/**
 * Credentials, AI tiers, setup-status, auth-methods, and user-invite
 * routes (v0.1.12).
 *
 * All endpoints under `/_ensemble/`. Admin-only routes verify
 * membership.role === 'admin' or 'owner' before reading/writing
 * secrets. The list endpoint never returns secret values; only an
 * "is set" flag.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env, ContextVariables } from '../types';
import {
  listCredentials, getCredential, setCredential, deleteCredential,
  getWorkspacePublicUrl,
  type CredentialCategory,
} from '../services/credentials';
import { verifyEmailDomain, sendEmail } from '../services/email';
import {
  renderMagicLinkEmail, renderInviteEmail, renderPasswordResetEmail,
} from '../services/email-templates';
import {
  listTiers, getTier, createTier, patchTier, deleteTier,
  provisionTierRoute, seedDefaultTiers,
  canaryForProvider, gatewayDashboardUrl,
} from '../services/ai-tiers';
import {
  listLocales, addLocale, patchLocale, setDefaultLocale, removeLocale,
  countLocalizedBrandTokens,
} from '../services/locales';
import {
  getSetting, setSetting, parseSessionTtl, SESSION_TTL_OPTIONS,
  validateAliasPath,
  type SettingKey,
} from '../services/workspace-settings';
import { getR2Bucket } from '../services/r2-binding';

type AppEnv = { Bindings: Env; Variables: ContextVariables };
type AppContext = Context<AppEnv>;
type App = Hono<AppEnv>;

function requireAdmin(c: AppContext): { ok: true } | Response {
  const membership = c.get('membership');
  if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
    return c.json({ error: 'admin role required' }, 403);
  }
  return { ok: true };
}

export function createCredentialsRoutes(): App {
  const app = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

  // ─── Brand asset upload (R2) ──────────────────────────────────────
  //
  // Operators upload logos/favicons via Brand → Logos. Files land in
  // env.R2 under `brand/<workspace>/<kind>/<random>.<ext>` and a public
  // URL is returned for the brand_tokens table to reference.
  //
  // Auth: admin-only. Size limit: 5 MB. Allowed content-types are an
  // explicit allowlist — we don't want this to become a generic upload.

  const ALLOWED_UPLOAD_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/webp',
    'image/x-icon',
    'image/vnd.microsoft.icon',
  ]);
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

  /**
   * Slots that REQUIRE an SVG master. These produce derived rasters
   * via the generation engine; uploading a raster as the master breaks
   * the derived-variant pipeline. Other slots (favicon, social_avatar,
   * og_image) accept raster because they're output-only formats with
   * no useful vector source.
   */
  const SVG_REQUIRED_ROLES = new Set(['wordmark', 'icon_mark', 'lockup']);

  /** Compute next version number for the same role+variant prefix. */
  async function nextVersion(
    r2: R2Bucket, prefix: string,
  ): Promise<number> {
    // R2.list returns keys sorted lexically. We list under the
    // prefix-before-version and parse the v<n> token out of each.
    const listed = await r2.list({ prefix, limit: 100 });
    let max = 0;
    for (const obj of listed.objects) {
      const m = obj.key.match(/-v(\d+)-/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max + 1;
  }

  // v0.1.99: extracted as named handler so /_ensemble/admin/brand/upload
  // can register directly. Legacy /_ensemble/brand/upload stays for
  // shell back-compat.
  const brandUploadPostHandler: import('hono').Handler = async (c) => {
    const adminCheck = requireAdmin(c);
    if (adminCheck instanceof Response) return adminCheck;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const r2 = await getR2Bucket(c.env, workspace.id);
    if (!r2) {
      return c.json({ error: 'R2 bucket not bound. Add the binding in wrangler.toml.' }, 412);
    }

    const form = await c.req.formData();
    const file = form.get('file');
    const kindRaw = (form.get('kind') as string) || 'logo';
    if (!(file instanceof File)) {
      return c.json({ error: 'No file provided (form field "file")' }, 400);
    }
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
      return c.json({ error: `Unsupported content-type: ${file.type}` }, 415);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return c.json({ error: `File too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB)` }, 413);
    }

    // Parse `kind` into role + variant. Client sends shapes like:
    //   wordmark_base   → role=wordmark, variant=base
    //   wordmark_dark   → role=wordmark, variant=dark
    //   wordmark_svg    → role=wordmark, variant=master   (legacy alias)
    //   icon_mark_dark_svg → role=icon_mark, variant=dark
    //   social_avatar_base → role=social_avatar, variant=base
    // Two-word roles (icon_mark, social_avatar, og_image) need careful
    // splitting — match the longest known role prefix.
    const KNOWN_ROLES = ['icon_mark', 'social_avatar', 'og_image', 'lockup', 'wordmark', 'favicon'];
    let role = 'logo';
    let variant = 'base';
    for (const r of KNOWN_ROLES) {
      if (kindRaw === r || kindRaw.startsWith(r + '_')) {
        role = r;
        const suffix = kindRaw.slice(r.length).replace(/^_/, '');
        variant = suffix || 'base';
        break;
      }
    }
    // Normalize 'svg' suffix → 'master' (the canonical variant name
    // for vector originals). Strip _svg from compound variants.
    if (variant === 'svg') variant = 'master';
    else if (variant.endsWith('_svg')) variant = variant.slice(0, -4);
    // 'base' is the canonical default variant — we surface it as
    // 'primary' in filenames so the brand-asset semantics are clear.
    if (variant === 'base') variant = 'primary';

    // Enforce SVG-only for vector-required roles. Allow raster on
    // legitimately raster-only slots (favicon, social_avatar, og_image).
    if (SVG_REQUIRED_ROLES.has(role) && file.type !== 'image/svg+xml') {
      return c.json({
        error: 'SVG master required',
        detail:
          `The ${role} slot requires an SVG file. We generate PNG, JPG, ` +
          `and other formats at any size on demand from the SVG master — ` +
          `uploading a raster here would break the derived-variant pipeline. ` +
          `Convert your file to SVG and try again.`,
      }, 415);
    }

    // Detect resolution. SVGs get 'master'; rasters get the pixel
    // width parsed from the file's image header. We parse a small
    // prefix of the file to avoid pulling the whole thing into memory
    // just for dimensions.
    const ext = extensionFor(file.type);
    let resolution = 'master';
    if (file.type !== 'image/svg+xml') {
      try {
        const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
        const w = parseImageWidth(head, file.type);
        if (w) resolution = String(w);
      } catch { /* fall back to 'master' */ }
    }

    // Self-describing R2 key:
    //   brand/<slug>/<role>/<slug>-<role>-<variant>-<resolution>-v<n>-<hash>.<ext>
    const slug = (workspace.slug || workspace.id).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const safeVariant = variant.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const versionPrefix = `brand/${slug}/${role}/${slug}-${role}-${safeVariant}-`;
    const v = await nextVersion(r2, versionPrefix);
    const hash = crypto.randomUUID().replace(/-/g, '').slice(0, 6);
    const filename = `${slug}-${role}-${safeVariant}-${resolution}-v${v}-${hash}${ext}`;
    const key = `brand/${slug}/${role}/${filename}`;

    await r2.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    // Canonical URL is always returned for storage. When the operator
    // has configured a public alias path (e.g. 'media'), we also
    // include the pretty form (/media/<key>) as `display_url`.
    const canonical = `/_ensemble/brand/asset/${encodeURIComponent(key)}`;
    const aliasPath = (await getSetting(c.env, workspace.id, 'asset_public_alias_path')).trim();
    const display = aliasPath
      ? `/${aliasPath}/${encodeURIComponent(key)}`
      : canonical;

    return c.json({
      ok: true,
      key,
      role,
      variant: safeVariant,
      resolution,
      version: v,
      filename,
      url: canonical,
      display_url: display,
    });
  };
  app.post('/_ensemble/brand/upload',       brandUploadPostHandler); // legacy
  app.post('/_ensemble/admin/brand/upload', brandUploadPostHandler); // v0.1.99 canonical

  /**
   * GET /_ensemble/core/brand/logo-policy — current policy + computed
   * banned pairs based on the workspace's brand backgrounds. The UI
   * uses this to render the composition tab + the variants matrix.
   */
  app.get('/_ensemble/core/brand/logo-policy', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const { loadEffectivePolicy, effectiveBannedPairs } = await import('../services/brand-policy');
    const policy = await loadEffectivePolicy(c.env.DB, workspace.id);

    // Fetch brand colors needed for contrast-based ban computation.
    const rows = await c.env.DB.prepare(
      `SELECT key, value FROM brand_tokens
       WHERE workspace_id = ? AND category = 'colors' AND locale = ''
         AND key IN ('brand-primary', 'brand-background-light', 'brand-background-dark')`,
    ).bind(workspace.id).all<{ key: string; value: string }>();
    const colors = { bgLight: '#ffffff', bgDark: '#0a0a0a', primary: '#3b82f6' };
    for (const r of rows.results ?? []) {
      if (r.key === 'brand-primary') colors.primary = r.value;
      else if (r.key === 'brand-background-light') colors.bgLight = r.value;
      else if (r.key === 'brand-background-dark') colors.bgDark = r.value;
    }
    const effectiveBans = effectiveBannedPairs(policy, colors);
    // Workspace slug is used by clients (e.g. Brand Overview variants
    // matrix) to construct the path-style render URL
    // /brand/<slug>-<composition>-<finish>-<bg>.svg
    const slug = (workspace.slug || workspace.id).toLowerCase();
    // Include the operator's pretty alias path so the variants matrix
    // can prefer it for Copy URL / Download SVG actions. When empty,
    // clients fall back to the canonical /_ensemble/brand/render/ URL.
    const { getSetting } = await import('../services/workspace-settings');
    const assetAliasPath = (await getSetting(c.env, workspace.id, 'asset_public_alias_path')).trim();
    return c.json({ policy, effectiveBans, brandColors: colors, workspaceSlug: slug, assetAliasPath });
  });

  /** PUT /_ensemble/core/brand/logo-policy — admin-only policy update. */
  app.put('/_ensemble/core/brand/logo-policy', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const body = await c.req.json().catch(() => ({}));
    const { savePolicy, defaultPolicy } = await import('../services/brand-policy');
    // Merge with default to ensure schema completeness.
    const merged = { ...defaultPolicy(), ...body, version: 1 };
    await savePolicy(c.env.DB, workspace.id, merged);
    return c.json({ ok: true });
  });

  /**
   * POST /_ensemble/core/brand/typography/save
   *
   * v0.1.51: atomic install + commit endpoint for typography. The
   * operator picks a Google Font in the Typography tab; on Save:
   *   1. Server fetches the woff2 from Google Fonts and decodes to TTF
   *   2. TTF lands in R2 under fonts/google/<slug>-<weight>.ttf
   *   3. brand_tokens commits the typography settings
   *
   * Both steps fire atomically. If install fails, brand_tokens does
   * not commit. If the commit fails, the font is still in R2 (next
   * save will reuse it via R2 head-check — no double-install).
   *
   * Body shape:
   *   {
   *     typography?: { typography_<role>_family: '...', ..., },
   *     identity?:   { wordmark_family: '...', ..., }
   *   }
   *
   * Both buckets are PUTs; the server enumerates `*_family` keys to
   * decide which fonts need installing. System fonts (sans-serif,
   * Georgia, etc.) are skipped — they aren't in R2 and Satori
   * handles them via its built-in fallback chain.
   */
  app.post('/_ensemble/core/brand/typography/save', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const body = await c.req.json().catch(() => ({})) as {
      typography?: Record<string, string>;
      identity?: Record<string, string>;
    };
    const typo = body.typography ?? {};
    const ident = body.identity ?? {};

    // Collect (family, weight) pairs that need installing. Pairs are
    // discovered by inspecting *_family + *_weight tokens across both
    // buckets.
    const pairs: Array<{ family: string; weight: number }> = [];
    const collect = (tokens: Record<string, string>, prefixes: string[]) => {
      for (const p of prefixes) {
        const family = (tokens[`${p}_family`] || '').trim();
        const weight = parseInt((tokens[`${p}_weight`] || '700').trim(), 10) || 700;
        if (!family) continue;
        // Skip system fonts — they're not in R2 and Satori falls back.
        if (/system-ui|^(serif|sans-serif|monospace)$|Georgia|ui-monospace|-apple-system/i.test(family)) continue;
        // De-dupe identical (family,weight) requests so two roles
        // sharing a font only install it once.
        if (pairs.some((q) => q.family === family && q.weight === weight)) continue;
        pairs.push({ family, weight });
      }
    };
    collect(typo, ['typography_display', 'typography_heading', 'typography_subheading', 'typography_body', 'typography_eyebrow', 'typography_label', 'typography_caption', 'typography_mono']);
    collect(ident, ['wordmark']);

    // Install fonts. Errors here abort the save — operator sees a
    // clear error and brand_tokens stays untouched.
    const { installFontIfMissing } = await import('../services/brand-render/install-font');
    const installed: string[] = [];
    for (const { family, weight } of pairs) {
      try {
        await installFontIfMissing(c.env, workspace.id, family, weight);
        installed.push(`${family}:${weight}`);
      } catch (err) {
        return c.json({
          error: 'font_install_failed',
          detail: `Couldn't install ${family} ${weight}: ${err instanceof Error ? err.message : String(err)}`,
          installed,
        }, 502);
      }
    }

    // Commit both token buckets. Use the existing PUT handler logic
    // by inlining the SQL — atomic-ish (D1 doesn't have multi-table
    // transactions, but identity + typography sit in the same table).
    const upserts: Array<{ category: string; key: string; value: string }> = [];
    for (const [k, v] of Object.entries(typo)) upserts.push({ category: 'typography', key: k, value: v });
    for (const [k, v] of Object.entries(ident)) upserts.push({ category: 'identity', key: k, value: v });

    // Best-effort batch. Empty values become deletes (operator
    // cleared a role).
    for (const row of upserts) {
      if (row.value === '') {
        await c.env.DB.prepare(
          `DELETE FROM brand_tokens WHERE workspace_id = ? AND category = ? AND key = ? AND locale = ''`,
        ).bind(workspace.id, row.category, row.key).run();
      } else {
        await c.env.DB.prepare(
          `INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale, updated_at)
           VALUES (?, ?, ?, ?, 'text', '', datetime('now'))
           ON CONFLICT (workspace_id, category, key, locale)
           DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        ).bind(workspace.id, row.category, row.key, row.value).run();
      }
    }

    return c.json({ ok: true, fontsInstalled: installed });
  });

  /**
   * GET /_ensemble/core/brand/render
   *
   * The brand-asset generator endpoint. Returns an SVG representation
   * of a composed, finish-applied, background-composited variant.
   *
   * Query params:
   *   composition = wordmark-only | icon-only | stacked | horizontal
   *   finish      = full-color | mono-black | mono-white | mono-brand
   *   bg          = transparent | light | dark
   *   download    = 1 (optional) — adds Content-Disposition: attachment
   *
   * Refuses banned combinations with 422.
   *
   * Raster output (PNG/JPG/WebP via resvg-wasm) ships in a follow-up
   * release — operators wanting raster today download SVG and convert
   * externally, OR use a modern browser which renders SVG natively.
   */
  /**
   * Shared render body for both URL shapes (query-string + path-style).
   * Returns the SVG response or a JSON error response.
   */
  async function handleBrandRender(
    c: AppContext,
    composition: 'wordmark-only' | 'icon-only' | 'stacked' | 'horizontal',
    finish: 'full-color' | 'mono-black' | 'mono-white' | 'mono-brand',
    backgroundId: string,
    options: {
      download: boolean;
      filename?: string;
      backgrounded?: boolean;
      /** Output format. Defaults to 'svg' when the URL ends in .svg or has no extension. */
      format?: 'svg' | 'png';
      /**
       * v0.1.95: explicit pixel size for PNG output. When set, the render
       * is sized to sizePx × sizePx (square). Ignored for SVG (which is
       * inherently scalable). Used by spec-exposed PNG variants to deliver
       * the right size for the use case (favicon 32, social 1200, etc.)
       * without forcing every consumer to use the composition's default.
       */
      sizePx?: number;
      /**
       * v0.1.48+: when set, the render uses these policy overrides
       * instead of the stored policy values. Powers the live-preview
       * tiles in the Logos composition editor so operators see slider
       * changes immediately without saving first.
       */
      overrides?: {
        iconScale?: number;
        spacing?: number;
        iconSide?: 'left' | 'right';
        iconPosition?: 'top' | 'bottom';
        crossAlign?: number;
        backgroundedPadding?: number;
        lightTile?: string;
        darkTile?: string;
      };
    },
  ): Promise<Response> {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    // v0.1.51: Satori + resvg pipeline replaces the heuristic
    // composeLockup. Three-tier cache (Cache API → R2 → render)
    // with content-hashed storage keys means saved-policy edits
    // auto-invalidate without any URL gymnastics — the storage
    // path includes a hash of policy + tokens + request, so any
    // change produces a different path and the old asset is left
    // untouched. Distribution URLs stay clean (no ?v=hash).
    const { renderBrandAssetV2 } = await import('../services/brand-render/render');

    const result = await renderBrandAssetV2({
      env: c.env,
      workspaceId: workspace.id,
      workspaceSlug: (workspace.slug || workspace.id).toLowerCase(),
      composition,
      finish,
      backgroundId,
      backgrounded: options.backgrounded,
      format: options.format,
      // v0.1.95: explicit PNG size for spec-exposed variants. Reuses
      // the favicon-size channel since the render pipeline already
      // overrides canvas dimensions when this is set.
      faviconSize: options.format === 'png' ? options.sizePx : undefined,
      overrides: options.overrides,
    });

    if (!result) {
      return c.json({
        error: 'render_failed',
        detail: 'Source SVG/typography missing, or composition not allowed by policy. Upload a wordmark + icon master in Brand → Logos and pick typography in Brand → Typography.',
      }, 404);
    }

    const slug = (workspace.slug || workspace.id).toLowerCase();
    const ext = options.format === 'png' ? 'png' : 'svg';
    const filename = options.filename || `${slug}-${composition}-${finish}-${backgroundId}.${ext}`;

    // Cache headers
    // ─────────────
    // Editorial renders (live preview with overrides): no-store. The
    // operator is actively dragging sliders.
    // Saved-policy renders: public, max-age=300, must-revalidate.
    //
    // v0.1.65: dropped the `max-age=2592000, immutable` 30-day pin.
    // The public URL grammar (slug-comp-finish-bg.ext) doesn't carry
    // a policy snapshot hash — so when operators save a padding /
    // tile-color / finish change, the URL stays the same and the
    // pinned response stayed cached for 30 days. CF edge would
    // serve old SVGs until TTL expired or someone manually purged.
    //
    // 5-minute revalidation gives saved-policy changes near-immediate
    // propagation in CF edge (and downstream consumers) while still
    // letting external consumers cache the asset for short bursts.
    const cacheControl = result.editorial
      ? 'no-store, max-age=0, must-revalidate'
      : 'public, max-age=300, must-revalidate';

    const headers = new Headers({
      'Content-Type': result.contentType,
      'Cache-Control': cacheControl,
    });
    if (options.download) {
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    }
    return new Response(result.body, { headers });
  }

  /**
   * Query-string form. Kept for backward compatibility — anyone with
   * an old `/_ensemble/core/brand/render?composition=...&finish=...&bg=...`
   * URL in a deck or doc continues to work. The path-style form below
   * is the preferred public URL going forward.
   */
  app.get('/_ensemble/core/brand/render', async (c) => {
    const composition = (c.req.query('composition') || 'wordmark-only') as 'wordmark-only' | 'icon-only' | 'stacked' | 'horizontal';
    const finish = (c.req.query('finish') || 'full-color') as 'full-color' | 'mono-black' | 'mono-white' | 'mono-brand';
    const backgroundId = c.req.query('bg') || 'transparent';
    const download = c.req.query('download') === '1';
    const backgrounded = c.req.query('backgrounded') === '1';
    // v0.1.48+: optional inline policy overrides for live preview.
    const numQ = (k: string): number | undefined => {
      const v = c.req.query(k);
      const n = v != null ? Number(v) : NaN;
      return Number.isFinite(n) ? n : undefined;
    };
    const overrides = {
      iconScale: numQ('iconScale'),
      spacing: numQ('spacing'),
      iconSide: c.req.query('iconSide') as 'left' | 'right' | undefined,
      iconPosition: c.req.query('iconPosition') as 'top' | 'bottom' | undefined,
      crossAlign: numQ('crossAlign'),
      backgroundedPadding: numQ('backgroundedPadding'),
      lightTile: c.req.query('lightTile') || undefined,
      darkTile:  c.req.query('darkTile')  || undefined,
    };
    const hasOverride = Object.values(overrides).some((v) => v !== undefined);
    return handleBrandRender(c, composition, finish, backgroundId, {
      download,
      backgrounded,
      overrides: hasOverride ? overrides : undefined,
    });
  });

  /**
   * Path-style form. Operators paste this into decks, emails, partner
   * docs, anywhere — and the URL itself describes what the file is.
   *
   *   /brand/<slug>-<composition>-<finish>-<bg>.svg
   *
   * Example: /brand/cl-workspace-stacked-mono-white-dark.svg
   *
   * The browser saves the file with that filename automatically when
   * an operator right-clicks → Save As, so no Content-Disposition
   * gymnastics needed. Same generator under the hood — this route is
   * pure URL rewriting.
   *
   * Composition aliases: 'wordmark', 'icon', 'stacked', 'horizontal'
   * map to 'wordmark-only', 'icon-only', and themselves respectively
   * — shorter URL segments without losing meaning.
   */
  /**
   * GET /_ensemble/brand/render/<filename>.svg
   *
   * Canonical URL for generated logo variants (composition × finish ×
   * background). Operators distribute these in decks/emails via the
   * configured pretty alias path (e.g. /assets/brand/render/...).
   * Same surface, same rules as every other brand resource: lives
   * under /_ensemble/brand/ canonically, rewrites to /<alias>/brand/
   * via the unified alias mechanism.
   */
  // v0.1.99: extracted to named handler so /brand/render/* registers
  // directly with the same body — no re-dispatch.
  const renderHandler: import('hono').Handler = async (c, next) => {
    const filename = c.req.param('filename')!;
    // v0.1.51: PNG output supported alongside SVG. Same path grammar,
    // different rasterization tail. Anything else (.jpg/.webp) falls
    // through — we don't transcode in v0.1.51.
    let format: 'svg' | 'png';
    let stem: string;
    if (filename.endsWith('.svg')) {
      format = 'svg';
      stem = filename.replace(/\.svg$/i, '');
    } else if (filename.endsWith('.png')) {
      format = 'png';
      stem = filename.replace(/\.png$/i, '');
    } else {
      return next();
    }

    // Path-style URL grammar:
    //   <anything>-<composition>-<finish-multi-segment>-<bg>.<ext>
    //
    // v0.1.45 rewrite: instead of parsing segments by index (which
    // was off-by-one twice — v0.1.43 buggy, v0.1.44 still 404'd in
    // prod), use suffix-pattern matching. Try every (composition,
    // finish, bg) combo against the END of the stem. Whatever
    // matches IS the variant; whatever precedes it is the slug
    // (which we ignore — workspace identity is read from
    // c.get('workspace')).
    //
    // Bulletproof: each KNOWN combination is tried explicitly. If
    // the filename ends with any known variant suffix, we render.
    // If not, 404 with a JSON error so triage is easy.

    const COMPOSITIONS: Array<{ slug: string; id: 'wordmark-only' | 'icon-only' | 'stacked' | 'horizontal' }> = [
      { slug: 'wordmark',   id: 'wordmark-only' },
      { slug: 'icon',       id: 'icon-only' },
      { slug: 'stacked',    id: 'stacked' },
      { slug: 'horizontal', id: 'horizontal' },
    ];
    const FINISHES: Array<'full-color' | 'mono-black' | 'mono-white' | 'mono-brand'> = [
      'full-color', 'mono-black', 'mono-white', 'mono-brand',
    ];
    // v0.1.60: five backgrounds. true-white / true-black are
    // universal high-contrast variants; light / dark are brand-
    // colored variants the operator configures.
    const BGS = ['transparent', 'true-white', 'true-black', 'light', 'dark'];

    // v0.1.95: ?size=N query param — when present (and the format is
    // png), render at NxN pixels instead of the composition's default
    // canvas. Used by the brand spec to expose PNG variants at multiple
    // useful sizes (1024 / 512 / 256 / 128 / 64 / 32). Pulled through
    // as `faviconSize` because the render pipeline already handles
    // square pixel overrides via that channel.
    const sizeQ = c.req.query('size');
    const sizeParsed = sizeQ ? parseInt(sizeQ, 10) : undefined;
    const sizePx = (sizeParsed !== undefined && sizeParsed > 0 && sizeParsed <= 4096)
      ? sizeParsed
      : undefined;

    // v0.1.49: parse override + backgrounded query params so the
    // path-style route accepts the same live-preview controls as
    // the query-string route. The composition editor on Logos tab
    // hits THIS route — without this, slider overrides on path-style
    // URLs were silently dropped and the preview never updated.
    const numQ = (k: string): number | undefined => {
      const v = c.req.query(k);
      const n = v != null ? Number(v) : NaN;
      return Number.isFinite(n) ? n : undefined;
    };
    const overrides = {
      iconScale: numQ('iconScale'),
      spacing: numQ('spacing'),
      iconSide: c.req.query('iconSide') as 'left' | 'right' | undefined,
      iconPosition: c.req.query('iconPosition') as 'top' | 'bottom' | undefined,
      crossAlign: numQ('crossAlign'),
      backgroundedPadding: numQ('backgroundedPadding'),
      lightTile: c.req.query('lightTile') || undefined,
      darkTile:  c.req.query('darkTile')  || undefined,
    };
    const hasOverride = Object.values(overrides).some((v) => v !== undefined);
    // v0.1.54: the `-bg-` path prefix is now a no-op alias. Earlier
    // releases used it to opt into a separate "Backgrounded" tile
    // variant; v0.1.54 collapsed that distinction — every light/dark
    // background variant uses the policy's padding setting, so there
    // is no longer a separate "backgrounded" thing to opt into.
    //
    // We still RECOGNIZE the prefix so older distribution URLs in
    // the wild (decks, emails, partner docs) keep working. The
    // generated output is identical with or without the prefix.
    const download = c.req.query('download') === '1';

    for (const comp of COMPOSITIONS) {
      for (const finish of FINISHES) {
        for (const bg of BGS) {
          // Back-compat: `bg-` prefix still parses, just produces the
          // same render as the unprefixed form.
          const bgSuffix = `-bg-${comp.slug}-${finish}-${bg}`;
          if (stem.endsWith(bgSuffix)) {
            return handleBrandRender(c, comp.id, finish, bg, {
              download,
              filename,
              format,
              sizePx,
              overrides: hasOverride ? overrides : undefined,
            });
          }
          const suffix = `-${comp.slug}-${finish}-${bg}`;
          if (stem.endsWith(suffix)) {
            return handleBrandRender(c, comp.id, finish, bg, {
              download,
              filename,
              format,
              sizePx,
              overrides: hasOverride ? overrides : undefined,
            });
          }
        }
      }
    }
    // No known variant suffix matched — return JSON so it's easy to
    // diagnose vs Hono's default plain-text 404.
    return c.json({
      error: 'unrecognized_brand_variant_url',
      filename,
      hint: 'Expected: /brand/<slug>-<composition>-<finish>-<bg>.{svg|png} where composition is one of wordmark|icon|stacked|horizontal, finish is full-color|mono-black|mono-white|mono-brand, bg is transparent|light|dark. (Light and dark variants automatically use the brand-background padding configured in Brand → Logos → Background settings.)',
    }, 404);
  };
  app.get('/_ensemble/brand/render/:filename{.+}', renderHandler);
  app.get('/brand/render/:filename{.+}',          renderHandler);

  /**
   * GET /_ensemble/diagnostic/version
   *
   * Diagnostic endpoint. Returns the package version + a deterministic
   * fingerprint of this build so we can verify deployments without
   * guessing. Add this near the top of any triage session.
   */
  // v0.1.77: GET /_ensemble/version — short canonical path, no auth.
  // Returns package + version fingerprint so CI / monitoring / debug
  // scripts can verify what's deployed without guessing. Public (no
  // auth) because version info is public anyway; making it auth-
  // required would just be friction for the use case.
  // Old path kept as alias for back-compat with any operator scripts.
  const versionPayload = () => ({
    package: '@ensemble-edge/workspace',
    version: '0.1.99',
    buildFingerprint: 'v0.1.99-brand-aliases-direct-registration-not-redispatch',
    timestamp: new Date().toISOString(),
  });
  // v0.1.81: version probe should never be stale — CI / monitoring /
  // debug curl always want fresh state. publicCors's default would
  // give 5min; override to no-store explicitly so the workspace's
  // current deploy is always immediately observable.
  const sendVersion = (c: { json: (v: unknown) => Response }) => {
    const r = c.json(versionPayload());
    r.headers.set('Cache-Control', 'no-store');
    return r;
  };
  app.get('/_ensemble/version', sendVersion);
  app.get('/_ensemble/diagnostic/version', sendVersion);

  /**
   * GET /favicon.svg — modern-browser favicon served as SVG.
   *
   * Modern browsers (Chrome 92+, Firefox 41+, Safari 16+) accept
   * <link rel="icon" type="image/svg+xml" href="/favicon.svg"> and
   * render it at every favicon size — tab, bookmark, history.
   * That covers ~95% of users without rasterization.
   *
   * Source priority:
   *   1. Operator's uploaded SVG icon mark (logo_icon_mark_svg)
   *   2. Generated mono-brand of icon-only composition
   *   3. 404 (browser falls back to /favicon.ico if present)
   *
   * Legacy .ico support — `logo_favicon` raster upload still works
   * via the standard brand-asset path when an operator pre-uploaded
   * one. Older browsers consume that.
   */
  /**
   * GET /_ensemble/brand/favicon.svg
   *
   * Modern-browser favicon. The shell HTML's <link rel="icon"> points
   * at this canonical URL; if the operator has configured an alias
   * path, the link gets rewritten to /<alias>/brand/favicon.svg by
   * the unified alias mechanism.
   */
  // v0.1.99: extracted as named handler so /brand/favicon.svg can
  // register directly with the same body — no re-dispatch.
  const faviconSvgHandler: import('hono').Handler = async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.notFound();
    const { getIconSvg } = await import('../services/brand-render/sources');
    const svg = await getIconSvg(c.env, workspace.id);
    if (!svg) return c.notFound();
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        // Long cache — operators bump their icon by uploading a new
        // one which gets a new R2 key, so this URL effectively keys
        // on whatever the current `logo_icon_mark_svg` token points at.
        // Brand CSS revalidation (v0.1.23 ETag) handles cache-busting
        // when the operator updates anything brand-related.
        'Cache-Control': 'public, max-age=3600, must-revalidate',
      },
    });
  };
  app.get('/_ensemble/brand/favicon.svg', faviconSvgHandler);
  app.get('/brand/favicon.svg',          faviconSvgHandler);

  /**
   * v0.1.53: full favicon suite. Together with /favicon.svg these
   * routes cover every browser/OS combination from IE11 onward:
   *
   *   favicon.svg          → modern browsers (already exists above)
   *   favicon.ico          → legacy IE/Edge, intranet
   *   favicon-32.png       → bookmark bar, downloaded shortcut
   *   favicon-180.png      → iOS home screen (apple-touch-icon)
   *   favicon-192.png      → Android home screen
   *   favicon-512.png      → Android splash, PWA icon
   *   manifest.webmanifest → PWA + Android (references 192 + 512)
   *
   * All PNGs route through the existing renderBrandAssetV2 pipeline
   * with icon-only composition + full-color finish, sized to the
   * pixel value baked into the URL. The cache-key snapshot includes
   * the brand tokens, so an operator changing their icon mark
   * naturally invalidates all favicon variants without explicit
   * busting.
   */
  async function renderFaviconPng(c: AppContext, sizePx: number): Promise<Response> {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.notFound();
    const { renderBrandAssetV2 } = await import('../services/brand-render/render');
    const result = await renderBrandAssetV2({
      env: c.env,
      workspaceId: workspace.id,
      workspaceSlug: (workspace.slug || workspace.id).toLowerCase(),
      composition: 'icon-only',
      finish: 'full-color',
      backgroundId: 'transparent',
      format: 'png',
      // The render pipeline sizes off a canvas hint from canvasSize();
      // for the favicon suite we override that via the faviconSize
      // override below. (See render.ts.)
      overrides: { iconScale: 1 },
      faviconSize: sizePx,
    });
    if (!result) return c.notFound();
    return new Response(result.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=2592000, immutable',
      },
    });
  }

  // v0.1.95: 16px added for completeness — the brand spec surfaces it
  // and an external favicon-generator script would expect to find it.
  // v0.1.97: explicit /_ensemble/brand/og.png JSON 404. The path used
  // to fall through to the SPA catch-all, which returned HTML — an
  // external consumer following endpoints.preview_card got the
  // workspace login screen instead of an image. The spec now omits
  // preview_card when no og_image is uploaded; this handler exists
  // so a direct URL probe gets a useful JSON 404 instead of HTML.
  // v0.1.99: canonical /brand/og.png mirrors the legacy path.
  const ogPng404Handler: import('hono').Handler = (c) => c.json({
    error: 'no_og_image',
    message: 'No og_image asset is configured for this workspace. Upload one under Brand → Logos → Open Graph image, or set logos.og_image in your brand spec.',
  }, 404);
  app.get('/_ensemble/brand/og.png', ogPng404Handler);
  app.get('/brand/og.png',          ogPng404Handler);

  app.get('/_ensemble/brand/favicon-16.png',  (c) => renderFaviconPng(c, 16));
  app.get('/_ensemble/brand/favicon-32.png',  (c) => renderFaviconPng(c, 32));
  app.get('/_ensemble/brand/favicon-180.png', (c) => renderFaviconPng(c, 180));
  app.get('/_ensemble/brand/favicon-192.png', (c) => renderFaviconPng(c, 192));
  app.get('/_ensemble/brand/favicon-512.png', (c) => renderFaviconPng(c, 512));
  // v0.1.99: canonical /brand/favicon-N.png registered next to the
  // legacy paths. Direct registrations — no re-dispatch — so the
  // handler runs in-place with full workspace context.
  app.get('/brand/favicon-16.png',  (c) => renderFaviconPng(c, 16));
  app.get('/brand/favicon-32.png',  (c) => renderFaviconPng(c, 32));
  app.get('/brand/favicon-180.png', (c) => renderFaviconPng(c, 180));
  app.get('/brand/favicon-192.png', (c) => renderFaviconPng(c, 192));
  app.get('/brand/favicon-512.png', (c) => renderFaviconPng(c, 512));

  // v0.1.99: extracted as named handler so /brand/favicon.ico can
  // register directly with the same body — no re-dispatch.
  const faviconIcoHandler: import('hono').Handler = async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.notFound();
    // Render the 32px PNG, then wrap in an ICO container. IE11+
    // and every modern browser accept PNG-inside-ICO; older legacy
    // intranet browsers that demand true BMP-inside-ICO are
    // vanishingly rare and out of scope.
    const { renderBrandAssetV2 } = await import('../services/brand-render/render');
    const { wrapPngInIco } = await import('../services/brand-render/favicon');
    const result = await renderBrandAssetV2({
      env: c.env,
      workspaceId: workspace.id,
      workspaceSlug: (workspace.slug || workspace.id).toLowerCase(),
      composition: 'icon-only',
      finish: 'full-color',
      backgroundId: 'transparent',
      format: 'png',
      overrides: { iconScale: 1 },
      faviconSize: 32,
    });
    if (!result) return c.notFound();
    const ico = wrapPngInIco(new Uint8Array(result.body), 32);
    // Slice off the underlying ArrayBuffer view so Response can
    // consume it — @cloudflare/workers-types Response constructor
    // wants BodyInit (ArrayBuffer/Blob/string/etc.), not a typed
    // array view.
    const icoBuf = ico.buffer.slice(ico.byteOffset, ico.byteOffset + ico.byteLength) as ArrayBuffer;
    return new Response(icoBuf, {
      headers: {
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=2592000, immutable',
      },
    });
  };
  app.get('/_ensemble/brand/favicon.ico', faviconIcoHandler);
  app.get('/brand/favicon.ico',          faviconIcoHandler);

  app.get('/_ensemble/brand/manifest.webmanifest', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.notFound();
    const { buildWebManifest } = await import('../services/brand-render/favicon');
    const { getSetting } = await import('../services/workspace-settings');
    // v0.1.57: resolve brand colors via the new BrandColorsDoc.
    // Pre-v0.1.55 we read brand-primary/brand-background-light as
    // raw token rows; those don't exist after the redesign — colors
    // live in a single JSON blob and resolve through palettes +
    // themes. This was breaking PWA add-to-home-screen because the
    // manifest got hardcoded #3b82f6 / #ffffff defaults.
    const { loadBrandColors } = await import('../services/brand-colors/load');
    const { resolvePalettes, resolveBindingValue } = await import('../services/brand-colors/resolver');

    // Display name from identity tokens (unchanged).
    const idRows = await c.env.DB.prepare(
      `SELECT key, value FROM brand_tokens
       WHERE workspace_id = ? AND category = 'identity' AND locale = ''
         AND key IN ('display_name', 'workspace_name')`,
    ).bind(workspace.id).all<{ key: string; value: string }>();
    const idTokens: Record<string, string> = {};
    for (const r of idRows.results ?? []) idTokens[r.key] = r.value;
    const name = idTokens['display_name'] || idTokens['workspace_name'] || workspace.slug || 'Workspace';

    // Brand colors via the new doc.
    const doc = await loadBrandColors(c.env.DB, workspace.id);
    const palettes = resolvePalettes(doc);
    const themeColor = resolveBindingValue(doc.themes.light.bindings.brand, palettes);
    const backgroundColor = resolveBindingValue(doc.themes.light.bindings.canvas, palettes);

    // Manifest URLs need to be ABSOLUTE-ish (root-relative is fine —
    // the browser resolves them against the page that linked the
    // manifest). Use the alias path when configured so the manifest
    // matches the rest of the favicon suite's URLs.
    const aliasPath = (await getSetting(c.env, workspace.id, 'asset_public_alias_path')).trim();
    const iconBasePath = aliasPath ? `/${aliasPath}/brand` : '/_ensemble/brand';

    const manifest = buildWebManifest({
      name,
      shortName: name.length > 12 ? name.slice(0, 12) : name,
      themeColor,
      backgroundColor,
      iconBasePath,
    });
    return new Response(manifest, {
      headers: {
        // .webmanifest is the canonical extension; servers should
        // declare manifest+json content-type so the browser parses
        // it (some browsers reject application/json).
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  });

  /**
   * Operator-facing endpoint: returns the canonical <head> snippet
   * the operator copies into their own site's <head>. Plain JSON so
   * the shell UI can render it inside a CodeBlock with one-click
   * copy. Authenticated; admin-only because the snippet exposes the
   * operator's configured alias path.
   */
  app.get('/_ensemble/core/brand/favicon-snippet', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const { buildFaviconHeadSnippet } = await import('../services/brand-render/favicon');
    const { getSetting } = await import('../services/workspace-settings');
    const aliasPath = (await getSetting(c.env, workspace.id, 'asset_public_alias_path')).trim();
    const iconBasePath = aliasPath ? `/${aliasPath}/brand` : '/_ensemble/brand';
    // Public origin of this workspace — operators paste this in
    // their external site, so we need the absolute origin (their
    // workspace.curalisto.com or whatever).
    const url = new URL(c.req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const snippet = buildFaviconHeadSnippet({ baseUrl, iconBasePath });
    return c.json({ snippet, baseUrl, iconBasePath });
  });

  /**
   * Shared R2 brand-asset reader. Used by both the canonical path and
   * the optional /assets/<key> alias. Scoped to keys under `brand/` so
   * the alias cannot exfiltrate other R2 prefixes.
   */
  async function serveBrandAsset(c: AppContext, key: string): Promise<Response> {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const r2 = await getR2Bucket(c.env, workspace.id);
    if (!r2) return c.json({ error: 'R2 not configured' }, 404);
    if (!key.startsWith('brand/')) return c.json({ error: 'Not found' }, 404);
    const obj = await r2.get(key);
    if (!obj) return c.json({ error: 'Not found' }, 404);
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    // Operator-friendly download filename: strip the version + hash
    // segments so designers see a clean name like
    // 'cl-workspace-wordmark-primary-master.svg' instead of the
    // full storage key.
    const tail = key.split('/').pop() || 'asset';
    const stripped = tail.replace(/-v\d+-[a-z0-9]{6}(\.[a-z0-9]+)$/i, '$1');
    if (c.req.query('download') === '1') {
      headers.set('Content-Disposition', `attachment; filename="${stripped}"`);
    } else {
      headers.set('Content-Disposition', `inline; filename="${stripped}"`);
    }
    headers.set('etag', obj.httpEtag);
    headers.set('Cache-Control', 'public, max-age=3600');
    return new Response(obj.body, { headers });
  }

  // v0.1.99: canonical /brand/asset/* registered alongside legacy path.
  const assetHandler: import('hono').Handler = (c) =>
    serveBrandAsset(c, decodeURIComponent(c.req.param('key')!));
  app.get('/_ensemble/brand/asset/:key{.+}', assetHandler);
  app.get('/brand/asset/:key{.+}',           assetHandler);

  // NOTE: The configurable asset alias used to be registered here as
  // `app.get('/:alias/:key{.+}')`. That route shape matched ANY two-
  // or-more-segment URL — including `/_ensemble/*`. When the handler
  // returned `c.notFound()` (because no alias was configured), Hono
  // committed to the match and stopped routing, so every workspace
  // API call 404'd. The fix moves alias handling into the SPA
  // catchall in create-workspace.ts where it can check the path
  // inline and fall through cleanly to the SPA when no match.

  // ─── Credentials CRUD ─────────────────────────────────────────────

  app.get('/_ensemble/credentials', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const category = c.req.query('category') as CredentialCategory | undefined;
    const items = await listCredentials(c.env, workspace.id, category);
    return c.json({ items });
  });

  app.get('/_ensemble/credentials/:key', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const value = await getCredential(c.env, workspace.id, c.req.param('key'));
    if (value === null) return c.json({ error: 'not set' }, 404);
    return c.json({ key: c.req.param('key'), value });
  });

  app.put('/_ensemble/credentials/:key', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    const user = c.get('user');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const body = await c.req.json<{ value: string; category: CredentialCategory; is_secret: boolean }>();
    if (typeof body.value !== 'string' || !body.category || typeof body.is_secret !== 'boolean') {
      return c.json({ error: 'body must include {value, category, is_secret}' }, 400);
    }

    await setCredential(c.env, workspace.id, c.req.param('key'), body.category, body.value, {
      isSecret: body.is_secret,
      updatedBy: user?.id,
    });

    // v0.1.76: audit credential changes. We log the KEY (e.g.
    // "cloudflare_api_token", "email_sending_domain") but never the
    // value — secrets must not appear in audit details.
    const { recordAudit, auditContext } = await import('../services/audit-log');
    await recordAudit(c.env, {
      ...auditContext(c),
      action: 'credentials.updated',
      resourceType: 'credential',
      resourceId: c.req.param('key'),
      details: { category: body.category, is_secret: body.is_secret },
    });

    // Side-effect: saving the AI Gateway namespace seeds default tiers.
    // (Pre-v0.1.14 also triggered on ai_gateway_token; that key was
    // dropped — the CF API token serves both Connection + AI Access.)
    const key = c.req.param('key');
    if (key === 'ai_gateway_name') {
      await seedDefaultTiers(c.env, workspace.id);
    }

    return c.json({ ok: true });
  });

  app.delete('/_ensemble/credentials/:key', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    await deleteCredential(c.env, workspace.id, c.req.param('key'));
    return c.json({ ok: true });
  });

  // ─── Connection-test endpoints ─────────────────────────────────────

  /**
   * Test the configured Cloudflare API token against each scope the
   * workspace needs. Returns a list the UI renders as status lights.
   * Persists the result under `cf_token_scope_status` so the UI can show
   * the last-known state without re-running tests on every page load.
   *
   * Each scope test is a minimally-invasive read against the relevant
   * API. We don't write anything during a test. A 401/403 means the
   * scope is missing; any other error is reported with detail so the
   * operator can debug.
   */
  app.post('/_ensemble/credentials/test/connection', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const token = await getCredential(c.env, workspace.id, 'cloudflare_api_token');
    const accountId = await getCredential(c.env, workspace.id, 'cloudflare_account_id');
    if (!token) return c.json({ error: 'No Cloudflare API token set' }, 400);

    type ScopeResult = { name: string; ok: boolean; detail: string };
    const scopes: ScopeResult[] = [];
    const auth = { Authorization: `Bearer ${token}` };

    // 1. Token validity itself — also tells us the token is alive.
    const verifyR = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: auth,
    });
    if (!verifyR.ok) {
      // Token is invalid/expired — every scope check would fail. Report
      // a single result and short-circuit.
      scopes.push({
        name: 'Token validity',
        ok: false,
        detail: `Token rejected by Cloudflare (HTTP ${verifyR.status}).`,
      });
      await setCredential(
        c.env, workspace.id, 'cf_token_scope_status', 'connection',
        JSON.stringify(scopes), { isSecret: false },
      );
      return c.json({ scopes });
    }

    // 2. Zone:Read — list zones. Required to find the zone for email
    // domain verification. Doesn't imply DNS-record read access.
    const zonesR = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=1', {
      headers: auth,
    });
    scopes.push({
      name: 'Zone:Read',
      ok: zonesR.ok,
      detail: zonesR.ok
        ? 'Token can list zones.'
        : `HTTP ${zonesR.status} — token missing Zone:Read scope.`,
    });

    // 3. Zone — DNS:Read — read DNS records inside a zone. This is a
    // SEPARATE scope from Zone:Read, and is required for email-sending
    // domain verification (SPF/DKIM record checks). v0.1.68: this used
    // to be conflated with Zone:Read above, and operators with the
    // narrower scope saw their email verification fail with an opaque
    // "DNS read failed: 403" mid-flow.
    if (zonesR.ok) {
      const zonesBody = await zonesR.json<{ result?: Array<{ id: string; name: string }> }>();
      const probeZone = zonesBody.result?.[0];
      if (probeZone) {
        const dnsR = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${probeZone.id}/dns_records?per_page=1`,
          { headers: auth },
        );
        scopes.push({
          name: 'Zone — DNS:Read',
          ok: dnsR.ok,
          detail: dnsR.ok
            ? `Token can read DNS records (probed zone: ${probeZone.name}).`
            : `HTTP ${dnsR.status} on zone ${probeZone.name} — token missing Zone:DNS:Read scope. Required for email domain verification.`,
        });
      } else {
        scopes.push({
          name: 'Zone — DNS:Read',
          ok: false,
          detail: 'No zones in this account to probe DNS access against.',
        });
      }
    } else {
      scopes.push({
        name: 'Zone — DNS:Read',
        ok: false,
        detail: 'Cannot test — Zone:Read failed above.',
      });
    }

    // 3. Email Routing — list addresses on the account.
    if (accountId) {
      const emailR = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/routing/addresses?per_page=1`,
        { headers: auth },
      );
      scopes.push({
        name: 'Email Routing Addresses:Edit',
        ok: emailR.ok,
        detail: emailR.ok
          ? 'Token can read Email Routing addresses.'
          : `HTTP ${emailR.status} — token likely missing Email Routing scope.`,
      });
    } else {
      scopes.push({
        name: 'Email Routing Addresses:Edit',
        ok: false,
        detail: 'Cannot test — set the Cloudflare Account ID first.',
      });
    }

    // 4a. AI Gateway:Edit — list gateways (management scope).
    // Required to create/configure routes (provisioning step).
    if (accountId) {
      const aiR = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways?per_page=1`,
        { headers: auth },
      );
      scopes.push({
        name: 'AI Gateway:Edit',
        ok: aiR.ok,
        detail: aiR.ok
          ? 'Token can list AI Gateway namespaces.'
          : `HTTP ${aiR.status} — token likely missing AI Gateway:Edit scope.`,
      });
    } else {
      scopes.push({
        name: 'AI Gateway:Edit',
        ok: false,
        detail: 'Cannot test — set the Cloudflare Account ID first.',
      });
    }

    // 4b. AI Gateway:Run — runtime dispatch scope. v0.1.78: separate
    // permission from Edit. Required for the workspace's tier proxy
    // (/_ensemble/ai/call/:tier) and "Test tier" button. Without it,
    // dispatch returns code 2005 "Failed to get response from provider"
    // which is misleading — the actual cause is missing Run scope.
    // No documented "verify scope" endpoint exists; we probe by listing
    // gateways via the runtime base (which requires Run). If that
    // succeeds → has Run; if 401/403 → missing.
    if (accountId) {
      // The runtime endpoint requires a real route to call. We don't
      // have a guaranteed one, so we probe the gateways' logs endpoint
      // which CF treats as a Run-permission-required read.
      const gatewayName = await getCredential(c.env, workspace.id, 'ai_gateway_name');
      if (gatewayName) {
        const runR = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways/${gatewayName}/logs?per_page=1`,
          { headers: auth },
        );
        scopes.push({
          name: 'AI Gateway:Run',
          ok: runR.ok,
          detail: runR.ok
            ? 'Token can dispatch through AI Gateway routes (runtime).'
            : `HTTP ${runR.status} — token missing AI Gateway:Run scope. Required for the "Test tier" button and guest-app AI calls.`,
        });
      } else {
        scopes.push({
          name: 'AI Gateway:Run',
          ok: false,
          detail: 'Cannot test — set the AI Gateway name first.',
        });
      }
    } else {
      scopes.push({
        name: 'AI Gateway:Run',
        ok: false,
        detail: 'Cannot test — set the Cloudflare Account ID first.',
      });
    }

    // 4c. Workers AI:Read — required for the workers-ai tier provider
    // to dispatch via the gateway. Token issued via the gateway
    // dashboard's "Create authentication token" flow defaults to
    // including this.
    if (accountId) {
      const waiR = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models?per_page=1`,
        { headers: auth },
      );
      scopes.push({
        name: 'Workers AI:Read',
        ok: waiR.ok,
        detail: waiR.ok
          ? 'Token can list Workers AI models.'
          : `HTTP ${waiR.status} — token missing Workers AI:Read scope. Required for workers-ai tier dispatch.`,
      });
    } else {
      scopes.push({
        name: 'Workers AI:Read',
        ok: false,
        detail: 'Cannot test — set the Cloudflare Account ID first.',
      });
    }

    // 4d. Email Sending:Write — Cloudflare's new transactional email
    // product (public beta April 2026). Required for the worker's
    // env.SEND_EMAIL.send() binding to dispatch through the Email
    // Sending product (not the legacy Email Routing reply path).
    if (accountId) {
      const esR = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/email-security/settings`,
        { headers: auth },
      );
      // The /email-security endpoint requires Email Sending scope to
      // read. If it 401/403s, token lacks it. Other errors may be
      // benign (e.g. 404 if no settings yet).
      const esOk = esR.ok || esR.status === 404;
      scopes.push({
        name: 'Email Sending:Write',
        ok: esOk,
        detail: esOk
          ? 'Token can access Email Sending product.'
          : `HTTP ${esR.status} — token may be missing Email Sending scope. Required for outbound email via env.SEND_EMAIL.`,
      });
    } else {
      scopes.push({
        name: 'Email Sending:Write',
        ok: false,
        detail: 'Cannot test — set the Cloudflare Account ID first.',
      });
    }

    // 5. Workers R2 Storage — list buckets on the account. Powers the
    // bucket picker in the credentials tab so operators can choose an
    // R2 bucket from a dropdown rather than typing the name into
    // wrangler.toml by hand.
    if (accountId) {
      const r2R = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
        { headers: auth },
      );
      scopes.push({
        name: 'Workers R2 Storage:Read',
        ok: r2R.ok,
        detail: r2R.ok
          ? 'Token can list R2 buckets.'
          : `HTTP ${r2R.status} — token likely missing Workers R2 Storage scope.`,
      });
    } else {
      scopes.push({
        name: 'Workers R2 Storage:Read',
        ok: false,
        detail: 'Cannot test — set the Cloudflare Account ID first.',
      });
    }

    // Persist for the UI to render on next load without retesting.
    await setCredential(
      c.env, workspace.id, 'cf_token_scope_status', 'connection',
      JSON.stringify(scopes), { isSecret: false },
    );

    return c.json({ scopes });
  });

  /**
   * GET /_ensemble/credentials/r2/buckets
   *
   * Lists every R2 bucket in the operator's Cloudflare account. Uses
   * the Cloudflare API token already configured in the credentials
   * tab. Powers the bucket picker so operators can choose from a
   * dropdown instead of typing the bucket name into wrangler.toml.
   *
   * Also reports binding health: whether `c.env.R2` is wired up at all,
   * and (if so) whether the previously-stored "selected bucket" is the
   * one currently bound. We can't read the bucket name from the
   * binding directly — Cloudflare doesn't expose it — so we infer it
   * from the workspace-settings `r2_selected_bucket` value plus a
   * `c.env.R2.list({ limit: 1 })` reachability probe.
   */
  app.get('/_ensemble/credentials/r2/buckets', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const token = await getCredential(c.env, workspace.id, 'cloudflare_api_token');
    const accountId = await getCredential(c.env, workspace.id, 'cloudflare_account_id');

    // Binding health: independent of token. Tells operators whether
    // their wrangler.toml is already wired up under the configured
    // binding name (default 'R2', operator-overridable).
    const r2 = await getR2Bucket(c.env, workspace.id);
    let bindingReachable = false;
    if (r2) {
      try {
        await r2.list({ limit: 1 });
        bindingReachable = true;
      } catch {
        bindingReachable = false;
      }
    }

    const selectedBucket = (await getSetting(c.env, workspace.id, 'r2_selected_bucket')).trim();
    const bindingName = (await getSetting(c.env, workspace.id, 'r2_binding_name')).trim() || 'R2';

    if (!token || !accountId) {
      return c.json({
        buckets: [],
        bindingReachable,
        selectedBucket,
        bindingName,
        error: !token ? 'No Cloudflare API token set' : 'No Cloudflare Account ID set',
      });
    }

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      return c.json({
        buckets: [],
        bindingReachable,
        selectedBucket,
        bindingName,
        error: `Cloudflare API HTTP ${res.status} — token likely missing Workers R2 Storage:Read scope.`,
      });
    }

    type CfBucket = { name: string; creation_date?: string };
    const body = (await res.json()) as { result?: { buckets?: CfBucket[] } };
    const buckets = (body.result?.buckets ?? []).map((b) => ({
      name: b.name,
      created_at: b.creation_date,
    }));

    return c.json({
      buckets,
      bindingReachable,
      selectedBucket,
      bindingName,
    });
  });

  /**
   * PUT /_ensemble/credentials/r2/binding-name
   *
   * Stores the env binding name Ensemble should read R2 through.
   * Default is 'R2'. Operators integrating into a pre-existing CF
   * project that already binds R2 under another name (FILES, etc.)
   * can change this so getR2Bucket() reads c.env[their-name].
   *
   * Cloudflare requires binding names to be valid JS identifiers
   * (start with [A-Za-z_], contain [A-Za-z0-9_]). We mirror that
   * validation here so the UI can't store garbage.
   */
  app.put('/_ensemble/credentials/r2/binding-name', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const body = await c.req.json<{ name: string }>().catch(() => ({ name: '' }));
    const name = (body.name ?? '').trim();
    if (!name) return c.json({ error: 'Binding name cannot be empty' }, 400);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      return c.json({ error: 'Invalid binding name (must be a JS identifier)' }, 400);
    }

    await setSetting(c.env, workspace.id, 'r2_binding_name', name);
    return c.json({ ok: true, bindingName: name });
  });

  /**
   * PUT /_ensemble/credentials/r2/selected-bucket
   *
   * Stores which bucket the operator picked from the dropdown. Doesn't
   * actually change any binding — that requires editing wrangler.toml
   * and redeploying — but persisting the choice lets the UI remember
   * it and lets the wrangler-snippet auto-populate on subsequent visits.
   */
  app.put('/_ensemble/credentials/r2/selected-bucket', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const body = await c.req.json<{ name: string }>().catch(() => ({ name: '' }));
    const name = (body.name ?? '').trim();
    // Light validation: CF R2 bucket names are 3–63 chars, lowercase,
    // dashes/numbers/letters. Mirror that here so the UI can't store
    // garbage that won't match anything in the dropdown.
    if (name && !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(name)) {
      return c.json({ error: 'Invalid bucket name' }, 400);
    }

    await setSetting(c.env, workspace.id, 'r2_selected_bucket', name);
    return c.json({ ok: true, selectedBucket: name });
  });

  app.post('/_ensemble/credentials/test/email', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const result = await verifyEmailDomain(c.env, workspace.id);
    // Persist the result so the login screen / setup status can read it
    // without re-running verification.
    await setCredential(c.env, workspace.id, 'email_provider_verified', 'notifications', result.status, {
      isSecret: false,
    });
    return c.json(result);
  });

  /**
   * Test the AI Gateway namespace using the same Cloudflare API token
   * (single-token model — v0.1.14). Returns ok if the gateway exists and
   * the token can read it; otherwise a specific failure reason.
   */
  /**
   * Send a branded test email to the current admin's address. Uses the
   * magic-link template (the most visually representative). Returns
   * whether the send actually went out; UI surfaces this via toast so
   * operators can preview the template before relying on it.
   */
  app.post('/_ensemble/credentials/test/email/send', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    const user = c.get('user');
    if (!workspace?.id) return c.json({ ok: false, message: 'workspace not resolved' }, 400);
    if (!user?.email) return c.json({ ok: false, message: 'no email on file for current admin' }, 400);

    const verified = await getCredential(c.env, workspace.id, 'email_provider_verified');
    if (verified !== 'verified') {
      return c.json({ ok: false, message: 'Email provider not verified. Run "Verify domain" first.' });
    }

    const base = await getWorkspacePublicUrl(c.env, workspace.id, c.req.raw);
    // The URL doesn't have to resolve to anything meaningful — this is a
    // preview send. We point it at /login as a safe default so a click
    // doesn't surprise the operator.
    const rendered = await renderMagicLinkEmail(c.env, workspace.id, {
      url: `${base.replace(/\/$/, '')}/login`,
      expires_in_minutes: 15,
    });
    const result = await sendEmail(c.env, workspace.id, {
      to: user.email,
      subject: `[Test] ${rendered.subject}`,
      text: rendered.text,
      html: rendered.html,
    });

    if (result.ok) return c.json({ ok: true, sent_to: user.email });
    // v0.1.70: map opaque reason codes to operator-actionable messages.
    // The most common failure on a freshly-deployed workspace is the
    // missing [send_email] wrangler binding — operators saw
    // "Send failed: not_configured" with no hint what to fix.
    const friendly = (() => {
      switch (result.reason) {
        case 'not_configured':
          return result.error_detail
            ? `Email provider not fully configured: ${result.error_detail}`
            : 'Email provider not fully configured. Check that the email_provider, email_from_address, and provider-specific credentials are all set.';
        case 'unverified_domain':
          return 'Provider rejected the from address — the sending domain isn\'t verified with this provider yet.';
        case 'rate_limited':
          return 'Provider rate-limited the send. Wait a moment and retry.';
        case 'unknown_provider':
          return `Unknown email_provider value. Set it to 'cloudflare' or 'resend'.`;
        case 'provider_error':
          return `Provider error: ${result.error_detail ?? 'see worker logs'}`;
        default:
          return `Send failed: ${result.reason ?? 'unknown'}`;
      }
    })();
    return c.json({
      ok: false,
      message: friendly,
      reason: result.reason,
      detail: result.error_detail,
    });
  });

  app.post('/_ensemble/credentials/test/ai', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const accountId =
      (await getCredential(c.env, workspace.id, 'ai_gateway_account_id'))
      ?? (await getCredential(c.env, workspace.id, 'cloudflare_account_id'));
    const gatewayName = await getCredential(c.env, workspace.id, 'ai_gateway_name');
    const cfToken = await getCredential(c.env, workspace.id, 'cloudflare_api_token');

    if (!accountId || !gatewayName || !cfToken) {
      return c.json({ ok: false, message: 'AI Gateway not configured' });
    }

    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways/${gatewayName}`,
      { headers: { Authorization: `Bearer ${cfToken}` } },
    );
    if (r.ok) return c.json({ ok: true });
    if (r.status === 401 || r.status === 403) {
      return c.json({ ok: false, status: r.status, message: 'Token lacks AI Gateway:Edit' });
    }
    if (r.status === 404) {
      return c.json({ ok: false, status: 404, message: `Gateway namespace "${gatewayName}" not found in this account` });
    }
    return c.json({ ok: false, status: r.status, message: `Cloudflare API ${r.status}` });
  });

  // ─── AI tiers CRUD ─────────────────────────────────────────────────

  app.get('/_ensemble/ai/tiers', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const tiers = await listTiers(c.env, workspace.id);
    return c.json({ tiers });
  });

  app.post('/_ensemble/ai/tiers', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const body = await c.req.json<{ name: string; display_name?: string; description?: string; icon?: string }>();
    try {
      const tier = await createTier(c.env, workspace.id, body);
      const provision = await provisionTierRoute(c.env, workspace.id, tier.name);
      return c.json({ tier, provision });
    } catch (err) {
      return c.json({ error: String(err) }, 400);
    }
  });

  app.patch('/_ensemble/ai/tiers/:name', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const body = await c.req.json<{ display_name?: string; description?: string; icon?: string }>();
    await patchTier(c.env, workspace.id, c.req.param('name'), body);
    const tier = await getTier(c.env, workspace.id, c.req.param('name'));
    return c.json({ tier });
  });

  app.delete('/_ensemble/ai/tiers/:name', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    try {
      await deleteTier(c.env, workspace.id, c.req.param('name'));
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: String(err) }, 409);
    }
  });

  /**
   * Test a tier with a canary payload appropriate for its provider.
   * Returns whatever the gateway returned plus a 'fallback' field when
   * the requested tier didn't exist. Operators use this from the AI
   * Access card to confirm a tier is wired up correctly before a guest
   * app depends on it.
   */
  app.post('/_ensemble/ai/tiers/:name/test', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const tier = await getTier(c.env, workspace.id, c.req.param('name'));
    if (!tier) return c.json({ error: `Tier "${c.req.param('name')}" not found` }, 404);

    const body = canaryForProvider(tier.provider);
    if (body === null) {
      return c.json({
        ok: false,
        message:
          'No canary available for provider "custom". Pick a provider on the tier first, ' +
          'or test from your guest app directly.',
      }, 400);
    }

    const accountId = (await getCredential(c.env, workspace.id, 'ai_gateway_account_id'))
      ?? (await getCredential(c.env, workspace.id, 'cloudflare_account_id'));
    const gatewayName = await getCredential(c.env, workspace.id, 'ai_gateway_name');
    const cfToken = await getCredential(c.env, workspace.id, 'cloudflare_api_token');
    if (!accountId || !gatewayName || !cfToken) {
      return c.json({ ok: false, message: 'AI Gateway not configured' }, 412);
    }

    // v0.1.73: dynamic routes are called via the /compat/chat/completions
    // OpenAI-compatible endpoint with `model: "dynamic/<route-name>"`
    // in the body, NOT via a /v1/<acct>/<gw>/<route-name> path. The
    // path-based pattern works for static provider-passthrough (e.g.
    // /openai/v1/chat/completions) but dynamic routes are dispatched
    // through the compat endpoint. All earlier tier tests + the AI
    // call proxy at /_ensemble/ai/call/:tier were calling the wrong
    // URL, which is why every test returned 400 even after routes
    // were correctly configured with model elements.
    const compatBody = (() => {
      // The body our caller (canaryForProvider) sent already has
      // {messages, max_tokens}. Inject model: "dynamic/<route>".
      // Strip any provider-specific {model: "claude-..."} key the
      // anthropic canary may have set, since dynamic routing uses
      // the route's configured model, not a body-specified one.
      const b = body as Record<string, unknown>;
      return {
        ...b,
        model: `dynamic/${tier.gateway_route}`,
      };
    })();
    // v0.1.74: gateway runtime calls (gateway.ai.cloudflare.com) with
    // authentication: true require the `cf-aig-authorization` header,
    // NOT the standard `Authorization` header. Pre-v0.1.74 we used
    // `Authorization`, which the gateway accepted as valid for
    // management calls (api.cloudflare.com) but ignored for runtime
    // calls — producing "Failed to get response from provider"
    // (code 2005) because the gateway treated the runtime call as
    // unauthenticated and refused to dispatch.
    const r = await fetch(
      `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayName}/compat/chat/completions`,
      {
        method: 'POST',
        headers: {
          'cf-aig-authorization': `Bearer ${cfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(compatBody),
      },
    );

    let responseBody: unknown = null;
    try {
      responseBody = await r.json();
    } catch {
      try { responseBody = await r.text(); } catch { /* ignore */ }
    }

    // v0.1.72/74: translate gateway 400s into operator-actionable messages.
    // Two common error codes the gateway returns:
    //   • Empty route elements → route can't dispatch (pre-v0.1.72 issue)
    //   • code 2005 "Failed to get response from provider" → either
    //     gateway auth is wrong, or the provider (openai/anthropic)
    //     isn't configured with BYOK keys at the gateway level.
    let friendlyMessage: string | undefined;
    if (!r.ok && r.status === 400) {
      // Detect code 2005 from the response body.
      const respObj = responseBody as { internalCode?: number; error?: Array<{ code?: number; message?: string }>; message?: string } | null;
      const internalCode = respObj?.internalCode ?? respObj?.error?.[0]?.code;
      const gatewayMessage = respObj?.message ?? respObj?.error?.[0]?.message;
      if (internalCode === 2005) {
        const providerHints: Record<string, string> = {
          'openai-chat':        'OpenAI provider — add your OpenAI API key in the Cloudflare AI Gateway dashboard under "Providers".',
          'anthropic-messages': 'Anthropic provider — add your Anthropic API key in the Cloudflare AI Gateway dashboard under "Providers".',
          'workers-ai':         'Workers AI provider — confirm Workers AI is enabled on this Cloudflare account and the model is available.',
          'custom':             'Custom provider — operator must configure this provider in the Cloudflare AI Gateway dashboard.',
        };
        const providerHint = providerHints[tier.provider] ?? 'Configure the provider in the Cloudflare AI Gateway dashboard.';
        friendlyMessage = `${gatewayMessage}. ${providerHint}`;
      } else {
        // Check for empty-elements route as a fallback diagnosis.
        try {
          const routesR = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways/${gatewayName}/routes`,
            { headers: { 'Authorization': `Bearer ${cfToken}` } },
          );
          if (routesR.ok) {
            const routesBody = await routesR.json<{ data?: { routes?: Array<{ id: string; name: string }> } }>();
            const routeMeta = routesBody.data?.routes?.find((x) => x.name === tier.gateway_route);
            if (routeMeta) {
              const detailR = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways/${gatewayName}/routes/${routeMeta.id}`,
                { headers: { 'Authorization': `Bearer ${cfToken}` } },
              );
              if (detailR.ok) {
                const detail = await detailR.json<{ result?: { version?: { data?: unknown[] } } }>();
                const elementsCount = detail.result?.version?.data?.length ?? 0;
                if (elementsCount === 0) {
                  friendlyMessage =
                    `Route "${tier.gateway_route}" has no model configured in Cloudflare AI Gateway. ` +
                    `Re-provision the tier (provisioning will create a default model target), ` +
                    `or open the gateway in the Cloudflare dashboard and add a model element manually.`;
                }
              }
            }
          }
        } catch { /* ignore — fall through to raw response */ }
      }
    }

    return c.json({
      ok: r.ok,
      status: r.status,
      provider: tier.provider,
      request_sent: body,
      response: responseBody,
      ...(friendlyMessage ? { message: friendlyMessage } : {}),
      ...(r.ok ? {} : { manual_url: gatewayDashboardUrl(accountId, gatewayName) }),
    });
  });

  /**
   * R2 binding probe — surfaces "do you have R2 bound, and can the
   * Worker write to it?" for the Connections tab's asset-storage row.
   * Reuses the same writability check the setup status endpoint uses.
   */
  app.get('/_ensemble/r2/status', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ bound: false, writable: false, detail: 'No workspace' });

    const r2 = await getR2Bucket(c.env, workspace.id);
    if (!r2) {
      return c.json({
        bound: false,
        writable: false,
        detail: 'No R2 bucket bound under the configured binding name. Add the binding in wrangler.toml.',
      });
    }
    try {
      const probeKey = `_ensemble/setup-probe/${workspace.id}`;
      await r2.put(probeKey, 'ok');
      await r2.delete(probeKey);
      return c.json({ bound: true, writable: true, detail: 'Bucket is writable.' });
    } catch (err) {
      return c.json({
        bound: true,
        writable: false,
        detail: `Bucket bound but write failed: ${String(err).slice(0, 200)}`,
      });
    }
  });

  /**
   * Surfaces the Cloudflare AI Gateway dashboard URL so the UI can deep-link
   * the operator to the page where they wire routes to models.
   */
  app.get('/_ensemble/ai/dashboard-url', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const accountId = (await getCredential(c.env, workspace.id, 'ai_gateway_account_id'))
      ?? (await getCredential(c.env, workspace.id, 'cloudflare_account_id'));
    const gatewayName = await getCredential(c.env, workspace.id, 'ai_gateway_name');
    if (!accountId || !gatewayName) {
      return c.json({ url: null });
    }
    return c.json({ url: gatewayDashboardUrl(accountId, gatewayName) });
  });

  app.post('/_ensemble/ai/tiers/:name/create-route', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const tierName = c.req.param('name');
    const result = await provisionTierRoute(c.env, workspace.id, tierName);
    // v0.1.76: audit successful provisioning (skip noisy failures —
    // they're already persisted in workspace_ai_tiers.last_error).
    if (result.ok) {
      const { recordAudit, auditContext } = await import('../services/audit-log');
      await recordAudit(c.env, {
        ...auditContext(c),
        action: 'ai_tier.provisioned',
        resourceType: 'ai_tier',
        resourceId: tierName,
      });
    }
    return c.json(result);
  });

  // ─── AI call proxy ─────────────────────────────────────────────────
  // POST /_ensemble/ai/call/:tier
  //
  // Guest-app entrypoint for AI calls. Guest apps pick a tier by name
  // (smart / good / simple / etc) and post a chat-completion-style
  // request body. Workspace injects the cf token + routes to the
  // gateway's dynamic-route dispatcher via the OpenAI-compat endpoint.
  // The guest never sees the token.
  //
  // v0.1.73: switched from the wrong /v1/<acct>/<gw>/<route-name> path
  // to the correct /v1/<acct>/<gw>/compat/chat/completions with
  // model:"dynamic/<route-name>" in the body. The path-based form
  // works for static provider passthrough; dynamic routes dispatch
  // through the compat endpoint.
  //
  // Falls back to 'good' if requested tier doesn't exist.

  app.post('/_ensemble/ai/call/:tier', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const requestedTier = c.req.param('tier');
    let tier = await getTier(c.env, workspace.id, requestedTier);
    const fallbackUsed = !tier ? requestedTier : null;
    if (!tier) {
      tier = await getTier(c.env, workspace.id, 'good');
      if (!tier) return c.json({ error: 'No fallback tier "good" configured' }, 412);
    }

    // Single-token model (v0.1.14): the AI call uses the same Cloudflare
    // API token configured in the Connection section. There is no
    // separate ai_gateway_token. The legacy value is lazily deleted in
    // ai-tiers.ts when first read.
    const accountId = (await getCredential(c.env, workspace.id, 'ai_gateway_account_id'))
      ?? (await getCredential(c.env, workspace.id, 'cloudflare_account_id'));
    const gatewayName = await getCredential(c.env, workspace.id, 'ai_gateway_name');
    const cfToken = await getCredential(c.env, workspace.id, 'cloudflare_api_token');
    if (!accountId || !gatewayName || !cfToken) {
      return c.json({ error: 'AI Gateway not configured' }, 412);
    }

    // Inject model:"dynamic/<route>" into the incoming body. The
    // route's configured model element overrides any model field the
    // guest specified — that's the whole point of tier abstraction.
    const incomingBody = await c.req.json<Record<string, unknown>>().catch(() => null);
    if (!incomingBody || typeof incomingBody !== 'object') {
      return c.json({ error: 'Request body must be valid JSON' }, 400);
    }
    const outgoingBody = {
      ...incomingBody,
      model: `dynamic/${tier.gateway_route}`,
    };
    // v0.1.74: gateway runtime uses cf-aig-authorization header.
    // See the matching comment on /_ensemble/ai/tiers/:name/test above
    // for why; same constraint applies to this guest-app proxy.
    const r = await fetch(
      `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayName}/compat/chat/completions`,
      {
        method: 'POST',
        headers: {
          'cf-aig-authorization': `Bearer ${cfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(outgoingBody),
      },
    );

    // If we used the fallback, surface that in a response header so the
    // guest's useAI hook can log it. Don't fail the response.
    const headers: Record<string, string> = {
      'Content-Type': r.headers.get('Content-Type') ?? 'application/json',
    };
    if (fallbackUsed) headers['X-Ensemble-Tier-Fallback'] = fallbackUsed;
    return new Response(r.body, { status: r.status, headers });
  });

  // ─── Setup status (for the home-page checklist) ────────────────────

  app.get('/_ensemble/setup/status', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ items: [] });

    const cfAccount = await getCredential(c.env, workspace.id, 'cloudflare_account_id');
    const cfToken = await getCredential(c.env, workspace.id, 'cloudflare_api_token');
    const emailProvider = await getCredential(c.env, workspace.id, 'email_provider');
    const emailVerified = await getCredential(c.env, workspace.id, 'email_provider_verified');
    const aiGateway = await getCredential(c.env, workspace.id, 'ai_gateway_name');

    const connectionDone = !!(cfAccount && cfToken);
    const emailDone = !!(emailProvider && emailVerified === 'verified');
    // AI is "done" when the gateway namespace is configured AND the
    // Connection token is present (single-token model — v0.1.14).
    const aiDone = !!(aiGateway && cfToken);

    // R2 writability — the binding may exist but the bucket might not be
    // configured/accessible. We check by attempting a tiny put then
    // delete. If env.R2 is missing entirely, mark pending.
    let r2Done = false;
    let r2Detail = 'No R2 bucket bound under the configured name — add the binding in wrangler.toml.';
    const r2Probe = await getR2Bucket(c.env, workspace.id);
    if (r2Probe) {
      try {
        const probeKey = `_ensemble/setup-probe/${workspace.id}`;
        await r2Probe.put(probeKey, 'ok');
        await r2Probe.delete(probeKey);
        r2Done = true;
        r2Detail = 'Bucket is writable.';
      } catch (err) {
        r2Detail = `Bucket bound but write failed: ${String(err).slice(0, 120)}`;
      }
    }

    // Favicon — v0.1.31 removed the standalone logo_favicon upload
    // slot. Favicons are now generated from the icon mark on demand
    // (favicon.svg + favicon-*.png). So "favicon configured" really
    // means "icon mark configured" — we check the icon-mark tokens
    // operators populate via Brand → Logos.
    let faviconDone = false;
    try {
      const row = await c.env.DB.prepare(
        `SELECT value FROM brand_tokens
         WHERE workspace_id = ? AND category = 'identity'
           AND key IN ('logo_icon_mark_svg', 'logo_icon_mark', 'logo_favicon')
           AND locale = ''
         LIMIT 1`,
      )
        .bind(workspace.id)
        .first<{ value: string }>();
      faviconDone = !!(row?.value && row.value.trim());
    } catch {
      // table may not exist on a very fresh workspace; treat as pending
    }

    return c.json({
      items: [
        {
          id: 'connection',
          title: 'Cloudflare connection',
          description: 'Required for DNS, email sending, and AI Gateway management.',
          status: connectionDone ? 'done' : 'pending',
          href: '/settings#connections',
          required: true,
        },
        {
          id: 'r2',
          title: 'Asset storage (R2)',
          description: r2Detail,
          status: r2Done ? 'done' : 'pending',
          href: '/settings#connections',
          required: false,
        },
        {
          id: 'favicon',
          title: 'Favicon',
          description:
            'Upload a favicon under Brand → Logos so the workspace shows your icon in browser tabs.',
          status: faviconDone ? 'done' : 'pending',
          href: '/brand#logos',
          required: false,
        },
        {
          id: 'email',
          title: 'Email notifications',
          description:
            'Configure Cloudflare or Resend to send invites and enable magic-link login. ' +
            'Without it, admins use one-time invite URLs.',
          status: emailDone ? 'done' : 'pending',
          href: '/settings#connections',
          required: false,
        },
        {
          id: 'ai',
          title: 'AI Access',
          description: 'Connect a Cloudflare AI Gateway namespace to enable AI features.',
          status: aiDone ? 'done' : 'pending',
          href: '/settings#connections',
          required: false,
        },
      ],
    });
  });

  // ─── Auth methods (for login screen to render magic-link conditionally) ────

  app.get('/_ensemble/auth/methods', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ password: true, magic_link: false });
    const verified = await getCredential(c.env, workspace.id, 'email_provider_verified');
    return c.json({
      password: true,
      magic_link: verified === 'verified',
    });
  });

  // ─── User invite + admin reset ─────────────────────────────────────
  // Both endpoints return { url, sent_via_email } so the admin can fall
  // back to manually sharing the URL when email isn't configured.

  app.post('/_ensemble/users/invite', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const body = await c.req.json<{ email: string; role?: string }>();
    if (!body.email) return c.json({ error: 'email required' }, 400);

    // Token: short-lived random string, stored in KV with expiry.
    const token = crypto.randomUUID().replace(/-/g, '');
    const key = `invite:${token}`;
    const payload = JSON.stringify({
      email: body.email,
      role: body.role ?? 'member',
      workspace_id: workspace.id,
      created_at: Date.now(),
    });
    await c.env.KV.put(key, payload, { expirationTtl: 60 * 60 * 24 * 7 }); // 7d

    const base = await getWorkspacePublicUrl(c.env, workspace.id, c.req.raw);
    const url = `${base}/auth/accept-invite?token=${token}`;

    let sent_via_email = false;
    const verified = await getCredential(c.env, workspace.id, 'email_provider_verified');
    if (verified === 'verified') {
      const inviter = c.get('user');
      const rendered = await renderInviteEmail(c.env, workspace.id, {
        url,
        inviter_name: inviter?.handle ?? inviter?.email,
        expires_in_days: 7,
      });
      const result = await sendEmail(c.env, workspace.id, {
        to: body.email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      sent_via_email = result.ok;
    }

    return c.json({ url: sent_via_email ? null : url, sent_via_email });
  });

  app.post('/_ensemble/users/:id/reset-password', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const userId = c.req.param('id');
    const target = await c.env.DB.prepare(
      `SELECT email FROM users WHERE id = ?`,
    ).bind(userId).first<{ email: string }>();
    if (!target) return c.json({ error: 'user not found' }, 404);

    const token = crypto.randomUUID().replace(/-/g, '');
    await c.env.KV.put(`pwreset:${token}`, JSON.stringify({
      user_id: userId,
      workspace_id: workspace.id,
      created_at: Date.now(),
    }), { expirationTtl: 60 * 60 }); // 1h

    const base = await getWorkspacePublicUrl(c.env, workspace.id, c.req.raw);
    const url = `${base}/auth/reset-password?token=${token}`;

    let sent_via_email = false;
    const verified = await getCredential(c.env, workspace.id, 'email_provider_verified');
    if (verified === 'verified') {
      const rendered = await renderPasswordResetEmail(c.env, workspace.id, {
        url,
        expires_in_minutes: 60,
      });
      const result = await sendEmail(c.env, workspace.id, {
        to: target.email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      sent_via_email = result.ok;
    }

    return c.json({ url: sent_via_email ? null : url, sent_via_email });
  });

  // ─── Workspace settings (v0.1.15) ──────────────────────────────────
  //
  // GET is open to any authenticated member (some settings, like
  // session_ttl, affect everyone). Writes require admin.

  const SETTING_KEYS: SettingKey[] = [
    'session_ttl_seconds',
    'asset_public_alias_path',
    'public_brand_guide_enabled',
  ];
  function isSettingKey(k: string): k is SettingKey {
    return (SETTING_KEYS as string[]).includes(k);
  }

  app.get('/_ensemble/settings/:key', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const key = c.req.param('key');
    if (!isSettingKey(key)) return c.json({ error: `Unknown setting "${key}"` }, 404);
    const value = await getSetting(c.env, workspace.id, key);
    return c.json({ key, value });
  });

  app.get('/_ensemble/settings/session/options', async (c) => {
    // Static, but lives behind auth like the rest of the settings API.
    return c.json({ options: SESSION_TTL_OPTIONS });
  });

  app.put('/_ensemble/settings/:key', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const key = c.req.param('key');
    if (!isSettingKey(key)) return c.json({ error: `Unknown setting "${key}"` }, 404);
    const body = await c.req.json<{ value: string }>();
    if (typeof body.value !== 'string') {
      return c.json({ error: 'value must be a string' }, 400);
    }
    // Per-key validation.
    if (key === 'session_ttl_seconds') {
      const n = Number(body.value);
      if (!Number.isFinite(n)) return c.json({ error: 'session_ttl_seconds must be a number' }, 400);
      if (n < 60) return c.json({ error: 'session_ttl_seconds must be >= 60' }, 400);
    }
    if (key === 'public_brand_guide_enabled') {
      if (body.value !== 'true' && body.value !== 'false') {
        return c.json({ error: `${key} must be "true" or "false"` }, 400);
      }
    }
    if (key === 'asset_public_alias_path') {
      const err = validateAliasPath(body.value);
      if (err) return c.json({ error: err }, 400);
    }
    const user = c.get('user');
    await setSetting(c.env, workspace.id, key, body.value, user?.id);
    // Echo the parsed/clamped value back so the UI sees what we actually stored.
    const stored = key === 'session_ttl_seconds'
      ? String(parseSessionTtl(body.value))
      : body.value;
    return c.json({ key, value: stored });
  });

  // ─── Workspace locales (v0.1.15) ───────────────────────────────────

  app.get('/_ensemble/locales', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const locales = await listLocales(c.env, workspace.id);
    return c.json({ locales });
  });

  app.post('/_ensemble/locales', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const body = await c.req.json<{ code: string; display_name: string }>();
    if (!body.code || !body.display_name) {
      return c.json({ error: 'code and display_name are required' }, 400);
    }
    try {
      const locale = await addLocale(c.env, workspace.id, body);
      return c.json({ locale });
    } catch (err) {
      return c.json({ error: String(err) }, 400);
    }
  });

  app.patch('/_ensemble/locales/:code', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const code = c.req.param('code');
    const body = await c.req.json<{
      display_name?: string;
      enabled?: boolean;
      make_default?: boolean;
    }>();
    try {
      if (body.make_default) {
        await setDefaultLocale(c.env, workspace.id, code);
      } else if (body.display_name !== undefined || body.enabled !== undefined) {
        await patchLocale(c.env, workspace.id, code, body);
      }
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: String(err) }, 400);
    }
  });

  /**
   * Count how many localized brand_tokens rows exist for this locale.
   * The Languages tab uses this to drive a "you're about to delete N
   * translations" confirm before allowing removal.
   */
  app.get('/_ensemble/locales/:code/usage', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const code = c.req.param('code');
    const count = await countLocalizedBrandTokens(c.env, workspace.id, code);
    return c.json({ code, brand_token_count: count });
  });

  app.delete('/_ensemble/locales/:code', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    try {
      await removeLocale(c.env, workspace.id, c.req.param('code'));
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: String(err) }, 409);
    }
  });

  // GET /_ensemble/brand/tokens — pre-v0.1.98 fell through to SPA HTML.
  // It only ever had a PUT handler; the bare GET returns an honest 405
  // with a pointer to /brand/spec (where the token data actually lives,
  // inline). v0.1.99: registered here in credentials.ts where the PUT
  // handler also lives — sibling route, same place.
  app.get('/_ensemble/brand/tokens', (c) => c.json({
    error: 'method_not_allowed',
    message: 'This endpoint accepts PUT only (admin token writes). To READ brand tokens, fetch /brand/spec — the token values are inline under colors.*, typography.*, spatial.*.',
    allowed_methods: ['PUT'],
    canonical_admin_url: `${new URL(c.req.url).origin}/_ensemble/admin/brand/tokens`,
  }, 405));

  return app;
}

/** Pick a stable file extension for our allowlisted upload types. */
function extensionFor(mime: string): string {
  switch (mime) {
    case 'image/png': return '.png';
    case 'image/jpeg': return '.jpg';
    case 'image/svg+xml': return '.svg';
    case 'image/webp': return '.webp';
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return '.ico';
    default: return '';
  }
}

/**
 * Parse pixel width from the first 64 bytes of a raster image. Returns
 * null for unrecognized formats. Used by the upload route to embed
 * the resolution into the self-describing filename.
 *
 * PNG: width at bytes 16-19 (big-endian uint32) after the 8-byte
 *   PNG signature and the IHDR chunk header.
 * JPEG: SOFn marker (0xFFC0–C3) followed by length + precision; width
 *   is at offset 7 from the marker as a big-endian uint16.
 * WebP: VP8/VP8L/VP8X chunk at byte 12+ contains width — we handle
 *   only the lossy VP8 + lossless VP8L variants which cover ~99% of
 *   browser-produced webp.
 */
function parseImageWidth(buf: Uint8Array, mime: string): number | null {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (mime === 'image/png' && buf.length >= 24) {
    // PNG header: 89 50 4E 47 0D 0A 1A 0A, then IHDR chunk (length 4,
    // type 'IHDR', then width 4, height 4).
    return view.getUint32(16, false);
  }
  if (mime === 'image/jpeg' && buf.length >= 32) {
    // Walk JPEG segments until we hit a SOFn marker.
    let i = 2; // skip SOI (FFD8)
    while (i < buf.length - 10) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      const segLen = view.getUint16(i + 2, false);
      // SOF0/1/2/3 — baseline + progressive variants
      if (marker >= 0xc0 && marker <= 0xc3) {
        return view.getUint16(i + 7, false);
      }
      i += 2 + segLen;
    }
    return null;
  }
  if (mime === 'image/webp' && buf.length >= 30) {
    // RIFF....WEBPVP8 or VP8L or VP8X
    const fourcc = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
    if (fourcc === 'VP8 ') {
      // bytes 26-27, little-endian, 14-bit (mask 0x3fff)
      return view.getUint16(26, true) & 0x3fff;
    }
    if (fourcc === 'VP8L') {
      // bytes 21-22, packed: width-1 in 14 bits little-endian
      const b1 = buf[21];
      const b2 = buf[22];
      return ((b2 << 8) | b1 & 0xff) + 1 - ((b1 & 0xc0) << 8) /* sign-correct mask */;
    }
    if (fourcc === 'VP8X' && buf.length >= 30) {
      // bytes 24-26 little-endian 24-bit width-1
      return ((buf[26] << 16) | (buf[25] << 8) | buf[24]) + 1;
    }
  }
  return null;
}
