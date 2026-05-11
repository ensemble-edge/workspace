/**
 * Apps Domain — Registry
 *
 * App registry for managing installed guest apps.
 */
export function createAppRegistryService() {
    return {
        list: async () => {
            // TODO: List installed apps
            return [];
        },
        install: async (_manifest) => {
            // TODO: Install an app
        },
        uninstall: async (_appId) => {
            // TODO: Uninstall an app
        },
    };
}
//# sourceMappingURL=registry.js.map