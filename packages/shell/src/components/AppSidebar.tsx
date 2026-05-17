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
  Wordmark,
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
