/**
 * Workspace Domain — i18n
 *
 * Internationalization configuration.
 */
export interface I18nConfig {
    defaultLocale: string;
    supportedLocales: string[];
}
export declare function createI18nService(config?: Partial<I18nConfig>): {
    defaultLocale: string;
    supportedLocales: string[];
};
//# sourceMappingURL=i18n.d.ts.map