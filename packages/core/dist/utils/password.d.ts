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
export declare function hashPassword(password: string): Promise<string>;
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
export declare function verifyPassword(password: string, storedHash: string): Promise<boolean>;
/**
 * Check if a password meets minimum requirements.
 *
 * @param password - Password to validate
 * @returns Object with valid boolean and optional error message
 */
export declare function validatePassword(password: string): {
    valid: boolean;
    error?: string;
};
//# sourceMappingURL=password.d.ts.map