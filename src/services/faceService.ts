import axios from 'axios';

const FACE_SERVER_URL = (import.meta.env.VITE_FACE_SERVER_URL as string || 'http://localhost:5000').replace(/\/$/, '');

const faceApi = axios.create({
    baseURL: FACE_SERVER_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
});

export const faceService = {
    startAddUser: async (userId: string) => {
        const response = await faceApi.post('/start_add_user', { user_id: userId });
        return response.data;
    },
    stopAddUser: async () => {
        const response = await faceApi.post('/stop_add_user');
        return response.data;
    },
    removeUser: async (userId: string) => {
        const response = await faceApi.post('/remove_user', { user_id: userId });
        return response.data;
    },
    banUser: async (userId: string) => {
        const response = await faceApi.post('/ban_user', { user_id: userId });
        return response.data;
    },
    unbanUser: async (userId: string) => {
        const response = await faceApi.post('/unban_user', { user_id: userId });
        return response.data;
    }
};
