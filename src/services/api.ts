import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
    },
    timeout: 30000, // 30 second timeout
});

/**
 * BroadcastChannel for syncing refreshed tokens between tabs of the SAME user.
 *
 * Why BroadcastChannel instead of localStorage?
 * - sessionStorage keeps each user's tokens isolated per-tab (User A in Tab 1
 *   never sees User B's tokens in Tab 2). We want to preserve this guarantee.
 * - But when the same user has multiple tabs open, refresh-token rotation causes
 *   the tab that refreshes first to invalidate the refresh token held by the
 *   other tabs — those tabs will fail their own refresh and get logged out.
 * - BroadcastChannel delivers a message ONLY to other tabs of the same origin
 *   in the same browser session. After Tab 1 refreshes, it posts the new tokens
 *   via this channel; Tab 2 receives them and updates its own sessionStorage so
 *   it won't have to re-refresh (or fail) on its next 401.
 */
const tokenChannel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('auth_token_sync')
    : null;

// Listen for token updates broadcast by sibling tabs of the SAME user
if (tokenChannel) {
    tokenChannel.onmessage = (event) => {
        const { type, userId, token, refreshToken, authUser } = event.data ?? {};

        // Only process messages intended for the currently logged-in user.
        // This prevents User B's tab from acting on User A's broadcast.
        const myUserId = (() => {
            try { return JSON.parse(sessionStorage.getItem('auth_user') || '{}')?.userId; }
            catch { return null; }
        })();
        if (!userId || !myUserId || userId !== myUserId) return;

        if (type === 'TOKEN_REFRESHED') {
            if (token)        sessionStorage.setItem('token', token);
            if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
            if (authUser)     sessionStorage.setItem('auth_user', authUser);
            window.dispatchEvent(new Event('auth_user_updated'));
        }
        if (type === 'LOGOUT') {
            // A sibling tab of the SAME user logged out — mirror the action
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('refreshToken');
            sessionStorage.removeItem('auth_user');
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
    };
}

export const setupInterceptors = (axiosInstance: any) => {
    // Determine the base URL to use for refresh calls
    const refreshBaseUrl = axiosInstance.defaults.baseURL || API_BASE_URL;

    // A separate instance for refreshing tokens to avoid interceptor recursion
    const refreshInstance = axios.create({
        baseURL: refreshBaseUrl,
        headers: {
            'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
    });

    // Request interceptor to add the auth token to headers
    // Login endpoints must NOT receive a stale token from a previous session —
    // doing so causes the backend to associate the new login with the old user.
    const LOGIN_ENDPOINTS = ['/api/auth/google', '/api/auth/google-code'];

    axiosInstance.interceptors.request.use(
        (config: any) => {
            const isLoginEndpoint = LOGIN_ENDPOINTS.some(
                (url) => config.url && config.url.includes(url)
            );
            const token = sessionStorage.getItem('token');
            if (
                token &&
                token !== 'undefined' &&
                token !== 'null' &&
                !config.headers.Authorization &&
                !isLoginEndpoint
            ) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        },
        (error: any) => Promise.reject(error)
    );

    // Flag to prevent multiple refresh calls simultaneously
    let isRefreshing = false;
    let failedQueue: any[] = [];

    const processQueue = (error: any, token: string | null = null) => {
        failedQueue.forEach((prom) => {
            if (error) {
                prom.reject(error);
            } else {
                prom.resolve(token);
            }
        });
        failedQueue = [];
    };

    // Response interceptor to handle token refresh
    axiosInstance.interceptors.response.use(
        (response: any) => {
            // Unwrap API envelope: { success, message, messageCode, data }
            if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
                response.data = response.data.data;
            }
            return response;
        },
        async (error: any) => {
            const originalRequest = error.config;

            // If error is 401 and not already retrying
            if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/api/auth/refresh')) {
                
                // Concurrent refresh handling — queue requests while one refresh is in flight
                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    })
                        .then((token) => {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            return axiosInstance(originalRequest);
                        })
                        .catch((err) => Promise.reject(err));
                }

                originalRequest._retry = true;
                isRefreshing = true;

                const currentRefreshToken = sessionStorage.getItem('refreshToken');

                if (!currentRefreshToken || currentRefreshToken === 'undefined' || currentRefreshToken === 'null') {
                    isRefreshing = false;
                    // No refresh token: session expired
                    handleSessionExpired();
                    return Promise.reject(error);
                }

                try {
                    // Call refresh endpoint with exact relative path
                    const response = await refreshInstance.post('/api/auth/refresh', { refreshToken: currentRefreshToken });

                    // Map fields robustly (handle PascalCase/camelCase)
                    const data = response.data.data || response.data;
                    const newToken = data.jwtToken || data.JwtToken;
                    const newRefreshToken = data.refreshToken || data.RefreshToken;

                    if (!newToken) throw new Error('No token returned from refresh');

                    // Update this tab's sessionStorage
                    sessionStorage.setItem('token', newToken);
                    sessionStorage.setItem('refreshToken', newRefreshToken || currentRefreshToken);
                    
                    // Update user info from refresh response (include avatar, role, fullName)
                    let authUserJson: string | undefined;
                    if (data.email || data.userId) {
                        let existingUser: any = {};
                        try {
                            const raw = sessionStorage.getItem('auth_user');
                            if (raw) existingUser = JSON.parse(raw);
                        } catch (e) {
                            console.error('Failed to parse existing auth_user from sessionStorage', e);
                        }

                        const userData = {
                            userId: data.userId || data.UserId || existingUser.userId,
                            email: data.email || data.Email || existingUser.email,
                            fullName: data.fullName || data.FullName || existingUser.fullName,
                            role: data.role ?? data.Role ?? existingUser.role,
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
                                existingUser.avatarUrl,
                        };
                        authUserJson = JSON.stringify(userData);
                        sessionStorage.setItem('auth_user', authUserJson);
                        window.dispatchEvent(new Event('auth_user_updated'));
                    }

                    // Broadcast new tokens to sibling tabs of the SAME user.
                    // Include userId so other users' tabs can ignore this message.
                    const broadcastUserId = data.userId || data.UserId ||
                        (() => { try { return JSON.parse(sessionStorage.getItem('auth_user') || '{}')?.userId; } catch { return null; } })();
                    tokenChannel?.postMessage({
                        type: 'TOKEN_REFRESHED',
                        userId: broadcastUserId,
                        token: newToken,
                        refreshToken: newRefreshToken || currentRefreshToken,
                        authUser: authUserJson,
                    });

                    // Process queuing and retry
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    processQueue(null, newToken);
                    isRefreshing = false;

                    return axiosInstance(originalRequest);
                } catch (refreshError: any) {
                    // Before giving up, check if a sibling tab already refreshed
                    // and updated this tab's sessionStorage via BroadcastChannel.
                    const freshToken = sessionStorage.getItem('token');
                    const usedToken = originalRequest.headers?.Authorization?.replace('Bearer ', '');
                    if (freshToken && freshToken !== usedToken) {
                        // Sibling tab already refreshed — retry with the new token
                        processQueue(null, freshToken);
                        isRefreshing = false;
                        originalRequest.headers.Authorization = `Bearer ${freshToken}`;
                        return axiosInstance(originalRequest);
                    }

                    processQueue(refreshError, null);
                    isRefreshing = false;
                    handleSessionExpired();
                    return Promise.reject(refreshError);
                }
            }

            // Normalize error message from API response shape:
            // { success: false, message: "...", errorCode: ..., details: "..." }
            if (error.response?.data?.message) {
                error.message = error.response.data.message;
            }

            return Promise.reject(error);
        }
    );
};

const handleSessionExpired = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('auth_user');
    
    // Notify sibling tabs (same user) to also log out
    tokenChannel?.postMessage({ type: 'LOGOUT' });

    // Redirect only if not already on login page
    if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
    }
};

// Apply interceptors
setupInterceptors(api);

/**
 * A clean axios instance for authentication endpoints (login, register).
 * It intentionally has NO request interceptor that injects session tokens,
 * preventing stale tokens from a previous user's session from contaminating
 * a new login request. Only the response envelope-unwrapping is applied.
 */
export const authApi = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
    },
    timeout: 30000,
});

// Only unwrap the API envelope — no token injection, no refresh logic.
authApi.interceptors.response.use(
    (response: any) => {
        if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
            response.data = response.data.data;
        }
        return response;
    },
    (error: any) => {
        if (error.response?.data?.message) {
            error.message = error.response.data.message;
        }
        return Promise.reject(error);
    }
);

export default api;
