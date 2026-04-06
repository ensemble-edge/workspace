/**
 * Echo Connector — Simplest Test App
 *
 * This is the most basic guest app possible. It demonstrates:
 * - Manifest declaration
 * - Context extraction from headers
 * - Health endpoint
 * - API routes
 * - AI panel tool declaration
 *
 * Use this as a template for building your own connectors.
 */

import { Hono } from 'hono';
import { defineGuestApp, getContext, requireContext } from '@ensemble-edge/guest';
import { createGuestWorker } from '@ensemble-edge/guest-cloudflare';

// Create Hono app for routing
const router = new Hono();

// Root endpoint - app info
router.get('/', (c) => {
  return c.json({
    app: 'echo',
    version: '1.0.0',
    description: 'Simple echo connector for testing the Ensemble guest app system',
    endpoints: [
      'GET /api/echo - Echo request info',
      'POST /api/echo - Echo back POST body',
      'POST /api/ai/echo - AI tool endpoint',
    ],
    ai_tools: ['echo'],
  });
});

// Echo endpoint - returns request info
router.get('/api/echo', (c) => {
  const ctx = getContext(c.req.raw);

  return c.json({
    data: {
      message: 'Hello from Echo!',
      context: ctx ? {
        workspaceId: ctx.workspace.workspaceId,
        appId: ctx.appId,
        userId: ctx.user?.userId ?? 'anonymous',
        userEmail: ctx.user?.userEmail ?? null,
        userRole: ctx.user?.userRole ?? null,
      } : null,
      request: {
        method: c.req.method,
        url: c.req.url,
        headers: Object.fromEntries(c.req.raw.headers.entries()),
      },
      timestamp: new Date().toISOString(),
    },
    meta: {
      request_id: ctx?.requestId ?? crypto.randomUUID(),
    },
  });
});

// Echo back POST body
router.post('/api/echo', async (c) => {
  const ctx = getContext(c.req.raw);
  const body = await c.req.json().catch(() => ({}));

  return c.json({
    data: {
      message: 'Echo received your data!',
      received: body,
      context: ctx ? {
        workspaceId: ctx.workspace.workspaceId,
        userId: ctx.user?.userId ?? 'anonymous',
      } : null,
    },
    meta: {
      request_id: ctx?.requestId ?? crypto.randomUUID(),
    },
  });
});

// AI tool: echo
router.post('/api/ai/echo', async (c) => {
  const ctx = requireContext(c.req.raw);
  const { message } = await c.req.json<{ message: string }>();

  return c.json({
    result: {
      echo: message,
      workspace: ctx.workspace.workspaceId,
      user: ctx.user?.userEmail ?? 'anonymous',
      timestamp: new Date().toISOString(),
    },
  });
});

// Define the guest app
const app = defineGuestApp({
  manifest: {
    id: 'echo',
    name: 'Echo',
    version: '1.0.0',
    description: 'Simple echo connector for testing the Ensemble guest app system',
    category: 'tool',
    icon: 'terminal',
    permissions: ['read:user', 'read:workspace'],
    entry: '/',
    author: {
      name: 'Ensemble Labs',
    },
    ai: {
      enabled: true,
      tools: [
        {
          name: 'echo',
          description: 'Echo back a message with workspace context',
          parameters: {
            message: {
              type: 'string',
              description: 'The message to echo',
              required: true,
            },
          },
        },
      ],
    },
    widgets: [
      {
        id: 'echo-status',
        name: 'Echo Status',
        description: 'Shows the current echo status',
        size: 'small',
        data_endpoint: '/api/echo',
        refresh_interval_seconds: 60,
      },
    ],
  },

  // Handle all requests via Hono router
  async fetch(request, ctx) {
    return router.fetch(request);
  },
});

// Export as Cloudflare Worker
export default createGuestWorker(app, {
  allowNoContext: true, // Allow direct testing without gateway
});
