import api from './api';
import { DashboardStats } from '@/types';

export const dashboardService = {
    getStats: async (): Promise<DashboardStats> => {
        const response = await api.get('/api/dashboard/stats');
        return response.data.data || response.data;
    },
    getOverview: async (milestoneId?: string): Promise<any> => {
        const response = await api.get('/api/dashboard/overview', { 
            params: milestoneId && milestoneId !== 'all' ? { milestoneId } : {} 
        });
        return response.data.data || response.data;
    },
    getMyWork: async (memberId?: string, milestoneId?: string): Promise<any> => {
        const response = await api.get('/api/dashboard/my-work', { 
            params: { memberId, milestoneId } 
        });
        return response.data.data || response.data;
    },
    getMilestoneStats: async (projectId: string): Promise<any> => {
        const response = await api.get('/api/dashboard/milestones', { params: { projectId } });
        return response.data.data || response.data;
    }
};
