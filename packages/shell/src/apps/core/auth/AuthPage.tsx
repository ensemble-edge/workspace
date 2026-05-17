/**
 * Auth & Security Page — auth methods + security policies.
 *
 * Integration credentials moved to Settings → Connections in v0.1.14.
 */

import * as React from 'react';

import { OverviewTab } from './OverviewTab';

export function AuthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auth & Security</h1>
        <p className="text-muted-foreground">
          Authentication methods and security policies.
        </p>
      </div>

      <OverviewTab />
    </div>
  );
}
