import { registerPage } from '../../registry';
import { AuthPage } from './AuthPage';

registerPage({
  appId: 'core:auth',
  path: '/auth',
  component: AuthPage,
  title: 'Auth & Security',
});
