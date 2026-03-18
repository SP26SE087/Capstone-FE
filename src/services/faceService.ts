import api from './api';

export const faceService = {
    startAddUser: async (userId: string) => {
        const response = await api.post('/start_add_user', { user_id: userId });
        return response.data;
    },
    stopAddUser: async () => {
        const response = await api.post('/stop_add_user');
        return response.data;
    },
    removeUser: async (userId: string) => {
        const response = await api.post('/remove_user', { user_id: userId });
        return response.data;
    },
    banUser: async (userId: string) => {
        const response = await api.post('/ban_user', { user_id: userId });
        return response.data;
    },
    unbanUser: async (userId: string) => {
        const response = await api.post('/unban_user', { user_id: userId });
        return response.data;
    }
};
