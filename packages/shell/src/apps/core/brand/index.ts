import { registerPage } from '../../registry';
import { BrandPage } from './BrandPage';

// v0.1.84: brand admin moved from /brand to /brand-app so the /brand
// URL can be the always-public brand guide (shareable with team /
// designers / external folks without conditional auth-branching).
registerPage({
  appId: 'core:brand',
  path: '/brand-app',
  component: BrandPage,
  title: 'Brand',
});
