/**
 * Notifications Domain
 *
 * User notification system.
 */
export interface Notification {
    id: string;
    title: string;
    body?: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: number;
    read: boolean;
}
export declare function createNotificationsService(): {
    send: (_notification: Omit<Notification, "id" | "timestamp" | "read">) => Promise<void>;
    list: () => Promise<Notification[]>;
    markRead: (_id: string) => Promise<void>;
};
//# sourceMappingURL=index.d.ts.map