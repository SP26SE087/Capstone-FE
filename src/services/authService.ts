import api from './api';

export interface AuthResponse {
    userId: string;
    jwtToken: string;
    tokenType: string;
    expiresIn: number;
    refreshToken: string;
    email: string;
    fullName: string;
    role: string | number;
    avatarUrl?: string;
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

        try {
            const token = authData.jwtToken || (authData as any).JwtToken;
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join('')));
            authData.userId = payload.sub || payload.nameid || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
        } catch (err) {
            console.error('Lỗi khi lấy userId từ token:', err);
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
            avatarUrl: rawData.avatarUrl || rawData.AvatarUrl,
            userId: '' // Will fetch below
        };

        try {
            const base64Url = authData.jwtToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join('')));
            authData.userId = payload.sub || payload.nameid || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
        } catch (err) {
            console.error('Lỗi khi lấy userId từ token sau loginWithCode:', err);
        }

        this.saveAuthData(authData);
        return authData;
    },

    async refreshToken(refreshToken: string): Promise<AuthResponse> {
        const response = await api.post('/api/auth/refresh', { refreshToken });
        const authData: AuthResponse = response.data.data || response.data;

        try {
            const base64Url = authData.jwtToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join('')));
            authData.userId = payload.sub || payload.nameid || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
        } catch (err) {
            console.error('Lỗi khi lấy userId trong lúc refresh token:', err);
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
            avatarUrl: data.avatarUrl || (data as any).AvatarUrl,
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

    getAuthUser(): { userId: string; email: string; fullName: string; role: string; avatarUrl?: string } | null {
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
