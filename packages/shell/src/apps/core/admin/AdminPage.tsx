/**
 * Admin Page — Workspace Settings
 *
 * Three tabs:
 * - General: workspace name, slug, locale, timezone
 * - Appearance: UI theme (base color, radius, fonts, etc.)
 * - Danger Zone: delete workspace, transfer ownership
 */

import * as React from 'react';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ensemble-edge/ui';

import { GeneralTab } from './GeneralTab';
import { AppearanceTab } from './AppearanceTab';
import { DangerZoneTab } from './DangerZoneTab';

export function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Workspace configuration and preferences
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralTab />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceTab />
        </TabsContent>

        <TabsContent value="danger">
          <DangerZoneTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
