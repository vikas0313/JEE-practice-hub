// ============================================================
// JEE Practice Hub — Module E12: Sync Idempotency & Resilience
// ============================================================

import { v4 as uuid } from 'uuid';
import type {
  SyncIdempotencyKey,
  ClientEventSequence,
  DeadLetterJob,
  CircuitBreakerStatus,
} from './types';
import {
  getSettings,
  getIdempotencyKey,
  saveIdempotencyKey,
  getClientEventSequences,
  insertClientEventSequence,
  getDeadLetterJobs,
  insertDeadLetterJob,
  updateDeadLetterJob,
  insertMonitorNotice,
} from './db';

/**
 * Deterministic hash of any JSON-serializable object.
 */
export function computeDeterministicHash(data: unknown): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data) ?? '';
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ('0000000' + (hash >>> 0).toString(16)).slice(-8);
}

/**
 * Processes a sync action idempotently.
 * If the key has already been processed, returns the cached result without re-executing handler.
 */
export async function processIdempotentSync<T>(options: {
  key: string;
  studentId: string;
  attemptId?: string | null;
  payload: any;
  handler: () => T | Promise<T>;
}): Promise<{ result: T; wasCached: boolean; hash: string }> {
  const settings = getSettings();
  const flagEnabled = settings.flag_e12_integrity_resilience ?? false;
  const hash = computeDeterministicHash(options.payload);

  if (!flagEnabled) {
    // Flag OFF: direct bypass
    const res = await options.handler();
    return { result: res, wasCached: false, hash };
  }

  // Check if idempotency key exists
  const existing = getIdempotencyKey(options.key);
  if (existing) {
    return {
      result: existing.payload as T,
      wasCached: true,
      hash: existing.response_hash,
    };
  }

  // Execute handler
  const freshResult = await options.handler();

  // Persist key record
  const record: SyncIdempotencyKey = {
    key: options.key,
    student_id: options.studentId,
    attempt_id: options.attemptId ?? null,
    processed_at: new Date().toISOString(),
    response_hash: hash,
    payload: freshResult,
  };
  saveIdempotencyKey(record);

  return {
    result: freshResult,
    wasCached: false,
    hash,
  };
}

/**
 * Records an event in an attempt's client sequence and checks for sequence gaps.
 */
export function recordEventSequenceWithGapDetection(
  attemptId: string,
  sequenceNumber: number,
  eventType: string,
  payload: any
): {
  event: ClientEventSequence;
  hasGap: boolean;
  missingSequences: number[];
} {
  const existing = getClientEventSequences(attemptId);
  const maxSeq = existing.length > 0 ? Math.max(...existing.map((e) => e.sequence_number)) : 0;

  const missingSequences: number[] = [];
  let hasGap = false;

  if (sequenceNumber > maxSeq + 1) {
    hasGap = true;
    for (let i = maxSeq + 1; i < sequenceNumber; i++) {
      missingSequences.push(i);
    }

    // Monitor notification if resilience flag is enabled
    const settings = getSettings();
    if (settings.flag_e12_integrity_resilience) {
      insertMonitorNotice({
        attempt_id: attemptId,
        student_id: null,
        message: `Sequence gap detected in attempt ${attemptId.slice(0, 8)}: expected seq ${maxSeq + 1}, received seq ${sequenceNumber}. Missing [${missingSequences.join(', ')}]`,
        reason: 'sequence_gap',
      });
    }
  }

  const newEvent: ClientEventSequence = {
    id: uuid(),
    attempt_id: attemptId,
    sequence_number: sequenceNumber,
    event_type: eventType,
    payload,
    created_at: new Date().toISOString(),
  };

  const saved = insertClientEventSequence(newEvent);

  return {
    event: saved,
    hasGap,
    missingSequences,
  };
}

/**
 * Executes an async task with retry and backoff.
 * On exhaustion of retries, isolates the payload into dead_letter_jobs.
 */
export async function executeWithRetryAndDeadLetter<T>(options: {
  jobType: string;
  payload: any;
  maxRetries?: number;
  initialDelayMs?: number;
  task: () => Promise<T>;
}): Promise<{ success: boolean; result?: T; deadLetterId?: string; error?: string }> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelay = options.initialDelayMs ?? 10; // short for testing/fast recovery
  let lastError: Error | unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await options.task();
      return { success: true, result: res };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // All retries failed: isolate into dead_letter_jobs
  const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
  const deadJob: DeadLetterJob = {
    id: uuid(),
    job_type: options.jobType,
    payload: options.payload,
    error_message: errorMsg,
    attempts_count: maxRetries + 1,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  insertDeadLetterJob(deadJob);

  return {
    success: false,
    deadLetterId: deadJob.id,
    error: errorMsg,
  };
}

/**
 * Retries a dead-letter job with a given recovery handler.
 */
export async function retryDeadLetterJob<T>(
  jobId: string,
  handler: (payload: any) => Promise<T>
): Promise<{ success: boolean; result?: T; error?: string }> {
  const jobs = getDeadLetterJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) {
    return { success: false, error: 'Job not found' };
  }

  try {
    const res = await handler(job.payload);
    updateDeadLetterJob(jobId, {
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      attempts_count: job.attempts_count + 1,
    });
    return { success: true, result: res };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    updateDeadLetterJob(jobId, {
      attempts_count: job.attempts_count + 1,
      error_message: errorMsg,
    });
    return { success: false, error: errorMsg };
  }
}

/**
 * Marks a dead-letter job as discarded.
 */
export function discardDeadLetterJob(jobId: string): boolean {
  const updated = updateDeadLetterJob(jobId, {
    status: 'discarded',
    resolved_at: new Date().toISOString(),
  });
  return !!updated;
}

/**
 * Lightweight Circuit Breaker for protecting external services from cascade failures.
 */
export class CircuitBreaker {
  private status: CircuitBreakerStatus = 'CLOSED';
  private consecutiveFailures = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private readonly failureThreshold: number;
  private readonly cooldownPeriodMs: number;

  constructor(options?: { failureThreshold?: number; cooldownPeriodMs?: number }) {
    this.failureThreshold = options?.failureThreshold ?? 3;
    this.cooldownPeriodMs = options?.cooldownPeriodMs ?? 1000;
  }

  public getStatus(): CircuitBreakerStatus {
    if (this.status === 'OPEN' && this.lastFailureTime) {
      if (Date.now() - this.lastFailureTime >= this.cooldownPeriodMs) {
        this.status = 'HALF_OPEN';
      }
    }
    return this.status;
  }

  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentStatus = this.getStatus();

    if (currentStatus === 'OPEN') {
      throw new Error('CircuitBreaker: OPEN (request fast-failed)');
    }

    try {
      const result = await fn();
      // Success: reset failures and close breaker
      this.consecutiveFailures = 0;
      this.status = 'CLOSED';
      this.lastSuccessTime = Date.now();
      return result;
    } catch (err) {
      this.consecutiveFailures++;
      this.lastFailureTime = Date.now();

      if (this.status === 'HALF_OPEN' || this.consecutiveFailures >= this.failureThreshold) {
        this.status = 'OPEN';
      }

      throw err;
    }
  }

  public reset(): void {
    this.status = 'CLOSED';
    this.consecutiveFailures = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
  }
}

