import { registerPage } from '../../registry';
import { NavPage } from './NavPage';

registerPage({
  appId: 'core:nav',
  path: '/nav',
  component: NavPage,
  title: 'Navigation',
});
