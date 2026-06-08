import { registerPage } from '../../registry';
import { LegalPage } from './LegalPage';

// The bare /legal URL is the always-public, server-rendered legal
// pages (crawlable). The operator CMS mounts at /legal-app — same
// split as brand (/brand public guide vs /brand-app admin).
registerPage({
  appId: 'core:legal',
  path: '/legal-app',
  component: LegalPage,
  title: 'Legal',
});
