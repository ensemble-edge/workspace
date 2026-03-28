#!/usr/bin/env node
// @ensemble-edge/cli — Developer tooling for Ensemble Workspace

import { Command } from 'commander';

const program = new Command();

program
  .name('ensemble')
  .description('Ensemble Workspace CLI')
  .version('0.0.1');

program
  .command('init [name]')
  .description('Initialize a new workspace project')
  .action((name) => {
    console.log(`Creating workspace: ${name || 'my-workspace'}`);
    // TODO: Implement project scaffolding
  });

program
  .command('dev')
  .description('Start development server')
  .action(() => {
    console.log('Starting development server...');
    // TODO: Implement dev server
  });

program
  .command('deploy')
  .description('Deploy workspace to Cloudflare')
  .action(() => {
    console.log('Deploying workspace...');
    // TODO: Implement deployment
  });

program
  .command('app')
  .description('Guest app management')
  .command('create <name>')
  .description('Create a new guest app')
  .action((name) => {
    console.log(`Creating guest app: ${name}`);
    // TODO: Implement app scaffolding
  });

program.parse();
