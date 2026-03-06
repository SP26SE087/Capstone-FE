import api from './api';
import { DashboardStats } from '@/types';

export const dashboardService = {
    getStats: async (): Promise<DashboardStats> => {
        const response = await api.get('/api/dashboard/stats');
        // Assuming the API returns the format { success: true, data: { ...stats } }
        // based on previous user input about token response format.
        return response.data.data || response.data;
    },
};
