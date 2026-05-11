/**
 * The whole guest app. Just JSX. No React import, no UI import, no styles.
 *
 * Components come from window.Ensemble at runtime via the jsx-runtime shim
 * configured in tsconfig.json. The compiled JS contains ONLY this code's
 * factory calls — about 2 KB total. React, Radix, and all workspace UI
 * components live in the workspace-served runtime bundle.
 *
 * Change workspace settings (brand color, font, spacing) and this app
 * follows automatically — the runtime is re-served per workspace.
 */
import type { EnsembleRuntime } from '@ensemble-edge/guest-runtime';

// Pull the primitives from the runtime. Types check at build time;
// at runtime these are resolved from window.Ensemble.
declare const Ensemble: EnsembleRuntime;
const { Page, Card, CardHeader, CardTitle, CardDescription, CardContent,
        Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
        Button } = Ensemble;

export default function HelloReact() {
  const rows = [
    { id: 'glp1-intake',  name: 'GLP-1 Intake',     version: '1.0.0' },
    { id: 'consent',      name: 'Patient Consent',  version: '0.3.1' },
    { id: 'demographics', name: 'Demographics',     version: '0.0.1' },
  ];

  return (
    <Page
      title="Hello, React"
      description="A reference guest app using @ensemble-edge/workspace primitives."
    >
      <Card>
        <CardHeader>
          <CardTitle>Form schemas (demo data)</CardTitle>
          <CardDescription>
            Padding, fonts, colors, and radius are inherited from the host
            workspace. Change them in workspace settings — this view follows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.version}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Page>
  );
}
