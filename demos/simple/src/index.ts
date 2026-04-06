/**
 * Ensemble Workspace Demo
 *
 * This is a simple demo workspace that showcases the Ensemble shell and core features.
 */

import { createWorkspace } from '@ensemble-edge/core';

// Create the workspace with configuration
const app = createWorkspace({
  workspace: {
    id: 'demo',
    slug: 'demo',
    name: 'Demo Workspace',
    type: 'organization',
  },
  brand: {
    name: 'Ensemble Demo',
    logo: null,
    colors: {
      primary: '#6366f1',
      secondary: '#8b5cf6',
    },
  },
  features: {
    ai: true,
    apps: true,
  },
});

export default app;
