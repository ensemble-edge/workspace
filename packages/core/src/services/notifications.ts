// Notifications service for user alerts

export interface Notification {
  id: string;
  title: string;
  body?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  read: boolean;
}

export function createNotificationsService() {
  return {
    send: async (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
      // TODO: Send notification
    },
    list: async (): Promise<Notification[]> => {
      // TODO: List notifications
      return [];
    },
    markRead: async (id: string) => {
      // TODO: Mark notification as read
    },
  };
}
