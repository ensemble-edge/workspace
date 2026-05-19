"use client";
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
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
/**
 * Tabs become a dropdown when the container is narrower than this.
 * 640px ≈ mobile-landscape; below this width horizontal tab strips
 * either overflow or wrap awkwardly, so we collapse into a native-
 * styled <select> that gives the same affordance with one tap.
 */
const TABS_COLLAPSE_BREAKPOINT_PX = 640;
const TabsCollapseContext = React.createContext(null);
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
const TabsList = React.forwardRef(({ className, variant, noCollapse = false, children, ...props }, ref) => {
    const wrapRef = React.useRef(null);
    const [collapsed, setCollapsed] = React.useState(false);
    const [triggers, setTriggers] = React.useState(new Map());
    // Read Tabs' active value from data attribute on the Root.
    const tabsRoot = TabsPrimitive.Root;
    void tabsRoot;
    React.useEffect(() => {
        if (noCollapse)
            return;
        const el = wrapRef.current;
        if (!el)
            return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setCollapsed(entry.contentRect.width < TABS_COLLAPSE_BREAKPOINT_PX);
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [noCollapse]);
    const registerTrigger = React.useCallback((value, label) => {
        setTriggers((prev) => {
            const next = new Map(prev);
            next.set(value, label);
            return next;
        });
    }, []);
    const unregisterTrigger = React.useCallback((value) => {
        setTriggers((prev) => {
            const next = new Map(prev);
            next.delete(value);
            return next;
        });
    }, []);
    // Locate the parent <Tabs> Root to read/write value. Radix exposes
    // it on the closest [data-state] element with role="tablist"'s
    // parent — but the simpler path: render an invisible TabsPrimitive
    // and forward selection through a hidden <select>. The dropdown
    // option onChange dispatches through the native <select>'s value
    // which is wired to TabsPrimitive via a hidden trigger click.
    const currentValue = useTabsRootValue(wrapRef);
    const setValue = useSetTabsRootValue(wrapRef);
    return (_jsx(TabsListContext.Provider, { value: { variant: variant ?? "default" }, children: _jsx(TabsCollapseContext.Provider, { value: {
                variant: variant ?? "default",
                collapsed,
                registerTrigger,
                unregisterTrigger,
                triggers,
                currentValue,
                setValue,
            }, children: _jsx("div", { ref: wrapRef, className: cn("w-full", collapsed && "block"), children: collapsed ? (_jsxs(_Fragment, { children: [_jsx(TabsPrimitive.List, { ref: ref, className: "sr-only", ...props, children: children }), _jsx("select", { value: currentValue ?? '', onChange: (e) => setValue(e.target.value), className: "w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", "aria-label": "Section", children: Array.from(triggers.entries()).map(([value, label]) => (_jsx("option", { value: value, children: typeof label === 'string' ? label : value }, value))) })] })) : (_jsx(TabsPrimitive.List, { ref: ref, className: cn(tabsListVariants({ variant }), className), ...props, children: children })) }) }) }));
});
TabsList.displayName = TabsPrimitive.List.displayName;
/**
 * Walk up the DOM from a known element to find the Radix Tabs.Root
 * data attribute and read the active value. This bypasses needing
 * an explicit context from Radix (which it doesn't expose).
 */
function useTabsRootValue(refToChildEl) {
    const [value, setValue] = React.useState();
    React.useEffect(() => {
        const el = refToChildEl.current;
        if (!el)
            return;
        // Find the closest Radix Tabs Root — it's the element with
        // [data-orientation], typically.
        const root = el.closest('[data-orientation]');
        if (!root)
            return;
        // Read the active value by scanning the trigger with [data-state="active"].
        function read() {
            const active = root?.querySelector('[role="tab"][data-state="active"]');
            const v = active?.getAttribute('data-value') ?? active?.getAttribute('value') ?? undefined;
            setValue(v);
        }
        read();
        const mo = new MutationObserver(read);
        mo.observe(root, { attributes: true, subtree: true, attributeFilter: ['data-state'] });
        return () => mo.disconnect();
    }, [refToChildEl]);
    return value;
}
/**
 * Returns a setter that clicks the hidden Radix trigger for the
 * chosen value — which updates Radix's authoritative state and
 * triggers all the normal selection behavior (content swap, etc.).
 */
function useSetTabsRootValue(refToChildEl) {
    return React.useCallback((value) => {
        const el = refToChildEl.current;
        if (!el)
            return;
        const root = el.closest('[data-orientation]');
        if (!root)
            return;
        const trigger = root.querySelector(`[role="tab"][value="${value}"], [role="tab"][data-value="${value}"]`);
        if (trigger)
            trigger.click();
    }, [refToChildEl]);
}
const TabsTrigger = React.forwardRef(({ className, value, children, ...props }, ref) => {
    const { variant } = React.useContext(TabsListContext);
    const collapse = React.useContext(TabsCollapseContext);
    // Register this trigger's label with the collapse context so the
    // dropdown render path has a text label per value. Re-runs when
    // children change so dynamic tab titles stay in sync.
    React.useEffect(() => {
        if (!collapse || !value)
            return;
        collapse.registerTrigger(value, extractText(children));
        return () => collapse.unregisterTrigger(value);
    }, [collapse, value, children]);
    return (_jsx(TabsPrimitive.Trigger, { ref: ref, value: value, className: cn(tabsTriggerVariants({ variant }), className), ...props, children: children }));
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;
/**
 * Coerce React children into a plain-text label for the dropdown
 * option text. Handles strings, numbers, and shallow element trees
 * by recursively gathering their text content.
 */
function extractText(node) {
    if (node == null || typeof node === 'boolean')
        return '';
    if (typeof node === 'string' || typeof node === 'number')
        return String(node);
    if (Array.isArray(node))
        return node.map(extractText).join('');
    if (React.isValidElement(node)) {
        const props = node.props;
        return extractText(props.children);
    }
    return '';
}
const TabsContent = React.forwardRef(({ className, ...props }, ref) => (_jsx(TabsPrimitive.Content, { ref: ref, className: cn("mt-2 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className), ...props })));
TabsContent.displayName = TabsPrimitive.Content.displayName;
export { Tabs, TabsList, TabsTrigger, TabsContent };
//# sourceMappingURL=tabs.js.map