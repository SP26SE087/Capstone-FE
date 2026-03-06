export const API_ENDPOINTS = {
    PROJECTS: '/projects',
    TASKS: '/tasks',
    MEMBERS: '/members',
    MILESTONES: '/milestones',
    DASHBOARD: '/dashboard/stats',
    AUTH: {
        LOGIN: '/auth/login',
        LOGOUT: '/auth/logout',
        ME: '/auth/me'
    }
};

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
