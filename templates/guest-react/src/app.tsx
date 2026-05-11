/**
 * Your guest app. Just JSX. No React import, no UI import, no styles.
 *
 * Workspace's runtime serves React, Radix UI, and the @ensemble-edge/ui
 * component library, attached to window.Ensemble. This file's compiled
 * output contains ONLY this file's factory calls — typically ~1 KB.
 *
 * Change workspace settings (brand color, font, spacing, radius) and this
 * app picks up the new values automatically. No redeploy needed.
 */
import type { EnsembleRuntime } from '@ensemble-edge/workspace/guest-runtime';

declare const Ensemble: EnsembleRuntime;
const { Page, Card, CardHeader, CardTitle, CardDescription, CardContent, Button } = Ensemble;

export default function {{APP_COMPONENT_NAME}}() {
  return (
    <Page
      title="{{APP_NAME}}"
      description="A new guest app — replace this with your real UI."
    >
      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>
            Edit <code>src/app.tsx</code> to build your interface. Components are
            destructured from <code>Ensemble</code> (typed via @ensemble-edge/workspace/guest-runtime).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button>Primary action</Button>
        </CardContent>
      </Card>
    </Page>
  );
}
