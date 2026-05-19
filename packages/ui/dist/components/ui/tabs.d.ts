import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { type VariantProps } from "class-variance-authority";
declare const Tabs: React.ForwardRefExoticComponent<TabsPrimitive.TabsProps & React.RefAttributes<HTMLDivElement>>;
/**
 * Responsive TabsList — renders as horizontal pills/lines on wide
 * containers (≥640px) and as a Select dropdown below that. Same
 * consumer API as before; this is purely an enhancement to the
 * existing TabsList, so every site already using <TabsList> gets
 * mobile-friendliness for free.
 *
 * Detection uses ResizeObserver on the list's parent — width-based,
 * not viewport-based, so a tab strip rendered in a narrow sidebar
 * collapses correctly even on a wide screen. Disable with the
 * `noCollapse` prop for edge cases that genuinely need fixed
 * horizontal layout.
 */
declare const TabsList: React.ForwardRefExoticComponent<Omit<TabsPrimitive.TabsListProps & React.RefAttributes<HTMLDivElement>, "ref"> & VariantProps<(props?: ({
    variant?: "default" | "line" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string> & {
    /** Disable mobile-collapse for this list. Default: false. */
    noCollapse?: boolean;
} & React.RefAttributes<HTMLDivElement>>;
declare const TabsTrigger: React.ForwardRefExoticComponent<Omit<TabsPrimitive.TabsTriggerProps & React.RefAttributes<HTMLButtonElement>, "ref"> & React.RefAttributes<HTMLButtonElement>>;
declare const TabsContent: React.ForwardRefExoticComponent<Omit<TabsPrimitive.TabsContentProps & React.RefAttributes<HTMLDivElement>, "ref"> & React.RefAttributes<HTMLDivElement>>;
export { Tabs, TabsList, TabsTrigger, TabsContent };
//# sourceMappingURL=tabs.d.ts.map