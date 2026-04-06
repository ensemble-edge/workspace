import * as React from "react"
import { cn } from "@/lib/utils"

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Icon to display (usually from lucide-react) */
  icon?: React.ReactNode
  /** Main heading */
  title: string
  /** Description text */
  description?: string
  /** Action button or link */
  action?: React.ReactNode
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center py-12 px-4 text-center",
          className
        )}
        {...props}
      >
        {icon && (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <div className="h-6 w-6 text-muted-foreground">{icon}</div>
          </div>
        )}
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            {description}
          </p>
        )}
        {action && <div className="mt-6">{action}</div>}
        {children}
      </div>
    )
  }
)
EmptyState.displayName = "EmptyState"

export { EmptyState }
