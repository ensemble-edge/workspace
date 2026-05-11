/**
 * The guest app. Pure JSX. No imports except types.
 *
 * Runs in the HOST's React tree — same document, same :root, same theme.
 * No iframe boundary. Workspace settings (brand, font, padding, radius)
 * apply directly; there's nothing to propagate.
 */
import type { EnsembleRuntime } from '@ensemble-edge/guest-runtime';

declare const Ensemble: EnsembleRuntime;
const {
  Page, Card, CardHeader, CardTitle, CardDescription, CardContent,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Button,
} = Ensemble;

export default function HelloComponent() {
  const rows = [
    { id: 'a', name: 'Component-tier app', detail: 'Renders in host React tree' },
    { id: 'b', name: 'No iframe', detail: 'Same :root, same theme' },
    { id: 'c', name: 'Tiny bundle', detail: '~500 bytes — just JSX factory calls' },
  ];

  return (
    <Page
      title="Hello, Component"
      description="A reference guest app using the component tier — no iframe, full host integration."
    >
      <Card>
        <CardHeader>
          <CardTitle>Why this tier exists</CardTitle>
          <CardDescription>
            The guest's UI is a React component the host loads via dynamic <code>import()</code>.
            It runs in the host's React tree, so brand color, fonts, padding, radius,
            and dark mode all just work — no boundary, no propagation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Behavior</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex gap-2">
            <Button>Primary action</Button>
            <Button variant="outline">Secondary</Button>
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}
