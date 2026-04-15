import { registerPage } from '../../registry';
import { PeoplePage } from './PeoplePage';

registerPage({
  appId: 'core:people',
  path: '/people',
  component: PeoplePage,
  title: 'People',
});
