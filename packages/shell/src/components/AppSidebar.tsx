/**
 * App Sidebar Component
 *
 * Main navigation sidebar using shadcn/ui Sidebar from @ensemble-edge/ui.
 * Displays workspace info, navigation sections, and user menu.
 */

import * as React from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import {
  Home,
  Users,
  Palette,
  Settings,
  ChevronUp,
  LogOut,
  Boxes,
  Grid3X3,
  Shield,
  ScrollText,
  BookOpen,
  PanelLeft,
  Languages,
  Check,
  type LucideIcon,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  Wordmark,
  toast,
} from '@ensemble-edge/ui';
import type { WordmarkSegment } from '@ensemble-edge/ui';

import {
  workspaceName,
  sections,
  currentPath,
  navigate,
  user,
  displayName,
  userInitials,
  logout,
  authedFetch,
} from '../state';

// Icon mapping for nav items
const iconMap: Record<string, LucideIcon> = {
  home: Home,
  users: Users,
  palette: Palette,
  settings: Settings,
  boxes: Boxes,
  'grid-3x3': Grid3X3,
  shield: Shield,
  'scroll-text': ScrollText,
  'book-open': BookOpen,
  'panel-left': PanelLeft,
};

export function AppSidebar() {
  useSignals();

  const name = workspaceName.value;
  const navSections = sections.value;
  const path = currentPath.value;
  const currentUser = user.value;
  const userName = displayName.value;
  const initials = userInitials.value;

  // Fetch the styled wordmark segments + raster wordmark image once on
  // mount. Worth keeping inline rather than threading a brand-state
  // signal through the whole shell — the sidebar is the only consumer
  // of this data outside the brand admin tabs, and changes are rare
  // enough that a reload-to-update is acceptable.
  const [brandSegments, setBrandSegments] = React.useState<WordmarkSegment[]>([]);
  const [brandWordmarkImage, setBrandWordmarkImage] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    authedFetch('/_ensemble/core/brand/tokens/identity')
      .then((r) => r.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
      .then((res) => {
        if (cancelled) return;
        for (const t of res.data ?? []) {
          if (t.key === 'wordmark_text' && t.value) {
            try {
              const parsed = JSON.parse(t.value) as WordmarkSegment[];
              if (Array.isArray(parsed)) setBrandSegments(parsed);
            } catch { /* noop */ }
          }
          if (t.key === 'logo_wordmark' && t.value) setBrandWordmarkImage(t.value);
        }
      })
      .catch(() => { /* fall back to plain name */ });
    return () => { cancelled = true; };
  }, []);

  const handleNavClick = (itemPath: string, e: React.MouseEvent) => {
    e.preventDefault();
    navigate(itemPath);
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Sidebar collapsible="icon">
      {/* Header with workspace name */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/" onClick={(e) => handleNavClick('/', e)}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  {/* Renders styled-text wordmark segments when configured,
                      raster wordmark image when set, or plain name fallback. */}
                  <Wordmark
                    segments={brandSegments}
                    imageUrl={brandWordmarkImage}
                    name={name}
                    imageHeight={20}
                    className="font-semibold"
                  />
                  <span className="text-xs text-muted-foreground">Workspace</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation sections */}
      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.id}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = iconMap[item.icon] || Home;
                  const isActive = path === item.path;

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <a
                          href={item.path}
                          onClick={(e) => handleNavClick(item.path, e)}
                        >
                          <Icon />
                          <span>{item.label}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer with user menu */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={currentUser?.avatarUrl}
                      alt={userName}
                    />
                    <AvatarFallback className="rounded-lg">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{userName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {currentUser?.email}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side="top"
                align="end"
                sideOffset={4}
              >
                <LanguageSubmenu />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

// ─── Language submenu ─────────────────────────────────────────────
//
// v0.1.40+: per-user preferred locale picker. Sits above Logout in
// the user dropdown. Pulls supported locales + current preference
// from the workspace-context endpoint; PUT to update; reloads the
// page on change so language-aware components pick up the new
// locale immediately (most i18n libraries don't reactively re-render
// without an explicit reload).
//
// Lives inside AppSidebar (not extracted to a separate file) because
// it's tightly coupled to the dropdown menu structure. If we ever
// add more user preferences (timezone, date format, etc.) this gets
// extracted to a UserPreferencesSubmenu component.

interface LocaleSlice {
  default: string;
  supported: string[];
  userPreferred: string | null;
}

function LanguageSubmenu() {
  const [locale, setLocale] = React.useState<LocaleSlice | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/_ensemble/workspace/context', { credentials: 'include' })
      .then((r) => r.ok ? r.json() as Promise<{ locale?: LocaleSlice }> : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data) => { if (!cancelled && data.locale) setLocale(data.locale); })
      .catch(() => { /* leave null — hide the submenu */ });
    return () => { cancelled = true; };
  }, []);

  // Hide the whole submenu when there's only one supported language —
  // showing a picker with a single option is bad UX.
  if (!locale || locale.supported.length <= 1) return null;

  const active = locale.userPreferred ?? locale.default;

  async function pick(code: string) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/_ensemble/workspace/preferences/locale', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ locale: code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { detail?: string };
        toast.error('Could not change language', { description: body.detail });
        return;
      }
      toast.success(`Language set to ${LANGUAGE_DISPLAY[code] ?? code}`);
      // Reload so language-aware components and translated brand
      // messaging re-render with the new preference.
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Languages className="mr-2 h-4 w-4" />
        Language
        <span className="ml-auto text-xs text-muted-foreground">
          {LANGUAGE_DISPLAY[active] ?? active}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          {locale.supported.map((code) => (
            <DropdownMenuItem
              key={code}
              onClick={() => pick(code)}
              disabled={saving || code === active}
            >
              <span className="flex-1">{LANGUAGE_DISPLAY[code] ?? code}</span>
              {code === active && <Check className="h-3.5 w-3.5 ml-2" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}

/**
 * BCP-47 code → human-readable display name. Covers the languages
 * we expect workspaces to ship with; falls back to the raw code
 * for anything not in the map. Add new entries as needed.
 */
const LANGUAGE_DISPLAY: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  sv: 'Svenska',
  ja: '日本語',
  ko: '한국어',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ar: 'العربية',
  he: 'עברית',
  ru: 'Русский',
  tr: 'Türkçe',
  hi: 'हिन्दी',
  vi: 'Tiếng Việt',
  th: 'ไทย',
};
