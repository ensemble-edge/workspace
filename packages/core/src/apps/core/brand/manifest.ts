import type { CoreAppManifest } from '../../types';

export const brandManifest: CoreAppManifest = {
  id: 'core:brand',
  name: 'Brand Manager',
  icon: 'palette',
  description: 'Customize your workspace visual identity — colors, fonts, logos, and styling.',
  tier: 'core',
  nav: {
    label: 'Brand',
    icon: 'palette',
    section: 'workspace',
    path: '/brand',
  },
};
