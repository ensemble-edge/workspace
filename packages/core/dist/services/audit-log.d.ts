/**
 * Audit log writer — one function, fire-and-forget, never throws.
 *
 * Today's coverage (v0.1.76): auth events, API key lifecycle,
 * credentials updates, AI tier lifecycle. Adding new events is a
 * one-liner at the callsite — no central event-type registry.
 *
 * Design goals:
 *   • Never throw from the writer. Audit failures must not affect
 *     the business operation that triggered them (a login flow
 *     shouldn't fail because the audit insert failed).
 *   • Fire-and-forget. Callers await it for consistency but the
 *     internal try/catch swallows errors.
 *   • Cheap actor identification. `actor_handle` is a human-readable
 *     hint (email or "api-key:<name>") so the UI can show a useful
 *     audit row without a JOIN against users.
 *   • Free-form details_json for event-specific data (e.g. an API
 *     key's prefix on creation, the credential category on update).
 */
import type { Env } from '../types';
export interface AuditEventInput {
    workspaceId: string;
    /** Stable identifier; e.g. 'auth.login', 'api_key.created'. */
    action: string;
    actorId?: string | null;
    /** Human-friendly actor (email or "api-key:<name>"). */
    actorHandle?: string | null;
    /** App that triggered the event ('core', 'guest:<id>'). */
    appId?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
    /** Anything event-specific. Stringified to JSON. */
    details?: Record<string, unknown>;
    ipAddress?: string | null;
}
/**
 * Insert one audit row. Never throws. Logs to console.warn on failure
 * so deployment observability still picks up audit-write issues.
 */
export declare function recordAudit(env: Env, input: AuditEventInput): Promise<void>;
/**
 * Helper for routes: pull the actor + IP from the request context.
 * Returns a partial AuditEventInput pre-populated with workspace +
 * actor identity. Callers add action + details.
 */
export declare function auditContext(c: {
    get: (key: string) => unknown;
    req: {
        header: (name: string) => string | undefined;
    };
}): {
    workspaceId: string;
    actorId: string | null;
    actorHandle: string | null;
    ipAddress: string | null;
};
//# sourceMappingURL=audit-log.d.ts.map