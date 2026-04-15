/**
 * Brand Page — Company Brand Identity Studio
 *
 * Hash-based tab routing: /brand#overview, /brand#colors, /brand#typography, etc.
 */

import * as React from 'react';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ensemble-edge/ui';

import { useHashTab } from '../../../hooks/useHashTab';
import { OverviewTab } from './OverviewTab';
import { ColorsTab } from './ColorsTab';
import { TypographyTab } from './TypographyTab';
import { LogosTab } from './LogosTab';
import { MessagingTab } from './MessagingTab';
import { IdentityTab } from './IdentityTab';

const TABS = ['overview', 'colors', 'typography', 'logos', 'messaging', 'identity'] as const;

export function BrandPage() {
  const [tab, setTab] = useHashTab('overview', TABS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Brand</h1>
        <p className="text-muted-foreground">
          Your company's visual identity — define once, use everywhere
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="typography">Typography</TabsTrigger>
          <TabsTrigger value="logos">Logos</TabsTrigger>
          <TabsTrigger value="messaging">Messaging</TabsTrigger>
          <TabsTrigger value="identity">Identity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="colors"><ColorsTab /></TabsContent>
        <TabsContent value="typography"><TypographyTab /></TabsContent>
        <TabsContent value="logos"><LogosTab /></TabsContent>
        <TabsContent value="messaging"><MessagingTab /></TabsContent>
        <TabsContent value="identity"><IdentityTab /></TabsContent>
      </Tabs>
    </div>
  );
}
