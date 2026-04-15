// @ensemble-edge/ui — UI component library built on shadcn/ui
// https://ui.shadcn.com

// =============================================================================
// Utility
// =============================================================================
export { cn } from "./lib/utils";

// =============================================================================
// shadcn/ui Components (from src/components/ui/)
// These components are pulled from shadcn/ui via CLI. Do not modify unless
// you're intentionally customizing them. Run `pnpm ui:diff` to check for updates.
// =============================================================================

// Alert Dialog
export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./components/ui/alert-dialog";

// Avatar
export { Avatar, AvatarImage, AvatarFallback } from "./components/ui/avatar";

// Badge
export { Badge, badgeVariants } from "./components/ui/badge";

// Button
export { Button, buttonVariants } from "./components/ui/button";
export type { ButtonProps } from "./components/ui/button";

// Card
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/ui/card";

// Checkbox
export { Checkbox } from "./components/ui/checkbox";

// Command (⌘K palette)
export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "./components/ui/command";

// Dialog
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";

// Dropdown Menu
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./components/ui/dropdown-menu";

// Input
export { Input } from "./components/ui/input";

// Label
export { Label } from "./components/ui/label";

// Popover
export { Popover, PopoverTrigger, PopoverContent } from "./components/ui/popover";

// Radio Group
export { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";

// Scroll Area
export { ScrollArea, ScrollBar } from "./components/ui/scroll-area";

// Select
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/ui/select";

// Separator
export { Separator } from "./components/ui/separator";

// Sheet (slide-over panel)
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./components/ui/sheet";

// Skeleton (loading placeholder)
export { Skeleton } from "./components/ui/skeleton";

// Sonner (toast notifications with alert-style theming)
export { Toaster, toast } from "./components/ui/sonner";

// Alert (static alert boxes)
export { Alert, AlertTitle, AlertDescription } from "./components/ui/alert";

// Slider
export { Slider } from "./components/ui/slider";

// Color Picker (custom Ensemble component built from shadcn primitives)
export { ColorPicker } from "./components/ui/color-picker";
export type { ColorPickerProps, ColorPreset } from "./components/ui/color-picker";

// Switch
export { Switch } from "./components/ui/switch";

// Table
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./components/ui/table";

// Tabs
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";

// Textarea
export { Textarea } from "./components/ui/textarea";

// Tooltip
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./components/ui/tooltip";

// Breadcrumb
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "./components/ui/breadcrumb";

// Collapsible
export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./components/ui/collapsible";

// Sidebar (full shadcn sidebar system)
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "./components/ui/sidebar";

// Hooks
export { useIsMobile } from "./hooks/use-mobile";

// =============================================================================
// Ensemble Custom Components (from src/components/ensemble/)
// These are our own components. Modify freely.
// =============================================================================

// Stat Card - metric display with optional trend indicator
export { StatCard } from "./components/ensemble/stat-card";
export type { StatCardProps } from "./components/ensemble/stat-card";

// Page Header - consistent page titles with actions
export { PageHeader } from "./components/ensemble/page-header";
export type { PageHeaderProps } from "./components/ensemble/page-header";

// Data Row - label/value pairs for details views
export { DataRow } from "./components/ensemble/data-row";
export type { DataRowProps } from "./components/ensemble/data-row";

// Empty State - placeholder for empty lists/views
export { EmptyState } from "./components/ensemble/empty-state";
export type { EmptyStateProps } from "./components/ensemble/empty-state";

// Future components:
// export { NavItem } from "./components/ensemble/nav-item";
// export { FilterBar } from "./components/ensemble/filter-bar";
// export { AppCard } from "./components/ensemble/app-card";
