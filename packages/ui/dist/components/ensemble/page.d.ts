import * as React from "react";
/**
 * ViewportContext — set by a host that has ALREADY applied
 * --content-padding around its viewport region. EnsemblePage reads
 * this and skips its internal padding so we don't double up.
 *
 * Default value: `{ outerPaddingApplied: false }`. That means a
 * page rendered outside any provider (e.g. a standalone preview,
 * a Storybook story, an isolated test render) applies its own
 * padding — looks right by default.
 *
 * The shell's Viewport wrapper provides this context with
 * `outerPaddingApplied: true` because the shell already wraps the
 * viewport in a div with --content-padding. Inside that provider,
 * EnsemblePage's own padding becomes a no-op.
 *
 * Guest apps in iframes don't see this context (their DOM tree is
 * separate from the host shell's), so EnsemblePage applies its own
 * padding inside the iframe — correct behavior for iframe-tier
 * guests. Component-tier guests render INSIDE the host's React tree
 * and DO see the context — so they also stay double-padding-free.
 */
export interface ViewportContextValue {
    /** True when an ancestor has applied --content-padding already. */
    outerPaddingApplied: boolean;
}
export declare const ViewportContext: React.Context<ViewportContextValue>;
/**
 * Provider hosts wrap around their viewport region to signal that
 * --content-padding is already applied. The Shell uses this around
 * its `<Viewport>`.
 */
export declare function ViewportContextProvider({ outerPaddingApplied, children, }: {
    outerPaddingApplied: boolean;
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
/**
 * EnsemblePage — the canonical page container.
 *
 * This is the single source of truth for "what a workspace page looks like."
 * Core apps render it inside the shell. Guest apps render it inside the iframe
 * via the workspace runtime. Same component, same behavior, both contexts.
 *
 * Reads workspace CSS variables for spacing, typography, colors. Operator
 * changes settings → every page (core and guest) updates automatically.
 *
 * Internal padding behavior:
 *   - When rendered INSIDE a ViewportContextProvider (the shell's standard
 *     viewport region), Page skips its internal padding because the host
 *     already applied --content-padding around it. No double padding.
 *   - When rendered OUTSIDE the provider (iframe-tier guests, isolated
 *     previews, Storybook), Page applies its own --content-padding.
 *   - `bleed` prop forces no padding regardless of context — useful for
 *     full-bleed hero layouts.
 *
 *   <EnsemblePage title="Quiz CMS" description="Manage form schemas">
 *     <Card>...</Card>
 *   </EnsemblePage>
 */
export interface EnsemblePageProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Page title (rendered as h1) */
    title?: string;
    /** Optional subtitle */
    description?: string;
    /** Right-aligned action area in the header */
    actions?: React.ReactNode;
    /**
     * Force-render without internal padding (e.g. for full-bleed hero
     * views). Normally you don't need this — context handles it
     * automatically. Set to `true` only when you want NO padding even
     * when no ancestor applied it.
     */
    bleed?: boolean;
}
declare const EnsemblePage: React.ForwardRefExoticComponent<EnsemblePageProps & React.RefAttributes<HTMLDivElement>>;
/**
 * EnsembleSection — a labeled subsection within a page.
 *
 * Used for "Form schemas", "Recent activity", etc. — content blocks
 * below the main page header.
 */
export interface EnsembleSectionProps extends React.HTMLAttributes<HTMLElement> {
    /** Section heading */
    title?: string;
    /** Optional subtitle */
    description?: string;
    /** Right-aligned actions for this section */
    actions?: React.ReactNode;
}
declare const EnsembleSection: React.ForwardRefExoticComponent<EnsembleSectionProps & React.RefAttributes<HTMLElement>>;
export { EnsemblePage, EnsembleSection };
//# sourceMappingURL=page.d.ts.map