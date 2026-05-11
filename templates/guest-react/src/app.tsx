import { createRoot } from 'react-dom/client';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Button,
} from '@ensemble-edge/workspace/ui';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{{APP_NAME}}</h1>
        <p className="text-muted-foreground">
          A new guest app — replace this placeholder with your real UI.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>
            Edit <code className="font-mono text-sm">src/app.tsx</code> to build your interface.
            Components come from <code className="font-mono text-sm">@ensemble-edge/workspace/ui</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="default">Primary action</Button>
        </CardContent>
      </Card>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
