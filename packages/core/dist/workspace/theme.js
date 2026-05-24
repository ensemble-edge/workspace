/**
 * Workspace Domain — Theme
 *
 * Theme configuration for workspace branding.
 */
export function createThemeService(config = {}) {
    return {
        config: {
            primaryColor: config.primaryColor ?? '#3B82F6',
            mode: config.mode ?? 'system',
            logo: config.logo,
            favicon: config.favicon,
        },
    };
}
//# sourceMappingURL=theme.js.map