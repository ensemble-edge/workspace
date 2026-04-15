import { registerPage } from '../../registry';
import { AppsPage } from './AppsPage';
import { AppViewPage } from './AppViewPage';

registerPage({
  appId: 'core:apps',
  path: '/apps',
  component: AppsPage,
  title: 'Apps',
});

registerPage({
  appId: 'core:apps',
  path: /^\/apps\/[\w-]+$/,
  component: AppViewPage,
  title: 'App',
});
