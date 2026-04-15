/**
 * General Tab — Workspace name, slug, locale, timezone.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
  Label,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@ensemble-edge/ui';

import { workspace, fetchWorkspace } from '../../../state';

export function GeneralTab() {
  useSignals();
  const ws = workspace.value;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [dateFormat, setDateFormat] = useState('us');
  const [saving, setSaving] = useState(false);

  // Load current workspace data
  useEffect(() => {
    if (ws) {
      setName(ws.name || '');
      setSlug(ws.slug || '');
      if (ws.settings?.timezone) setTimezone(ws.settings.timezone);
      if (ws.settings?.dateFormat) setDateFormat(ws.settings.dateFormat);
    }
  }, [ws]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save workspace name via identity brand token
      const response = await fetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'identity',
          tokens: { display_name: name },
        }),
      });

      if (!response.ok) throw new Error('Failed to save');
      await fetchWorkspace();
      toast.success('Workspace updated', {
        description: 'Your workspace settings have been saved.',
      });
    } catch {
      toast.error('Failed to save', {
        description: 'Could not update workspace settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace Info</CardTitle>
          <CardDescription>Basic workspace identification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Workspace Name</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workspace"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-slug">Slug</Label>
            <Input
              id="ws-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-workspace"
              disabled
            />
            <p className="text-xs text-muted-foreground">
              Used in URLs. Cannot be changed after creation.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Locale & Region</CardTitle>
          <CardDescription>Timezone and formatting preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern (US)</SelectItem>
                <SelectItem value="America/Chicago">Central (US)</SelectItem>
                <SelectItem value="America/Denver">Mountain (US)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific (US)</SelectItem>
                <SelectItem value="Europe/London">London</SelectItem>
                <SelectItem value="Europe/Berlin">Berlin</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date Format</Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger><SelectValue placeholder="Select format" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="us">MM/DD/YYYY</SelectItem>
                <SelectItem value="eu">DD/MM/YYYY</SelectItem>
                <SelectItem value="iso">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
