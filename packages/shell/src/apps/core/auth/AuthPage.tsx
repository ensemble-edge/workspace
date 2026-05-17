/**
 * Auth & Security Page — tabs:
 *   #overview      auth methods + security policies (existing)
 *   #credentials   Connection, Notifications, AI Access (v0.1.12)
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
import { CredentialsTab } from './CredentialsTab';

const TABS = ['overview', 'credentials'] as const;

export function AuthPage() {
  const [tab, setTab] = useHashTab('overview', TABS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auth & Security</h1>
        <p className="text-muted-foreground">
          Authentication methods, security policies, and integration credentials.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="credentials">
          <CredentialsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
