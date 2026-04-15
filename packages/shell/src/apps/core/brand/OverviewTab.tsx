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
  toast,
} from '@ensemble-edge/ui';

import { getRelativeLuminance } from './color-utils';

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

export function OverviewTab() {
  const [spec, setSpec] = useState<BrandSpec | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/_ensemble/brand/spec')
      .then((r) => r.json() as Promise<BrandSpec>)
      .then((data) => { setSpec(data); setLoading(false); })
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
  const hasTypography = !!(spec.typography.heading || spec.typography.body);
  const hasMessaging = !!(spec.messaging.tagline || spec.messaging.mission);
  const specUrl = spec.endpoints?.spec || `${window.location.origin}/_ensemble/brand/spec`;
  const cssUrl = spec.endpoints?.css || `${window.location.origin}/_ensemble/brand/css`;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card>
        <CardContent className="py-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-4xl font-bold tracking-tight">{name}</h2>
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Typography */}
        {hasTypography && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" /> Typography
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {spec.typography.display && (
                <div>
                  <p className="text-xs text-muted-foreground">Display</p>
                  <p className="text-2xl font-bold">{spec.typography.display.family}</p>
                </div>
              )}
              {spec.typography.heading && (
                <div>
                  <p className="text-xs text-muted-foreground">Heading</p>
                  <p className="text-xl font-semibold">{spec.typography.heading.family}</p>
                </div>
              )}
              {spec.typography.body && (
                <div>
                  <p className="text-xs text-muted-foreground">Body</p>
                  <p className="text-base">{spec.typography.body.family}</p>
                </div>
              )}
              {spec.typography.mono && (
                <div>
                  <p className="text-xs text-muted-foreground">Mono</p>
                  <p className="text-sm font-mono">{spec.typography.mono.family}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
