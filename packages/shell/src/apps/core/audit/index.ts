import { registerPage } from '../../registry';
import { AuditPage } from './AuditPage';

registerPage({
  appId: 'core:audit',
  path: '/audit',
  component: AuditPage,
  title: 'Audit Log',
});
