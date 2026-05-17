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
import { createRoot } from "react-dom/client";

// Pull in workspace UI components. esbuild bundles them all into the runtime.
import {
  // Layout primitives — the canonical page chrome
  EnsemblePage,
  EnsembleSection,
  PageHeader,
  // Most-commonly-used shadcn components
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button,
  Input,
  Label,
  Textarea,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption, TableFooter,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
  Popover, PopoverTrigger, PopoverContent,
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator,
  Checkbox,
  Switch,
  Badge,
  Separator,
  Alert, AlertTitle, AlertDescription,
  Skeleton,
  Avatar, AvatarImage, AvatarFallback,
  EmptyState,
  StatCard,
  DataRow,
  SaveStatus,
  useSaveStatus,
  // Utility
  cn,
} from "@ensemble-edge/ui";

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

  // React essentials (so guest's compiled JSX can reference them)
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

  // Utility
  cn: typeof cn;

  // Layout primitives
  Page: typeof EnsemblePage;
  Section: typeof EnsembleSection;
  PageHeader: typeof PageHeader;

  // shadcn components
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

export type WorkspaceEventType =
  | 'locale.added'
  | 'locale.removed'
  | 'locale.default-changed'
  | 'brand.tokens.changed'
  | 'user.role.changed'
  | 'workspace.settings.changed';

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

export interface UseAIResult {
  /** Send a chat-completion body (provider-shaped) and return the response. */
  call: (body: unknown) => Promise<{
    response: Response;
    data: unknown;
    fallback: string | null;
  }>;
  loading: boolean;
  error: string | null;
  /** If the workspace fell back from the requested tier, name of the tier used. */
  fallback: string | null;
}

function useAI({ tier }: { tier: string }): UseAIResult {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fallback, setFallback] = React.useState<string | null>(null);

  const call = React.useCallback(
    async (body: unknown) => {
      setLoading(true);
      setError(null);
      setFallback(null);
      try {
        const response = await fetch(`/_ensemble/ai/call/${encodeURIComponent(tier)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const fb = response.headers.get('X-Ensemble-Tier-Fallback');
        if (fb) setFallback(fb);
        let data: unknown = null;
        try {
          data = await response.clone().json();
        } catch {
          data = await response.clone().text();
        }
        if (!response.ok) {
          const msg =
            typeof data === 'object' && data && 'error' in data
              ? String((data as { error: unknown }).error)
              : `AI call failed: ${response.status}`;
          setError(msg);
        }
        return { response, data, fallback: fb };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'AI call failed';
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [tier],
  );

  return { call, loading, error, fallback };
}

// Module-level cache for useLocales — avoid N requests for N components.
let _localesCache: WorkspaceLocale[] | null = null;
let _localesPromise: Promise<WorkspaceLocale[]> | null = null;

async function fetchLocalesOnce(): Promise<WorkspaceLocale[]> {
  if (_localesCache) return _localesCache;
  if (_localesPromise) return _localesPromise;
  _localesPromise = (async () => {
    const r = await fetch('/_ensemble/locales', { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = (await r.json()) as { locales: WorkspaceLocale[] };
    _localesCache = body.locales ?? [];
    return _localesCache;
  })();
  try {
    return await _localesPromise;
  } finally {
    _localesPromise = null;
  }
}

function useLocales(): UseLocalesResult {
  const [locales, setLocales] = React.useState<WorkspaceLocale[]>(_localesCache ?? []);
  const [loading, setLoading] = React.useState(!_localesCache);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchLocalesOnce()
      .then((data) => {
        if (!cancelled) {
          setLocales(data);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const defaultLocale = locales.find((l) => l.is_default)?.code ?? 'en';
  const enabledCodes = [...locales]
    .filter((l) => l.enabled)
    .sort((a, b) => (a.is_default && !b.is_default ? -1 : !a.is_default && b.is_default ? 1 : 0))
    .map((l) => l.code);

  return { locales, defaultLocale, enabledCodes, loading, error };
}

/**
 * Iframe-tier listeners. The host postMessages events to this window
 * after we subscribe via `ensemble:subscribe-events`. The guest-runtime
 * keeps a single global listener and fans events out to React hooks.
 */
const eventListeners = new Set<(event: WorkspaceEvent) => void>();
let _subscribedToHost = false;

function ensureSubscribedToHost() {
  if (_subscribedToHost) return;
  _subscribedToHost = true;

  // Tell the host this iframe wants events. AppViewPage's onMessage
  // catches `ensemble:subscribe-events` and registers our window.
  try {
    window.parent.postMessage({ type: 'ensemble:subscribe-events', v: 1 }, '*');
  } catch {
    /* same-origin same window — no parent */
  }

  // Listen for incoming events from the host.
  window.addEventListener('message', (event) => {
    const msg = event.data as {
      type?: string;
      v?: number;
      event?: WorkspaceEvent;
    };
    if (!msg || msg.type !== 'ensemble:event' || msg.v !== 1 || !msg.event) return;
    for (const fn of eventListeners) {
      try { fn(msg.event); } catch (e) { console.error('[ensemble-events] listener threw:', e); }
    }
  });
}

function useWorkspaceEvent(
  type: WorkspaceEventType | WorkspaceEventType[],
  handler: (event: WorkspaceEvent) => void,
) {
  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;

  React.useEffect(() => {
    ensureSubscribedToHost();
    const types = Array.isArray(type) ? type : [type];
    const listener = (event: WorkspaceEvent) => {
      if (types.includes(event.type)) {
        handlerRef.current(event);
      }
    };
    eventListeners.add(listener);
    return () => {
      eventListeners.delete(listener);
    };
  }, [Array.isArray(type) ? type.join(',') : type]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Module-level cache for useFonts.
let _fontsCache: UseFontsResult['roles'] | null = null;
let _fontsPromise: Promise<UseFontsResult['roles']> | null = null;

async function fetchFontsOnce(): Promise<UseFontsResult['roles']> {
  if (_fontsCache) return _fontsCache;
  if (_fontsPromise) return _fontsPromise;
  _fontsPromise = (async () => {
    const r = await fetch('/_ensemble/core/brand/fonts/active', { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = (await r.json()) as { roles: UseFontsResult['roles'] };
    _fontsCache = body.roles ?? null;
    return _fontsCache;
  })();
  try {
    return await _fontsPromise;
  } finally {
    _fontsPromise = null;
  }
}

function useFonts(): UseFontsResult {
  const [roles, setRoles] = React.useState<UseFontsResult['roles']>(_fontsCache);
  const [loading, setLoading] = React.useState(!_fontsCache);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchFontsOnce()
      .then((data) => {
        if (!cancelled) { setRoles(data); setLoading(false); }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Invalidate the cache on brand.tokens.changed so guests reactively
  // pick up new fonts. Inside the iframe runtime we already have
  // useWorkspaceEvent — but we can't call it from here (would create a
  // hook-call cycle). Instead, register at module load.

  return { roles, loading, error };
}

// Invalidate the module-level fonts cache when brand tokens change.
// This runs once on module load — independent of any React hook.
(function registerFontsInvalidator() {
  if (typeof window === 'undefined') return;
  window.addEventListener('message', (event) => {
    const msg = event.data as { type?: string; v?: number; event?: { type?: string } };
    if (msg?.type === 'ensemble:event' && msg?.event?.type === 'brand.tokens.changed') {
      _fontsCache = null;
    }
  });
})();

function mount(Component: React.ComponentType): void {
  const container = document.getElementById("root");
  if (!container) {
    console.error("[ensemble-runtime] No #root element found");
    return;
  }

  // Listen for the host's CSS variable snapshot and apply to this iframe's
  // :root. The host sends it once on ensemble:ready (which we emit below).
  // After this, var(--*) references inside the iframe resolve to the host's
  // values — padding, fonts, radius, colors all match identically.
  window.addEventListener("message", (event) => {
    const msg = event.data as { type?: string; v?: number; payload?: Record<string, string> };
    if (!msg || msg.type !== "ensemble:cssVars" || msg.v !== 1) return;
    const root = document.documentElement;
    for (const [name, value] of Object.entries(msg.payload || {})) {
      if (typeof name === "string" && name.startsWith("--")) {
        root.style.setProperty(name, value);
      }
    }
  });

  // Tell the host we're ready so it pushes context + cssVars.
  try { window.parent.postMessage({ type: "ensemble:ready", v: 1 }, "*"); } catch { /* same-origin same window */ }

  const root = createRoot(container);
  root.render(<Component />);
}

const runtime: EnsembleRuntime = {
  version: 1,
  mount,

  React,
  createElement: React.createElement,
  Fragment: React.Fragment,
  useState: React.useState,
  useEffect: React.useEffect,
  useMemo: React.useMemo,
  useCallback: React.useCallback,
  useRef: React.useRef,
  useContext: React.useContext,
  useReducer: React.useReducer,

  cn,

  Page: EnsemblePage,
  Section: EnsembleSection,
  PageHeader,

  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Input, Label, Textarea,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption, TableFooter,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
  Popover, PopoverTrigger, PopoverContent,
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator,
  Checkbox, Switch, Badge, Separator,
  Alert, AlertTitle, AlertDescription,
  Skeleton,
  Avatar, AvatarImage, AvatarFallback,
  EmptyState, StatCard, DataRow,
  SaveStatus, useSaveStatus,

  useLocales,
  useWorkspaceEvent,
  useFonts,

  useAI,
};

// Attach to window so the guest's HTML shell can find it.
declare global {
  interface Window { Ensemble: EnsembleRuntime; }
}
window.Ensemble = runtime;

// Also export for ESM consumers (e.g., the guest's jsx-runtime shim).
export { runtime };
export default runtime;
