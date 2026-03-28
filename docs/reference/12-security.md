## 19. Security Model

### Defense Layers

| Layer | Protection |
|---|---|
| **Edge** | Cloudflare WAF, DDoS, Bot Management |
| **Auth** | JWTs + refresh tokens, MFA, session binding (core:auth app manages policies) |
| **Workspace** | Membership verification on every request |
| **App (all tiers)** | Permission checks via SDK, scoped storage |
| **Agent** | API key scoping, rate limiting, capability tokens |
| **Data** | Row-level security via workspace + app scoping (even core apps are scoped) |
| **Iframe** | CSP sandbox for untrusted guest apps |
| **Knowledge** | Read/write permissions on knowledge domains |
| **API Gateway** | Unified rate limiting, CORS, IP allowlisting, request logging |
| **Audit** | Every mutation logged (core:audit app) — humans and agents |

---
