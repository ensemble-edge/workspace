// Theme service for workspace branding

export interface ThemeConfig {
  primaryColor: string;
  mode: 'light' | 'dark' | 'system';
  logo?: string;
  favicon?: string;
}

export function createThemeService(config: Partial<ThemeConfig> = {}) {
  return {
    config: {
      primaryColor: config.primaryColor ?? '#3B82F6',
      mode: config.mode ?? 'system',
      logo: config.logo,
      favicon: config.favicon,
    },
  };
}
