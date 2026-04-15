import type { CoreAppDefinition } from '../../types';
import { brandManifest } from './manifest';
import { registerBrandRoutes } from './routes';

export const brandApp: CoreAppDefinition = {
  manifest: brandManifest,
  registerRoutes: registerBrandRoutes,
};
