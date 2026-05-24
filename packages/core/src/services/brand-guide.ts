/**
 * Public brand guide renderer.
 *
 * Server-rendered HTML at /brand that surfaces the workspace's brand
 * identity for external sharing: wordmark, color palette with copyable
 * hex codes, typography stack, logo variants, and contact info.
 *
 * Headers + meta tags enforce noindex/nofollow so the page doesn't
 * appear in search. The page works without shell JS so it loads
 * instantly and renders even for visitors with JS disabled.
 */

import { resolveBrandImage } from './brand-images';
import { parseWordmarkSegments } from './wordmark-segments';
import type { FontRole, ResolvedRole, TextTransform } from './font-roles';

interface Env {
  DB: D1Database;
}

interface BrandData {
  workspace_name: string;
  /**
   * Brand description for the public guide. Sourced from the
   * `elevator_pitch` messaging token (operator-editable in
   * Brand → Messaging), NOT a column on the workspaces table —
   * workspaces only carries identity, not narrative copy.
   */
  workspace_description: string | null;
  workspace_slug: string;
  tagline: string | null;
  accent: string;
  tokens: Record<string, string>;
  wordmark_segments: Array<{ text: string; color?: string }>;
}

async function loadBrandData(env: Env, workspaceId: string): Promise<BrandData> {
  const ws = await env.DB.prepare(`SELECT name, slug FROM workspaces WHERE id = ?`)
    .bind(workspaceId)
    .first<{ name: string; slug: string }>();

  const rows = await env.DB.prepare(
    `SELECT key, value, category FROM brand_tokens
       WHERE workspace_id = ? AND category IN ('identity', 'colors', 'typography', 'messaging')
         AND locale = ''`,
  )
    .bind(workspaceId)
    .all<{ key: string; value: string; category: string }>();

  const tokens: Record<string, string> = {};
  for (const r of rows.results ?? []) tokens[r.key] = r.value;

  return {
    workspace_name: ws?.name ?? 'Workspace',
    workspace_slug: (ws?.slug ?? workspaceId).toLowerCase(),
    // Source description from elevator_pitch — it's the closest
    // operator-curated "what does this workspace do" string we have.
    // Falls back to null so the brand-guide renderer can hide the
    // description block entirely.
    workspace_description: tokens['elevator_pitch'] ?? null,
    tagline: tokens['tagline'] ?? null,
    accent: tokens['accent'] || '#3B82F6',
    tokens,
    wordmark_segments: parseWordmarkSegments(tokens['wordmark_text'] ?? ''),
  };
}

export async function renderBrandGuide(env: Env, workspaceId: string): Promise<string> {
  const brand = await loadBrandData(env, workspaceId);
  // Apply the operator's pretty asset alias on every URL we render.
  // Stored brand_token values stay canonical — transforming on read
  // means changing the alias path never breaks the stored data.
  const { applyAssetAlias, getSetting } = await import('./workspace-settings');
  const aliasPath = (await getSetting(env as { DB: D1Database }, workspaceId, 'asset_public_alias_path')).trim();
  const wordmarkLight = applyAssetAlias(resolveBrandImage(brand.tokens, 'wordmark', { mode: 'light' }), aliasPath);
  const iconLight = applyAssetAlias(resolveBrandImage(brand.tokens, 'icon_mark', { mode: 'light' }), aliasPath);
  const wordmarkDark = applyAssetAlias(resolveBrandImage(brand.tokens, 'wordmark', { mode: 'dark' }), aliasPath);
  const iconDark = applyAssetAlias(resolveBrandImage(brand.tokens, 'icon_mark', { mode: 'dark' }), aliasPath);

  // v0.1.32+: policy-driven approved + banned variants. The variants
  // gallery pulls live from the generator endpoint; the banned-uses
  // gallery renders the same logo with red Xs and a reason caption.
  const { loadPolicy, effectiveBannedPairs } = await import('./brand-policy');
  const policy = await loadPolicy(env.DB, workspaceId);
  const brandColors = {
    bgLight: brand.tokens['brand-background-light'] || '#ffffff',
    bgDark: brand.tokens['brand-background-dark'] || '#0a0a0a',
    primary: brand.tokens['brand-primary'] || brand.accent,
  };
  const bannedPairs = effectiveBannedPairs(policy, brandColors);
  const allComps = Object.entries(policy.compositions) as Array<[string, { allowed: boolean }]>;
  const approvedComps = allComps.filter(([, c]) => c.allowed).map(([id]) => id);
  // v0.1.47+: compositions explicitly disabled in policy show up in
  // the banned-uses gallery so external consumers learn the brand's
  // approved-vs-banned compositions visually.
  const bannedComps = allComps.filter(([, c]) => !c.allowed).map(([id]) => id);
  const approvedFinishes = policy.finishes.filter((f) => f.allowed);
  const approvedBgs = policy.backgrounds.filter((b) => b.allowed);
  const banSet = new Set(bannedPairs.map((b) => `${b.finishId}|${b.backgroundId}`));

  const font =
    tokens('font_sans', brand.tokens) ||
    `-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`;

  // v0.1.57: load all configured typography roles for the expanded
  // typography section. Each role carries family + weight + style +
  // letter-spacing + text-transform + font-size. We render one
  // specimen per role using the workspace's actual settings.
  const { loadAndResolveRoles } = await import('./font-roles');
  let typographyRoles: Awaited<ReturnType<typeof loadAndResolveRoles>> | null = null;
  try {
    typographyRoles = await loadAndResolveRoles(env.DB, workspaceId);
  } catch {
    /* fall back to single-pangram section */
  }

  const colorEntries = Object.entries(brand.tokens)
    .filter(([k, v]) => isHex(v) && !k.startsWith('logo_'))
    .map(([k, v]) => ({ name: prettifyTokenKey(k), value: v }));

  // v0.1.55: brand-colors HTML emitter — same visual model as the
  // BrandCard display mode used on the Brand Overview tab. Falls
  // back to the legacy swatch grid when the new doc isn't present
  // (which on a single-workspace install should never happen, but
  // the legacy path stays as a safety net for graceful degradation).
  let brandColorsHtml = '';
  try {
    const { loadBrandColors } = await import('./brand-colors/load');
    const { renderBrandColorsHtml } = await import('./brand-colors/render-html');
    const doc = await loadBrandColors(env.DB, workspaceId);
    brandColorsHtml = renderBrandColorsHtml(doc);
  } catch {
    /* fall through to legacy */
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(brand.workspace_name)} — Brand</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: ${font}; color: #111827; background: #ffffff; }
      .container { max-width: 980px; margin: 0 auto; padding: 48px 24px; }
      header { padding-bottom: 32px; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px; }
      h1 { font-size: 18px; font-weight: 500; color: #6b7280; margin: 0 0 8px; }
      h2 { font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin: 32px 0 12px; }
      .wordmark { font-size: 42px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; margin: 8px 0; }
      .tagline { font-size: 18px; color: #6b7280; margin: 8px 0 0; line-height: 1.5; }
      .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
      .swatch { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; cursor: pointer; transition: transform 0.1s; }
      .swatch:hover { transform: translateY(-1px); }
      .swatch .color { height: 80px; }
      .swatch .meta { padding: 10px 12px; font-size: 13px; }
      .swatch .meta strong { display: block; color: #111827; }
      .swatch .meta code { color: #6b7280; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
      .logo-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
      /* v0.1.57: logo tiles use the same #808080 mid-grey chrome
         the Brand Overview matrix uses (50%-luminance preview surface
         — shows true light/dark logo relationships without bias). */
      .logo-tile {
        background: #808080;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        padding: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 120px;
      }
      .logo-tile img { max-width: 100%; max-height: 80px; }
      /* Typography specimens — one row per configured role. */
      .typography-card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 0;
        overflow: hidden;
      }
      .typo-row {
        display: grid;
        grid-template-columns: 160px 1fr;
        gap: 24px;
        align-items: baseline;
        padding: 20px 24px;
        border-top: 1px solid #f3f4f6;
      }
      .typo-row:first-child { border-top: 0; }
      .typo-meta { font-size: 11px; color: #71717a; }
      .typo-meta .role {
        font-weight: 500;
        color: #18181b;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        display: block;
        margin-bottom: 4px;
      }
      .typo-meta .stack {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10px;
        color: #a1a1aa;
        word-break: break-word;
      }
      .typo-meta .vitals {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10px;
        color: #a1a1aa;
        margin-top: 2px;
      }
      .typo-specimen { line-height: 1.25; color: #18181b; }
      footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="container">
      <header>
        <h1>Brand guide</h1>
        ${renderWordmark(brand)}
        ${brand.tagline ? `<p class="tagline">${escapeHtml(brand.tagline)}</p>` : ''}
      </header>

      ${
        wordmarkLight || iconLight || wordmarkDark || iconDark
          ? `<section>
              <h2>Logo marks</h2>
              <div class="logo-grid">
                ${wordmarkLight ? logoTile('Wordmark', wordmarkLight, false) : ''}
                ${wordmarkDark ? logoTile('Wordmark · dark', wordmarkDark, true) : ''}
                ${iconLight ? logoTile('Icon', iconLight, false) : ''}
                ${iconDark ? logoTile('Icon · dark', iconDark, true) : ''}
              </div>
            </section>`
          : ''
      }

      <section>
        <h2>Approved uses</h2>
        <p style="font-size:13px;color:#6b7280;margin:0 0 12px;">
          Every composition × finish × background combination approved by this brand.
          Use these freely.
        </p>
        ${approvedComps.map((composition) => `
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin:16px 0 8px;">
            ${escapeHtml(composition.replace('-', ' '))}
          </p>
          <div class="logo-grid">
            ${approvedFinishes.flatMap((finish) =>
              approvedBgs.map((bg) => {
                if (banSet.has(`${finish.id}|${bg.id}`)) return '';
                const compShort = composition === 'wordmark-only' ? 'wordmark'
                  : composition === 'icon-only' ? 'icon'
                  : composition;
                const renderUrl = applyAssetAlias(
                  `/_ensemble/brand/render/${brand.workspace_slug}-${compShort}-${finish.id}-${bg.id}.svg`,
                  aliasPath,
                ) ?? '';
                // v0.1.57: every logo tile uses the same #808080
                // mid-grey chrome regardless of bg variant. The
                // background color is already INSIDE the rendered
                // SVG via the padding system; the outer tile is a
                // neutral preview surface.
                return `<div>
                  <div class="logo-tile">
                    <img src="${escapeAttr(renderUrl)}" alt="${escapeHtml(`${finish.label} on ${bg.label}`)}">
                  </div>
                  <p style="font-size:12px;color:#6b7280;margin:8px 0 0;">${escapeHtml(`${finish.label} · ${bg.label}`)}</p>
                </div>`;
              }),
            ).join('')}
          </div>
        `).join('')}

        <!-- v0.1.54: separate Backgrounded section removed.
             Light/dark background variants in the matrix above
             already use the policy.backgrounded.padding setting
             configured in Brand → Logos → Background settings. -->
      </section>

      ${(bannedPairs.length > 0 || bannedComps.length > 0) ? `
      <section>
        <h2>Banned uses</h2>
        <p style="font-size:13px;color:#6b7280;margin:0 0 12px;">
          Don't use the logo in these combinations — they're either illegible
          (insufficient contrast) or off-brand by policy.
        </p>
        <div class="logo-grid">
          ${bannedComps.map((composition) => {
            // v0.1.47+: render a sample of this banned composition with the
            // red X overlay so consumers learn the brand's allowed lockups.
            // Uses full-color × transparent as the sample finish/bg since
            // we just need to show *what the composition looks like*.
            const compShort = composition === 'wordmark-only' ? 'wordmark'
              : composition === 'icon-only' ? 'icon'
              : composition;
            const renderUrl = applyAssetAlias(
              `/_ensemble/brand/render/${brand.workspace_slug}-${compShort}-full-color-transparent.svg`,
              aliasPath,
            ) ?? '';
            const label = composition.replace('-', ' ');
            return `<div>
              <div class="logo-tile" style="position:relative;">
                <img src="${escapeAttr(renderUrl)}" alt="banned composition: ${escapeAttr(label)}">
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
                  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line x1="5" y1="5" x2="95" y2="95" stroke="#c62828" stroke-width="3"/>
                    <line x1="95" y1="5" x2="5" y2="95" stroke="#c62828" stroke-width="3"/>
                  </svg>
                </div>
              </div>
              <p style="font-size:12px;color:#c62828;margin:8px 0 0;font-weight:600;text-transform:capitalize;">${escapeHtml(label)} lockup</p>
              <p style="font-size:11px;color:#6b7280;margin:2px 0 0;">Not an approved composition for this brand.</p>
            </div>`;
          }).join('')}
          ${bannedPairs.map((ban) => {
            const finish = policy.finishes.find((f) => f.id === ban.finishId);
            const bg = policy.backgrounds.find((b) => b.id === ban.backgroundId);
            if (!finish || !bg) return '';
            const renderUrl = applyAssetAlias(
              `/_ensemble/brand/render/${brand.workspace_slug}-wordmark-${ban.finishId}-${ban.backgroundId}.svg`,
              aliasPath,
            ) ?? '';
            return `<div>
              <div class="logo-tile" style="position:relative;">
                <img src="${escapeAttr(renderUrl)}" alt="banned use">
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
                  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line x1="5" y1="5" x2="95" y2="95" stroke="#c62828" stroke-width="3"/>
                    <line x1="95" y1="5" x2="5" y2="95" stroke="#c62828" stroke-width="3"/>
                  </svg>
                </div>
              </div>
              <p style="font-size:12px;color:#c62828;margin:8px 0 0;font-weight:600;">${escapeHtml(`${finish.label} · ${bg.label}`)}</p>
              ${ban.reason ? `<p style="font-size:11px;color:#6b7280;margin:2px 0 0;">${escapeHtml(ban.reason)}</p>` : ''}
            </div>`;
          }).join('')}
        </div>
      </section>
      ` : ''}

      ${
        brandColorsHtml
          ? `<section>
              <h2>Brand colors</h2>
              ${brandColorsHtml}
            </section>`
          : colorEntries.length > 0
            ? `<section>
                <h2>Colors</h2>
                <div class="grid">
                  ${colorEntries.map((c) => swatch(c.name, c.value)).join('')}
                </div>
              </section>`
            : ''
      }

      <section>
        <h2>Typography</h2>
        ${renderTypographySection(typographyRoles, font)}
      </section>

      <footer>
        ${escapeHtml(brand.workspace_name)}${brand.workspace_description ? ' · ' + escapeHtml(brand.workspace_description) : ''}
      </footer>
    </div>
    <script>
      // Click a swatch to copy its hex.
      for (const el of document.querySelectorAll('.swatch')) {
        el.addEventListener('click', () => {
          const hex = el.getAttribute('data-hex');
          if (!hex) return;
          navigator.clipboard?.writeText(hex);
          const meta = el.querySelector('.meta code');
          if (meta) {
            const orig = meta.textContent;
            meta.textContent = 'Copied!';
            setTimeout(() => { meta.textContent = orig; }, 1200);
          }
        });
      }
    </script>
  </body>
</html>`;
}

function renderWordmark(brand: BrandData): string {
  if (brand.wordmark_segments.length > 0) {
    return `<div class="wordmark">${brand.wordmark_segments
      .map(
        (s) =>
          `<span${s.color ? ` style="color:${escapeAttr(s.color)}"` : ''}>${escapeHtml(s.text)}</span>`,
      )
      .join('')}</div>`;
  }
  return `<div class="wordmark" style="color:${escapeAttr(brand.accent)}">${escapeHtml(brand.workspace_name)}</div>`;
}

function logoTile(label: string, src: string, _dark: boolean): string {
  // v0.1.57: dark parameter retained for signature compat but
  // ignored — every logo tile uses the same #808080 chrome now.
  return `<div>
    <div class="logo-tile">
      <img src="${escapeAttr(src)}" alt="${escapeHtml(label)}">
    </div>
    <p style="font-size:12px;color:#6b7280;margin:8px 0 0;">${escapeHtml(label)}</p>
  </div>`;
}

function swatch(name: string, hex: string): string {
  return `<div class="swatch" data-hex="${escapeAttr(hex)}" title="Click to copy">
    <div class="color" style="background:${escapeAttr(hex)}"></div>
    <div class="meta">
      <strong>${escapeHtml(name)}</strong>
      <code>${escapeHtml(hex)}</code>
    </div>
  </div>`;
}

function tokens(key: string, t: Record<string, string>): string | undefined {
  return t[key];
}

function isHex(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}

function prettifyTokenKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

/* ──────────────────────────────────────────────────────────────
 * Typography section — v0.1.57 expansion
 *
 * Replaces the pre-v0.1.57 two-pangram block with a per-role
 * specimen card. Renders one row per CONFIGURED role using the
 * operator's actual family + weight + style + letter-spacing +
 * text-transform + font-size. Mirrors the structure of the
 * Brand Overview typography specimen card.
 *
 * When the role loader fails (no DB, fresh workspace) the section
 * gracefully falls back to the legacy pangram block.
 * ──────────────────────────────────────────────────────────── */

interface RoleSpec {
  key: FontRole;
  label: string;
  preview: string;
}

const ROLE_DISPLAY_ORDER: RoleSpec[] = [
  { key: 'display',    label: 'Display',    preview: 'Make something beautiful' },
  { key: 'heading',    label: 'Heading',    preview: 'The quick brown fox' },
  { key: 'subheading', label: 'Subheading', preview: 'Card title or modal heading' },
  { key: 'body',       label: 'Body',       preview: 'The quick brown fox jumps over the lazy dog. Used for paragraphs, descriptions, and most reading.' },
  { key: 'eyebrow',    label: 'Eyebrow',    preview: 'Product update' },
  { key: 'label',      label: 'Label',      preview: 'Save changes' },
  { key: 'caption',    label: 'Caption',    preview: 'Updated 5 minutes ago. Source: Ensemble v0.1.57 release notes.' },
  { key: 'mono',       label: 'Mono',       preview: 'const x = 42;' },
];

function renderTypographySection(
  roles: Record<FontRole, ResolvedRole> | null,
  fallbackFontStack: string,
): string {
  if (!roles) {
    // Legacy fallback when the role loader failed (e.g. fresh DB).
    return `<div class="typography-card" style="padding:24px;">
      <p style="font-size:28px;font-weight:700;line-height:1.2;margin:0 0 12px;">The quick brown fox jumps over the lazy dog.</p>
      <p style="font-size:18px;font-weight:500;line-height:1.4;margin:0 0 12px;">The quick brown fox jumps over the lazy dog.</p>
      <p style="font-size:15px;line-height:1.5;color:#6b7280;margin:0;">Stack: ${escapeHtml(fallbackFontStack)}</p>
    </div>`;
  }

  // Build one row per role using the operator's actual settings.
  const rows = ROLE_DISPLAY_ORDER.map((spec) => {
    const r = roles[spec.key];
    if (!r) return '';
    // Family stack — synthesize from family + sensible fallback chain.
    const stack = familyStack(r.family, spec.key);
    const styleAttr = r.style === 'italic' ? 'italic' : 'normal';
    const transformAttr = (r.textTransform || 'none') as TextTransform;
    // Compute display size — clamp super-large display down so the
    // /brand guide doesn't overflow its container on small screens.
    const sizeRem = parseFloat(r.fontSize) || 1;
    const displaySize = Math.min(sizeRem, 3) + 'rem';
    return `
      <div class="typo-row">
        <div class="typo-meta">
          <span class="role">${escapeHtml(spec.label)}</span>
          <div class="stack">${escapeHtml(r.family)}${r.inheritedFrom ? ` <span style="color:#a1a1aa;">· inherits from ${escapeHtml(r.inheritedFrom)}</span>` : ''}</div>
          <div class="vitals">${escapeHtml(r.weight)} · ${escapeHtml(displaySize)}${r.style === 'italic' ? ' · italic' : ''}${r.letterSpacing && r.letterSpacing !== '0em' ? ` · ${escapeHtml(r.letterSpacing)}` : ''}${transformAttr !== 'none' ? ` · ${escapeHtml(transformAttr)}` : ''}</div>
        </div>
        <div class="typo-specimen"
             style="font-family:${escapeAttr(stack)};font-weight:${escapeAttr(r.weight)};font-style:${styleAttr};font-size:${displaySize};letter-spacing:${escapeAttr(r.letterSpacing || '0')};text-transform:${transformAttr};">
          ${escapeHtml(spec.preview)}
        </div>
      </div>
    `;
  }).join('');

  return `<div class="typography-card">${rows}</div>`;
}

/**
 * Build a CSS font-family stack from a role's family + sensible
 * generic fallback. Wraps multi-word families in quotes.
 */
function familyStack(family: string, role: FontRole): string {
  const generic = role === 'mono' ? 'ui-monospace, monospace' : 'system-ui, sans-serif';
  // System families don't need quotes.
  if (/^(system-ui|sans-serif|serif|monospace|ui-monospace|-apple-system)$/i.test(family.trim())) {
    return `${family}, ${generic}`;
  }
  return `"${family}", ${generic}`;
}
