import * as React from "react";
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
    /** Render without internal padding (e.g. for full-bleed views) */
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