import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The label/title for the stat */
  title: string
  /** The main value to display */
  value: string | number
  /** Optional description text below the value */
  description?: string
  /** Optional trend indicator */
  trend?: {
    direction: "up" | "down" | "neutral"
    value: string
  }
  /** Optional icon to display */
  icon?: React.ReactNode
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, title, value, description, trend, icon, ...props }, ref) => {
    return (
      <Card ref={ref} className={cn("", className)} {...props}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {icon && (
            <div className="h-4 w-4 text-muted-foreground">{icon}</div>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {(description || trend) && (
            <p className="text-xs text-muted-foreground">
              {trend && (
                <span
                  className={cn(
                    "mr-1 font-medium",
                    trend.direction === "up" && "text-green-600 dark:text-green-400",
                    trend.direction === "down" && "text-red-600 dark:text-red-400"
                  )}
                >
                  {trend.direction === "up" && "↑"}
                  {trend.direction === "down" && "↓"}
                  {trend.direction === "neutral" && "→"} {trend.value}
                </span>
              )}
              {description}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
