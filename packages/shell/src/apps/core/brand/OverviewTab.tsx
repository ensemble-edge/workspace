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
