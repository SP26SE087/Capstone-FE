import api from './api';

export const userService = {
    getByEmail: async (email: string): Promise<any> => {
        try {
            const response = await api.get(`/api/users/email/${email}`);
            // The response might be wrapped in { success: true, data: { ... } }
            return response.data.data || response.data;
        } catch (error) {
            console.error(`Error fetching user by email ${email}:`, error);
            throw error;
        }
    },
    getById: async (userId: string): Promise<any> => {
        try {
            const response = await api.get(`/api/users/${userId}`);
            return response.data.data || response.data;
        } catch (error) {
            console.error(`Error fetching user ${userId}:`, error);
            throw error;
        }
    }
};
