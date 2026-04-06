import * as React from "react"
import { cn } from "@/lib/utils"

export interface DataRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Label on the left */
  label: string
  /** Value on the right */
  value: React.ReactNode
  /** Optional: use monospace font for value */
  mono?: boolean
}

const DataRow = React.forwardRef<HTMLDivElement, DataRowProps>(
  ({ className, label, value, mono, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-between py-2 border-b border-border last:border-0",
          className
        )}
        {...props}
      >
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("text-sm font-medium", mono && "font-mono")}>
          {value}
        </span>
      </div>
    )
  }
)
DataRow.displayName = "DataRow"

export { DataRow }
