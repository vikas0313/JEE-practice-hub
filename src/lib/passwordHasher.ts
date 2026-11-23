// ============================================================
// JEE Practice Hub — Cryptographic Password Hashing & Verification
// ============================================================
// Uses industry-standard PBKDF2 with SHA-256, 100,000 iterations,
// and cryptographically secure random 16-byte salts.
// Format: $pbkdf2-sha256$i=100000$<salt_hex>$<hash_hex>

const ITERATIONS = 100000;
const KEY_LEN_BYTES = 32;

function bufToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Asynchronously hashes a password using PBKDF2-SHA256 with 100,000 iterations.
 */
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(salt);
  } else {
    // Fallback for environments where crypto is under globalThis
    (globalThis as any).crypto.getRandomValues(salt);
  }

  const subtle = (globalThis as any).crypto?.subtle || (crypto as any)?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto subtle is required for password hashing');
  }

  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derived = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LEN_BYTES * 8
  );

  const saltHex = bufToHex(salt);
  const hashHex = bufToHex(derived);

  return `$pbkdf2-sha256$i=${ITERATIONS}$${saltHex}$${hashHex}`;
}

/**
 * Checks if a stored password string is already hashed or requires upgrade.
 */
export function isHashed(stored: string): boolean {
  return typeof stored === 'string' && stored.startsWith('$pbkdf2-sha256$');
}

/**
 * Verifies a candidate password against a stored hash or legacy plain text.
 * Returns { valid: boolean; needsMigration: boolean }
 */
export async function verifyPassword(
  candidate: string,
  stored: string
): Promise<{ valid: boolean; needsMigration: boolean }> {
  if (!stored || !candidate) {
    return { valid: false, needsMigration: false };
  }

  // Check if stored format is PBKDF2
  if (isHashed(stored)) {
    const parts = stored.split('$');
    // Format: ["", "pbkdf2-sha256", "i=100000", "<salt>", "<hash>"]
    if (parts.length !== 5) {
      return { valid: false, needsMigration: false };
    }

    const iterMatch = parts[2].match(/i=(\d+)/);
    const iterations = iterMatch ? parseInt(iterMatch[1], 10) : ITERATIONS;
    const salt = hexToBuf(parts[3]);
    const expectedHashHex = parts[4];

    const enc = new TextEncoder();
    const subtle = (globalThis as any).crypto?.subtle || (crypto as any)?.subtle;

    const keyMaterial = await subtle.importKey(
      'raw',
      enc.encode(candidate),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derived = await subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      KEY_LEN_BYTES * 8
    );

    const actualHashHex = bufToHex(derived);
    const valid = timingSafeEqual(actualHashHex, expectedHashHex);

    return { valid, needsMigration: false };
  }

  // Legacy plaintext match (constant-time compare)
  const valid = timingSafeEqual(candidate, stored);
  return { valid, needsMigration: valid };
}
