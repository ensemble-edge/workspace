/**
 * Danger Zone Tab — Destructive workspace operations.
 */

import * as React from 'react';
import { useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
} from '@ensemble-edge/ui';

export function DangerZoneTab() {
  const [confirmText, setConfirmText] = useState('');

  return (
    <div className="space-y-6">
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Workspace</CardTitle>
          <CardDescription>
            Permanently delete this workspace and all its data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              Type <span className="font-mono font-bold">delete my workspace</span> to confirm
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="delete my workspace"
            />
          </div>
          <Button
            variant="destructive"
            disabled={confirmText !== 'delete my workspace'}
          >
            Delete Workspace
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Transfer Ownership</CardTitle>
          <CardDescription>
            Transfer this workspace to another member. You will lose owner privileges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled>
            Transfer Ownership (coming soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
