/**
 * People Page
 *
 * Member directory and team management.
 * Currently a placeholder — will be expanded in Phase 2.
 */

import * as React from 'react';
import { Users } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ensemble-edge/ui';

export function PeoplePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">People</h1>
        <p className="text-muted-foreground">
          Manage workspace members, roles, and permissions.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Invite and manage your team members.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Users className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">People management coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
