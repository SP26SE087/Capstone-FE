import api from './api';

export interface AddUserRequest {
    email: string;
    fullName: string;
    role: number;
}

export interface UpdateUserRequest {
    fullName?: string;
    role?: number;
    isActive?: boolean;
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
    getAll: async (): Promise<any[]> => {
        try {
            const response = await api.get('/api/users');
            return response.data.data || response.data;
        } catch (error) {
            console.error('Lỗi khi tải danh sách người dùng:', error);
            throw error;
        }
    },

    getByEmail: async (email: string): Promise<any> => {
        try {
            const response = await api.get(`/api/users/email/${email}`);
            return response.data.data || response.data;
        } catch (error) {
            console.error(`Lỗi khi tìm người dùng theo email ${email}:`, error);
            throw error;
        }
    },

    getById: async (userId: string): Promise<any> => {
        try {
            const response = await api.get(`/api/users/${userId}`);
            return response.data.data || response.data;
        } catch (error) {
            console.error(`Lỗi khi tìm người dùng ${userId}:`, error);
            throw error;
        }
    },

    addUser: async (data: AddUserRequest): Promise<UserResponse> => {
        const response = await api.post('/api/users', data);
        return response.data.data || response.data;
    },

    deleteUser: async (userId: string): Promise<void> => {
        await api.delete(`/api/users/${userId}`);
    },

    updateUser: async (userId: string, data: UpdateUserRequest): Promise<UserResponse> => {
        const response = await api.put(`/api/users/${userId}`, data);
        return response.data.data || response.data;
    },
};