/**
 * @ensemble-edge/sdk — Public types for the workspace context surface.
 *
 * THE CONTRACT — read this before adding a field:
 *
 *   1. Adding a field to WorkspaceContext is purely ADDITIVE. Guest
 *      apps using older SDK versions see new fields as `undefined`
 *      and continue working unchanged.
 *
 *   2. Renaming or removing a field requires bumping `version` from 1
 *      to 2. We've never had to do this. The design intent is that
 *      v1 is forever — extend, don't break.
 *
 *   3. Every domain is a top-level key (workspace, user, locale,
 *      theme, brand, etc.). When the surface grows, group new
 *      capabilities into existing domains or add a new domain.
 *      Avoid sprinkling unrelated fields at the root.
 *
 *   4. The SDK type MUST mirror the server-side WorkspaceContextV1
 *      shape exactly. They're the same contract — one TypeScript
 *      definition lives in @ensemble-edge/core/services/workspace-context.ts
 *      and a verbatim copy lives here so guest apps don't pull
 *      core as a dependency.
 */

export type ThemeMode = 'light' | 'dark' | 'system';

export interface WorkspaceContext {
  /** Schema version. Always 1 for now — bumps are breaking changes. */
  version: 1;

  workspace: {
    id: string;
    slug: string;
    name: string;
    /** Operator-curated display name; falls back to `name`. */
    displayName: string;
  };

  /** null when the guest app loaded without an authenticated session. */
  user: {
    id: string;
    email: string;
    displayName: string | null;
    role: string;
    /** Per-user account-level locale stored on the users row. */
    locale: string | null;
  } | null;

  locale: {
    /** Workspace default (e.g. 'en'). */
    default: string;
    /** Supported BCP-47 codes (e.g. ['en','es','fr']). */
    supported: string[];
    /**
     * Current user's preferred locale. null when unauthenticated or
     * when the user hasn't explicitly picked one — fall back to
     * `locale.default` in your i18n setup.
     */
    userPreferred: string | null;
  };

  theme: {
    mode: ThemeMode;
    primary: string;
    accent: string;
  };

  brand: {
    name: string;
    tagline: string | null;
    wordmarkUrl: string | null;
    iconUrl: string | null;
  };

  /**
   * Future feature gating. Empty for now; populated as guest-app
   * capability gates ship.
   */
  capabilities: Record<string, boolean>;

  /**
   * Operator-toggleable feature flags. Empty for now.
   */
  featureFlags: Record<string, boolean>;
}
