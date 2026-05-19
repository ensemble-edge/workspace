import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
const StatCard = React.forwardRef(({ className, title, value, description, trend, icon, ...props }, ref) => {
    return (_jsxs(Card, { ref: ref, className: cn("", className), ...props, children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium text-muted-foreground", children: title }), icon && (_jsx("div", { className: "h-4 w-4 text-muted-foreground", children: icon }))] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: value }), (description || trend) && (_jsxs("p", { className: "text-xs text-muted-foreground", children: [trend && (_jsxs("span", { className: cn("mr-1 font-medium", trend.direction === "up" && "text-green-600 dark:text-green-400", trend.direction === "down" && "text-red-600 dark:text-red-400"), children: [trend.direction === "up" && "↑", trend.direction === "down" && "↓", trend.direction === "neutral" && "→", " ", trend.value] })), description] }))] })] }));
});
StatCard.displayName = "StatCard";
export { StatCard };
//# sourceMappingURL=stat-card.js.map