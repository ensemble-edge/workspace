/**
 * Messaging Tab — Brand voice, taglines, and copy.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

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
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  toast,
} from '@ensemble-edge/ui';

interface ValueProp {
  headline: string;
  description: string;
}

interface CustomField {
  key: string;
  value: string;
  type: string;
  label: string;
}

export function MessagingTab() {
  const [tagline, setTagline] = useState('');
  const [elevatorPitch, setElevatorPitch] = useState('');
  const [mission, setMission] = useState('');
  const [boilerplate, setBoilerplate] = useState('');
  const [legalFooter, setLegalFooter] = useState('');
  const [valueProps, setValueProps] = useState<ValueProp[]>([{ headline: '', description: '' }]);
  const [toneDescriptors, setToneDescriptors] = useState('');
  const [toneAvoid, setToneAvoid] = useState('');
  const [voiceGuidelines, setVoiceGuidelines] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [saving, setSaving] = useState(false);

  const knownKeys = new Set(['tagline', 'elevator_pitch', 'mission', 'boilerplate', 'legal_footer', 'value_props', 'tone_descriptors', 'tone_avoid', 'voice_guidelines']);

  useEffect(() => {
    fetch('/_ensemble/core/brand/tokens/messaging')
      .then((r) => r.json() as Promise<{ data?: Array<{ key: string; value: string; type?: string; label?: string }> }>)
      .then((res) => {
        const custom: CustomField[] = [];
        for (const token of res.data || []) {
          switch (token.key) {
            case 'tagline': setTagline(token.value); break;
            case 'elevator_pitch': setElevatorPitch(token.value); break;
            case 'mission': setMission(token.value); break;
            case 'boilerplate': setBoilerplate(token.value); break;
            case 'legal_footer': setLegalFooter(token.value); break;
            case 'value_props':
              try { setValueProps(JSON.parse(token.value)); } catch { /* keep default */ }
              break;
            case 'tone_descriptors': setToneDescriptors(token.value); break;
            case 'tone_avoid': setToneAvoid(token.value); break;
            case 'voice_guidelines': setVoiceGuidelines(token.value); break;
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

  const addValueProp = () => setValueProps([...valueProps, { headline: '', description: '' }]);
  const removeValueProp = (i: number) => setValueProps(valueProps.filter((_, idx) => idx !== i));
  const updateValueProp = (i: number, field: keyof ValueProp, val: string) => {
    setValueProps(valueProps.map((vp, idx) => idx === i ? { ...vp, [field]: val } : vp));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'messaging',
          tokens: {
            tagline,
            elevator_pitch: elevatorPitch,
            mission,
            boilerplate,
            legal_footer: legalFooter,
            value_props: JSON.stringify(valueProps.filter((vp) => vp.headline)),
            tone_descriptors: toneDescriptors,
            tone_avoid: toneAvoid,
            voice_guidelines: voiceGuidelines,
            ...Object.fromEntries(customFields.filter((f) => f.key && f.value).map((f) => [f.key, f.value])),
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Messaging saved');
    } catch {
      toast.error('Failed to save messaging');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Core Messaging */}
      <Card>
        <CardHeader>
          <CardTitle>Core Messaging</CardTitle>
          <CardDescription>Your brand's key statements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tagline</Label>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="The intelligent capital platform" />
            <p className="text-xs text-muted-foreground">{tagline.length}/60 characters</p>
          </div>
          <div className="space-y-2">
            <Label>Elevator Pitch</Label>
            <Textarea value={elevatorPitch} onChange={(e) => setElevatorPitch(e.target.value)} placeholder="One paragraph explaining what you do..." rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Mission Statement</Label>
            <Textarea value={mission} onChange={(e) => setMission(e.target.value)} placeholder="Our mission is to..." rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Value Propositions */}
      <Card>
        <CardHeader>
          <CardTitle>Value Propositions</CardTitle>
          <CardDescription>Key benefits — used in marketing and AI context</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {valueProps.map((vp, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="flex-1 space-y-2">
                <Input value={vp.headline} onChange={(e) => updateValueProp(i, 'headline', e.target.value)} placeholder="Headline" />
                <Textarea value={vp.description} onChange={(e) => updateValueProp(i, 'description', e.target.value)} placeholder="Description..." rows={2} />
              </div>
              {valueProps.length > 1 && (
                <Button variant="ghost" size="icon" className="mt-1 text-muted-foreground hover:text-destructive" onClick={() => removeValueProp(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addValueProp}>
            <Plus className="mr-1 h-3 w-3" /> Add Value Prop
          </Button>
        </CardContent>
      </Card>

      {/* Tone & Voice */}
      <Card>
        <CardHeader>
          <CardTitle>Tone & Voice</CardTitle>
          <CardDescription>How your brand sounds — used by AI and content creators</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tone Descriptors</Label>
            <Input value={toneDescriptors} onChange={(e) => setToneDescriptors(e.target.value)} placeholder="confident, clear, approachable, technical when needed" />
            <p className="text-xs text-muted-foreground">Comma-separated adjectives</p>
          </div>
          <div className="space-y-2">
            <Label>Avoid</Label>
            <Input value={toneAvoid} onChange={(e) => setToneAvoid(e.target.value)} placeholder="jargon without explanation, hype, superlatives" />
            <p className="text-xs text-muted-foreground">Things to never say</p>
          </div>
          <div className="space-y-2">
            <Label>Voice Guidelines</Label>
            <Textarea value={voiceGuidelines} onChange={(e) => setVoiceGuidelines(e.target.value)} placeholder="First person plural ('we'). Active voice. Short sentences..." rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Boilerplate */}
      <Card>
        <CardHeader>
          <CardTitle>Boilerplate & Legal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Company Boilerplate</Label>
            <Textarea value={boilerplate} onChange={(e) => setBoilerplate(e.target.value)} placeholder="Ownly Group is an Austin-based fintech..." rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Legal Footer</Label>
            <Input value={legalFooter} onChange={(e) => setLegalFooter(e.target.value)} placeholder="© {year} The Ownly Group, LLC. All rights reserved." />
            <p className="text-xs text-muted-foreground">Use {'{year}'} for auto-updating year</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Messaging'}
          </Button>
        </CardFooter>
      </Card>

      {/* Custom Messaging Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Fields</CardTitle>
          <CardDescription>Add messaging fields specific to your business</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {customFields.map((field, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Field name"
                    value={field.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      const key = label.toLowerCase().replace(/\s+/g, '_');
                      setCustomFields(customFields.map((f, idx) => idx === i ? { ...f, label, key } : f));
                    }}
                    className="text-sm"
                  />
                  <Select value={field.type} onValueChange={(v) => setCustomFields(customFields.map((f, idx) => idx === i ? { ...f, type: v } : f))}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="rich_text">Long Text</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {field.type === 'rich_text' ? (
                  <Textarea
                    placeholder="Value"
                    value={field.value}
                    onChange={(e) => setCustomFields(customFields.map((f, idx) => idx === i ? { ...f, value: e.target.value } : f))}
                    rows={3}
                    className="text-sm"
                  />
                ) : (
                  <Input
                    placeholder="Value"
                    value={field.value}
                    onChange={(e) => setCustomFields(customFields.map((f, idx) => idx === i ? { ...f, value: e.target.value } : f))}
                    className="text-sm"
                  />
                )}
              </div>
              <Button variant="ghost" size="icon" className="mt-1 text-muted-foreground hover:text-destructive" onClick={() => setCustomFields(customFields.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setCustomFields([...customFields, { key: `msg_${Date.now()}`, value: '', type: 'text', label: '' }])}>
            <Plus className="mr-1 h-3 w-3" /> Add Field
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
