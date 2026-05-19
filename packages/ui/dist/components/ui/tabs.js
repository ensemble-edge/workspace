"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const Tabs = TabsPrimitive.Root;
const tabsListVariants = cva("inline-flex items-center text-muted-foreground", {
    variants: {
        variant: {
            default: "h-9 justify-center rounded-lg bg-muted p-1",
            line: "h-auto gap-4 border-b border-border bg-transparent p-0 rounded-none",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});
const tabsTriggerVariants = cva("inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", {
    variants: {
        variant: {
            default: "rounded-md px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs",
            line: "rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});
const TabsListContext = React.createContext({});
const TabsList = React.forwardRef(({ className, variant, ...props }, ref) => (_jsx(TabsListContext.Provider, { value: { variant: variant ?? "default" }, children: _jsx(TabsPrimitive.List, { ref: ref, className: cn(tabsListVariants({ variant }), className), ...props }) })));
TabsList.displayName = TabsPrimitive.List.displayName;
const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => {
    const { variant } = React.useContext(TabsListContext);
    return (_jsx(TabsPrimitive.Trigger, { ref: ref, className: cn(tabsTriggerVariants({ variant }), className), ...props }));
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;
const TabsContent = React.forwardRef(({ className, ...props }, ref) => (_jsx(TabsPrimitive.Content, { ref: ref, className: cn("mt-2 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className), ...props })));
TabsContent.displayName = TabsPrimitive.Content.displayName;
export { Tabs, TabsList, TabsTrigger, TabsContent };
//# sourceMappingURL=tabs.js.map