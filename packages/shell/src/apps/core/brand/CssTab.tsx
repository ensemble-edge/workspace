/**
 * CSS Tab — v0.1.56.
 *
 * Power-user escape hatch for the closed brand color system. Operator
 * types raw CSS that gets appended verbatim to the published
 * /brand.css. Operator-defined declarations land LAST in the file
 * so they win cascade order over anything auto-generated above.
 *
 * Mirrors the affordance pattern at the bottom of Brand Overview's
 * Export card: Copy URL · Download (.css) · View raw, plus a
 * one-click Copy <link> tag.
 *
 * Storage:
 *   brand_tokens.category='custom', key='operator_css_overrides',
 *   value=<raw CSS string>
 *
 * Reads/writes via:
 *   GET /_ensemble/core/brand/custom-css → { css }
 *   PUT /_ensemble/core/brand/custom-css { css }
 *
 * Saves are manual (Save button). On save, emits brand.tokens.changed
 * so the CSS endpoint's downstream consumers reload.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Copy, ExternalLink, Download, FileCode } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Textarea,
  Label,
  SaveStatus,
  toast,
} from '@ensemble-edge/ui';

import { authedFetch, emitWorkspaceEvent } from '../../../state';
import { useFormStatus } from '../../../hooks/useFormStatus';

export function CssTab() {
  const [css, setCss] = useState<string>('');
  const [saved, setSaved] = useState<string>('');
  const status = useFormStatus({ value: css, mode: 'manual' });

  useEffect(() => {
    authedFetch('/_ensemble/core/brand/custom-css')
      .then((r) => r.json() as Promise<{ css?: string }>)
      .then((res) => {
        const value = res.css ?? '';
        setCss(value);
        setSaved(value);
        status.resetBaseline(value);
      })
      .catch(() => { /* leave empty */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    status.beginSave();
    try {
      const res = await authedFetch('/_ensemble/core/brand/custom-css', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ css }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(css);
      status.commitSave();
      emitWorkspaceEvent('brand.tokens.changed', { category: 'custom', key: 'operator_css_overrides' });
      toast.success('Custom CSS saved', {
        description: 'Your overrides are live at /brand.css.',
      });
    } catch (err) {
      status.failSave(err);
      toast.error('Failed to save custom CSS', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function handleDiscard() {
    setCss(saved);
    status.resetBaseline(saved);
    toast.success('Reverted unsaved changes');
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const cssUrl = `${baseUrl}/_ensemble/brand/css`;
  const linkTag = `<link rel="stylesheet" href="${cssUrl}" />`;
  const saving = status.state === 'saving';

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed');
    }
  }

  function downloadCss() {
    // Fetch the live /brand.css and trigger a download. Using the
    // server's actual published CSS (not just the operator's
    // overrides) so the file is self-contained — palettes, themes,
    // overrides, everything.
    fetch(cssUrl)
      .then((r) => r.text())
      .then((text) => {
        const blob = new Blob([text], { type: 'text/css' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'brand.css';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error('Download failed'));
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-normal tracking-tight">CSS</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[680px]">
            Append custom CSS variables or property declarations to your published
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded ml-1 mr-1">/brand.css</code>.
            Operator-defined declarations land last in the file, so they win cascade order
            over palette and theme tokens emitted above.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status.dirty && (
            <Button type="button" variant="ghost" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
          )}
          {status.state !== 'clean' && <SaveStatus state={status.state} />}
          <Button onClick={handleSave} disabled={!status.dirty || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Instructions card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCode className="h-4 w-4" /> How this works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            The textarea below accepts any valid CSS. Common patterns:
          </p>
          <ul className="space-y-2 list-disc pl-5">
            <li>
              <strong className="text-foreground">Custom variables</strong> —{' '}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">--brand-button-radius: 6px;</code>
              {' '}wrapped in a <code className="text-xs bg-muted px-1.5 py-0.5 rounded">:root</code> block.
              These join the auto-generated tokens (<code className="text-xs bg-muted px-1.5 py-0.5 rounded">--primary-main</code>,{' '}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">--gradient-sunrise</code>, etc.) so any consumer can read them.
            </li>
            <li>
              <strong className="text-foreground">Property overrides</strong> — full selector blocks like{' '}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.brand-callout {'{ box-shadow: ...; }'}</code>{' '}
              to extend the design system with project-specific components.
            </li>
            <li>
              <strong className="text-foreground">Media queries</strong> — wrap any of the above in{' '}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">@media (prefers-reduced-motion)</code>{' '}
              or similar for context-aware tokens.
            </li>
          </ul>
          <p className="pt-1">
            Save commits to <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/brand.css</code> immediately.
            Operator overrides are appended at the END of the file under a clearly-labelled comment block,
            so they take cascade priority over palette and theme tokens emitted above.
          </p>
        </CardContent>
      </Card>

      {/* The editor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Custom CSS</CardTitle>
          <CardDescription>
            Empty = no overrides. Saving an empty value removes the operator block entirely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={css}
            onChange={(e) => setCss(e.currentTarget.value)}
            placeholder={`/* Example: */\n:root {\n  --brand-button-radius: 6px;\n  --brand-shadow-pop: 0 10px 32px rgba(0, 0, 0, 0.12);\n}\n\n.brand-callout {\n  border-left: 3px solid var(--primary-main);\n  padding-left: 1rem;\n}`}
            spellCheck={false}
            className="font-mono text-sm min-h-[280px] resize-y"
            style={{ fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}
          />
        </CardContent>
      </Card>

      {/* Export affordances — mirrors Brand Overview's Export card so
          operators have a single mental model for "get the CSS out". */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Use the published CSS</CardTitle>
          <CardDescription>
            Reference <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/_ensemble/brand/css</code> from
            any project — auto-generated tokens AND your custom overrides land in this one URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => copyText(linkTag, '<link> tag')}>
              <Copy className="h-3 w-3 mr-1.5" /> Copy &lt;link&gt; tag
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => copyText(cssUrl, 'CSS URL')}>
              <Copy className="h-3 w-3 mr-1.5" /> Copy URL
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadCss}>
              <Download className="h-3 w-3 mr-1.5" /> Download brand.css
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={cssUrl} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="h-3 w-3 mr-1.5" /> View live
              </a>
            </Button>
          </div>
          <Label className="text-xs text-muted-foreground mt-3 inline-block">
            Live URL: <code className="text-xs">{cssUrl}</code>
          </Label>
        </CardContent>
      </Card>
    </div>
  );
}
