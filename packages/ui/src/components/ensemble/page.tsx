import * as React from "react"
import { cn } from "@/lib/utils"

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

const EnsemblePage = React.forwardRef<HTMLDivElement, EnsemblePageProps>(
  ({ className, title, description, actions, bleed = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // space-y-6 between header and content. Padding comes from
          // --content-padding (set by workspace; falls back to 1.5rem).
          // No bg-background here — the body/iframe owns that.
          "space-y-6 text-foreground",
          !bleed && "p-[var(--content-padding,1.5rem)]",
          className,
        )}
        style={{ fontFamily: "var(--font-body, inherit)" }}
        {...props}
      >
        {(title || actions) && (
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              {title && (
                <h1
                  className="text-3xl font-bold tracking-tight truncate"
                  style={{ fontFamily: "var(--font-heading, inherit)" }}
                >
                  {title}
                </h1>
              )}
              {description && (
                <p className="text-muted-foreground">{description}</p>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2 shrink-0">{actions}</div>
            )}
          </div>
        )}
        {children}
      </div>
    );
  }
);
EnsemblePage.displayName = "EnsemblePage";

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

const EnsembleSection = React.forwardRef<HTMLElement, EnsembleSectionProps>(
  ({ className, title, description, actions, children, ...props }, ref) => {
    return (
      <section ref={ref} className={cn("space-y-4", className)} {...props}>
        {(title || actions) && (
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              {title && (
                <h2 className="text-xl font-semibold tracking-tight truncate">{title}</h2>
              )}
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2 shrink-0">{actions}</div>
            )}
          </div>
        )}
        {children}
      </section>
    );
  }
);
EnsembleSection.displayName = "EnsembleSection";

export { EnsemblePage, EnsembleSection };
