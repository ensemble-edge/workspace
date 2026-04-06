// @ensemble-edge/guest — Smoke tests
import { describe, it, expect } from 'vitest';
import { defineGuestApp } from './define-guest-app';
import type { GuestAppConfig, GuestAppManifest } from './types';

describe('@ensemble-edge/guest', () => {
  describe('exports', () => {
    it('exports defineGuestApp function', () => {
      expect(typeof defineGuestApp).toBe('function');
    });
  });

  describe('defineGuestApp', () => {
    it('returns an app object with manifest', () => {
      const app = defineGuestApp({
        manifest: {
          id: 'test-app',
          name: 'Test App',
          version: '1.0.0',
          category: 'tool',
          permissions: ['read:user'],
          entry: '/app',
        },
      });

      expect(app).toBeDefined();
      expect(app.manifest).toEqual({
        id: 'test-app',
        name: 'Test App',
        version: '1.0.0',
        category: 'tool',
        permissions: ['read:user'],
        entry: '/app',
      });
    });

    it('supports lifecycle callbacks', () => {
      const callbacks = {
        onInit: () => {},
        onActivate: () => {},
        onDeactivate: () => {},
      };

      const app = defineGuestApp({
        manifest: {
          id: 'lifecycle-app',
          name: 'Lifecycle App',
          version: '1.0.0',
          category: 'tool',
          permissions: [],
          entry: '/',
        },
        ...callbacks,
      });

      expect(app.init).toBe(callbacks.onInit);
      expect(app.activate).toBe(callbacks.onActivate);
      expect(app.deactivate).toBe(callbacks.onDeactivate);
    });
  });
});
