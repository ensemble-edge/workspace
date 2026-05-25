import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "../../lib/utils.js";
const DataRow = React.forwardRef(({ className, label, value, mono, ...props }, ref) => {
    return (_jsxs("div", { ref: ref, className: cn("flex items-center justify-between py-2 border-b border-border last:border-0", className), ...props, children: [_jsx("span", { className: "text-sm text-muted-foreground", children: label }), _jsx("span", { className: cn("text-sm font-medium", mono && "font-mono"), children: value })] }));
});
DataRow.displayName = "DataRow";
export { DataRow };
//# sourceMappingURL=data-row.js.map