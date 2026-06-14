/**
 * Workspace context resolver — the SINGLE server-side source of truth
 * for everything `@ensemble-edge/sdk`'s `useWorkspaceContext()` hook
 * surfaces to guest apps.
 *
 * Architectural contract:
 *
 *   1. ONE endpoint  (/_ensemble/workspace/context)
 *   2. ONE hook      (useWorkspaceContext)
 *   3. ONE type      (WorkspaceContext, versioned)
 *   4. EXTENSIBLE BY ADDITION ONLY
 *
 * Adding a new domain (e.g. `timezone`, `featureFlags`, `capabilities`)
 * means:
 *   - Add a resolver function below
 *   - Add a key to the WorkspaceContext type in @ensemble-edge/sdk
 *   - Call it from resolveWorkspaceContext()
 *   - Done. No new endpoint, no SDK version bump, existing guest apps
 *     see the field as additive.
 *
 * Renames / removals require bumping the `version` field at the root
 * and surface a deprecation period for guest authors. We've never had
 * to do this — the design intent is that v1 is forever.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types';
export type ThemeMode = 'light' | 'dark' | 'system';
export interface WorkspaceContextV1 {
    /** Schema version. Bump only on breaking changes. */
    version: 1;
    workspace: {
        id: string;
        slug: string;
        name: string;
        /** Operator-curated display name; falls back to `name`. */
        displayName: string;
    };
    /**
     * The tenant's public brand domain when configured (e.g.
     * `{ domain: 'curalisto.com', proto: 'https', origin:
     * 'https://curalisto.com' }`), else null. Guest apps that emit
     * public/shareable URLs (footer links, emails, og:url) should build
     * them against `publicDomain.origin` when present, falling back to
     * their own host otherwise — mirroring how core surfaces use it. See
     * docs/spec/05-guest-sdk.md "Brand domains".
     */
    publicDomain: {
        domain: string;
        proto: string;
        origin: string;
    } | null;
    /** null when the request is unauthenticated. */
    user: {
        id: string;
        email: string;
        displayName: string | null;
        role: string;
        locale: string | null;
    } | null;
    locale: {
        /** Workspace default (e.g. 'en'). */
        default: string;
        /** All supported BCP-47 codes (e.g. ['en','es','fr']). */
        supported: string[];
        /**
         * Current user's preferred locale. null when unauthenticated or
         * when the user hasn't picked one — caller falls back to default.
         */
        userPreferred: string | null;
    };
    theme: {
        /** Operator-saved mode: 'light' | 'dark' | 'system'. */
        mode: ThemeMode;
        /** Brand-primary hex for guest apps that want the accent color. */
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
     * Guest-app capabilities — what the workspace allows this guest to
     * do. Used for feature gating (e.g. "can this guest invoke AI tier
     * X?"). Empty object for v0.1.40; populated as feature gating ships.
     */
    capabilities: Record<string, boolean>;
    /**
     * Operator-toggleable feature flags. Empty object for v0.1.40;
     * populated when we ship a feature-flag service.
     */
    featureFlags: Record<string, boolean>;
}
interface ResolverInput {
    env: Env;
    workspaceId: string;
    userId: string | null;
}
export declare function resolveWorkspaceContext(input: ResolverInput): Promise<WorkspaceContextV1>;
/**
 * Read a user preference. Returns null when the table doesn't exist
 * or the key isn't set.
 */
export declare function getUserPreference(db: D1Database, userId: string, key: string): Promise<string | null>;
/**
 * Write a user preference. Creates the table on first use so we don't
 * need a migration step.
 */
export declare function setUserPreference(db: D1Database, userId: string, key: string, value: string): Promise<void>;
export {};
//# sourceMappingURL=workspace-context.d.ts.map