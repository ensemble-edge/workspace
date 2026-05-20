/**
 * Overview Tab — Visual brand summary at a glance.
 *
 * Fetches the brand spec and renders a live preview showing:
 * - Company identity
 * - Color palette swatches
 * - Typography specimens
 * - Key messaging
 * - Export links
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Copy, ExternalLink, Download, Palette, Type, MessageSquare } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Skeleton,
  Separator,
  Wordmark,
  toast,
} from '@ensemble-edge/ui';
import type { WordmarkSegment } from '@ensemble-edge/ui';

import { getRelativeLuminance } from './color-utils';
import { authedFetch } from '../../../state';
import { subscribeWorkspaceEvent } from '../../../state/events';

interface BrandSpec {
  ensemble_brand: string;
  identity: {
    display_name: string;
    legal_name?: string;
    industry?: string;
    headquarters?: string;
    founding_year?: string;
    website?: string;
  };
  colors: {
    groups: Array<{ slug: string; label: string; shades: Record<string, string> }>;
    semantic: Record<string, string>;
  };
  typography: {
    display?: { family: string; category?: string };
    heading?: { family: string; category?: string };
    body?: { family: string; category?: string };
    mono?: { family: string; category?: string };
  };
  messaging: {
    tagline?: string;
    elevator_pitch?: string;
    mission?: string;
    tone?: { descriptors?: string[] };
    value_props?: Array<{ headline: string; description: string }>;
  };
  logos: Record<string, string>;
  endpoints?: Record<string, string>;
}

interface ResolvedFontRole {
  family: string;
  weight: string;
  style: 'normal' | 'italic';
  letterSpacing: string;
  textTransform: 'none' | 'uppercase' | 'lowercase';
  fontSize: string;
  scaleRatio: string;
  stack: string;
  label?: string;
  usage?: string;
}

type FontRoleKey =
  | 'display' | 'heading' | 'subheading' | 'body'
  | 'eyebrow' | 'label' | 'caption' | 'mono';

/** Shared specimen sample text — the canonical English pangram. */
const SPECIMEN_PANGRAM = 'The quick brown fox jumps over the lazy dog.';

/** Display order of roles in the specimen card. Wordmark omitted by design. */
const SPECIMEN_ORDER: FontRoleKey[] = [
  'display', 'heading', 'subheading', 'body', 'eyebrow', 'label', 'caption', 'mono',
];

/** Compute the three H-step sizes from a base + ratio. Mirrors server logic. */
function computeScaleStepsClient(baseRem: string, ratio: string): [string, string, string] {
  const base = parseFloat(baseRem);
  const r = parseFloat(ratio);
  if (!isFinite(base) || !isFinite(r) || r <= 0) return [baseRem, baseRem, baseRem];
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return [`${round(base)}rem`, `${round(base / r)}rem`, `${round(base / (r * r))}rem`];
}

function remToPx(rem: string): string {
  const n = parseFloat(rem);
  return isFinite(n) ? `${Math.round(n * 16)}px` : rem;
}

export function OverviewTab() {
  const [spec, setSpec] = useState<BrandSpec | null>(null);
  const [wordmarkSegments, setWordmarkSegments] = useState<WordmarkSegment[]>([]);
  const [activeFonts, setActiveFonts] = useState<Record<string, ResolvedFontRole> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Spec + wordmark_text + resolved-fonts-with-sizes in parallel.
    Promise.all([
      authedFetch('/_ensemble/brand/spec').then((r) => r.json() as Promise<BrandSpec>),
      authedFetch('/_ensemble/core/brand/tokens/identity')
        .then((r) => r.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
        .then((res) => {
          const raw = (res.data ?? []).find((t) => t.key === 'wordmark_text');
          if (!raw?.value) return [] as WordmarkSegment[];
          try {
            const parsed = JSON.parse(raw.value) as WordmarkSegment[];
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })
        .catch(() => [] as WordmarkSegment[]),
      authedFetch('/_ensemble/core/brand/fonts/active')
        .then((r) => r.json() as Promise<{ roles?: Record<string, ResolvedFontRole> }>)
        .then((res) => res.roles ?? null)
        .catch(() => null),
    ])
      .then(([data, segments, fonts]) => {
        setSpec(data);
        setWordmarkSegments(segments);
        setActiveFonts(fonts);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!spec) return <p className="text-muted-foreground">Failed to load brand spec.</p>;

  const name = spec.identity.display_name || 'Workspace';
  const hasColors = spec.colors.groups.length > 0;
  const hasMessaging = !!(spec.messaging.tagline || spec.messaging.mission);
  const specUrl = spec.endpoints?.spec || `${window.location.origin}/_ensemble/brand/spec`;
  const cssUrl = spec.endpoints?.css || `${window.location.origin}/_ensemble/brand/css`;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card>
        <CardContent className="px-8 py-10">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              {/* Renders styled-text segments when configured, image
                  wordmark when set, or plain name as final fallback.
                  Wrap in a block element so the wordmark sits inside
                  its own line box with proper top padding from the
                  surrounding flex container. */}
              <div className="pt-2">
                <Wordmark
                  segments={wordmarkSegments}
                  imageUrl={spec.logos.wordmark}
                  name={name}
                  imageHeight={48}
                  className="text-4xl"
                />
              </div>
              {spec.messaging.tagline && (
                <p className="mt-2 text-lg text-muted-foreground">{spec.messaging.tagline}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {spec.identity.industry && <Badge variant="outline">{spec.identity.industry}</Badge>}
                {spec.identity.headquarters && <Badge variant="outline">{spec.identity.headquarters}</Badge>}
                {spec.identity.founding_year && <Badge variant="outline">Est. {spec.identity.founding_year}</Badge>}
              </div>
            </div>
            {spec.logos.icon_mark && (
              <img src={spec.logos.icon_mark} alt={name} className="h-16 w-16 rounded-lg object-contain" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Color Palette */}
      {hasColors && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" /> Color Palette
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {spec.colors.groups.map((group) => (
              <div key={group.slug}>
                <p className="text-sm font-medium text-muted-foreground mb-2">{group.label}</p>
                <div className="flex gap-1 overflow-hidden rounded-lg">
                  {Object.entries(group.shades)
                    .sort(([a], [b]) => {
                      const numA = Number(a), numB = Number(b);
                      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                      return a.localeCompare(b);
                    })
                    .map(([shade, hex]) => {
                      const lum = getRelativeLuminance(hex);
                      return (
                        <div
                          key={shade}
                          className="flex flex-1 h-12 items-end justify-center pb-1 text-[10px] font-medium min-w-[32px]"
                          style={{ backgroundColor: hex, color: lum < 0.5 ? '#fff' : '#000' }}
                          title={`${group.slug}-${shade}: ${hex}`}
                        >
                          {shade}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}

            {/* Semantic */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Semantic</p>
              <div className="flex gap-2">
                {(['success', 'warning', 'error', 'info'] as const).map((key) => {
                  const hex = spec.colors.semantic[key];
                  if (!hex) return null;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded" style={{ backgroundColor: hex }} />
                      <span className="text-xs text-muted-foreground capitalize">{key}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Typography specimen — full width, renders every content role at
          its real brand tokens (family/weight/size/letter-spacing/case)
          with the canonical pangram so cross-role visual comparison is
          apples-to-apples. Wordmark is intentionally omitted; it's a
          lockup, not a typeface specimen. */}
      {activeFonts && (
        <TypographySpecimenCard fonts={activeFonts} />
      )}

      {/* Logo variants matrix — composition × finish × background.
          Renders only approved combinations. Each cell exposes copy
          (SVG markup / URL) and download (SVG) actions. The brand
          guide shows the same matrix + the banned-uses gallery. */}
      <LogoVariantsCard />

      {/* Favicon specimen — shows what the operator's browser tab,
          home screen icon, and bookmark will display. Generated from
          the icon mark SVG via /favicon.svg. */}
      <FaviconCard />

      {/* v0.1.53: full favicon suite — operator copies the <head>
          block into their site to wire up every browser/OS variant
          (SVG, ICO legacy, iOS apple-touch-icon, Android manifest). */}
      <FaviconSuiteCard />


      <div className="grid gap-6 lg:grid-cols-2">
        {/* Messaging */}
        {hasMessaging && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> Voice
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {spec.messaging.mission && (
                <div>
                  <p className="text-xs text-muted-foreground">Mission</p>
                  <p className="text-sm">{spec.messaging.mission}</p>
                </div>
              )}
              {spec.messaging.tone?.descriptors && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tone</p>
                  <div className="flex flex-wrap gap-1">
                    {spec.messaging.tone.descriptors.map((d) => (
                      <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {spec.messaging.value_props && spec.messaging.value_props.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Value Propositions</p>
                  {spec.messaging.value_props.map((vp, i) => (
                    <p key={i} className="text-sm"><strong>{vp.headline}</strong> — {vp.description}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Export</CardTitle>
          <CardDescription>Use your brand in any project</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => {
              navigator.clipboard.writeText(`<link rel="stylesheet" href="${cssUrl}" />`);
              toast.success('CSS link tag copied');
            }}>
              <Copy className="mr-2 h-3 w-3" /> CSS Link Tag
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              window.open(specUrl, '_blank');
            }}>
              <ExternalLink className="mr-2 h-3 w-3" /> View Spec JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${name.toLowerCase().replace(/\s+/g, '-')}-brand.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}>
              <Download className="mr-2 h-3 w-3" /> Download Spec
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              navigator.clipboard.writeText(specUrl);
              toast.success('Spec URL copied');
            }}>
              <Copy className="mr-2 h-3 w-3" /> Copy Spec URL
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Typography Specimen ─────────────────────────────────────────────

/**
 * Full-width specimen showing every content role rendered at its real
 * brand tokens (family/weight/size/letter-spacing/case) with the same
 * pangram. Cross-role differences become obvious because content is
 * held constant — only typography changes.
 *
 * Heading and Subheading each render three H-step rows (H1/H2/H3 and
 * H4/H5/H6) computed from base size × scale ratio, so the operator sees
 * the resulting hierarchy at a glance.
 */
function TypographySpecimenCard({ fonts }: { fonts: Record<string, ResolvedFontRole> }) {
  const present = SPECIMEN_ORDER.filter((k) => !!fonts[k]);
  if (present.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Type className="h-5 w-5" /> Typography
        </CardTitle>
        <CardDescription>
          Each role rendered at the brand's configured family, weight,
          size, letter-spacing, and case.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {present.map((role) => (
          <SpecimenRow key={role} role={role} font={fonts[role]} />
        ))}
      </CardContent>
    </Card>
  );
}

function SpecimenRow({ role, font }: { role: FontRoleKey; font: ResolvedFontRole }) {
  const isScaled = role === 'heading' || role === 'subheading';
  const tags: [string, string, string] = role === 'heading'
    ? ['H1', 'H2', 'H3']
    : ['H4', 'H5', 'H6'];

  const baseStyle: React.CSSProperties = {
    fontFamily: font.stack || `"${font.family}", sans-serif`,
    fontWeight: Number(font.weight) || 400,
    fontStyle: font.style,
    letterSpacing: font.letterSpacing,
    textTransform: font.textTransform,
    lineHeight: 1.2,
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {font.label ?? role} <span className="text-muted-foreground/60">— {font.family}</span>
        </p>
        {!isScaled && (
          <p className="text-[10px] font-mono text-muted-foreground">
            {font.fontSize} ({remToPx(font.fontSize)})
          </p>
        )}
      </div>
      {isScaled ? (
        <div className="space-y-3">
          {computeScaleStepsClient(font.fontSize, font.scaleRatio).map((size, i) => (
            <div key={tags[i]} className="flex items-baseline gap-3">
              <span className="text-[10px] font-mono text-muted-foreground w-14 shrink-0">
                {tags[i]} · {remToPx(size)}
              </span>
              <p style={{ ...baseStyle, fontSize: size }} className="m-0 break-words flex-1">
                {SPECIMEN_PANGRAM}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ ...baseStyle, fontSize: font.fontSize }} className="m-0 break-words">
          {SPECIMEN_PANGRAM}
        </p>
      )}
      {font.usage && (
        <p className="text-xs text-muted-foreground/80 mt-1">{font.usage}</p>
      )}
    </div>
  );
}

// ─── Logo Variants ─────────────────────────────────────────────────

type CompositionId = 'wordmark-only' | 'icon-only' | 'stacked' | 'horizontal';
type FinishId = 'full-color' | 'mono-black' | 'mono-white' | 'mono-brand';

interface PolicyResponse {
  policy: {
    compositions: Record<CompositionId, { allowed: boolean }>;
    finishes: Array<{ id: FinishId; label: string; allowed: boolean }>;
    backgrounds: Array<{ id: string; label: string; allowed: boolean }>;
    backgrounded?: {
      allowed: boolean;
      lightAllowed: boolean;
      darkAllowed: boolean;
      padding: number;
    };
  };
  effectiveBans: Array<{ finishId: FinishId; backgroundId: string; reason?: string }>;
  workspaceSlug?: string;
  /** Operator-configured pretty alias path (e.g. 'assets'). Empty
   *  string means no alias is set → fall back to canonical
   *  /_ensemble/brand/render/ URLs. */
  assetAliasPath?: string;
}

/**
 * Full Composition × Finish × Background matrix. Only renders cells
 * that are approved by the operator's policy AND pass WCAG contrast.
 * Each cell shows the live-generated SVG and exposes copy + download
 * actions.
 */
function LogoVariantsCard() {
  const [policy, setPolicy] = useState<PolicyResponse | null>(null);
  // v0.1.51: reloadToken bumps on every brand.tokens.changed event so
  // the variant cells re-fetch their <img> URLs after typography or
  // policy edits. The cache key on the server side is content-hashed
  // (so it auto-invalidates), but the BROWSER also caches the <img>
  // URL — bumping the token forces a fresh GET so the operator sees
  // their save reflected immediately, not after the browser cache
  // happens to expire.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    authedFetch('/_ensemble/core/brand/logo-policy')
      .then((r) => r.json() as Promise<PolicyResponse>)
      .then(setPolicy)
      .catch(() => { /* no policy → card hidden */ });
  }, [reloadToken]);

  useEffect(() => {
    return subscribeWorkspaceEvent((e) => {
      if (e.type === 'brand.tokens.changed') {
        setReloadToken((t) => t + 1);
      }
    });
  }, []);

  if (!policy) return null;

  const approvedComps = (Object.entries(policy.policy.compositions) as Array<[CompositionId, { allowed: boolean }]>)
    .filter(([, c]) => c.allowed)
    .map(([id]) => id);
  const approvedFinishes = policy.policy.finishes.filter((f) => f.allowed);
  const approvedBgs = policy.policy.backgrounds.filter((b) => b.allowed);

  const banSet = new Set(
    policy.effectiveBans.map((b) => `${b.finishId}|${b.backgroundId}`),
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" /> Logo variants
        </CardTitle>
        <CardDescription>
          Approved compositions × finishes × backgrounds. Every cell is
          generated live from your SVG masters and brand colors. Download
          SVG, copy markup, or copy URL for any cell.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {approvedComps.map((composition) => (
          <div key={composition} className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {composition.replace('-', ' ')}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {approvedFinishes.flatMap((finish) =>
                approvedBgs.map((bg) => {
                  if (banSet.has(`${finish.id}|${bg.id}`)) return null;
                  return (
                    <VariantCell
                      key={`${composition}-${finish.id}-${bg.id}-${reloadToken}`}
                      composition={composition}
                      finish={finish}
                      background={bg}
                      workspaceSlug={policy.workspaceSlug || 'workspace'}
                      assetAliasPath={policy.assetAliasPath || ''}
                    />
                  );
                }),
              )}
            </div>
          </div>
        ))}

        {/* v0.1.54: separate "Backgrounded" row removed. Light/dark
            background variants now automatically use the padding
            configured in Brand → Logos → Background settings, so
            there's no longer a distinct "backgrounded" concept to
            display. Operators see one cohesive variants matrix:
            Composition × Finish × Background. */}
      </CardContent>
    </Card>
  );
}

function VariantCell({
  composition,
  finish,
  background,
  workspaceSlug,
  assetAliasPath,
}: {
  composition: CompositionId;
  finish: { id: FinishId; label: string };
  background: { id: string; label: string };
  workspaceSlug: string;
  /** Pretty alias path (e.g. 'assets'). Empty → use canonical /_ensemble/. */
  assetAliasPath: string;
}) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  // Unified URL model (v0.1.46+): every brand resource lives under
  // /_ensemble/brand/* canonically; if the operator has configured
  // a pretty alias path, we prefer it for Copy URL / Download SVG
  // actions (the canonical URL also still works). Operators see the
  // pretty form in their distribution channels.
  // Composition short aliases: 'wordmark-only' → 'wordmark',
  // 'icon-only' → 'icon' for shorter URL segments.
  const compShort =
    composition === 'wordmark-only' ? 'wordmark'
    : composition === 'icon-only' ? 'icon'
    : composition;
  const tailSvg = `${workspaceSlug}-${compShort}-${finish.id}-${background.id}.svg`;
  const tailPng = `${workspaceSlug}-${compShort}-${finish.id}-${background.id}.png`;
  const renderUrl = assetAliasPath
    ? `/${assetAliasPath}/brand/render/${tailSvg}`
    : `/_ensemble/brand/render/${tailSvg}`;
  // v0.1.53: PNG variant of the same composition. Same URL grammar,
  // .png extension instead of .svg — the path-style render route
  // dispatches to resvg-wasm for rasterization. Operators get
  // download buttons for both formats per cell.
  const pngUrl = assetAliasPath
    ? `/${assetAliasPath}/brand/render/${tailPng}`
    : `/_ensemble/brand/render/${tailPng}`;
  // Same URL — browser auto-saves with the filename from the URL path.
  const downloadUrl = renderUrl;

  async function copyMarkup() {
    try {
      const r = await authedFetch(renderUrl);
      const svg = await r.text();
      await navigator.clipboard.writeText(svg);
      toast.success('SVG copied to clipboard');
    } catch {
      toast.error('Copy failed');
    }
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(baseUrl + renderUrl);
    toast.success('URL copied');
  }

  // v0.1.54: every cell uses the same mid-grey #808080 chrome — the
  // neutral-luminance background designers use for previewing
  // because it shows true relationships against both light and dark
  // logo finishes without bias. Replaces the old isDarkBg branching
  // that was needed when cells reflected the variant's literal
  // background — that context is now baked into the SVG itself via
  // the unified backgrounds axis (v0.1.54), so the cell chrome no
  // longer needs to "match" the variant.
  const buttonClass = 'h-7 px-2 text-xs border-zinc-500/50 bg-white/80 text-zinc-900 hover:bg-white hover:text-zinc-950';

  return (
    <div className="rounded-md border p-3" style={{ backgroundColor: '#808080', color: '#0a0a0a' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider opacity-80">
          {finish.label} · {background.label}
        </p>
      </div>
      <div className="flex items-center justify-center h-24 mb-2 rounded">
        {/* Embed the generated SVG via <img> — the browser fetches it
            and renders inline; no special handling needed because the
            render endpoint returns image/svg+xml. */}
        <img
          src={renderUrl}
          alt={`${composition} — ${finish.label} on ${background.label}`}
          className="max-h-20 max-w-full"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        <Button type="button" variant="outline" size="sm" className={buttonClass}
          onClick={copyMarkup}>
          Copy SVG
        </Button>
        <Button type="button" variant="outline" size="sm" className={buttonClass}
          onClick={copyUrl}>
          Copy URL
        </Button>
        <Button type="button" variant="outline" size="sm" className={buttonClass} asChild>
          <a href={downloadUrl} download>
            <Download className="h-3 w-3 mr-1" /> SVG
          </a>
        </Button>
        <Button type="button" variant="outline" size="sm" className={buttonClass} asChild>
          <a href={pngUrl} download>
            <Download className="h-3 w-3 mr-1" /> PNG
          </a>
        </Button>
      </div>
    </div>
  );
}

// ─── Favicon ─────────────────────────────────────────────────────

/**
 * Favicon specimen card. Shows the operator's icon mark rendered at
 * the canonical favicon sizes a browser actually uses:
 *
 *   16  — historical browser tab
 *   32  — high-DPI browser tab + bookmark
 *   48  — Windows taskbar
 *   180 — iOS home screen ("apple-touch-icon")
 *   192 — Android home screen
 *   512 — Android splash + PWA icon
 *
 * All sizes come from one source: /favicon.svg (the icon mark SVG
 * served via the v0.1.36 endpoint). Modern browsers scale the SVG
 * natively at every requested size — no rasterization needed.
 *
 * Includes a Copy URL action so operators can drop the favicon
 * URL into external systems (analytics dashboards, PWA configs,
 * partner deck templates).
 */
function FaviconCard() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  // v0.1.46+: favicon lives canonically at /_ensemble/brand/favicon.svg.
  // Pretty alias preferred for the Copy URL action when configured.
  const [aliasPath, setAliasPath] = useState<string>('');
  useEffect(() => {
    authedFetch('/_ensemble/core/brand/logo-policy')
      .then((r) => r.json() as Promise<{ assetAliasPath?: string }>)
      .then((p) => setAliasPath(p.assetAliasPath || ''))
      .catch(() => { /* leave empty */ });
  }, []);
  const faviconUrl = aliasPath
    ? `/${aliasPath}/brand/favicon.svg`
    : '/_ensemble/brand/favicon.svg';
  const fullUrl = baseUrl + faviconUrl;

  const sizes: Array<{ px: number; label: string; context: string }> = [
    { px: 16,  label: '16',  context: 'Browser tab' },
    { px: 32,  label: '32',  context: 'Tab @ 2×' },
    { px: 48,  label: '48',  context: 'Windows taskbar' },
    { px: 180, label: '180', context: 'iOS home screen' },
    { px: 192, label: '192', context: 'Android home' },
    { px: 512, label: '512', context: 'PWA splash' },
  ];

  async function copyUrl() {
    await navigator.clipboard.writeText(fullUrl);
    toast.success('Favicon URL copied');
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" /> Favicon
        </CardTitle>
        <CardDescription>
          Generated from your icon mark. Modern browsers (Chrome 92+,
          Firefox 41+, Safari 16+) scale this SVG at every requested
          size — one source covers tab icons, home-screen icons, and
          PWA splash screens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          {sizes.map((s) => (
            <div key={s.px} className="flex flex-col items-center gap-1.5">
              <div
                className="rounded border bg-muted/30 flex items-center justify-center"
                style={{ width: Math.max(s.px, 32), height: Math.max(s.px, 32) }}
              >
                <img
                  src={faviconUrl}
                  alt={`Favicon ${s.label}px`}
                  style={{ width: s.px, height: s.px, display: 'block' }}
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-mono">{s.label}px</p>
                <p className="text-[10px] text-muted-foreground">{s.context}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={copyUrl}>
            <Copy className="h-3 w-3 mr-1" /> Copy URL
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={faviconUrl} download="favicon.svg">
              <Download className="h-3 w-3 mr-1" /> Download SVG
            </a>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={faviconUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLink className="h-3 w-3 mr-1" /> View raw
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          For the full browser/OS coverage (favicon.ico, apple-touch-icon,
          Android manifest) see the Favicon Suite card below — it generates
          all the canonical favicon files and a copy-paste <code className="text-[11px]">&lt;head&gt;</code> block.
        </p>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Favicon Suite (v0.1.53)
 *
 * Renders the canonical favicon files (favicon.ico, favicon-32.png,
 * favicon-180.png, favicon-192.png, favicon-512.png, manifest.webmanifest)
 * via the server-side Satori + resvg pipeline. Operator copies a
 * <head> snippet that references all of them — drops into their
 * external site to get every browser/OS combination wired up.
 * ──────────────────────────────────────────────────────────── */

interface FaviconSnippetResponse {
  snippet: string;
  baseUrl: string;
  iconBasePath: string;
}

function FaviconSuiteCard() {
  const [data, setData] = useState<FaviconSnippetResponse | null>(null);
  // v0.1.54: same event-driven refresh pattern as LogoVariantsCard.
  // The browser caches <img> srcs by URL — even though our server
  // cache is content-hashed and auto-invalidates on icon-mark
  // changes, the browser doesn't know to re-fetch unless the URL
  // changes OR the element remounts. reloadToken bumps on every
  // brand.tokens.changed event; appending it to each preview tile's
  // React key forces a remount so the operator sees their new icon
  // reflected here immediately, not after a refresh.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    authedFetch('/_ensemble/core/brand/favicon-snippet')
      .then((r) => r.json() as Promise<FaviconSnippetResponse>)
      .then(setData)
      .catch(() => { /* admin-only — card hidden for non-admins */ });
  }, []);

  useEffect(() => {
    return subscribeWorkspaceEvent((e) => {
      if (e.type === 'brand.tokens.changed') {
        setReloadToken((t) => t + 1);
      }
    });
  }, []);

  if (!data) return null;

  const u = (path: string) => `${data.baseUrl}${data.iconBasePath}${path}`;

  async function copySnippet() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.snippet);
      toast.success('Snippet copied — paste into your site\'s <head>');
    } catch {
      toast.error('Copy failed');
    }
  }

  // Each entry: a favicon file produced by the server, with its
  // display dimensions and use-case label. Renders as a small grid
  // of preview tiles + a Download link below the snippet.
  const files: Array<{ url: string; label: string; size: number; previewSize: number; note: string }> = [
    { url: u('/favicon.svg'),       label: 'favicon.svg',      size: 0,   previewSize: 32, note: 'Modern browsers (tab, bookmark, history)' },
    { url: u('/favicon.ico'),       label: 'favicon.ico',      size: 32,  previewSize: 32, note: 'Legacy IE/Edge, intranet browsers' },
    { url: u('/favicon-32.png'),    label: 'favicon-32.png',   size: 32,  previewSize: 32, note: 'Bookmark bar, downloaded shortcut' },
    { url: u('/favicon-180.png'),   label: 'favicon-180.png',  size: 180, previewSize: 48, note: 'iOS home screen (apple-touch-icon)' },
    { url: u('/favicon-192.png'),   label: 'favicon-192.png',  size: 192, previewSize: 48, note: 'Android home screen' },
    { url: u('/favicon-512.png'),   label: 'favicon-512.png',  size: 512, previewSize: 64, note: 'Android splash, PWA icon' },
    { url: u('/manifest.webmanifest'), label: 'manifest.webmanifest', size: 0, previewSize: 0, note: 'PWA + Android (references 192 + 512)' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" /> Favicon suite
        </CardTitle>
        <CardDescription>
          Drop this <code>&lt;head&gt;</code> snippet into your site to wire
          up every browser/OS variant — SVG for modern browsers, ICO for
          legacy IE/Edge, apple-touch-icon for iOS home screens, manifest
          for Android. Every file is generated live from your icon mark.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* The copy-paste <head> block */}
        <div className="rounded-md border bg-zinc-900 text-zinc-100 p-3 font-mono text-[11px] whitespace-pre overflow-x-auto">
          {data.snippet}
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={copySnippet}>
            <Copy className="h-3 w-3 mr-1" /> Copy <code className="ml-1">&lt;head&gt;</code> block
          </Button>
        </div>

        <Separator />

        {/* Individual file previews + downloads */}
        <div>
          <p className="text-sm font-medium mb-2">Files</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((f) => (
              // Append reloadToken to the React key so each tile
              // remounts when brand.tokens.changed fires — the
              // <img> tag re-fetches from the URL (whose underlying
              // server response is already fresh because the
              // content-hash cache key changed).
              <div key={`${f.url}-${reloadToken}`} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-3">
                  {f.previewSize > 0 ? (
                    <img
                      src={f.url}
                      alt={f.label}
                      className="rounded shrink-0 object-contain"
                      style={{ width: f.previewSize, height: f.previewSize }}
                    />
                  ) : (
                    <div className="flex items-center justify-center rounded bg-muted shrink-0 text-[10px] text-muted-foreground" style={{ width: 32, height: 32 }}>
                      JSON
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono truncate">{f.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{f.note}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                    <a href={f.url} download={f.label}>
                      <Download className="h-3 w-3 mr-1" /> Download
                    </a>
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                    <a href={f.url} target="_blank" rel="noreferrer noopener">
                      <ExternalLink className="h-3 w-3 mr-1" /> View
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          All files are generated on demand from your icon mark — change
          your icon in Brand → Logos and the entire suite re-renders the
          next time anyone loads it. No re-deploy needed.
        </p>
      </CardContent>
    </Card>
  );
}
