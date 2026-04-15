/**
 * Navigation Hub — Sidebar configuration admin.
 */

import * as React from 'react';
import { PanelLeft } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ensemble-edge/ui';

export function NavPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Navigation</h1>
        <p className="text-muted-foreground">
          Configure sidebar sections, ordering, and role-based visibility
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sidebar Configuration</CardTitle>
          <CardDescription>
            Drag and drop to reorder sections and items. Set visibility rules per role.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <PanelLeft className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">Navigation builder coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
