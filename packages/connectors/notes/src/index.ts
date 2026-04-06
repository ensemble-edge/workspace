/**
 * Notes Connector — D1 Scoped Storage Demo
 *
 * This connector demonstrates:
 * - D1 database access (scoped to workspace)
 * - CRUD operations with proper error handling
 * - Pagination
 * - Search functionality
 * - AI panel tools for note management
 *
 * Each workspace gets isolated storage - notes from workspace A
 * are never visible to workspace B.
 */

import { Hono } from 'hono';
import { defineGuestApp, requireContext, requireUser, type GuestAppContext } from '@ensemble-edge/guest';
import { createGuestWorker, type GuestWorkerEnv } from '@ensemble-edge/guest-cloudflare';

// Note type
interface Note {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// Extend env with our DB
interface Env extends GuestWorkerEnv {
  DB: D1Database;
}

// Create Hono app for routing
const router = new Hono<{ Bindings: Env }>();

// Initialize database tables (called on first request)
async function initDb(db: D1Database, workspaceId: string): Promise<void> {
  // Create notes table (scoped by workspace_id)
  await db.exec(`CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, title TEXT NOT NULL, content TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_workspace ON notes(workspace_id)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(workspace_id, user_id)`);
}

// List notes (paginated)
router.get('/api/notes', async (c) => {
  const ctx = requireContext(c.req.raw);
  const db = c.env.DB;

  await initDb(db, ctx.workspace.workspaceId);

  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = (page - 1) * limit;
  const search = url.searchParams.get('q') || '';

  let query = `SELECT * FROM notes WHERE workspace_id = ?`;
  const params: (string | number)[] = [ctx.workspace.workspaceId];

  if (search) {
    query += ` AND (title LIKE ? OR content LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
  params.push(limit + 1, offset); // Fetch one extra to check if there's more

  const result = await db.prepare(query).bind(...params).all<Note>();
  const notes = result.results || [];
  const hasMore = notes.length > limit;

  if (hasMore) {
    notes.pop(); // Remove the extra item
  }

  // Get total count
  let countQuery = `SELECT COUNT(*) as count FROM notes WHERE workspace_id = ?`;
  const countParams: string[] = [ctx.workspace.workspaceId];
  if (search) {
    countQuery += ` AND (title LIKE ? OR content LIKE ?)`;
    countParams.push(`%${search}%`, `%${search}%`);
  }
  const countResult = await db.prepare(countQuery).bind(...countParams).first<{ count: number }>();
  const total = countResult?.count ?? 0;

  return c.json({
    data: notes,
    meta: {
      request_id: ctx.requestId,
      total,
      page,
      per_page: limit,
      has_more: hasMore,
    },
  });
});

// Get single note
router.get('/api/notes/:id', async (c) => {
  const ctx = requireContext(c.req.raw);
  const db = c.env.DB;
  const noteId = c.req.param('id');

  const note = await db.prepare(
    `SELECT * FROM notes WHERE id = ? AND workspace_id = ?`
  ).bind(noteId, ctx.workspace.workspaceId).first<Note>();

  if (!note) {
    return c.json({
      error: { code: 'NOT_FOUND', message: 'Note not found' },
      meta: { request_id: ctx.requestId },
    }, 404);
  }

  return c.json({
    data: note,
    meta: { request_id: ctx.requestId },
  });
});

// Create note
router.post('/api/notes', async (c) => {
  const ctx = requireUser(c.req.raw);
  const db = c.env.DB;

  await initDb(db, ctx.workspace.workspaceId);

  const body = await c.req.json<{ title: string; content?: string }>();

  if (!body.title?.trim()) {
    return c.json({
      error: { code: 'VALIDATION_ERROR', message: 'Title is required' },
      meta: { request_id: ctx.requestId },
    }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO notes (id, workspace_id, user_id, title, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    ctx.workspace.workspaceId,
    ctx.user.userId,
    body.title.trim(),
    body.content?.trim() ?? '',
    now,
    now
  ).run();

  const note = await db.prepare(
    `SELECT * FROM notes WHERE id = ?`
  ).bind(id).first<Note>();

  return c.json({
    data: note,
    meta: { request_id: ctx.requestId },
  }, 201);
});

// Update note
router.put('/api/notes/:id', async (c) => {
  const ctx = requireUser(c.req.raw);
  const db = c.env.DB;
  const noteId = c.req.param('id');

  const existing = await db.prepare(
    `SELECT * FROM notes WHERE id = ? AND workspace_id = ?`
  ).bind(noteId, ctx.workspace.workspaceId).first<Note>();

  if (!existing) {
    return c.json({
      error: { code: 'NOT_FOUND', message: 'Note not found' },
      meta: { request_id: ctx.requestId },
    }, 404);
  }

  const body = await c.req.json<{ title?: string; content?: string }>();
  const now = new Date().toISOString();

  await db.prepare(
    `UPDATE notes SET
       title = COALESCE(?, title),
       content = COALESCE(?, content),
       updated_at = ?
     WHERE id = ? AND workspace_id = ?`
  ).bind(
    body.title?.trim() ?? null,
    body.content?.trim() ?? null,
    now,
    noteId,
    ctx.workspace.workspaceId
  ).run();

  const note = await db.prepare(
    `SELECT * FROM notes WHERE id = ?`
  ).bind(noteId).first<Note>();

  return c.json({
    data: note,
    meta: { request_id: ctx.requestId },
  });
});

// Delete note
router.delete('/api/notes/:id', async (c) => {
  const ctx = requireUser(c.req.raw);
  const db = c.env.DB;
  const noteId = c.req.param('id');

  const existing = await db.prepare(
    `SELECT * FROM notes WHERE id = ? AND workspace_id = ?`
  ).bind(noteId, ctx.workspace.workspaceId).first<Note>();

  if (!existing) {
    return c.json({
      error: { code: 'NOT_FOUND', message: 'Note not found' },
      meta: { request_id: ctx.requestId },
    }, 404);
  }

  await db.prepare(
    `DELETE FROM notes WHERE id = ? AND workspace_id = ?`
  ).bind(noteId, ctx.workspace.workspaceId).run();

  return c.json({
    data: { deleted: true, id: noteId },
    meta: { request_id: ctx.requestId },
  });
});

// AI tool: create_note
router.post('/api/ai/create_note', async (c) => {
  const ctx = requireUser(c.req.raw);
  const db = c.env.DB;

  await initDb(db, ctx.workspace.workspaceId);

  const { title, content } = await c.req.json<{ title: string; content?: string }>();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO notes (id, workspace_id, user_id, title, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, ctx.workspace.workspaceId, ctx.user.userId, title, content ?? '', now, now).run();

  return c.json({
    result: {
      success: true,
      note_id: id,
      message: `Created note "${title}"`,
    },
  });
});

// AI tool: search_notes
router.post('/api/ai/search_notes', async (c) => {
  const ctx = requireContext(c.req.raw);
  const db = c.env.DB;

  await initDb(db, ctx.workspace.workspaceId);

  const { query, limit = 10 } = await c.req.json<{ query: string; limit?: number }>();

  const results = await db.prepare(
    `SELECT id, title, substr(content, 1, 200) as content_preview, updated_at
     FROM notes
     WHERE workspace_id = ? AND (title LIKE ? OR content LIKE ?)
     ORDER BY updated_at DESC
     LIMIT ?`
  ).bind(ctx.workspace.workspaceId, `%${query}%`, `%${query}%`, Math.min(limit, 20)).all<{
    id: string;
    title: string;
    content_preview: string;
    updated_at: string;
  }>();

  return c.json({
    result: {
      count: results.results?.length ?? 0,
      notes: results.results ?? [],
    },
  });
});

// Define the guest app
const app = defineGuestApp({
  manifest: {
    id: 'notes',
    name: 'Notes',
    version: '1.0.0',
    description: 'Simple notes app demonstrating D1 scoped storage',
    category: 'tool',
    icon: 'sticky-note',
    permissions: ['read:user', 'read:workspace', 'storage:read', 'storage:write'],
    entry: '/',
    author: {
      name: 'Ensemble Labs',
    },
    search: {
      enabled: true,
      endpoint: '/api/notes',
      placeholder: 'Search notes...',
      min_query_length: 2,
    },
    ai: {
      enabled: true,
      tools: [
        {
          name: 'create_note',
          description: 'Create a new note in the workspace',
          parameters: {
            title: {
              type: 'string',
              description: 'The title of the note',
              required: true,
            },
            content: {
              type: 'string',
              description: 'The content of the note',
              required: false,
            },
          },
        },
        {
          name: 'search_notes',
          description: 'Search for notes by title or content',
          parameters: {
            query: {
              type: 'string',
              description: 'Search query',
              required: true,
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default 10, max 20)',
              required: false,
              default: 10,
            },
          },
        },
      ],
    },
    widgets: [
      {
        id: 'recent-notes',
        name: 'Recent Notes',
        description: 'Shows your most recently updated notes',
        size: 'medium',
        data_endpoint: '/api/notes?limit=5',
        refresh_interval_seconds: 30,
      },
    ],
  },

  // Handle all requests via Hono router
  async fetch(request, ctx, env) {
    const url = new URL(request.url);

    // For the root path, return app info
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        app: 'notes',
        version: '1.0.0',
        endpoints: [
          'GET /api/notes - List notes',
          'GET /api/notes/:id - Get note',
          'POST /api/notes - Create note',
          'PUT /api/notes/:id - Update note',
          'DELETE /api/notes/:id - Delete note',
        ],
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Pass env to Hono router so c.env is populated
    return router.fetch(request, env as Env);
  },
});

// Export as Cloudflare Worker
export default createGuestWorker(app, {
  allowNoContext: true, // Allow direct testing
});
