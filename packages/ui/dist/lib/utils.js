import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
/**
 * Combines class names using clsx and tailwind-merge.
 * This is the standard pattern used by shadcn/ui components.
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-primary", className)
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
//# sourceMappingURL=utils.js.map