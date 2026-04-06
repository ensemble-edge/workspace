/**
 * Minimal test worker to verify wrangler is working
 */

export default {
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/test') {
      return new Response(JSON.stringify({ status: 'ok', path: url.pathname }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Hello from minimal worker!', {
      headers: { 'Content-Type': 'text/plain' },
    });
  },
};
