/**
 * Workspace Domain — i18n
 *
 * Internationalization configuration.
 */
export function createI18nService(config = {}) {
    return {
        defaultLocale: config.defaultLocale ?? 'en',
        supportedLocales: config.supportedLocales ?? ['en'],
    };
}
//# sourceMappingURL=i18n.js.map