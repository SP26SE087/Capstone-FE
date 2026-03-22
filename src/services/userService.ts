import api from './api';

export const userService = {
    getAll: async (): Promise<any[]> => {
        try {
            const response = await api.get('/api/users');
            return response.data.data || response.data;
        } catch (error) {
            console.error('Error fetching all users:', error);
            throw error;
        }
    },
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
export interface AddUserRequest {
    email: string;
    fullName: string;
    role: number;
}

export interface UserResponse {
    userId: string;
    email: string;
    fullName: string;
    role: number;
    status: number;
    createdAt: string;
    updatedAt: string;
}

export const userService = {
    async addUser(data: AddUserRequest): Promise<UserResponse> {
        const response = await api.post('/api/users', data);
        return response.data.data || response.data;
    },
};
