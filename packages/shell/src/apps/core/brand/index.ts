import { registerPage } from '../../registry';
import { BrandPage } from './BrandPage';

registerPage({
  appId: 'core:brand',
  path: '/brand',
  component: BrandPage,
  title: 'Brand',
});
