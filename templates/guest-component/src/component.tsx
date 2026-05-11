/**
 * Your guest app. Pure JSX. No imports except types.
 *
 * This renders directly in the host's React tree — no iframe boundary.
 * Workspace settings (brand color, font, padding, radius) apply
 * automatically because everything is one document, one :root.
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
            Edit <code>src/component.tsx</code>. Components come from <code>Ensemble</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button>Primary action</Button>
        </CardContent>
      </Card>
    </Page>
  );
}
