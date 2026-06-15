/**
 * Migration 017: workspace_domains — tenant brand domains.
 *
 * Lets a workspace serve its public surfaces (legal pages, brand guide,
 * future public pages) under the tenant's own domain
 * (curalisto.com/legal/privacy) instead of workspace.curalisto.com/...,
 * with correct canonical + hreflang for SEO.
 *
 * Reverse lookup: host → workspace_id, so the resolver's resolveByDomain()
 * (currently a stub) becomes a PRIMARY KEY hit. PK(domain) also makes
 * "one domain belongs to exactly one workspace" a structural invariant —
 * a second tenant claiming the same domain fails at write time, not at
 * resolve time.
 *
 *   domain      host only — 'curalisto.com' (no proto, no path, no slash)
 *   workspace_id the owning tenant
 *   proto       'https' (override only for local dev)
 *   verified    ships defaulting to 1 (trusted-on-write): an operator
 *               setting a tenant's domain is already trusted. Real
 *               DNS-TXT/ACME self-serve verification later flips the
 *               default to 0 + adds a verify flow — no schema change.
 *
 * See docs/plan/brand-domain.md.
 */
export const migration = {
    name: '017_workspace_domains',
    sql: `
    CREATE TABLE IF NOT EXISTS workspace_domains (
      domain        TEXT PRIMARY KEY,
      workspace_id  TEXT NOT NULL,
      proto         TEXT NOT NULL DEFAULT 'https',
      verified      INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      created_by    TEXT,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_workspace_domains_ws ON workspace_domains(workspace_id);
  `,
};
//# sourceMappingURL=017_workspace_domains.js.map