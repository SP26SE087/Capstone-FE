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
    isActive?: boolean;
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
            authData.jwtToken = token;
        } catch (err) {
            console.error('Lỗi khi lấy userId từ token:', err);
        }

        const hydrated = await this.hydrateProfile(authData);
        this.saveAuthData(hydrated);
        return hydrated;
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
            avatarUrl:
                rawData.avatarUrl ||
                rawData.AvatarUrl ||
                rawData.avatar ||
                rawData.Avatar ||
                rawData.pictureUrl ||
                rawData.PictureUrl ||
                rawData.pictureURL ||
                rawData.picture ||
                rawData.photoUrl ||
                rawData.PhotoUrl ||
                rawData.photoURL ||
                rawData.imageUrl ||
                rawData.ImageUrl ||
                rawData.googleAvatarUrl ||
                rawData.GoogleAvatarUrl ||
                rawData.profilePictureUrl ||
                rawData.ProfilePictureUrl ||
                rawData.profileImageUrl ||
                rawData.ProfileImageUrl,
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

        const hydrated = await this.hydrateProfile(authData);
        this.saveAuthData(hydrated);
        return hydrated;
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

        const hydrated = await this.hydrateProfile(authData);
        this.saveAuthData(hydrated);
        return hydrated;
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
            isActive: data.isActive,
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

    async hydrateProfile(authData: AuthResponse): Promise<AuthResponse> {
        try {
            const res = await api.get('/api/users/me', {
                headers: { Authorization: `Bearer ${authData.jwtToken}` }
            });
            const data = res.data.data || res.data;
            const isActive = data.isActive ?? data.status !== false;

            if (isActive === false) {
                this.clearAuthData();
                throw new Error('Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.');
            }

            return {
                ...authData,
                fullName: data.fullName || data.FullName || authData.fullName,
                role: data.role ?? data.Role ?? authData.role,
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
                    authData.avatarUrl,
                isActive,
            };
        } catch (err) {
            // Nếu lấy profile thất bại, trả lại authData hiện có
            console.warn('Không thể đồng bộ profile sau đăng nhập:', err);
            return authData;
        }
    },
};
