// Type definitions for guest apps

export interface GuestAppManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  permissions: string[];
  entry: string;
}

export interface GuestAppConfig {
  manifest: GuestAppManifest;
  onInit?: () => void | Promise<void>;
  onActivate?: () => void | Promise<void>;
  onDeactivate?: () => void | Promise<void>;
}

export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  userEmail: string;
}

export interface ThemeContext {
  primaryColor: string;
  mode: 'light' | 'dark';
}
