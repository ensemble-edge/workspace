import { createRoot } from 'react-dom/client';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@ensemble-edge/ui';

function App() {
  const rows = [
    { id: 'glp1-intake', name: 'GLP-1 Intake', version: '1.0.0' },
    { id: 'consent', name: 'Patient Consent', version: '0.3.1' },
    { id: 'demographics', name: 'Demographics', version: '0.0.1' },
  ];

  // Layout matches core app pages (see packages/shell/src/apps/core/brand/BrandPage.tsx):
  //   - Outer container: space-y-6 between header block and content blocks
  //   - Header block: `text-3xl font-bold tracking-tight` h1 + muted-foreground p
  //   - NO bg-background or min-h-screen — the iframe's body inherits those
  //     from /_ensemble/brand/css, and the iframe itself fills its container
  //     via the shell's AppViewPage flex layout.
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hello, React</h1>
        <p className="text-muted-foreground">
          A reference guest app using @ensemble-edge/ui inside an iframe.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Form schemas (demo data)</CardTitle>
          <CardDescription>
            This renders with the host workspace&apos;s brand tokens. Change the brand
            in workspace settings — this view follows.
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
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
