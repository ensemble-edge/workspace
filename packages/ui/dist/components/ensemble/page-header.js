import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/utils";
const PageHeader = React.forwardRef(({ className, title, description, actions, back, children, ...props }, ref) => {
    return (_jsxs("div", { ref: ref, className: cn("mb-6", className), ...props, children: [back && _jsx("div", { className: "mb-2", children: back }), _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("h1", { className: "text-2xl font-bold tracking-tight", children: title }), description && (_jsx("p", { className: "text-muted-foreground", children: description }))] }), actions && (_jsx("div", { className: "flex items-center gap-2 shrink-0", children: actions }))] }), children] }));
});
PageHeader.displayName = "PageHeader";
export { PageHeader };
//# sourceMappingURL=page-header.js.map