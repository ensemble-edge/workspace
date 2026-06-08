import { describe, it, expect } from 'vitest';
import {
  substituteLegalPlaceholders,
  formatLegalDate,
  type LegalPlaceholderValues,
} from './legal-placeholders';

const FULL: LegalPlaceholderValues = {
  companyName: 'Curalisto',
  businessAddress: '123 Main St, Austin, TX 78701',
  supportEmail: 'hello@curalisto.com',
  supportPhone: '+1 555-555-5555',
  noticesEmail: 'legal@curalisto.com',
};

const EMPTY: LegalPlaceholderValues = {
  companyName: '',
  businessAddress: '',
  supportEmail: '',
  supportPhone: '',
  noticesEmail: '',
};

describe('substituteLegalPlaceholders', () => {
  it('substitutes every token from full values', () => {
    const body =
      '[COMPANY NAME] | [EMAIL] | [PHONE] | [LEGAL BUSINESS ADDRESS] | [LEGAL NOTICES EMAIL]';
    const out = substituteLegalPlaceholders(body, FULL, '2026-06-07', 'en');
    expect(out).toBe(
      'Curalisto | hello@curalisto.com | +1 555-555-5555 | 123 Main St, Austin, TX 78701 | legal@curalisto.com',
    );
  });

  it('erases tokens whose value is empty (no brackets left behind)', () => {
    const body = 'Call us at [PHONE] or write [EMAIL].';
    const out = substituteLegalPlaceholders(body, EMPTY, '2026-06-07', 'en');
    expect(out).toBe('Call us at  or write .');
    expect(out).not.toContain('[');
  });

  it('replaces [COMPANY NAME CONTACT] before [COMPANY NAME] so the longer token wins', () => {
    const body = '[COMPANY NAME CONTACT]';
    const out = substituteLegalPlaceholders(body, FULL, '2026-06-07', 'en');
    expect(out).toBe('Curalisto (hello@curalisto.com)');
  });

  it('composite falls back to whichever part is present', () => {
    const nameOnly = { ...EMPTY, companyName: 'Acme' };
    expect(substituteLegalPlaceholders('[COMPANY NAME CONTACT]', nameOnly, '', 'en')).toBe('Acme');
    const emailOnly = { ...EMPTY, supportEmail: 'a@b.com' };
    expect(substituteLegalPlaceholders('[COMPANY NAME CONTACT]', emailOnly, '', 'en')).toBe('a@b.com');
    expect(substituteLegalPlaceholders('[COMPANY NAME CONTACT]', EMPTY, '', 'en')).toBe('');
  });

  it('does not let [COMPANY NAME] clobber a [COMPANY NAME CONTACT] occurrence', () => {
    const body = '[COMPANY NAME] then [COMPANY NAME CONTACT]';
    const out = substituteLegalPlaceholders(body, FULL, '', 'en');
    expect(out).toBe('Curalisto then Curalisto (hello@curalisto.com)');
  });

  it('formats [DATE] in the render locale', () => {
    const body = 'Last updated: [DATE]';
    expect(substituteLegalPlaceholders(body, FULL, '2026-06-07', 'en')).toBe(
      'Last updated: June 7, 2026',
    );
    // Spanish month name, lowercased per es conventions.
    const es = substituteLegalPlaceholders(body, FULL, '2026-06-07', 'es');
    expect(es.toLowerCase()).toContain('junio');
    expect(es).toContain('2026');
  });

  it('[DATE] is erased when the doc has no ISO date', () => {
    expect(substituteLegalPlaceholders('x[DATE]y', FULL, '', 'en')).toBe('xy');
  });
});

describe('formatLegalDate', () => {
  it('does not shift the calendar day in negative-UTC locales', () => {
    // Anchored at noon UTC, so 2026-01-01 stays Jan 1 even when
    // formatted for a locale; the UTC timeZone guarantees it.
    expect(formatLegalDate('2026-01-01', 'en-US')).toBe('January 1, 2026');
  });

  it('falls back gracefully on an unknown locale string', () => {
    // Garbage locale → en-US fallback, never throws.
    const out = formatLegalDate('2026-06-07', 'not-a-locale!!');
    expect(out).toContain('2026');
  });
});
