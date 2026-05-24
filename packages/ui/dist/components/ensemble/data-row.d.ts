import * as React from "react";
export interface DataRowProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Label on the left */
    label: string;
    /** Value on the right */
    value: React.ReactNode;
    /** Optional: use monospace font for value */
    mono?: boolean;
}
declare const DataRow: React.ForwardRefExoticComponent<DataRowProps & React.RefAttributes<HTMLDivElement>>;
export { DataRow };
//# sourceMappingURL=data-row.d.ts.map