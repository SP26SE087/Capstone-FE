import api from './api';

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
