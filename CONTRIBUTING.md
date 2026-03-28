# Contributing to Ensemble Workspace

Thank you for your interest in contributing to Ensemble Workspace!

## Quick Start

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/workspace.git`
3. Install dependencies: `bun install`
4. Create a branch: `git checkout -b feature/your-feature-name`
5. Make your changes
6. Test your changes: `bun test`
7. Add a changeset: `bun run changeset` (for user-facing changes)
8. Commit: `git commit -m "feat: add amazing feature"`
9. Push: `git push origin feature/your-feature-name`
10. Create a Pull Request

## Development Setup

```bash
# Install dependencies
bun install

# Start development (all packages)
bun run dev

# Run tests
bun test

# Type checking
bun run typecheck

# Linting
bun run lint

# Format code
bun run format
```

## Package Development

Each package in `packages/` can be developed independently:

```bash
# Work on @ensemble-edge/core
cd packages/core
bun run dev

# Work on @ensemble-edge/ui
cd packages/ui
bun run dev
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc)
- `refactor:` Code changes that neither fix bugs nor add features
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

## Changesets for Version Management

We use [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs.

### When to Add a Changeset

Add a changeset for any user-facing changes:
- New features
- Bug fixes
- Breaking changes
- Performance improvements

**Don't** add changesets for:
- Documentation updates
- Internal refactoring
- Test changes
- Build/CI configuration

### How to Add a Changeset

After making your changes:

```bash
bun run changeset
```

This will prompt you to:
1. Select which packages are affected
2. Choose the version bump type (patch/minor/major)
3. Write a summary of the changes

## Pull Request Guidelines

- Keep PRs focused and small
- Update tests and documentation
- Ensure all checks pass
- Link related issues
- Request review from maintainers

## Code Style

- TypeScript required for all code
- Follow existing patterns
- Use Preact for UI components
- Use Tailwind CSS v4 for styling
- Comment complex logic

## Architecture Guidelines

- Guest apps must be isolated (no direct access to workspace internals)
- All cross-app communication goes through the gateway API
- Services are singletons initialized at workspace creation
- Shell components use Preact Signals for state

## Need Help?

- Open an issue for bugs
- Start a discussion for features
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT license.
