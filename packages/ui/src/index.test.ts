// @ensemble-edge/ui — Smoke tests
import { describe, it, expect } from 'vitest';
import {
  // Layout
  Container,
  Stack,
  // Input
  Button,
  Input,
  Select,
  // Display
  Card,
  Badge,
  Avatar,
  // Feedback
  Toast,
  Modal,
  Spinner,
} from './index';

describe('@ensemble-edge/ui', () => {
  describe('exports', () => {
    it('exports layout components', () => {
      expect(typeof Container).toBe('function');
      expect(typeof Stack).toBe('function');
    });

    it('exports input components', () => {
      expect(typeof Button).toBe('function');
      expect(typeof Input).toBe('function');
      expect(typeof Select).toBe('function');
    });

    it('exports display components', () => {
      expect(typeof Card).toBe('function');
      expect(typeof Badge).toBe('function');
      expect(typeof Avatar).toBe('function');
    });

    it('exports feedback components', () => {
      expect(typeof Toast).toBe('function');
      expect(typeof Modal).toBe('function');
      expect(typeof Spinner).toBe('function');
    });
  });
});
