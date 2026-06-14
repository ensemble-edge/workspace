import { describe, it, expect } from 'vitest';
import { resolveDispatch } from './app-dispatch';
import type { AppEntry } from './app-registry';

function app(over: Partial<AppEntry> & Pick<AppEntry, 'id' | 'tier' | 'mounts'>): AppEntry {
  return {
    name: over.id,
    icon: 'box',
    description: '',
    basePath: '/x',
    surfaceKind: 'operator',
    status: 'active',
    governable: true,
    settings: {},
    ...over,
  } as AppEntry;
}

describe('resolveDispatch', () => {
  const legal = app({
    id: 'core:legal',
    tier: 'core',
    mounts: [
      { host: '*', path: '/legal' },
      { host: 'curalisto.com', path: '/legal' },
    ],
  });
  const quiz = app({
    id: 'guest:quiz',
    tier: 'guest',
    mounts: [{ host: 'curalisto.com', path: '/quiz' }],
  });

  it('forwards a guest mount on its brand host', () => {
    const t = resolveDispatch([legal, quiz], 'curalisto.com', '/quiz/start');
    expect(t.kind).toBe('guest');
    if (t.kind === 'guest') {
      expect(t.guestId).toBe('quiz');
      expect(t.matchedPath).toBe('/quiz/start');
    }
  });

  it('passes through a core mount (served in-process, not proxied)', () => {
    const t = resolveDispatch([legal, quiz], 'curalisto.com', '/legal/privacy');
    expect(t.kind).toBe('passthrough');
  });

  it('ignores host:* mounts (workspace host served by normal routes)', () => {
    // Same path on the workspace host → no dispatch match → fallthrough.
    const t = resolveDispatch([legal, quiz], 'workspace.curalisto.com', '/legal/privacy');
    expect(t.kind).toBe('fallthrough');
  });

  it('falls through for unclaimed paths', () => {
    expect(resolveDispatch([legal, quiz], 'curalisto.com', '/nope').kind).toBe('fallthrough');
  });

  it('does not match on a path boundary (/quiz ≠ /quizzes)', () => {
    expect(resolveDispatch([quiz], 'curalisto.com', '/quizzes').kind).toBe('fallthrough');
    expect(resolveDispatch([quiz], 'curalisto.com', '/quiz').kind).toBe('guest'); // exact
  });

  it('skips disabled apps', () => {
    const off = app({ id: 'guest:quiz', tier: 'guest', status: 'inactive', mounts: [{ host: 'curalisto.com', path: '/quiz' }] });
    expect(resolveDispatch([off], 'curalisto.com', '/quiz').kind).toBe('fallthrough');
  });

  it('longest mount path wins (most specific)', () => {
    const broad = app({ id: 'guest:a', tier: 'guest', mounts: [{ host: 'h.com', path: '/app' }] });
    const deep = app({ id: 'guest:b', tier: 'guest', mounts: [{ host: 'h.com', path: '/app/admin' }] });
    const t = resolveDispatch([broad, deep], 'h.com', '/app/admin/x');
    expect(t.kind).toBe('guest');
    if (t.kind === 'guest') expect(t.guestId).toBe('b');
  });

  it('is case/port insensitive on host', () => {
    expect(resolveDispatch([quiz], 'Curalisto.com:443', '/quiz').kind).toBe('guest');
  });
});
