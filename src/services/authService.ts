import api from './api';
import { userService } from './userService';

export interface AuthResponse {
    userId: string;
    jwtToken: string;
    tokenType: string;
    expiresIn: number;
    refreshToken: string;
    email: string;
    fullName: string;
    role: string | number;
}

const AUTH_KEYS = {
    TOKEN: 'token',
    REFRESH_TOKEN: 'refreshToken',
    USER: 'auth_user',
} as const;

export const authService = {
    async loginWithGoogle(idToken: string): Promise<AuthResponse> {
        const response = await api.post('/api/auth/google', { idToken });
        const authData: AuthResponse = response.data.data || response.data;

        // After login, use the new token to get full user details (including userId)
        try {
            const token = authData.jwtToken || (authData as any).JwtToken;
            const me = await userService.getMe(token);
            authData.userId = me.userId;
        } catch (err) {
            console.error('Lỗi khi lấy thông tin người dùng (getMe):', err);
        }

        this.saveAuthData(authData);
        return authData;
    },

    async loginWithCode(code: string, redirectUri: string): Promise<AuthResponse> {
        const response = await api.post('/api/auth/google-code', { code, redirectUri });
        const rawData = response.data.data || response.data;
        
        // Map fields robustly (handle PascalCase and camelCase)
        const authData: AuthResponse = {
            ...rawData,
            jwtToken: rawData.jwtToken || rawData.JwtToken,
            refreshToken: rawData.refreshToken || rawData.RefreshToken,
            email: rawData.email || rawData.Email,
            fullName: rawData.fullName || rawData.FullName,
            role: rawData.role ?? rawData.Role,
            userId: '' // Will fetch below
        };

        try {
            const me = await userService.getMe(authData.jwtToken);
            authData.userId = me.userId;
        } catch (err) {
            console.error('Lỗi khi lấy thông tin getMe sau loginWithCode:', err);
        }

        this.saveAuthData(authData);
        return authData;
    },

    async refreshToken(refreshToken: string): Promise<AuthResponse> {
        const response = await api.post('/api/auth/refresh', { refreshToken });
        const authData: AuthResponse = response.data.data || response.data;

        try {
            const me = await userService.getMe(authData.jwtToken);
            authData.userId = me.userId;
        } catch (err) {
            console.error('Lỗi khi lấy thông tin người dùng trong lúc refresh:', err);
        }

        this.saveAuthData(authData);
        return authData;
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
        localStorage.setItem(AUTH_KEYS.TOKEN, data.jwtToken);
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
