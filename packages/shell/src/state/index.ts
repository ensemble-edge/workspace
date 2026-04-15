/**
 * Shell State Exports
 *
 * All Preact Signals for shell state management.
 */

// Workspace state
export {
  workspace,
  workspaces,
  workspaceLoading,
  workspaceError,
  workspaceSlug,
  workspaceName,
  workspaceSettings,
  fetchWorkspace,
  switchWorkspace,
} from './workspace';

// User/auth state
export {
  user,
  membership,
  authLoading,
  authError,
  isAuthenticated,
  userRole,
  isAdmin,
  isOwner,
  displayName,
  userInitials,
  fetchUser,
  login,
  logout,
  register,
} from './user';

// Theme state
export {
  theme,
  themeLoading,
  themeError,
  darkMode,
  accentColor,
  initDarkMode,
  toggleDarkMode,
  fetchTheme,
  applyTheme,
} from './theme';

// Navigation state
export {
  navConfig,
  navLoading,
  currentPath,
  aiPanelOpen,
  aiPanelPinned,
  sidebarCollapsed,
  commandPaletteOpen,
  sections,
  activeItem,
  breadcrumb,
  fetchNav,
  navigate,
  toggleAIPanel,
  toggleAIPanelPinned,
  setAIPanelPinned,
  toggleSidebar,
  openCommandPalette,
  closeCommandPalette,
  initNavigation,
} from './nav';

// Toast notifications
export {
  toast,
  toasts,
  pauseAutoDismiss,
  resumeAutoDismiss,
  dismissToast,
  dismissAllToasts,
  dismissMostRecent,
} from './toasts';
export type { Toast, ToastOptions, PartialToastOptions } from './toasts';

// Overlay state (drawers, modals, dialogs)
export {
  overlayStack,
  closingOverlays,
  activeDrawer,
  activeModal,
  activeDialog,
  hasOpenOverlay,
  topmostOverlay,
  isDrawerOpen,
  hasBlockingOverlay,
  openDrawer,
  openModal,
  openDialog,
  closeOverlay,
  closeTopOverlay,
  closeAllOverlays,
  closeOverlaysByType,
  confirm,
  alert,
  initOverlayKeyboard,
  useOverlay,
} from './overlay';
export type {
  OverlayDisplay,
  OverlayConfig,
  DrawerConfig,
  ModalConfig,
  DialogConfig,
  ConfirmOptions,
  AlertOptions,
  OverlayAPI,
} from './overlay';
