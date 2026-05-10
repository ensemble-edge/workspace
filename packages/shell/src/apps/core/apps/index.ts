import { registerPage } from '../../registry';
import { AppsPage } from './AppsPage';
import { AppViewPage } from './AppViewPage';

registerPage({
  appId: 'core:apps',
  path: '/apps',
  component: AppsPage,
  title: 'Apps',
});

// Match /apps/<id> AND any deeper subpath like /apps/<id>/foo/bar.
// The guest app's own routing (inside the iframe) handles the suffix —
// we forward the full path through the gateway so the worker sees it.
registerPage({
  appId: 'core:apps',
  path: /^\/apps\/[\w-]+(?:\/.*)?$/,
  component: AppViewPage,
  title: 'App',
});
