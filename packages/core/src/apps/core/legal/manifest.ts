import type { CoreAppManifest } from '../../types';

export const legalManifest: CoreAppManifest = {
  id: 'core:legal',
  name: 'Legal Center',
  icon: 'scale',
  description:
    'Manage workspace legal documents — privacy, terms, consent, and more. Localized, versioned, and published to a public read API.',
  tier: 'core',
  nav: {
    // The CMS SPA page mounts at /legal-app so the bare /legal URL can
    // stay the always-public, server-rendered legal pages (same split
    // as brand: /brand is the public guide, /brand-app is the admin).
    label: 'Legal',
    icon: 'scale',
    section: 'workspace',
    path: '/legal-app',
  },
};
