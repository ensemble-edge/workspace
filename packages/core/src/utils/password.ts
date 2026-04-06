/**
 * Password Hashing Utilities
 *
 * Uses PBKDF2 via Web Crypto API (native to Cloudflare Workers).
 * No external dependencies required.
 *
 * Hash format: $pbkdf2-sha256$iterations$salt$hash
 * All values are base64url encoded.
 */

/**
 * PBKDF2 configuration.
 * These values balance security and performance for Cloudflare Workers.
 */
const PBKDF2_ITERATIONS = 100000; // OWASP recommended minimum
const SALT_LENGTH = 16; // 128 bits
const HASH_LENGTH = 32; // 256 bits
const ALGORITHM = 'PBKDF2';
const HASH_ALGORITHM = 'SHA-256';

/**
 * Generate a cryptographically secure random salt.
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Convert Uint8Array to base64url string.
 */
function toBase64Url(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert base64url string to Uint8Array.
 */
function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Derive a key from password and salt using PBKDF2.
 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  // Import password as a key
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    ALGORITHM,
    false,
    ['deriveBits']
  );

  // Derive bits using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: ALGORITHM,
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: HASH_ALGORITHM,
    },
    passwordKey,
    HASH_LENGTH * 8 // bits
  );

  return new Uint8Array(derivedBits);
}

/**
 * Hash a password for storage.
 *
 * @param password - Plain text password
 * @returns Hash string in format: $pbkdf2-sha256$iterations$salt$hash
 *
 * @example
 * ```ts
 * const hash = await hashPassword('mysecretpassword');
 * // Store hash in database
 * await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
 *   .bind(hash, userId)
 *   .run();
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await deriveKey(password, salt, PBKDF2_ITERATIONS);

  // Format: $pbkdf2-sha256$iterations$salt$hash
  return [
    '$pbkdf2-sha256',
    PBKDF2_ITERATIONS.toString(),
    toBase64Url(salt),
    toBase64Url(hash),
  ].join('$');
}

/**
 * Verify a password against a stored hash.
 *
 * @param password - Plain text password to verify
 * @param storedHash - Hash string from database
 * @returns true if password matches, false otherwise
 *
 * @example
 * ```ts
 * const user = await db.prepare('SELECT * FROM users WHERE email = ?')
 *   .bind(email)
 *   .first();
 *
 * if (!user || !await verifyPassword(password, user.password_hash)) {
 *   return c.json({ error: 'Invalid credentials' }, 401);
 * }
 * ```
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    // Parse the stored hash
    const parts = storedHash.split('$');
    if (parts.length !== 5 || parts[1] !== 'pbkdf2-sha256') {
      return false;
    }

    const iterations = parseInt(parts[2], 10);
    const salt = fromBase64Url(parts[3]);
    const expectedHash = fromBase64Url(parts[4]);

    // Derive hash from provided password
    const actualHash = await deriveKey(password, salt, iterations);

    // Constant-time comparison to prevent timing attacks
    return timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}

/**
 * Constant-time comparison of two Uint8Arrays.
 * Prevents timing attacks by always comparing all bytes.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

/**
 * Check if a password meets minimum requirements.
 *
 * @param password - Password to validate
 * @returns Object with valid boolean and optional error message
 */
export function validatePassword(password: string): {
  valid: boolean;
  error?: string;
} {
  if (!password || password.length < 8) {
    return {
      valid: false,
      error: 'Please use at least 8 characters',
    };
  }

  // No complexity rules per the spec decision
  return { valid: true };
}
