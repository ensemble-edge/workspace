/**
 * Home Page
 *
 * Default landing page for the workspace.
 * Shows welcome message and quick-access cards to core apps.
 */

import * as React from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { Home, Users, Palette, Settings } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
} from '@ensemble-edge/ui';

import {
  workspaceName,
  isAuthenticated,
  navigate,
} from '../../../state';

export function HomePage() {
  useSignals();
  const name = workspaceName.value;
  const authenticated = isAuthenticated.value;

  const handleNav = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(path);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to {name}</h1>
        <p className="text-muted-foreground">
          {authenticated
            ? 'Your workspace is ready. Select an app from the sidebar to get started.'
            : 'Please log in to access your workspace.'}
        </p>
      </div>

      {!authenticated && (
        <Button asChild>
          <a href="/login">Log in</a>
        </Button>
      )}

      {authenticated && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={handleNav('/people')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">People</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>Manage team members and permissions</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={handleNav('/brand')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Brand</CardTitle>
              <Palette className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>Customize colors, fonts, and styling</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={handleNav('/settings')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Settings</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>Configure workspace settings</CardDescription>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
