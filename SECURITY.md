# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

Email: security@ensemble.ai

Please include:
- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)

We'll respond within 48 hours.

## Security Considerations

### Guest App Isolation

Guest apps run in iframes with strict sandboxing:
- No direct DOM access to workspace
- Communication only through postMessage API
- Permissions must be declared in manifest

### Authentication

- Workspace auth is handled by @ensemble-edge/core
- Guest apps receive tokens scoped to their permissions
- Tokens are short-lived and automatically refreshed

### Data Access

- Guest apps can only access data their manifest permits
- All API calls are validated against permissions
- Sensitive data is never exposed to client-side code
