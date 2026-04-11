import api from './api';

export interface Notification {
    id: string;
    type?: number;
    title: string;
    message: string;
    isRead: boolean;
    createdAtUtc: string;
    readAtUtc?: string | null;
    referenceId?: string;
    referenceType?: string;
}

export interface NotificationListResponse {
    items: Notification[];
    totalCount: number;
    pageIndex: number;
    pageSize: number;
}

export const notificationService = {
    getNotifications: async (pageIndex = 0, pageSize = 20): Promise<NotificationListResponse> => {
        const response = await api.get('/api/notifications', {
            params: { pageIndex, pageSize },
        });
        const data = response.data.data || response.data;
        return {
            items: data.items || data,
            totalCount: data.totalCount ?? (data.items?.length ?? 0),
            pageIndex: data.pageIndex ?? pageIndex,
            pageSize: data.pageSize ?? pageSize,
        };
    },

    getUnreadCount: async (): Promise<number> => {
        const response = await api.get('/api/notifications/unread-count');
        const data = response.data.data ?? response.data;
        return typeof data === 'number' ? data : (data.count ?? data.unreadCount ?? 0);
    },

    markAsRead: async (id: string): Promise<void> => {
        await api.patch(`/api/notifications/${id}/read`);
    },

    markAllAsRead: async (): Promise<void> => {
        await api.patch('/api/notifications/read-all');
    },

    deleteNotification: async (id: string): Promise<void> => {
        await api.delete(`/api/notifications/${id}`);
    },

    deleteAllNotifications: async (): Promise<void> => {
        await api.delete('/api/notifications');
    },
};
