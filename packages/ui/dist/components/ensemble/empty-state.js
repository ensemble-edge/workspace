import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "../../lib/utils.js";
const EmptyState = React.forwardRef(({ className, icon, title, description, action, children, ...props }, ref) => {
    return (_jsxs("div", { ref: ref, className: cn("flex flex-col items-center justify-center py-12 px-4 text-center", className), ...props, children: [icon && (_jsx("div", { className: "mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4", children: _jsx("div", { className: "h-6 w-6 text-muted-foreground", children: icon }) })), _jsx("h3", { className: "text-lg font-semibold", children: title }), description && (_jsx("p", { className: "mt-1 text-sm text-muted-foreground max-w-sm", children: description })), action && _jsx("div", { className: "mt-6", children: action }), children] }));
});
EmptyState.displayName = "EmptyState";
export { EmptyState };
//# sourceMappingURL=empty-state.js.map