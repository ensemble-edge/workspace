// @ensemble-edge/core — Smoke tests
import { describe, it, expect, vi } from 'vitest';
import { createWorkspace } from './create-workspace';
import type { WorkspaceConfig } from './types';

// Create a fresh mock for each test
function createMockD1(userCount: number = 1) {
  // Track if migrations have been "run"
  let migrationsRun = false;

  const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockImplementation((column?: string) => {
      // Return user count for bootstrap check
      if (sql.includes('COUNT(*)') && sql.includes('users')) {
        return Promise.resolve(column === 'count' ? userCount : { count: userCount });
      }
      // Return migration check - return result after migrations run
      if (sql.includes('_migrations') && sql.includes('SELECT')) {
        return Promise.resolve(migrationsRun ? { name: '001_initial' } : null);
      }
      return Promise.resolve(null);
    }),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({}),
  }));

  return {
    prepare: mockPrepare,
    exec: vi.fn().mockResolvedValue({}),
    batch: vi.fn().mockImplementation(() => {
      migrationsRun = true;
      return Promise.resolve([]);
    }),
  };
}

// Mock KV namespace
function createMockKV() {
  const store: Record<string, string> = {};
  return {
    get: vi.fn().mockImplementation((key: string) => Promise.resolve(store[key] || null)),
    put: vi.fn().mockImplementation((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    delete: vi.fn().mockImplementation((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
  };
}

// Create mock environment (with users existing - bootstrapped workspace)
function createMockEnv(userCount: number = 1) {
  return {
    DB: createMockD1(userCount) as unknown as D1Database,
    KV: createMockKV() as unknown as KVNamespace,
    R2: {} as R2Bucket,
    JWT_SECRET: 'test-secret',
  };
}

describe('@ensemble-edge/core', () => {
  describe('exports', () => {
    it('exports createWorkspace function', () => {
      expect(typeof createWorkspace).toBe('function');
    });
  });

  describe('createWorkspace', () => {
    const mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;

    it('returns a WorkspaceInstance with fetch handler', () => {
      const workspace = createWorkspace({
        workspace: {
          name: 'Test Workspace',
          slug: 'test',
        },
      });

      expect(workspace).toBeDefined();
      expect(typeof workspace.fetch).toBe('function');
    });

    it('responds to health check', async () => {
      const workspace = createWorkspace({
        workspace: {
          name: 'Acme Corp',
          slug: 'acme',
        },
        brand: {
          accent: '#3B82F6',
        },
      });

      const env = createMockEnv();
      const request = new Request('http://localhost/health');
      const response = await workspace.fetch(request, env, mockCtx);

      expect(response.status).toBe(200);

      const data = await response.json() as { status: string };
      expect(data.status).toBe('ok');
    });

    it('redirects to bootstrap when no users exist', async () => {
      const workspace = createWorkspace({
        workspace: {
          name: 'Fresh Workspace',
          slug: 'fresh',
        },
      });

      // Create env with zero users
      const env = createMockEnv(0);
      const request = new Request('http://localhost/');
      const response = await workspace.fetch(request, env, mockCtx);

      // Should redirect to bootstrap
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/_ensemble/bootstrap');
    });

    it('responds to root path with shell HTML when bootstrapped', async () => {
      const workspace = createWorkspace({
        workspace: {
          name: 'Acme Corp',
          slug: 'acme',
        },
      });

      // Create env with existing users (bootstrapped)
      const env = createMockEnv(1);
      const request = new Request('http://localhost/');
      const response = await workspace.fetch(request, env, mockCtx);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');

      const html = await response.text();
      expect(html).toContain('Acme Corp');
      // New shell loads via Preact SPA - check for loading state and shell script
      expect(html).toContain('id="app"');
      expect(html).toContain('/_ensemble/shell/shell.js');
    });

    it('serves brand CSS', async () => {
      const workspace = createWorkspace({
        workspace: {
          name: 'Test',
          slug: 'test',
        },
        brand: {
          accent: '#FF5500',
        },
      });

      const env = createMockEnv();
      const request = new Request('http://localhost/_ensemble/brand/css');
      const response = await workspace.fetch(request, env, mockCtx);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/css');

      const css = await response.text();
      expect(css).toContain('--color-accent: #FF5500');
    });

    it('serves brand theme JSON', async () => {
      const workspace = createWorkspace({
        workspace: {
          name: 'Test',
          slug: 'test',
        },
        brand: {
          accent: '#00FF00',
        },
      });

      const env = createMockEnv();
      const request = new Request('http://localhost/_ensemble/brand/theme');
      const response = await workspace.fetch(request, env, mockCtx);

      expect(response.status).toBe(200);

      const theme = await response.json() as { colors: { accent: string } };
      expect(theme.colors.accent).toBe('#00FF00');
    });
  });
});
