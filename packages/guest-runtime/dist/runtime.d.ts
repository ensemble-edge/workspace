/**
 * The Ensemble Guest Runtime.
 *
 * This file is bundled by esbuild into a single runtime.js that workspace
 * serves at /_ensemble/runtime/v1/runtime.js. Guest apps load this script
 * in their iframe; everything they need (React, workspace UI, layout
 * primitives, mount() helper) is then available on `window.Ensemble`.
 *
 * Guest workers ship ZERO of this code. They just emit JSX that compiles
 * to factory calls against `Ensemble.createElement`, and call
 * `Ensemble.mount(YourComponent)`.
 */
import * as React from "react";
import { EnsemblePage, EnsembleSection, PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Input, Label, Textarea, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption, TableFooter, Tabs, TabsList, TabsTrigger, TabsContent, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, Popover, PopoverTrigger, PopoverContent, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator, Checkbox, Switch, Badge, Separator, Alert, AlertTitle, AlertDescription, Skeleton, Avatar, AvatarImage, AvatarFallback, EmptyState, StatCard, DataRow, SaveStatus, useSaveStatus, cn } from "@ensemble-edge/ui";
/**
 * The runtime API surface — what's available on `window.Ensemble`.
 * This is the v1 CONTRACT. New components can be added; existing
 * components cannot be removed or have their props changed without
 * cutting v2.
 */
export interface EnsembleRuntime {
    /** Runtime version. Lets guest apps assert compatibility if they want. */
    version: 1;
    /** Mount a guest app into the iframe's #root element. */
    mount: (component: React.ComponentType) => void;
    React: typeof React;
    createElement: typeof React.createElement;
    Fragment: typeof React.Fragment;
    useState: typeof React.useState;
    useEffect: typeof React.useEffect;
    useMemo: typeof React.useMemo;
    useCallback: typeof React.useCallback;
    useRef: typeof React.useRef;
    useContext: typeof React.useContext;
    useReducer: typeof React.useReducer;
    cn: typeof cn;
    Page: typeof EnsemblePage;
    Section: typeof EnsembleSection;
    PageHeader: typeof PageHeader;
    Card: typeof Card;
    CardHeader: typeof CardHeader;
    CardTitle: typeof CardTitle;
    CardDescription: typeof CardDescription;
    CardContent: typeof CardContent;
    CardFooter: typeof CardFooter;
    Button: typeof Button;
    Input: typeof Input;
    Label: typeof Label;
    Textarea: typeof Textarea;
    Table: typeof Table;
    TableHeader: typeof TableHeader;
    TableBody: typeof TableBody;
    TableRow: typeof TableRow;
    TableHead: typeof TableHead;
    TableCell: typeof TableCell;
    TableCaption: typeof TableCaption;
    TableFooter: typeof TableFooter;
    Tabs: typeof Tabs;
    TabsList: typeof TabsList;
    TabsTrigger: typeof TabsTrigger;
    TabsContent: typeof TabsContent;
    Dialog: typeof Dialog;
    DialogTrigger: typeof DialogTrigger;
    DialogContent: typeof DialogContent;
    DialogHeader: typeof DialogHeader;
    DialogTitle: typeof DialogTitle;
    DialogDescription: typeof DialogDescription;
    DialogFooter: typeof DialogFooter;
    DialogClose: typeof DialogClose;
    DropdownMenu: typeof DropdownMenu;
    DropdownMenuTrigger: typeof DropdownMenuTrigger;
    DropdownMenuContent: typeof DropdownMenuContent;
    DropdownMenuItem: typeof DropdownMenuItem;
    DropdownMenuSeparator: typeof DropdownMenuSeparator;
    DropdownMenuLabel: typeof DropdownMenuLabel;
    Popover: typeof Popover;
    PopoverTrigger: typeof PopoverTrigger;
    PopoverContent: typeof PopoverContent;
    Tooltip: typeof Tooltip;
    TooltipTrigger: typeof TooltipTrigger;
    TooltipContent: typeof TooltipContent;
    TooltipProvider: typeof TooltipProvider;
    Select: typeof Select;
    SelectTrigger: typeof SelectTrigger;
    SelectValue: typeof SelectValue;
    SelectContent: typeof SelectContent;
    SelectItem: typeof SelectItem;
    SelectGroup: typeof SelectGroup;
    SelectLabel: typeof SelectLabel;
    SelectSeparator: typeof SelectSeparator;
    Checkbox: typeof Checkbox;
    Switch: typeof Switch;
    Badge: typeof Badge;
    Separator: typeof Separator;
    Alert: typeof Alert;
    AlertTitle: typeof AlertTitle;
    AlertDescription: typeof AlertDescription;
    Skeleton: typeof Skeleton;
    Avatar: typeof Avatar;
    AvatarImage: typeof AvatarImage;
    AvatarFallback: typeof AvatarFallback;
    EmptyState: typeof EmptyState;
    StatCard: typeof StatCard;
    DataRow: typeof DataRow;
    SaveStatus: typeof SaveStatus;
    useSaveStatus: typeof useSaveStatus;
    /**
     * useAI({ tier }) — call the workspace's AI Gateway through a named tier.
     *
     * Tier names map 1:1 to dynamic gateway routes the workspace admin
     * configured under Settings → Auth & Security → Credentials. Default
     * tiers are 'smart' | 'good' | 'simple'; admins may add more.
     *
     * If the requested tier doesn't exist, the workspace falls back to the
     * default tier and returns the response with header
     * `X-Ensemble-Tier-Fallback: <real-tier-used>`; the hook surfaces this
     * as `fallback`.
     */
    useAI: typeof useAI;
    /**
     * toast — show a toast notification in the workspace shell (v0.1.86).
     *
     * The iframe doesn't render the toast itself; it postMessages the host
     * shell, which renders the toast in its own toaster (bottom-right of
     * the workspace, same as core-app toasts). This means toasts stay
     * visible even after the user navigates away from the iframe page.
     *
     * Functions (e.g. action.onClick) don't cross frames, so the bridge
     * accepts kind/message/description/duration only. For action buttons,
     * use a component-tier guest (your component runs in the host React
     * tree and calls the host toast() directly).
     */
    toast: typeof toast;
    /**
     * useSecret({ key, scope }) — read/write encrypted per-app secrets that
     * the workspace stores on the guest's behalf (v0.1.85).
     *
     * The workspace owns the encryption key; the guest never sees it. The
     * iframe-tier version auto-derives the guest's appId from the iframe's
     * URL (since iframes are served under /_ensemble/apps/<appId>/), so
     * the call site is just `useSecret({ key })`.
     *
     * Scopes:
     *   • 'app' (default) — shared, admin-write, member-read
     *   • 'user' — private to the authenticated user; admins cannot read
     *
     * Guest apps are NOT required to use this. They can keep secrets in
     * their own worker storage if they want. But using it means no key
     * management on their side.
     */
    useSecret: typeof useSecret;
    /**
     * useLocales() — read the workspace's configured content locales.
     *
     * Operators declare which BCP-47 locales the workspace supports under
     * Brand → Languages. Guest apps that render localized content should
     * use this hook to discover what's enabled and which is the default.
     *
     * The hook fetches once per mount and caches via module-level state
     * so multiple components don't make redundant requests. Updates
     * require a remount (locale changes are rare).
     */
    useLocales: typeof useLocales;
    /**
     * useWorkspaceEvent — subscribe to workspace mutation events.
     *
     * Operators change things in the workspace shell (add a language,
     * promote a default locale, update brand tokens). Guest apps that
     * render against that state should refetch or react when it changes,
     * not stay stale until the user manually reloads.
     *
     * Event types in v0.1.17:
     *   'locale.added' | 'locale.removed' | 'locale.default-changed'
     *   'brand.tokens.changed' | 'user.role.changed' | 'workspace.settings.changed'
     *
     * Iframe-tier guests receive events via postMessage from the host.
     * Component-tier guests share the host's in-memory bus. Same shape
     * either way — guest code doesn't need to know the tier.
     */
    useWorkspaceEvent: typeof useWorkspaceEvent;
    /**
     * useFonts() — read the workspace's active typography.
     *
     * Returns the five resolved typographic roles (display, heading,
     * body, mono, wordmark) with family + weight + style + CSS stack.
     * Guest apps can render their own typography against the workspace
     * scheme by applying `roles.heading.stack` etc., or by referencing
     * the published CSS variables `var(--font-heading)` etc.
     */
    useFonts: typeof useFonts;
}
export interface FontRoleResolved {
    family: string;
    weight: string;
    style: 'normal' | 'italic';
    isSystem: boolean;
    /** Pre-computed CSS font-family stack (with quoting + fallbacks). */
    stack: string;
}
export interface UseFontsResult {
    roles: Record<'display' | 'heading' | 'body' | 'mono' | 'wordmark', FontRoleResolved> | null;
    loading: boolean;
    error: string | null;
}
export type WorkspaceEventType = 'locale.added' | 'locale.removed' | 'locale.default-changed' | 'brand.tokens.changed' | 'user.role.changed' | 'workspace.settings.changed';
export interface WorkspaceEvent {
    type: WorkspaceEventType;
    ts: number;
    data?: Record<string, unknown>;
}
export interface WorkspaceLocale {
    code: string;
    display_name: string;
    is_default: boolean;
    enabled: boolean;
}
export interface UseLocalesResult {
    locales: WorkspaceLocale[];
    /** BCP-47 code of the default locale (or 'en' before load completes). */
    defaultLocale: string;
    /** Enabled locale codes, with default-first ordering. */
    enabledCodes: string[];
    loading: boolean;
    error: string | null;
}
export type SecretScope = 'app' | 'user';
export interface UseSecretOptions {
    /** Secret name within the (app, scope) namespace. */
    key: string;
    /** 'app' (default) for shared, 'user' for per-user. */
    scope?: SecretScope;
}
export interface UseSecretResult {
    /** Fetch and decrypt the current value. Null if unset. */
    get: () => Promise<string | null>;
    /** Encrypt + store. Throws on auth/permission failure. */
    set: (value: string) => Promise<void>;
    /** Remove. Returns true if a row was deleted, false if none existed. */
    remove: () => Promise<boolean>;
    /** True while the most recent call is in flight. */
    loading: boolean;
    /** Set on the most recent failure; cleared on next call start. */
    error: string | null;
}
export interface UseAIResult {
    /** Send a chat-completion body (provider-shaped) and return the response. */
    call: (body: unknown) => Promise<{
        response: Response;
        data: unknown;
        /** v0.1.83: convenience accessor — extracted reply text from common
         *  provider shapes (OpenAI chat completion, Anthropic messages,
         *  Workers AI generate). Empty string if no recognizable shape. */
        text: string;
        fallback: string | null;
    }>;
    loading: boolean;
    error: string | null;
    /** If the workspace fell back from the requested tier, name of the tier used. */
    fallback: string | null;
}
/**
 * Toast bridge — postMessage to the workspace shell so it renders the
 * toast in its own toaster. Plain message envelope (functions can't
 * cross the postMessage boundary), so `action` callbacks aren't
 * supported on this surface — use a component-tier guest for that.
 */
export type ToastKind = 'success' | 'error' | 'warning' | 'info';
export interface ToastBridgeOptions {
    description?: string;
    /** ms, default 5000. 0 = persistent until dismissed by the user. */
    duration?: number;
}
interface ToastApi {
    (kind: ToastKind, message: string, options?: ToastBridgeOptions): void;
    success: (message: string, options?: ToastBridgeOptions) => void;
    error: (message: string, options?: ToastBridgeOptions) => void;
    warning: (message: string, options?: ToastBridgeOptions) => void;
    info: (message: string, options?: ToastBridgeOptions) => void;
}
declare const toast: ToastApi;
declare function useSecret({ key, scope }: UseSecretOptions): UseSecretResult;
declare function useAI({ tier }: {
    tier: string;
}): UseAIResult;
declare function useLocales(): UseLocalesResult;
declare function useWorkspaceEvent(type: WorkspaceEventType | WorkspaceEventType[], handler: (event: WorkspaceEvent) => void): void;
declare function useFonts(): UseFontsResult;
declare const runtime: EnsembleRuntime;
declare global {
    interface Window {
        Ensemble: EnsembleRuntime;
    }
}
export { runtime };
export default runtime;
//# sourceMappingURL=runtime.d.ts.map