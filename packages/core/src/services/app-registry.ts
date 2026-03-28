// App registry service for managing installed apps

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
    install: async (manifest: AppManifest) => {
      // TODO: Install an app
    },
    uninstall: async (appId: string) => {
      // TODO: Uninstall an app
    },
  };
}
