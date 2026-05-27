import * as React from "react";
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
    /** The label/title for the stat */
    title: string;
    /** The main value to display */
    value: string | number;
    /** Optional description text below the value */
    description?: string;
    /** Optional trend indicator */
    trend?: {
        direction: "up" | "down" | "neutral";
        value: string;
    };
    /** Optional icon to display */
    icon?: React.ReactNode;
}
declare const StatCard: React.ForwardRefExoticComponent<StatCardProps & React.RefAttributes<HTMLDivElement>>;
export { StatCard };
//# sourceMappingURL=stat-card.d.ts.map