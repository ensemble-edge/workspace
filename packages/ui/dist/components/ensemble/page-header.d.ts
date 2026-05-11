import * as React from "react";
export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Page title */
    title: string;
    /** Optional description/subtitle */
    description?: string;
    /** Action buttons (right side) */
    actions?: React.ReactNode;
    /** Back button or breadcrumb */
    back?: React.ReactNode;
}
declare const PageHeader: React.ForwardRefExoticComponent<PageHeaderProps & React.RefAttributes<HTMLDivElement>>;
export { PageHeader };
//# sourceMappingURL=page-header.d.ts.map