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
    orcid?: string;
    googleScholarUrl?: string;
    githubUrl?: string;
    studentId?: string;
    phoneNumber?: string;
}

export interface UserResponse {
    userId: string;
    email: string;
    fullName: string;
    role: number;
    isActive?: boolean;
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
    studentId?: string;
    phoneNumber?: string;
    orcid?: string;
    googleScholarUrl?: string;
    githubUrl?: string;
}

export interface UpdateProfileRequest {
    fullName?: string;
    studentId?: string | null;
    phoneNumber?: string | null;
    orcid?: string | null;
    googleScholarUrl?: string | null;
    githubUrl?: string | null;
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

    deleteUser: async (userId: string): Promise<UserResponse> => {
        // Backend supports soft-delete via update (set isActive=false), not HTTP DELETE.
        const response = await api.put(`/api/users/${userId}`, { isActive: false });
        return response.data.data || response.data;
    },

    deleteByEmail: async (email: string): Promise<void> => {
        await api.patch(`/api/users/email/${encodeURIComponent(email)}`);
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
        const response = await api.get(`/api/users/me?_t=${Date.now()}`, config);
        return response.data.data || response.data;
    },

    getProfile: async (): Promise<ProfileResponse> => {
        try {
            const response = await api.get(`/api/users/me?_t=${Date.now()}`);
            const data = response.data.data || response.data;
            return {
                email: data.email || data.Email || '',
                fullName: data.fullName || data.FullName || '',
                role: data.role ?? data.Role ?? 4,
                createdAt: data.createdAt || data.CreatedAt || '',
                avatarUrl:
                    data.avatarUrl ||
                    data.AvatarUrl ||
                    data.avatar ||
                    data.Avatar ||
                    data.pictureUrl ||
                    data.PictureUrl ||
                    data.pictureURL ||
                    data.picture ||
                    data.photoUrl ||
                    data.PhotoUrl ||
                    data.photoURL ||
                    data.imageUrl ||
                    data.ImageUrl ||
                    data.googleAvatarUrl ||
                    data.GoogleAvatarUrl ||
                    data.profilePictureUrl ||
                    data.ProfilePictureUrl ||
                    data.profileImageUrl ||
                    data.ProfileImageUrl ||
                    '',
                studentId: data.studentId || data.StudentId || '',
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

    getByStudentId: async (studentId: string): Promise<any> => {
        const response = await api.get(`/api/users/student/${encodeURIComponent(studentId)}`);
        return response.data.data || response.data;
    },

    getCheckingLogs: async (email: string): Promise<any[]> => {
        const response = await api.get(`/api/users/checking-logs/${encodeURIComponent(email)}`);
        return response.data.data ?? response.data ?? [];
    },

    addCheckingLog: async (studentId: string, checkingTime: string): Promise<any> => {
        const response = await api.post('/api/users/checking-log', { studentId, checkingTime });
        return response.data.data || response.data;
    },

    getLabTime: async (userId: string, period: 'day' | 'week' | 'month', date?: string): Promise<any> => {
        const params = new URLSearchParams({ period });
        if (date) params.set('date', date);
        const res = await api.get(`/api/users/${userId}/lab-time?${params}`);
        return res.data.data ?? res.data;
    },

    getLabTimeRange: async (
        userId: string,
        period: 'day' | 'week' | 'month',
        from: string,
        to: string
    ): Promise<any[]> => {
        const params = new URLSearchParams({ period, from, to });
        const res = await api.get(`/api/users/${userId}/lab-time/range?${params}`);
        return res.data.data ?? res.data;
    },
};