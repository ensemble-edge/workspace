// @ensemble-edge/cli — Smoke tests
import { describe, it, expect } from 'vitest';
import { Command } from 'commander';

describe('@ensemble-edge/cli', () => {
  describe('commander integration', () => {
    it('can create a Command instance', () => {
      const program = new Command();
      program.name('ensemble').version('0.0.1');

      expect(program.name()).toBe('ensemble');
      expect(program.version()).toBe('0.0.1');
    });

    it('can define subcommands', () => {
      const program = new Command();
      program.command('init [name]').description('Initialize a new workspace');

      const commands = program.commands;
      expect(commands.length).toBe(1);
      expect(commands[0].name()).toBe('init');
    });
  });
});
