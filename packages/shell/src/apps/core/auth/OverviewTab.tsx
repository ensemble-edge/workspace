/**
 * Overview tab — the existing Auth & Security content, factored out
 * so AuthPage can host multiple tabs.
 */

import * as React from 'react';
import { useEffect, useState } from 'react';
import { Key, Lock } from 'lucide-react';

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Badge,
} from '@ensemble-edge/ui';
import { authedFetch } from '../../../state';

interface AuthMethods {
  password: boolean;
  magic_link: boolean;
}

export function OverviewTab() {
  const [methods, setMethods] = useState<AuthMethods | null>(null);

  useEffect(() => {
    authedFetch('/_ensemble/auth/methods')
      .then((r) => r.json() as Promise<AuthMethods>)
      .then(setMethods)
      .catch(() => setMethods({ password: true, magic_link: false }));
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" /> Authentication Methods
          </CardTitle>
          <CardDescription>How users sign in to this workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <MethodRow
            name="Email & Password"
            description="Traditional login with email and password"
            active={methods?.password ?? true}
          />
          <MethodRow
            name="Magic Link"
            description="Passwordless email login — enabled when email is configured"
            active={methods?.magic_link ?? false}
            inactiveHint="Configure email in Credentials → Notifications"
          />
          <MethodRow
            name="SSO / SAML"
            description="Enterprise single sign-on"
            active={false}
            inactiveHint="Coming Soon"
          />
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
          <PolicyRow name="Session Lifetime" description="How long sessions stay active" value="7 days" />
          <PolicyRow name="Password Requirements" description="Minimum password strength" value="8+ chars" />
          <PolicyRow name="Rate Limiting" description="Login attempt throttling" value="5 per 15min" />
        </CardContent>
      </Card>
    </div>
  );
}

function MethodRow({
  name, description, active, inactiveHint,
}: { name: string; description: string; active: boolean; inactiveHint?: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {active ? (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>
      ) : (
        <Badge variant="outline">{inactiveHint ?? 'Disabled'}</Badge>
      )}
    </div>
  );
}

function PolicyRow({ name, description, value }: { name: string; description: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <span className="text-sm font-mono">{value}</span>
    </div>
  );
}
