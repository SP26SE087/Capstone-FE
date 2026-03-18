import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to add the auth token to headers
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token && token !== 'undefined' && token !== 'null') {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// ---- Auto Refresh Token Logic ----
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token!);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Only handle 401 errors, skip if already retried or if this is the refresh request itself
        if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url?.includes('/api/auth/refresh')
        ) {
            // If already refreshing, queue this request
            if (isRefreshing) {
                return new Promise<string>((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null') {
                    throw new Error('No refresh token available');
                }

                const response = await api.post('/api/auth/refresh', { refreshToken });
                const data = response.data.data || response.data;

                // Save new tokens
                localStorage.setItem('token', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                localStorage.setItem('auth_user', JSON.stringify({
                    userId: data.userId,
                    email: data.email,
                    fullName: data.fullName,
                    role: data.role,
                }));

                // Process all queued requests with the new token
                processQueue(null, data.accessToken);

                // Retry the original request with the new token
                originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh failed — clear auth data and redirect to login
                processQueue(refreshError, null);
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('auth_user');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
