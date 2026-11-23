/**
 * Monotonic Exam Countdown Timer & Offline Answer Sync Queue
 * Protects against OS clock jumps, NTP sync shifts, and network disconnections.
 */

export interface MonotonicTimerConfig {
  initialSecondsRemaining: number;
  onTick?: (secondsLeft: number) => void;
  onExpire: () => void;
  tickIntervalMs?: number;
}

/**
 * Countdown timer backed strictly by performance.now()
 * Unaffected by OS system clock changes, day jumps, or manual time adjustment.
 */
export class MonotonicCountdownTimer {
  private startPerfMs: number;
  private totalDurationMs: number;
  private timerId: any = null;
  private isRunning: boolean = false;
  private onTick?: (secondsLeft: number) => void;
  private onExpire: () => void;
  private tickIntervalMs: number;

  constructor(config: MonotonicTimerConfig) {
    this.totalDurationMs = Math.max(0, config.initialSecondsRemaining * 1000);
    this.startPerfMs = performance.now();
    this.onTick = config.onTick;
    this.onExpire = config.onExpire;
    this.tickIntervalMs = config.tickIntervalMs || 1000;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startPerfMs = performance.now();

    this.timerId = setInterval(() => {
      const remainingSec = this.getRemainingSeconds();

      if (this.onTick) {
        this.onTick(remainingSec);
      }

      if (remainingSec <= 0) {
        this.stop();
        this.onExpire();
      }
    }, this.tickIntervalMs);
  }

  public stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
  }

  /**
   * Computes remaining seconds using monotonic elapsed time.
   * Irrespective of Date.now() or system time modifications.
   */
  public getRemainingSeconds(currentPerfNow: number = performance.now()): number {
    const elapsedMs = currentPerfNow - this.startPerfMs;
    const remainingMs = Math.max(0, this.totalDurationMs - elapsedMs);
    return Math.ceil(remainingMs / 1000);
  }

  public isActive(): boolean {
    return this.isRunning;
  }
}

export interface QueuedAnswerItem {
  questionId: string;
  answer: string;
  timestamp: string;
}

/**
 * Manages client-side queue of answers recorded while offline
 */
export class OfflineAnswerSyncManager {
  private queue: QueuedAnswerItem[] = [];

  public enqueue(questionId: string, answer: string, timestamp: string = new Date().toISOString()): void {
    // Replace if question already exists in queue to keep latest answer
    const existingIdx = this.queue.findIndex((q) => q.questionId === questionId);
    if (existingIdx >= 0) {
      this.queue[existingIdx] = { questionId, answer, timestamp };
    } else {
      this.queue.push({ questionId, answer, timestamp });
    }
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getPendingItems(): QueuedAnswerItem[] {
    return [...this.queue];
  }

  public clear(): void {
    this.queue = [];
  }

  /**
   * Flushes queue through sync function
   */
  public async flush(
    syncFn: (items: QueuedAnswerItem[]) => Promise<{ acceptedCount: number }>
  ): Promise<{ syncedCount: number; error?: string }> {
    if (this.queue.length === 0) {
      return { syncedCount: 0 };
    }

    try {
      const itemsToSync = [...this.queue];
      const result = await syncFn(itemsToSync);
      // Remove synced items from queue
      this.queue = this.queue.filter(
        (item) => !itemsToSync.some((synced) => synced.questionId === item.questionId)
      );
      return { syncedCount: result.acceptedCount };
    } catch (err) {
      return { syncedCount: 0, error: (err as Error).message };
    }
  }
}

