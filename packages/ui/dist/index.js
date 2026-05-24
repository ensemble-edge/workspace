// @ensemble-edge/ui — UI component library built on shadcn/ui
// https://ui.shadcn.com
// =============================================================================
// Utility
// =============================================================================
export { cn } from "./lib/utils.js";
// =============================================================================
// shadcn/ui Components (from src/components/ui/)
// These components are pulled from shadcn/ui via CLI. Do not modify unless
// you're intentionally customizing them. Run `pnpm ui:diff` to check for updates.
// =============================================================================
// Alert Dialog
export { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, } from "./components/ui/alert-dialog.js";
// Avatar
export { Avatar, AvatarImage, AvatarFallback } from "./components/ui/avatar.js";
// Badge
export { Badge, badgeVariants } from "./components/ui/badge.js";
// Button
export { Button, buttonVariants } from "./components/ui/button.js";
// Card
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, } from "./components/ui/card.js";
// Checkbox
export { Checkbox } from "./components/ui/checkbox.js";
// Command (⌘K palette)
export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator, } from "./components/ui/command.js";
// Dialog
export { Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, } from "./components/ui/dialog.js";
// Dropdown Menu
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup, } from "./components/ui/dropdown-menu.js";
// Input
export { Input } from "./components/ui/input.js";
// Label
export { Label } from "./components/ui/label.js";
// Popover
export { Popover, PopoverTrigger, PopoverContent } from "./components/ui/popover.js";
// Radio Group
export { RadioGroup, RadioGroupItem } from "./components/ui/radio-group.js";
// Scroll Area
export { ScrollArea, ScrollBar } from "./components/ui/scroll-area.js";
// Select
export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton, } from "./components/ui/select.js";
// Separator
export { Separator } from "./components/ui/separator.js";
// Sheet (slide-over panel)
export { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription, } from "./components/ui/sheet.js";
// Skeleton (loading placeholder)
export { Skeleton } from "./components/ui/skeleton.js";
// Sonner (toast notifications with alert-style theming)
export { Toaster, toast } from "./components/ui/sonner.js";
// Alert (static alert boxes)
export { Alert, AlertTitle, AlertDescription } from "./components/ui/alert.js";
// Slider
export { Slider } from "./components/ui/slider.js";
// Color Picker (custom Ensemble component built from shadcn primitives)
export { ColorPicker } from "./components/ui/color-picker.js";
// Switch
export { Switch } from "./components/ui/switch.js";
// Table
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption, } from "./components/ui/table.js";
// Tabs
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs.js";
// Textarea
export { Textarea } from "./components/ui/textarea.js";
// Tooltip
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, } from "./components/ui/tooltip.js";
// Breadcrumb
export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis, } from "./components/ui/breadcrumb.js";
// Collapsible
export { Collapsible, CollapsibleTrigger, CollapsibleContent, } from "./components/ui/collapsible.js";
// Sidebar (full shadcn sidebar system)
export { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarInset, SidebarMenu, SidebarMenuAction, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger, useSidebar, } from "./components/ui/sidebar.js";
// Hooks
export { useIsMobile } from "./hooks/use-mobile.js";
// =============================================================================
// Ensemble Custom Components (from src/components/ensemble/)
// These are our own components. Modify freely.
// =============================================================================
// Stat Card - metric display with optional trend indicator
export { StatCard } from "./components/ensemble/stat-card.js";
// Page Header - consistent page titles with actions
export { PageHeader } from "./components/ensemble/page-header.js";
// EnsemblePage + EnsembleSection - the canonical page chrome.
// Both core apps and guest apps render through these primitives so a
// workspace settings change propagates everywhere automatically.
export { EnsemblePage, EnsembleSection, ViewportContext, ViewportContextProvider } from "./components/ensemble/page.js";
// Data Row - label/value pairs for details views
export { DataRow } from "./components/ensemble/data-row.js";
// Empty State - placeholder for empty lists/views
export { EmptyState } from "./components/ensemble/empty-state.js";
// Save Status - visible save-state indicator for forms/cards
export { SaveStatus, useSaveStatus } from "./components/ensemble/save-status.js";
// Wordmark - segmented or image-based workspace brand mark
export { Wordmark } from "./components/ensemble/wordmark.js";
// FontCombobox - typeahead picker for font families (system + Google Fonts)
export { FontCombobox } from "./components/ensemble/font-combobox.js";
// BrandCard - unified brand color display (palettes + neutral + gradients + semantic).
// Same component, two consumers: Brand Overview tab (display mode) and the
// /brand public guide (display mode) + Brand Colors editor tab (edit mode).
export { BrandCard } from "./components/brand/BrandCard.js";
// BrandTokenPicker - token-first picker (palette rungs + optional hex / auto / system).
// Used by theme binding editors and gradient stop editors where the operator
// should pick from the workspace's known tokens rather than a raw hex.
export { BrandTokenPicker } from "./components/brand/BrandTokenPicker.js";
// Future components:
// export { NavItem } from "./components/ensemble/nav-item";
// export { FilterBar } from "./components/ensemble/filter-bar";
// export { AppCard } from "./components/ensemble/app-card";
//# sourceMappingURL=index.js.map