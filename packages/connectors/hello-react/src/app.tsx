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

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Hello, React</h1>
        <p className="text-muted-foreground">
          A reference guest app using @ensemble-edge/ui inside an iframe.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Form schemas (demo data)</CardTitle>
          <CardDescription>
            This renders with the host workspace&apos;s brand tokens. Change the brand
            in workspace settings → this view follows.
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
