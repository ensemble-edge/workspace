## 19. Security Model

> **⚠️ Architecture Update (March 2026):** Auth is now centralized at the edge layer. See [`02-shell-shift.md`](./02-shell-shift.md) for the full security architecture.

### Defense Layers

| Layer | Protection |
|---|---|
| **Edge Proxy** | Cloudflare WAF, DDoS, Bot Management. **Session validation and user header injection.** All auth happens here. |
| **`app.ensemble.ai`** | Magic link service, network identity management, SSO broker, JWT signing. No plaintext emails stored. |
| **Workspace Worker** | Receives pre-authenticated requests with `X-Ensemble-User` headers. Focuses on business logic, not auth. |
| **App (all tiers)** | Permission checks via SDK, scoped storage. Apps trust headers injected by proxy. |
| **Agent** | API key scoping, rate limiting, capability tokens |
| **Data** | Row-level security via workspace + app scoping (even core apps are scoped) |
| **Iframe** | CSP sandbox for untrusted guest apps. Theme cascading via postMessage. |
| **Knowledge** | Read/write permissions on knowledge domains |
| **Audit** | Every mutation logged (core:audit app) — humans and agents |

### Key Security Principles

- **Workspace Workers never touch credentials.** They receive pre-authenticated requests from the edge proxy.
- **JWTs validated at edge.** The proxy caches public keys and validates tokens locally — no runtime calls to `app.ensemble.ai`.
- **No plaintext emails in central storage.** `app.ensemble.ai` stores only hashed composite keys (`sha256(domain + email)`) for identity discovery.
- **Device-locked magic links.** Magic links are cryptographically bound to the device/browser session that initiated them.
- **Rate limiting at edge.** Per-IP, per-email, per-workspace limits enforced before requests reach workspace Workers.

---
