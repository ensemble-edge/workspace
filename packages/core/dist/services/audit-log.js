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
/**
 * Insert one audit row. Never throws. Logs to console.warn on failure
 * so deployment observability still picks up audit-write issues.
 */
export async function recordAudit(env, input) {
    try {
        const id = crypto.randomUUID();
        await env.DB.prepare(`INSERT INTO audit_log
         (id, workspace_id, actor_id, actor_handle, app_id, action,
          resource_type, resource_id, details_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, input.workspaceId, input.actorId ?? null, input.actorHandle ?? null, input.appId ?? null, input.action, input.resourceType ?? null, input.resourceId ?? null, input.details ? JSON.stringify(input.details) : null, input.ipAddress ?? null).run();
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[audit] failed to record event:', input.action, err);
    }
}
/**
 * Helper for routes: pull the actor + IP from the request context.
 * Returns a partial AuditEventInput pre-populated with workspace +
 * actor identity. Callers add action + details.
 */
export function auditContext(c) {
    const workspace = c.get('workspace');
    const user = c.get('user');
    const apiKey = c.get('apiKey');
    return {
        workspaceId: workspace?.id ?? '',
        actorId: user?.id ?? apiKey?.id ?? null,
        actorHandle: user?.email ?? user?.handle ?? (apiKey?.name ? `api-key:${apiKey.name}` : null),
        ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null,
    };
}
//# sourceMappingURL=audit-log.js.map