// @ensemble-edge/sdk — Smoke tests
import { describe, it, expect } from 'vitest';
import { useWorkspace } from './hooks/use-workspace';
import { useTheme } from './hooks/use-theme';

describe('@ensemble-edge/sdk', () => {
  describe('exports', () => {
    it('exports useWorkspace hook', () => {
      expect(typeof useWorkspace).toBe('function');
    });

    it('exports useTheme hook', () => {
      expect(typeof useTheme).toBe('function');
    });
  });

  describe('useWorkspace', () => {
    it('returns workspace context object', () => {
      const workspace = useWorkspace();

      expect(workspace).toBeDefined();
      expect(workspace).toHaveProperty('name');
      expect(workspace).toHaveProperty('slug');
    });
  });

  describe('useTheme', () => {
    it('returns theme context with setMode function', () => {
      const theme = useTheme();

      expect(theme).toBeDefined();
      expect(theme).toHaveProperty('primaryColor');
      expect(theme).toHaveProperty('mode');
      expect(typeof theme.setMode).toBe('function');
    });
  });
});
