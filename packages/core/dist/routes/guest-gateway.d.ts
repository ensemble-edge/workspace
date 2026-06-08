/**
 * Guest App Gateway Routes
 *
 * Proxies requests to guest apps (connectors, tools, agents) via:
 * - Service bindings (same-zone Cloudflare Workers, 0ms latency)
 * - HTTP fetch (remote services)
 *
 * Route pattern: /_ensemble/apps/{app-id}/*
 *
 * The gateway:
 * - Resolves app from registry
 * - Validates capability token
 * - Injects context headers (workspace, user, permissions)
 * - Proxies request to guest app
 * - Logs to audit trail
 */
import { Hono } from 'hono';
import type { Env, ContextVariables } from '../types';
/**
 * Create guest app gateway routes.
 */
export declare function createGuestGatewayRoutes(): Hono<{
    Bindings: Env;
    Variables: ContextVariables;
}, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=guest-gateway.d.ts.map