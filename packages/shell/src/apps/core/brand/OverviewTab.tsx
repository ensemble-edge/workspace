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
  };
  effectiveBans: Array<{ finishId: FinishId; backgroundId: string; reason?: string }>;
  workspaceSlug?: string;
}

/**
 * Full Composition × Finish × Background matrix. Only renders cells
 * that are approved by the operator's policy AND pass WCAG contrast.
 * Each cell shows the live-generated SVG and exposes copy + download
 * actions.
 */
function LogoVariantsCard() {
  const [policy, setPolicy] = useState<PolicyResponse | null>(null);

  useEffect(() => {
    authedFetch('/_ensemble/core/brand/logo-policy')
      .then((r) => r.json() as Promise<PolicyResponse>)
      .then(setPolicy)
      .catch(() => { /* no policy → card hidden */ });
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
                      key={`${composition}-${finish.id}-${bg.id}`}
                      composition={composition}
                      finish={finish}
                      background={bg}
                      workspaceSlug={policy.workspaceSlug || 'workspace'}
                    />
                  );
                }),
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function VariantCell({
  composition,
  finish,
  background,
  workspaceSlug,
}: {
  composition: CompositionId;
  finish: { id: FinishId; label: string };
  background: { id: string; label: string };
  workspaceSlug: string;
}) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  // Path-style URL: /brand/<slug>-<composition>-<finish>-<bg>.svg
  // Composition aliases: 'wordmark-only' → 'wordmark', 'icon-only' → 'icon'
  // for shorter URL segments. The server route reverses these aliases.
  const compShort =
    composition === 'wordmark-only' ? 'wordmark'
    : composition === 'icon-only' ? 'icon'
    : composition;
  const renderUrl = `/brand/${workspaceSlug}-${compShort}-${finish.id}-${background.id}.svg`;
  // Same URL — browser auto-saves with the filename from the URL path.
  const downloadUrl = renderUrl;

  // Dark backgrounds render the cell with a dark frame so the operator
  // sees the variant in its intended context. Light/transparent stay
  // light. We rely on a few hex heuristics rather than re-fetching the
  // brand colors.
  const isDarkBg = background.id === 'dark';

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

  return (
    <div
      className={
        isDarkBg
          ? 'rounded-md border p-3 bg-zinc-900 text-zinc-100'
          : 'rounded-md border p-3 bg-muted/30'
      }
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider opacity-70">
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
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
          onClick={copyMarkup}>
          Copy SVG
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs"
          onClick={copyUrl}>
          Copy URL
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
          <a href={downloadUrl} download>
            <Download className="h-3 w-3 mr-1" /> SVG
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
  const faviconUrl = '/favicon.svg';
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
          Legacy browsers (IE, older Safari) fall back to whatever
          static favicon you've uploaded as <code className="text-[11px]">logo_favicon</code> —
          we'll regenerate the canonical 10-file suite (favicon.ico,
          apple-touch-icon, mstile, etc.) once raster output ships.
        </p>
      </CardContent>
    </Card>
  );
}
