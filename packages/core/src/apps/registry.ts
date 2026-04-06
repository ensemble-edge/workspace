/**
 * Apps Domain — Registry
 *
 * App registry for managing installed guest apps.
 */

export interface AppManifest {
  id: string;
  name: string;
  version: string;
  permissions: string[];
  entry: string;
}

export function createAppRegistryService() {
  return {
    list: async (): Promise<AppManifest[]> => {
      // TODO: List installed apps
      return [];
    },
    install: async (_manifest: AppManifest) => {
      // TODO: Install an app
    },
    uninstall: async (_appId: string) => {
      // TODO: Uninstall an app
    },
  };
}
