## 16. Cross-Workspace App Sharing

Guest apps are developed once and can be installed in multiple workspaces. Core and bundled apps are always present (they're in the binary) — the sharing model is simpler: workspaces just toggle them on/off.

```
     Same AIUX Binary (core + bundled built in)
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Acme Co  │  │ StartupX │  │ Board Y  │
    │          │  │          │  │          │
    │ CORE: all│  │ CORE: all│  │ CORE: all│
    │ BUNDLED: │  │ BUNDLED: │  │ BUNDLED: │
    │  dash ✓  │  │  dash ✓  │  │  dash ✗  │
    │  AI   ✓  │  │  AI   ✓  │  │  AI   ✗  │
    │  files ✓ │  │  files ✗ │  │  files ✓ │
    │ GUEST:   │  │ GUEST:   │  │ GUEST:   │
    │  CRM  ✓  │  │  CRM  ✓  │  │  (none)  │
    │  Wiki ✓  │  │  Wiki ✗  │  │          │
    │          │  │          │  │          │
    │ Theme: 🔵│  │ Theme: 🟢│  │ Theme: ⚫│
    └──────────┘  └──────────┘  └──────────┘
```

---

## 17. Public & Customer-Facing Views

AIUX isn't just an intranet. Workspaces can expose public or restricted views.

### Visibility Levels

| Level | Description | Auth Required |
|---|---|---|
| **Private** | Only workspace members | Yes (membership) |
| **Restricted** | Specific external users (e.g., clients) | Yes (guest membership) |
| **Public Auth** | Anyone can view after creating an AIUX account | Yes (account, no membership) |
| **Public** | Anyone on the internet | No |

### Example: Ownly Capital Borrower Portal

1. Create workspace `ownly-capital-portal` using "client-portal" template
2. Core apps auto-configure (admin-only, minimal UI for the admin)
3. Most bundled apps disabled by template (only notifications + dashboard enabled)
4. Install guest app "Loan Tracker" (visibility: restricted)
5. Install guest app "Document Upload" (visibility: restricted)
6. Brand Manager → apply Ownly Capital brand
7. Invite borrowers as guests → they see only Loan Tracker + Document Upload + Dashboard
8. Clean, branded, minimal UI

---

