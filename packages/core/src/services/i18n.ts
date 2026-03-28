// Internationalization service

export interface I18nConfig {
  defaultLocale: string;
  supportedLocales: string[];
}

export function createI18nService(config: Partial<I18nConfig> = {}) {
  return {
    defaultLocale: config.defaultLocale ?? 'en',
    supportedLocales: config.supportedLocales ?? ['en'],
  };
}
