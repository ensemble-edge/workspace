/**
 * Admin Page — Workspace Settings
 *
 * Hash-based tab routing: /settings#general, /settings#appearance, /settings#danger
 */

import * as React from 'react';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ensemble-edge/ui';

import { useHashTab } from '../../../hooks/useHashTab';
import { GeneralTab } from './GeneralTab';
import { AppearanceTab } from './AppearanceTab';
import { DangerZoneTab } from './DangerZoneTab';

const TABS = ['general', 'appearance', 'danger'] as const;

export function AdminPage() {
  const [tab, setTab] = useHashTab('general', TABS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Workspace configuration and preferences
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        <TabsContent value="general"><GeneralTab /></TabsContent>
        <TabsContent value="appearance"><AppearanceTab /></TabsContent>
        <TabsContent value="danger"><DangerZoneTab /></TabsContent>
      </Tabs>
    </div>
  );
}
