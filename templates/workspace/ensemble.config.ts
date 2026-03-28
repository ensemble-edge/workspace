import type { WorkspaceConfig } from '@ensemble-edge/core';

export default {
  name: 'My Workspace',
  slug: 'my-workspace',
  theme: {
    primaryColor: '#3B82F6',
    logo: '/logo.svg',
  },
  apps: [
    // Add your apps here
  ],
} satisfies WorkspaceConfig;
