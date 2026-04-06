// @ensemble-edge/guest-cloudflare — Smoke tests
import { describe, it, expect } from 'vitest';
import { createGuestWorker } from './adapter';

describe('@ensemble-edge/guest-cloudflare', () => {
  describe('exports', () => {
    it('exports createGuestWorker function', () => {
      expect(typeof createGuestWorker).toBe('function');
    });
  });

  describe('createGuestWorker', () => {
    const mockApp = {
      manifest: {
        id: 'test-app',
        name: 'Test App',
        version: '1.0.0',
        category: 'tool' as const,
        permissions: [],
        entry: '/',
      },
      init: undefined,
      activate: undefined,
      deactivate: undefined,
    };

    it('returns a worker with fetch handler', () => {
      const worker = createGuestWorker(mockApp);

      expect(worker).toBeDefined();
      expect(typeof worker.fetch).toBe('function');
    });

    it('serves manifest at /.well-known/ensemble-manifest.json', async () => {
      const worker = createGuestWorker(mockApp);

      const request = new Request('http://localhost/.well-known/ensemble-manifest.json');
      const response = await worker.fetch(request, {}, {} as ExecutionContext);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      const manifest = await response.json();
      expect(manifest).toEqual(mockApp.manifest);
    });

    it('returns placeholder for other routes', async () => {
      const worker = createGuestWorker(mockApp);

      const request = new Request('http://localhost/app');
      const response = await worker.fetch(request, {}, {} as ExecutionContext);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
    });
  });
});
