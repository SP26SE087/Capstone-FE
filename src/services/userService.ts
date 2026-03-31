import api from './api';

export interface AddUserRequest {
    email: string;
    fullName: string;
    role: number;
    phoneNumber?: string;
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

export interface ProfileResponse {
    email: string;
    fullName: string;
    role: number;
    createdAt: string;
    avatarUrl?: string;
    phoneNumber?: string;
    orcid?: string;
    googleScholarUrl?: string;
    githubUrl?: string;
}

export interface UpdateProfileRequest {
    fullName?: string;
    phoneNumber?: string;
    orcid?: string;
    googleScholarUrl?: string;
    githubUrl?: string;
}

export const userService = {
    getAll: async (): Promise<any[]> => {
        try {
            const response = await api.get('/api/users');
            return response.data.data || response.data;
        } catch (error) {
            console.error('Error loading user list:', error);
            throw error;
        }
    },

    getByEmail: async (email: string): Promise<any> => {
        try {
            const response = await api.get(`/api/users/email/${email}`);
            return response.data.data || response.data;
        } catch (error) {
            console.error(`Error finding user by email ${email}:`, error);
            throw error;
        }
    },

    getById: async (userId: string): Promise<any> => {
        try {
            const response = await api.get(`/api/users/${userId}`);
            return response.data.data || response.data;
        } catch (error) {
            console.error(`Error finding user ${userId}:`, error);
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

    exchangeGoogleToken: async (userId: string, code: string, redirectUri: string): Promise<any> => {
        const response = await api.post(`/api/users/${userId}/google-token/exchange`, {
            code,
            redirectUri
        });
        return response.data.data || response.data;
    },

    getMe: async (token?: string): Promise<any> => {
        const config = token
            ? { headers: { Authorization: `Bearer ${token}` } }
            : {};
        const response = await api.get('/api/users/me', config);
        return response.data.data || response.data;
    },

    getProfile: async (): Promise<ProfileResponse> => {
        try {
            const response = await api.get('/api/users/me');
            const data = response.data.data || response.data;
            return {
                email: data.email || data.Email || '',
                fullName: data.fullName || data.FullName || '',
                role: data.role ?? data.Role ?? 4,
                createdAt: data.createdAt || data.CreatedAt || '',
                avatarUrl: data.avatarUrl || data.AvatarUrl || data.pictureUrl || data.PictureUrl || '',
                phoneNumber: data.phoneNumber || data.PhoneNumber || '',
                orcid: data.orcid || data.Orcid || '',
                googleScholarUrl: data.googleScholarUrl || data.GoogleScholarUrl || '',
                githubUrl: data.githubUrl || data.GithubUrl || ''
            };
        } catch (error) {
            console.error('Error loading profile:', error);
            throw error;
        }
    },

    updateProfile: async (data: UpdateProfileRequest): Promise<any> => {
        try {
            const response = await api.put(`/api/users/me/profile`, data);
            return response.data.data || response.data;
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    },
};