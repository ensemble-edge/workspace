import { registerPage } from '../../registry';
import { KnowledgePage } from './KnowledgePage';

registerPage({
  appId: 'core:knowledge',
  path: '/knowledge',
  component: KnowledgePage,
  title: 'Knowledge',
});
