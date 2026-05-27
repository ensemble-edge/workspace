import * as React from "react";
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Icon to display (usually from lucide-react) */
    icon?: React.ReactNode;
    /** Main heading */
    title: string;
    /** Description text */
    description?: string;
    /** Action button or link */
    action?: React.ReactNode;
}
declare const EmptyState: React.ForwardRefExoticComponent<EmptyStateProps & React.RefAttributes<HTMLDivElement>>;
export { EmptyState };
//# sourceMappingURL=empty-state.d.ts.map