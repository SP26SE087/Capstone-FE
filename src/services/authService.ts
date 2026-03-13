import api from './api';

export interface AuthResponse {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
    refreshToken: string;
    userId: string;
    email: string;
    fullName: string;
    role: string;
}

const AUTH_KEYS = {
    TOKEN: 'token',
    REFRESH_TOKEN: 'refreshToken',
    USER: 'auth_user',
} as const;

export const authService = {
    async loginWithGoogle(idToken: string): Promise<AuthResponse> {
        const response = await api.post('/api/auth/google', { idToken });
        const data: AuthResponse = response.data;
        this.saveAuthData(data);
        return data;
    },

    async refreshToken(refreshToken: string): Promise<AuthResponse> {
        const response = await api.post('/api/auth/refresh', { refreshToken });
        const data: AuthResponse = response.data;
        this.saveAuthData(data);
        return data;
    },

    async logout(): Promise<void> {
        try {
            await api.post('/api/auth/logout');
        } catch {
            // Ignore errors — clear local data regardless
        }
        this.clearAuthData();
    },

    saveAuthData(data: AuthResponse): void {
        localStorage.setItem(AUTH_KEYS.TOKEN, data.accessToken);
        localStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, data.refreshToken);
        localStorage.setItem(AUTH_KEYS.USER, JSON.stringify({
            userId: data.userId,
            email: data.email,
            fullName: data.fullName,
            role: data.role,
        }));
    },

    clearAuthData(): void {
        localStorage.removeItem(AUTH_KEYS.TOKEN);
        localStorage.removeItem(AUTH_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(AUTH_KEYS.USER);
    },

    getAccessToken(): string | null {
        return localStorage.getItem(AUTH_KEYS.TOKEN);
    },

    getAuthUser(): { userId: string; email: string; fullName: string; role: string } | null {
        const raw = localStorage.getItem(AUTH_KEYS.USER);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },

    isAuthenticated(): boolean {
        return !!this.getAccessToken() && !!this.getAuthUser();
    },
};
