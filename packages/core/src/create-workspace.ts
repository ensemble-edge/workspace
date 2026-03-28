import { Hono } from 'hono';

export interface WorkspaceConfig {
  name: string;
  slug: string;
  theme?: {
    primaryColor?: string;
    logo?: string;
  };
  apps?: string[];
}

export interface WorkspaceInstance {
  fetch: (request: Request, env?: unknown, ctx?: ExecutionContext) => Response | Promise<Response>;
}

/**
 * Create a new Ensemble Workspace instance.
 *
 * @example
 * ```ts
 * import { createWorkspace } from '@ensemble-edge/core';
 *
 * export default createWorkspace({
 *   name: 'Acme Corp',
 *   slug: 'acme',
 *   theme: {
 *     primaryColor: '#3B82F6',
 *   },
 * });
 * ```
 */
export function createWorkspace(config: WorkspaceConfig): WorkspaceInstance {
  const app = new Hono();

  app.get('/', (c) => {
    return c.json({
      workspace: config.name,
      slug: config.slug,
      version: '0.0.1',
    });
  });

  return {
    fetch: app.fetch,
  };
}
