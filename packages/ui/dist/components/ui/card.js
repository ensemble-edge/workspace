import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/utils";
const cardPaddingStyle = { padding: 'var(--card-padding, 1.5rem)' };
const cardPaddingNoTopStyle = { padding: 'var(--card-padding, 1.5rem)', paddingTop: 0 };
const Card = React.forwardRef(({ className, ...props }, ref) => (_jsx("div", { ref: ref, className: cn("rounded-xl border bg-card text-card-foreground shadow-xs", className), ...props })));
Card.displayName = "Card";
const CardHeader = React.forwardRef(({ className, style, ...props }, ref) => (_jsx("div", { ref: ref, className: cn("flex flex-col space-y-1.5", className), style: { ...cardPaddingStyle, ...style }, ...props })));
CardHeader.displayName = "CardHeader";
const CardTitle = React.forwardRef(({ className, ...props }, ref) => (_jsx("div", { ref: ref, className: cn("font-semibold leading-none tracking-tight", className), ...props })));
CardTitle.displayName = "CardTitle";
const CardDescription = React.forwardRef(({ className, ...props }, ref) => (_jsx("div", { ref: ref, className: cn("text-sm text-muted-foreground", className), ...props })));
CardDescription.displayName = "CardDescription";
const CardContent = React.forwardRef(({ className, style, ...props }, ref) => (_jsx("div", { ref: ref, className: cn("", className), style: { ...cardPaddingNoTopStyle, ...style }, ...props })));
CardContent.displayName = "CardContent";
const CardFooter = React.forwardRef(({ className, style, ...props }, ref) => (_jsx("div", { ref: ref, className: cn("flex items-center", className), style: { ...cardPaddingNoTopStyle, ...style }, ...props })));
CardFooter.displayName = "CardFooter";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
//# sourceMappingURL=card.js.map