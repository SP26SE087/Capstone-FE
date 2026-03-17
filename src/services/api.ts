import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
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
    });

    // Add a request interceptor to add the auth token to headers
    axiosInstance.interceptors.request.use(
        (config: any) => {
            const token = localStorage.getItem('token');
            if (token && token !== 'undefined' && token !== 'null') {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        },
        (error: any) => {
            return Promise.reject(error);
        }
    );

// Flag to prevent multiple refresh calls
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

    // Add a response interceptor to handle token refresh
    axiosInstance.interceptors.response.use(
        (response: any) => {
        return response;
    },
    async (error: any) => {
        const originalRequest = error.config;

        // If error is 401 and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            
            // If it's already refreshing, add to queue
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return axiosInstance(originalRequest);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem('refreshToken');

            if (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null') {
                isRefreshing = false;
                processQueue(new Error('No refresh token available'), null);
                return Promise.reject(error);
            }

            try {
                // Call refresh endpoint using the refreshInstance
                // Use absolute path or ensure the instance has correct baseURL
                const response = await refreshInstance.post('/api/auth/refresh', { refreshToken });
                
                // Assuming the response structure is consistent
                const authData = response.data.data || response.data;
                const { accessToken, refreshToken: newRefreshToken } = authData;

                // Update storage
                localStorage.setItem('token', accessToken);
                localStorage.setItem('refreshToken', newRefreshToken);
                if (authData.userId) {
                    localStorage.setItem('auth_user', JSON.stringify({
                        userId: authData.userId,
                        email: authData.email,
                        fullName: authData.fullName,
                        role: authData.role,
                    }));
                }

                // Update original request and retry
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                
                processQueue(null, accessToken);
                isRefreshing = false;
                
                return axiosInstance(originalRequest);
            } catch (refreshError) {
                // Refresh failed - force logout
                processQueue(refreshError, null);
                isRefreshing = false;
                
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('auth_user');
                
                // Only redirect if we are on a protected page
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login';
                }
                
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    });
};

setupInterceptors(api);

export default api;
