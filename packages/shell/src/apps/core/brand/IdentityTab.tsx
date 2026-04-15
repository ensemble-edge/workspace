/**
 * Identity Tab — Company info + custom fields + import/export.
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Upload, Download } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  toast,
} from '@ensemble-edge/ui';

interface CustomField {
  key: string;
  value: string;
  type: string;
  label: string;
}

export function IdentityTab() {
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [foundingYear, setFoundingYear] = useState('');
  const [headquarters, setHeadquarters] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const knownKeys = new Set(['legal_name', 'display_name', 'founding_year', 'headquarters', 'website', 'industry']);

  useEffect(() => {
    fetch('/_ensemble/core/brand/tokens/identity')
      .then((r) => r.json() as Promise<{ data?: Array<{ key: string; value: string; type: string; label: string | null }> }>)
      .then((res) => {
        const custom: CustomField[] = [];
        for (const token of res.data || []) {
          if (token.key.startsWith('logo_')) continue; // handled by Logos tab
          switch (token.key) {
            case 'legal_name': setLegalName(token.value); break;
            case 'display_name': setDisplayName(token.value); break;
            case 'founding_year': setFoundingYear(token.value); break;
            case 'headquarters': setHeadquarters(token.value); break;
            case 'website': setWebsite(token.value); break;
            case 'industry': setIndustry(token.value); break;
            default:
              if (!knownKeys.has(token.key)) {
                custom.push({ key: token.key, value: token.value, type: token.type || 'text', label: token.label || token.key });
              }
          }
        }
        setCustomFields(custom);
      })
      .catch(() => {});
  }, []);

  const addCustomField = () => {
    setCustomFields([...customFields, { key: `field_${Date.now()}`, value: '', type: 'text', label: 'New Field' }]);
  };

  const removeCustomField = (i: number) => {
    setCustomFields(customFields.filter((_, idx) => idx !== i));
  };

  const updateCustomField = (i: number, updates: Partial<CustomField>) => {
    setCustomFields(customFields.map((f, idx) => idx === i ? { ...f, ...updates } : f));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const tokens: Record<string, string> = {
        legal_name: legalName,
        display_name: displayName,
        founding_year: foundingYear,
        headquarters,
        website,
        industry,
      };
      // Include custom fields
      for (const field of customFields) {
        if (field.key && field.value) tokens[field.key] = field.value;
      }

      const res = await fetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'identity', tokens }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Identity saved');
    } catch {
      toast.error('Failed to save identity');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>Legal and public-facing details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ownly" />
            </div>
            <div className="space-y-2">
              <Label>Legal Name</Label>
              <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="The Ownly Group, LLC" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Founded</Label>
                <Input value={foundingYear} onChange={(e) => setFoundingYear(e.target.value)} placeholder="2024" />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Fintech" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Headquarters</Label>
              <Input value={headquarters} onChange={(e) => setHeadquarters(e.target.value)} placeholder="Austin, TX" />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://ownly.com" />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Identity'}
            </Button>
          </CardFooter>
        </Card>

        {/* Import/Export */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import / Export</CardTitle>
              <CardDescription>Move your brand between workspaces</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" onClick={() => {
                fetch('/_ensemble/brand/spec')
                  .then((r) => r.json())
                  .then((spec) => {
                    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${displayName || 'brand'}-spec.json`.toLowerCase().replace(/\s+/g, '-');
                    a.click();
                    URL.revokeObjectURL(url);
                  });
              }}>
                <Download className="mr-2 h-4 w-4" /> Export Brand Spec (JSON)
              </Button>

              <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Upload className="mr-2 h-4 w-4" /> Import Brand Spec
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <ImportForm onSuccess={() => {
                    setImportOpen(false);
                    window.location.reload();
                  }} />
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Custom Fields */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>Add company-specific identity fields</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {customFields.map((field, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Label"
                        value={field.label}
                        onChange={(e) => updateCustomField(i, { label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                        className="text-sm"
                      />
                      <Select value={field.type} onValueChange={(v) => updateCustomField(i, { type: v })}>
                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="url">URL</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      placeholder="Value"
                      value={field.value}
                      onChange={(e) => updateCustomField(i, { value: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <Button variant="ghost" size="icon" className="mt-1 text-muted-foreground hover:text-destructive" onClick={() => removeCustomField(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCustomField}>
                <Plus className="mr-1 h-3 w-3" /> Add Field
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ImportForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileSpec, setFileSpec] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setFileSpec(JSON.parse(reader.result as string));
      } catch {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const body: Record<string, unknown> = { overwrite };
      if (mode === 'url') {
        body.url = url;
      } else {
        body.spec = fileSpec;
      }

      const res = await fetch('/_ensemble/brand/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { success?: boolean; error?: string; created?: number; updated?: number; skipped?: number };
      if (!res.ok) throw new Error(data.error || 'Import failed');

      toast.success('Brand imported', {
        description: `${data.created || 0} created, ${data.updated || 0} updated, ${data.skipped || 0} skipped`,
      });
      onSuccess();
    } catch (err) {
      toast.error('Import failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import Brand Spec</DialogTitle>
        <DialogDescription>
          Import from a JSON file or a URL. Custom fields are created automatically.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="flex gap-2">
          <Button variant={mode === 'file' ? 'default' : 'outline'} size="sm" onClick={() => setMode('file')}>
            From File
          </Button>
          <Button variant={mode === 'url' ? 'default' : 'outline'} size="sm" onClick={() => setMode('url')}>
            From URL
          </Button>
        </div>

        {mode === 'file' ? (
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange} className="text-sm" />
            {fileSpec && <p className="text-sm text-green-500">File loaded and ready to import.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Spec URL</Label>
            <Input
              placeholder="https://other-workspace.com/_ensemble/brand/spec"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
          Overwrite existing values
        </label>
      </div>
      <DialogFooter>
        <Button onClick={handleImport} disabled={importing || (mode === 'file' ? !fileSpec : !url)}>
          {importing ? 'Importing...' : 'Import'}
        </Button>
      </DialogFooter>
    </>
  );
}
