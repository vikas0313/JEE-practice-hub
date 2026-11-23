/**
 * Supabase Remote Synchronization Engine
 * Automatically syncs profiles, responses, visits, and attempts between
 * browser local storage and Supabase PostgreSQL.
 */
import type { Profile, Response, Visit, Attempt } from './types';
import { getTable } from './db';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://jugtkxdlajirafrsdvxm.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_T3-ikl6xYeHvN-faZnyT2g_do7SjqxE';

const isVitest = typeof process !== 'undefined' && Boolean((process as any).env?.VITEST);

function getHeaders() {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=representation',
  };
}

/**
 * Pushes a single record to the remote Supabase table
 */
export async function syncPush(table: string, row: any): Promise<boolean> {
  if (isVitest || typeof window === 'undefined' || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return false;
  }

  // Whitelist tables to sync remotely
  const syncableTables = ['profiles', 'responses', 'visits', 'attempts', 'practiced_questions', 'alerts', 'settings'];
  if (!syncableTables.includes(table)) {
    return false;
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(row),
    });

    return res.ok;
  } catch (e) {
    console.debug(`[SupabaseSync] Push failed for table ${table}:`, e);
    return false;
  }
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
        // If remote has updated_at or is more recent, update local
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
}

let syncIntervalStarted = false;

/**
 * Initializes automatic background remote synchronization
 */
export function startSupabaseAutoSync(): void {
  if (isVitest || typeof window === 'undefined' || syncIntervalStarted) return;
  syncIntervalStarted = true;

  // Immediate pull
  syncAllFromRemote();

  // Periodic pull every 6 seconds
  setInterval(() => {
    syncAllFromRemote();
  }, 6000);
}
