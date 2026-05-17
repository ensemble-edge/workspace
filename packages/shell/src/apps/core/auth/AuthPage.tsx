/**
 * Auth & Security Page — auth methods, policies, and session config.
 *
 * Hash-based tab routing: /auth#overview, /auth#sessions
 *
 * Integration credentials moved to Settings → Connections in v0.1.14.
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
import { SessionsTab } from './SessionsTab';

const TABS = ['overview', 'sessions'] as const;

export function AuthPage() {
  const [tab, setTab] = useHashTab('overview', TABS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auth & Security</h1>
        <p className="text-muted-foreground">
          Authentication methods, security policies, and session lifetime.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="sessions"><SessionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
