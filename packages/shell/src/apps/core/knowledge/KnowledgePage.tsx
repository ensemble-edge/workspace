/**
 * Knowledge Page — Company knowledge graph editor.
 */

import * as React from 'react';
import { BookOpen } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ensemble-edge/ui';

export function KnowledgePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Knowledge</h1>
        <p className="text-muted-foreground">
          Company knowledge base — standards, processes, and reference material
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base</CardTitle>
          <CardDescription>
            Define company knowledge that the AI assistant and team members can reference.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">Knowledge editor coming soon</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This will support rich text entries with versioning and search.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
