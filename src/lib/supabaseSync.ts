/**
 * Supabase Remote Synchronization Engine with Offline Resilient Queue
 * Automatically syncs profiles, responses, visits, and attempts between
 * browser local storage and Supabase PostgreSQL.
 */
import type { Profile, Response, Visit, Attempt } from './types';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://jugtkxdlajirafrsdvxm.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_T3-ikl6xYeHvN-faZnyT2g_do7SjqxE';

const isVitest = typeof process !== 'undefined' && Boolean((process as any).env?.VITEST);
const QUEUE_KEY = 'jph_offline_sync_queue';

export interface QueueItem {
  id: string;
  table: string;
  row: any;
  timestamp: number;
  attempts: number;
}

function getHeaders() {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=representation',
  };
}

export function getOfflineQueue(): QueueItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setOfflineQueue(queue: QueueItem[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export function enqueueOfflineItem(table: string, row: any): void {
  if (typeof localStorage === 'undefined') return;
  const queue = getOfflineQueue();
  // Avoid duplicate queueing for the same record id and table
  const existingIdx = queue.findIndex(q => q.table === table && q.row?.id === row?.id);
  const item: QueueItem = {
    id: `${table}_${row?.id || Date.now()}`,
    table,
    row,
    timestamp: Date.now(),
    attempts: 0,
  };
  if (existingIdx !== -1) {
    queue[existingIdx] = item;
  } else {
    queue.push(item);
  }
  setOfflineQueue(queue);
}

/**
 * Pushes a single record to the remote Supabase table with offline queue fallback
 */
export async function syncPush(table: string, row: any): Promise<boolean> {
  if (isVitest || typeof window === 'undefined' || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return false;
  }

  const syncableTables = ['profiles', 'responses', 'visits', 'attempts', 'practiced_questions', 'alerts', 'settings'];
  if (!syncableTables.includes(table)) {
    return false;
  }

  // If currently offline, enqueue immediately
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineItem(table, row);
    return false;
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(row),
    });

    if (!res.ok) {
      enqueueOfflineItem(table, row);
      return false;
    }

    return true;
  } catch (e) {
    enqueueOfflineItem(table, row);
    console.debug(`[SupabaseSync] Push failed for table ${table}, queued offline:`, e);
    return false;
  }
}

/**
 * Flushes all pending items in the offline queue
 */
export async function flushOfflineQueue(): Promise<{ sent: number; remaining: number }> {
  if (isVitest || typeof window === 'undefined' || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { sent: 0, remaining: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) return { sent: 0, remaining: 0 };

  const remaining: QueueItem[] = [];
  let sent = 0;

  for (const item of queue) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/${item.table}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(item.row),
      });
      if (res.ok) {
        sent++;
      } else {
        item.attempts += 1;
        remaining.push(item);
      }
    } catch {
      item.attempts += 1;
      remaining.push(item);
    }
  }

  setOfflineQueue(remaining);
  return { sent, remaining: remaining.length };
}

/**
 * Pulls remote records from Supabase and merges them into localStorage
 */
export async function syncPullTable<T extends { id: string }>(table: string): Promise<boolean> {
  if (isVitest || typeof window === 'undefined' || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return false;
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      return false;
    }

    const remoteRows: T[] = await res.json();
    if (!Array.isArray(remoteRows)) return false;

    // Merge into local storage table
    const localRaw = localStorage.getItem(`jph_${table}`);
    const localRows: T[] = localRaw ? JSON.parse(localRaw) : [];

    let modified = false;
    const localMap = new Map<string, T>(localRows.map(r => [r.id, r]));

    for (const remote of remoteRows) {
      if (!localMap.has(remote.id)) {
        localRows.push(remote);
        localMap.set(remote.id, remote);
        modified = true;
      } else {
        const current = localMap.get(remote.id);
        const remoteUpdated = (remote as any).updated_at;
        const currentUpdated = (current as any)?.updated_at;
        if (remoteUpdated && (!currentUpdated || new Date(remoteUpdated) > new Date(currentUpdated))) {
          const idx = localRows.findIndex(r => r.id === remote.id);
          if (idx !== -1) {
            localRows[idx] = { ...current, ...remote };
            modified = true;
          }
        }
      }
    }

    if (modified) {
      localStorage.setItem(`jph_${table}`, JSON.stringify(localRows));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('active-student-changed'));
    }

    return true;
  } catch (e) {
    console.debug(`[SupabaseSync] Pull failed for table ${table}:`, e);
    return false;
  }
}

/**
 * Perform a full pull across all user & activity tables
 */
export async function syncAllFromRemote(): Promise<void> {
  if (isVitest || typeof window === 'undefined') return;
  await Promise.allSettled([
    syncPullTable<Profile>('profiles'),
    syncPullTable<Response>('responses'),
    syncPullTable<Visit>('visits'),
    syncPullTable<Attempt>('attempts'),
  ]);
  // Flush offline queue on sync check
  await flushOfflineQueue();
}

let syncIntervalStarted = false;

/**
 * Initializes automatic background remote synchronization
 */
export function startSupabaseAutoSync(): void {
  if (isVitest || typeof window === 'undefined' || syncIntervalStarted) return;
  syncIntervalStarted = true;

  // Initial pull and flush
  syncAllFromRemote();

  // Listen for online reconnect event to immediately flush pending offline queue
  window.addEventListener('online', () => {
    flushOfflineQueue();
    syncAllFromRemote();
  });

  // Periodic pull and queue flush every 6 seconds
  setInterval(() => {
    syncAllFromRemote();
  }, 6000);
}
