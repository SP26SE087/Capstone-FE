import api from './api';
import { Milestone } from '@/types';

export const milestoneService = {
    getByProject: async (projectId: string): Promise<Milestone[]> => {
        try {
            const response = await api.get(`/api/projects/${projectId}/milestones`);
            return response.data.data || response.data;
        } catch (error) {
            console.error(`Error fetching milestones for project ${projectId}:`, error);
            return [];
        }
    },

    create: async (milestoneData: any): Promise<any> => {
        try {
            const response = await api.post('/api/projects/milestones', milestoneData);
            return response.data;
        } catch (error) {
            console.error('Error creating milestone:', error);
            throw error;
        }
    }
};
