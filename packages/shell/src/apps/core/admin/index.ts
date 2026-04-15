import { registerPage } from '../../registry';
import { AdminPage } from './AdminPage';

registerPage({
  appId: 'core:admin',
  path: '/settings',
  component: AdminPage,
  title: 'Settings',
});
