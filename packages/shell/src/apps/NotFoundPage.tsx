/**
 * 404 — Not Found Page
 */

import * as React from 'react';

import {
  Card,
  CardContent,
  Button,
} from '@ensemble-edge/ui';

import { navigate } from '../state';

export function NotFoundPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center py-8">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
          <p className="mt-1 text-muted-foreground">
            The page you're looking for doesn't exist.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
            &larr; Back to home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
