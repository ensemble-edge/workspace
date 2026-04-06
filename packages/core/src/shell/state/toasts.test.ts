/**
 * Toast State Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  toast,
  toasts,
  dismissToast,
  dismissAllToasts,
  dismissMostRecent,
} from './toasts';

describe('Toast Notifications', () => {
  beforeEach(() => {
    // Clear all toasts before each test
    dismissAllToasts();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('toast.success()', () => {
    it('adds a toast with type "success"', () => {
      toast.success('Settings saved');

      expect(toasts.value).toHaveLength(1);
      expect(toasts.value[0].type).toBe('success');
      expect(toasts.value[0].message).toBe('Settings saved');
    });

    it('supports description option', () => {
      toast.success('Invite sent', { description: 'They will receive an email' });

      expect(toasts.value[0].description).toBe('They will receive an email');
    });
  });

  describe('toast.error()', () => {
    it('adds a toast with type "error"', () => {
      toast.error('Invalid email');

      expect(toasts.value).toHaveLength(1);
      expect(toasts.value[0].type).toBe('error');
      expect(toasts.value[0].message).toBe('Invalid email');
    });
  });

  describe('toast.warning()', () => {
    it('adds a toast with type "warning"', () => {
      toast.warning('Low storage');

      expect(toasts.value).toHaveLength(1);
      expect(toasts.value[0].type).toBe('warning');
      expect(toasts.value[0].message).toBe('Low storage');
    });
  });

  describe('toast.info()', () => {
    it('adds a toast with type "info"', () => {
      toast.info('Processing...');

      expect(toasts.value).toHaveLength(1);
      expect(toasts.value[0].type).toBe('info');
      expect(toasts.value[0].message).toBe('Processing...');
    });
  });

  describe('toast()', () => {
    it('adds a toast with custom options', () => {
      const onClick = vi.fn();
      toast({
        type: 'error',
        message: 'Connection failed',
        action: { label: 'Retry', onClick },
        duration: 0,
      });

      expect(toasts.value).toHaveLength(1);
      expect(toasts.value[0].action?.label).toBe('Retry');
      expect(toasts.value[0].duration).toBe(0);
    });
  });

  describe('unique IDs', () => {
    it('generates unique IDs for each toast', () => {
      const id1 = toast.success('First');
      const id2 = toast.success('Second');
      const id3 = toast.error('Third');

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('returns the toast ID for programmatic dismissal', () => {
      const id = toast.info('Uploading...');

      expect(typeof id).toBe('string');
      expect(id).toMatch(/^toast-/);
    });
  });

  describe('toast.dismiss()', () => {
    it('removes a specific toast by ID', () => {
      const id1 = toast.success('First');
      const id2 = toast.success('Second');

      expect(toasts.value).toHaveLength(2);

      toast.dismiss(id1);

      expect(toasts.value).toHaveLength(1);
      expect(toasts.value[0].id).toBe(id2);
    });

    it('does nothing if ID does not exist', () => {
      toast.success('Test');

      expect(toasts.value).toHaveLength(1);

      toast.dismiss('non-existent-id');

      expect(toasts.value).toHaveLength(1);
    });
  });

  describe('toast.dismissAll()', () => {
    it('clears all toasts', () => {
      toast.success('First');
      toast.error('Second');
      toast.warning('Third');

      expect(toasts.value).toHaveLength(3);

      toast.dismissAll();

      expect(toasts.value).toHaveLength(0);
    });
  });

  describe('dismissMostRecent()', () => {
    it('removes the most recently added toast', () => {
      toast.success('First');
      toast.error('Second');
      const id3 = toast.warning('Third');

      expect(toasts.value).toHaveLength(3);
      expect(toasts.value[2].id).toBe(id3);

      dismissMostRecent();

      expect(toasts.value).toHaveLength(2);
      expect(toasts.value.find((t) => t.id === id3)).toBeUndefined();
    });

    it('does nothing if no toasts exist', () => {
      expect(toasts.value).toHaveLength(0);

      dismissMostRecent();

      expect(toasts.value).toHaveLength(0);
    });
  });

  describe('auto-dismiss', () => {
    it('removes toast after duration expires', () => {
      toast.success('Auto dismiss', { duration: 100 });

      expect(toasts.value).toHaveLength(1);

      vi.advanceTimersByTime(100);

      expect(toasts.value).toHaveLength(0);
    });

    it('uses default duration of 5000ms', () => {
      toast.success('Default duration');

      expect(toasts.value).toHaveLength(1);
      expect(toasts.value[0].duration).toBe(5000);

      vi.advanceTimersByTime(4999);
      expect(toasts.value).toHaveLength(1);

      vi.advanceTimersByTime(1);
      expect(toasts.value).toHaveLength(0);
    });

    it('does not auto-dismiss when duration is 0', () => {
      toast.info('Persistent', { duration: 0 });

      expect(toasts.value).toHaveLength(1);

      vi.advanceTimersByTime(60000); // 1 minute

      expect(toasts.value).toHaveLength(1);
    });
  });

  describe('max toasts limit', () => {
    it('limits to 5 visible toasts', () => {
      toast.success('Toast 1');
      toast.success('Toast 2');
      toast.success('Toast 3');
      toast.success('Toast 4');
      toast.success('Toast 5');
      toast.success('Toast 6');

      expect(toasts.value).toHaveLength(5);
    });

    it('removes oldest toast when limit exceeded', () => {
      const id1 = toast.success('Toast 1', { duration: 0 });
      toast.success('Toast 2', { duration: 0 });
      toast.success('Toast 3', { duration: 0 });
      toast.success('Toast 4', { duration: 0 });
      toast.success('Toast 5', { duration: 0 });
      const id6 = toast.success('Toast 6', { duration: 0 });

      expect(toasts.value).toHaveLength(5);
      expect(toasts.value.find((t) => t.id === id1)).toBeUndefined();
      expect(toasts.value.find((t) => t.id === id6)).toBeDefined();
    });
  });

  describe('dismissible option', () => {
    it('defaults to true', () => {
      toast.success('Dismissible by default');

      expect(toasts.value[0].dismissible).toBe(true);
    });

    it('can be set to false', () => {
      toast.success('Not dismissible', { dismissible: false });

      expect(toasts.value[0].dismissible).toBe(false);
    });
  });

  describe('action option', () => {
    it('supports action button configuration', () => {
      const onClick = vi.fn();
      toast.error('Failed', {
        action: { label: 'Retry', onClick },
      });

      expect(toasts.value[0].action).toBeDefined();
      expect(toasts.value[0].action?.label).toBe('Retry');
      expect(typeof toasts.value[0].action?.onClick).toBe('function');
    });
  });

  describe('createdAt timestamp', () => {
    it('records creation time for ordering', () => {
      const before = Date.now();
      toast.success('Test');
      const after = Date.now();

      expect(toasts.value[0].createdAt).toBeGreaterThanOrEqual(before);
      expect(toasts.value[0].createdAt).toBeLessThanOrEqual(after);
    });
  });
});
