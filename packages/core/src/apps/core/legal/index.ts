import type { CoreAppDefinition } from '../../types';
import { legalManifest } from './manifest';
import { registerLegalRoutes } from './routes';

export const legalApp: CoreAppDefinition = {
  manifest: legalManifest,
  registerRoutes: registerLegalRoutes,
};
