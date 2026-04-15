/**
 * Auth & Security Page — Authentication policies and SSO configuration.
 */

import * as React from 'react';
import { Shield, Key, Lock } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@ensemble-edge/ui';

export function AuthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auth & Security</h1>
        <p className="text-muted-foreground">
          Authentication methods, SSO, and security policies
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" /> Authentication Methods
            </CardTitle>
            <CardDescription>How users sign in to this workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Email & Password</p>
                <p className="text-sm text-muted-foreground">Traditional login with email and password</p>
              </div>
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Magic Link</p>
                <p className="text-sm text-muted-foreground">Passwordless email login</p>
              </div>
              <Badge variant="outline">Coming Soon</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">SSO / SAML</p>
                <p className="text-sm text-muted-foreground">Enterprise single sign-on</p>
              </div>
              <Badge variant="outline">Coming Soon</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Security Policies
            </CardTitle>
            <CardDescription>Workspace security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Session Lifetime</p>
                <p className="text-sm text-muted-foreground">How long sessions stay active</p>
              </div>
              <span className="text-sm font-mono">7 days</span>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Password Requirements</p>
                <p className="text-sm text-muted-foreground">Minimum password strength</p>
              </div>
              <span className="text-sm font-mono">8+ chars</span>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Rate Limiting</p>
                <p className="text-sm text-muted-foreground">Login attempt throttling</p>
              </div>
              <span className="text-sm font-mono">5 per 15min</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
