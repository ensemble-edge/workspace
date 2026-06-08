/**
 * core:legal — public HTML page rendering.
 *
 * Self-contained HTML + inline CSS (no Tailwind, no client JS beyond a
 * tiny inline language-switcher). The "Centro Legal" layout from spec
 * §6.1: brand-agnostic ToC sidebar on the left, rendered doc on the
 * right, a language dropdown driven by the doc's own slugs_json.
 *
 * Crawlable: emits <link rel="alternate" hreflang> per locale and does
 * NOT set noindex. The route layer omits the noindex header to match.
 */
export interface LegalPageData {
    lang: string;
    activeId: string;
    title: string;
    lastUpdated: string;
    contentHtml: string;
    /** The active doc's slugs by locale — drives the language switcher + hreflang. */
    slugs: Record<string, string | null | undefined>;
    toc: Array<{
        id: string;
        title: string;
        slug: string;
    }>;
}
export declare function renderLegalPage(data: LegalPageData): string;
/** Small 404 page (spec §6.1) — site-default-locale, no sidebar. */
export declare function renderLegalNotFound(lang: string): string;
//# sourceMappingURL=render.d.ts.map