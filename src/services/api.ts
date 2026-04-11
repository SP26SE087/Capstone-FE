import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 second timeout
});

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
    axiosInstance.interceptors.request.use(
        (config: any) => {
            const token = sessionStorage.getItem('token');
            if (token && token !== 'undefined' && token !== 'null' && !config.headers.Authorization) {
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
        (response: any) => response,
        async (error: any) => {
            const originalRequest = error.config;

            // If error is 401 and not already retrying
            if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/api/auth/refresh')) {
                
                // Concurrent refresh handling
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

                    // Update storage
                    sessionStorage.setItem('token', newToken);
                    sessionStorage.setItem('refreshToken', newRefreshToken || currentRefreshToken);
                    
                    // Update user info from refresh response (include avatar, role, fullName)
                    if (data.email || data.userId) {
                        const userData = {
                            userId: data.userId || data.UserId,
                            email: data.email || data.Email,
                            fullName: data.fullName || data.FullName,
                            role: data.role ?? data.Role,
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
                                data.ProfileImageUrl,
                        };
                        sessionStorage.setItem('auth_user', JSON.stringify(userData));
                        window.dispatchEvent(new Event('auth_user_updated'));
                    }

                    // Process queuing and retry
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    processQueue(null, newToken);
                    isRefreshing = false;

                    return axiosInstance(originalRequest);
                } catch (refreshError) {
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
    
    // Redirect only if not already on login page
    if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
    }
};

// Apply interceptors
setupInterceptors(api);

export default api;
