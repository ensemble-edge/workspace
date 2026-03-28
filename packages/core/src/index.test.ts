// @ensemble-edge/core — Smoke tests
import { describe, it, expect } from 'vitest';
import { createWorkspace } from './create-workspace';
import type { WorkspaceConfig, WorkspaceInstance } from './create-workspace';

describe('@ensemble-edge/core', () => {
  describe('exports', () => {
    it('exports createWorkspace function', () => {
      expect(typeof createWorkspace).toBe('function');
    });
  });

  describe('createWorkspace', () => {
    it('returns a WorkspaceInstance with fetch handler', () => {
      const workspace = createWorkspace({
        name: 'Test Workspace',
        slug: 'test',
      });

      expect(workspace).toBeDefined();
      expect(typeof workspace.fetch).toBe('function');
    });

    it('responds to root path with workspace info', async () => {
      const workspace = createWorkspace({
        name: 'Acme Corp',
        slug: 'acme',
        theme: {
          primaryColor: '#3B82F6',
        },
      });

      const request = new Request('http://localhost/');
      const response = await workspace.fetch(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({
        workspace: 'Acme Corp',
        slug: 'acme',
        version: '0.0.1',
      });
    });
  });
});
