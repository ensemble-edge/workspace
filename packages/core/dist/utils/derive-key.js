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
const encoder = new TextEncoder();
/**
 * Derive a 256-bit AES-GCM key from the workspace's JWT_SECRET for a
 * specific purpose. Cached per purpose since the inputs don't change
 * during a request.
 */
export async function deriveKey(rootSecret, info) {
    const baseKey = await crypto.subtle.importKey('raw', encoder.encode(rootSecret), 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey({
        name: 'HKDF',
        hash: 'SHA-256',
        // Salt is constant across deployments; the info string is what
        // separates purposes. A per-deployment salt would mean
        // re-encrypting on key rotation; not worth the complexity yet.
        salt: encoder.encode('ensemble-v1'),
        info: encoder.encode(info),
    }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
/**
 * Encrypt a UTF-8 string under the derived key for the given purpose.
 * Returns base64(iv || ciphertext). The IV is 12 bytes random per call
 * (NIST-recommended for GCM). The auth tag is included in the
 * ciphertext (Web Crypto's AES-GCM emits ct || tag).
 */
export async function encryptString(rootSecret, purpose, plaintext) {
    const key = await deriveKey(rootSecret, purpose);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext)));
    const out = new Uint8Array(iv.length + ct.length);
    out.set(iv, 0);
    out.set(ct, iv.length);
    return bytesToBase64(out);
}
/**
 * Inverse of encryptString. Throws on tampered ciphertext (GCM tag
 * mismatch surfaces as a DOMException — callers should treat as a hard
 * error: the value is corrupt or the secret rotated).
 */
export async function decryptString(rootSecret, purpose, envelopeB64) {
    const key = await deriveKey(rootSecret, purpose);
    const envelope = base64ToBytes(envelopeB64);
    if (envelope.length < 13) {
        throw new Error('Invalid ciphertext: too short');
    }
    const iv = envelope.slice(0, 12);
    const ct = envelope.slice(12);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(pt);
}
function bytesToBase64(bytes) {
    let bin = '';
    for (const b of bytes)
        bin += String.fromCharCode(b);
    return btoa(bin);
}
function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        out[i] = bin.charCodeAt(i);
    return out;
}
//# sourceMappingURL=derive-key.js.map