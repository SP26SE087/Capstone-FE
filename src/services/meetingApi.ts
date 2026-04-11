/**
 * Separate Axios instance for Meeting & Seminar APIs.
 * 
 * These APIs expect the Authorization header to contain ONLY the JWT token,
 * WITHOUT the "Bearer" prefix. On Swagger, when entering Authorize, users
 * do NOT prepend "Bearer". So the header is: Authorization: <token>
 */
import axios from 'axios';
import { API_BASE_URL } from './api';

const meetingApi = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
    },
});

// Request interceptor — sends token WITHOUT "Bearer" prefix
meetingApi.interceptors.request.use(
    (config: any) => {
        const token = sessionStorage.getItem('token');
        if (token && token !== 'undefined' && token !== 'null' && !config.headers.Authorization) {
            config.headers.Authorization = token;
        }
        return config;
    },
    (error: any) => Promise.reject(error)
);

// Response interceptor — handle 401 by refreshing token
meetingApi.interceptors.response.use(
    (response: any) => response,
    async (error: any) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = sessionStorage.getItem('refreshToken');
            if (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null') {
                // Session expired — let the main app handle redirect
                return Promise.reject(error);
            }

            try {
                const refreshInstance = axios.create({ baseURL: API_BASE_URL });
                const response = await refreshInstance.post('/api/auth/refresh', { refreshToken });

                const data = response.data.data || response.data;
                const newToken = data.jwtToken || data.JwtToken;
                const newRefreshToken = data.refreshToken || data.RefreshToken;

                if (!newToken) throw new Error('No token from refresh');

                sessionStorage.setItem('token', newToken);
                if (newRefreshToken) sessionStorage.setItem('refreshToken', newRefreshToken);

                // Retry with new token (no Bearer prefix)
                originalRequest.headers.Authorization = newToken;
                return meetingApi(originalRequest);
            } catch (refreshError) {
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('refreshToken');
                sessionStorage.removeItem('auth_user');
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default meetingApi;
