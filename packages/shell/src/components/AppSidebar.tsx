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
} from '@ensemble-edge/ui';

import {
  workspaceName,
  sections,
  currentPath,
  navigate,
  user,
  displayName,
  userInitials,
  logout,
} from '../state';

// Icon mapping for nav items
const iconMap: Record<string, LucideIcon> = {
  home: Home,
  users: Users,
  palette: Palette,
  settings: Settings,
  boxes: Boxes,
};

export function AppSidebar() {
  useSignals();

  const name = workspaceName.value;
  const navSections = sections.value;
  const path = currentPath.value;
  const currentUser = user.value;
  const userName = displayName.value;
  const initials = userInitials.value;

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
                  <span className="font-semibold">{name}</span>
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
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
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
