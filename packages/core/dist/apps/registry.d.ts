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
export declare function createAppRegistryService(): {
    list: () => Promise<AppManifest[]>;
    install: (_manifest: AppManifest) => Promise<void>;
    uninstall: (_appId: string) => Promise<void>;
};
//# sourceMappingURL=registry.d.ts.map