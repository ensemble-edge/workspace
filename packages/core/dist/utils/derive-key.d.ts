/**
 * Key derivation for workspace cryptographic purposes.
 *
 * We reuse env.JWT_SECRET as the single source of entropy. From it we
 * derive independent purpose-specific keys via HKDF-SHA256. JWT signing
 * uses the raw secret directly (jose's existing HMAC flow); credentials
 * and payload encryption use derived keys with distinct `info` labels.
 *
 * Adding a new purpose: add a label to PurposeInfo and use it. Bumping
 * `v1` → `v2` would mean re-encrypting all stored ciphertext under the
 * new derivation; the JWT signing path is unaffected since it doesn't
 * derive.
 *
 * Why this is safe (the audit answer): HKDF with distinct info strings
 * produces uniformly-independent keys from the same input keying
 * material. Knowing one derived key reveals nothing about another.
 * The standard reference: RFC 5869 §3.
 */
export type PurposeInfo = 'ensemble:credentials:v1' | 'ensemble:payload:v1';
/**
 * Derive a 256-bit AES-GCM key from the workspace's JWT_SECRET for a
 * specific purpose. Cached per purpose since the inputs don't change
 * during a request.
 */
export declare function deriveKey(rootSecret: string, info: PurposeInfo): Promise<CryptoKey>;
/**
 * Encrypt a UTF-8 string under the derived key for the given purpose.
 * Returns base64(iv || ciphertext). The IV is 12 bytes random per call
 * (NIST-recommended for GCM). The auth tag is included in the
 * ciphertext (Web Crypto's AES-GCM emits ct || tag).
 */
export declare function encryptString(rootSecret: string, purpose: PurposeInfo, plaintext: string): Promise<string>;
/**
 * Inverse of encryptString. Throws on tampered ciphertext (GCM tag
 * mismatch surfaces as a DOMException — callers should treat as a hard
 * error: the value is corrupt or the secret rotated).
 */
export declare function decryptString(rootSecret: string, purpose: PurposeInfo, envelopeB64: string): Promise<string>;
//# sourceMappingURL=derive-key.d.ts.map