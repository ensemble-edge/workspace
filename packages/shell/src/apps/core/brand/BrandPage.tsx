/**
 * Brand Page — Company Brand Identity Studio
 *
 * 6 tabs for defining a complete brand system:
 * - Overview: Visual brand summary at a glance + export
 * - Colors: Named color groups with visual swatch editor
 * - Typography: Font picker with live preview
 * - Logos: Upload zones for brand marks
 * - Messaging: Tagline, pitch, mission, value props, tone + custom fields
 * - Identity: Company info, custom fields, import/export
 *
 * The brand spec is canonical at /_ensemble/brand/spec (JSON).
 * CSS, markdown context, and visual pages are derived from it.
 */

import * as React from 'react';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ensemble-edge/ui';

import { OverviewTab } from './OverviewTab';
import { ColorsTab } from './ColorsTab';
import { TypographyTab } from './TypographyTab';
import { LogosTab } from './LogosTab';
import { MessagingTab } from './MessagingTab';
import { IdentityTab } from './IdentityTab';

export function BrandPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Brand</h1>
        <p className="text-muted-foreground">
          Your company's visual identity — define once, use everywhere
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="typography">Typography</TabsTrigger>
          <TabsTrigger value="logos">Logos</TabsTrigger>
          <TabsTrigger value="messaging">Messaging</TabsTrigger>
          <TabsTrigger value="identity">Identity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="colors">
          <ColorsTab />
        </TabsContent>

        <TabsContent value="typography">
          <TypographyTab />
        </TabsContent>

        <TabsContent value="logos">
          <LogosTab />
        </TabsContent>

        <TabsContent value="messaging">
          <MessagingTab />
        </TabsContent>

        <TabsContent value="identity">
          <IdentityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
