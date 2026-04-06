"use client"

import { Toaster as Sonner, toast } from "sonner"
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Toaster component styled to match shadcn/ui Alert component.
 *
 * Provides consistent styling between toast notifications and alerts.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast relative w-full rounded-lg border px-4 py-3 text-sm shadow-lg group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border",
          title: "font-medium leading-none tracking-tight",
          description: "text-sm text-muted-foreground [&_p]:leading-relaxed",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:hover:bg-primary/90",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:hover:bg-muted/90",
          closeButton:
            "group-[.toast]:bg-background group-[.toast]:border-border group-[.toast]:text-foreground group-[.toast]:hover:bg-muted",
          error:
            "group-[.toaster]:border-destructive/50 group-[.toaster]:text-destructive dark:group-[.toaster]:border-destructive [&_svg]:text-destructive",
          success:
            "group-[.toaster]:border-green-500/50 group-[.toaster]:text-green-600 dark:group-[.toaster]:border-green-500 dark:group-[.toaster]:text-green-400 [&_svg]:text-green-600 dark:[&_svg]:text-green-400",
          warning:
            "group-[.toaster]:border-yellow-500/50 group-[.toaster]:text-yellow-600 dark:group-[.toaster]:border-yellow-500 dark:group-[.toaster]:text-yellow-400 [&_svg]:text-yellow-600 dark:[&_svg]:text-yellow-400",
          info:
            "group-[.toaster]:border-blue-500/50 group-[.toaster]:text-blue-600 dark:group-[.toaster]:border-blue-500 dark:group-[.toaster]:text-blue-400 [&_svg]:text-blue-600 dark:[&_svg]:text-blue-400",
        },
      }}
      icons={{
        success: <CheckCircle2 className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <AlertTriangle className="h-4 w-4" />,
        error: <AlertCircle className="h-4 w-4" />,
        close: <X className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
