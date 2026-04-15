import { registerPage } from '../../registry';
import { HomePage } from './HomePage';

registerPage({
  appId: 'core:home',
  path: '/',
  component: HomePage,
  title: 'Home',
});
