// Hook to access workspace context

export interface WorkspaceContext {
  name: string;
  slug: string;
}

export function useWorkspace(): WorkspaceContext {
  // TODO: Implement workspace context hook
  return {
    name: '',
    slug: '',
  };
}
