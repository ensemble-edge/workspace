import { describe, it, expect } from 'vitest';
import { validateBrandDomain, absoluteUrl, originForRequest } from './brand-domain';

// Minimal Hono-context stub: just what originForRequest reads.
function ctxStub(opts: { url: string; brand?: { domain: string; proto: string } | null }) {
  return {
    get: (k: string) => (k === 'brandDomain' ? (opts.brand ?? null) : undefined),
    req: { url: opts.url },
  } as never;
}

describe('validateBrandDomain', () => {
  it('accepts a plain FQDN', () => {
    expect(validateBrandDomain('curalisto.com')).toBeNull();
    expect(validateBrandDomain('legal.curalisto.com')).toBeNull();
  });
  it('rejects protocol, path, port, uppercase, junk', () => {
    expect(validateBrandDomain('https://curalisto.com')).toMatch(/http/);
    expect(validateBrandDomain('curalisto.com/legal')).toMatch(/path/);
    expect(validateBrandDomain('curalisto.com:8787')).toMatch(/port/);
    expect(validateBrandDomain('Curalisto.com')).toMatch(/lowercase/);
    expect(validateBrandDomain('not a domain')).toBeTruthy();
    expect(validateBrandDomain('')).toBeTruthy();
    expect(validateBrandDomain('localhost')).toBeTruthy(); // no TLD
  });
});

describe('originForRequest / absoluteUrl', () => {
  it('uses the brand domain when set', () => {
    const c = ctxStub({ url: 'https://workspace.curalisto.com/legal/x', brand: { domain: 'curalisto.com', proto: 'https' } });
    expect(originForRequest(c)).toBe('https://curalisto.com');
    expect(absoluteUrl(c, '/legal/privacy')).toBe('https://curalisto.com/legal/privacy');
  });
  it('falls back to the request host when no brand domain', () => {
    const c = ctxStub({ url: 'https://workspace.curalisto.com/legal/x', brand: null });
    expect(originForRequest(c)).toBe('https://workspace.curalisto.com');
    expect(absoluteUrl(c, '/legal/privacy')).toBe('https://workspace.curalisto.com/legal/privacy');
  });
});
