import { createRoot } from 'react-dom/client';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Button,
} from '@ensemble-edge/workspace/ui';

function App() {
  // Layout matches core app pages — see hello-react reference connector.
  // Outer: space-y-6 between header and content. No bg-background or
  // min-h-screen — the iframe inherits the workspace theme via
  // /_ensemble/brand/css and fills its container via the shell's flex layout.
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{{APP_NAME}}</h1>
        <p className="text-muted-foreground">
          A new guest app — replace this placeholder with your real UI.
        </p>
      </div>

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
