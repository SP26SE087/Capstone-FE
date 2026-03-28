import api from './api';
import { Milestone, Task } from '@/types';
import { toApiDate } from '@/utils/projectUtils';

export const milestoneService = {
    getByProject: async (projectId: string): Promise<Milestone[]> => {
        if (!projectId || projectId === 'undefined') return [];
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
            // Filter and format fields for AddMilestoneRequest
            const payload = {
                projectId: milestoneData.projectId,
                name: milestoneData.name,
                description: milestoneData.description,
                startDate: toApiDate(milestoneData.startDate),
                dueDate: toApiDate(milestoneData.dueDate),
                status: milestoneData.status !== undefined ? Number(milestoneData.status) : 0
            };
            const response = await api.post('/api/projects/milestones', payload);
            return response.data;
        } catch (error) {
            console.error('Error creating milestone:', error);
            throw error;
        }
    },

    createBulk: async (milestones: any[]): Promise<any> => {
        try {
            const response = await api.post('/api/projects/milestones/bulk', milestones);
            return response.data;
        } catch (error) {
            console.error('Error creating bulk milestones:', error);
            throw error;
        }
    },

    updateStatus: async (milestoneId: string, status: number): Promise<any> => {
        try {
            const response = await api.patch(`/api/projects/milestones/${milestoneId}/status`, {
                status: status
            });
            return response.data;
        } catch (error) {
            console.error(`Error updating status for milestone ${milestoneId}:`, error);
            throw error;
        }
    },

    update: async (milestoneId: string, milestoneData: any): Promise<any> => {
        try {
            const response = await api.patch(`/api/projects/milestones`, {
                milestoneId: milestoneId,
                name: milestoneData.name,
                description: milestoneData.description,
                startDate: toApiDate(milestoneData.startDate),
                dueDate: toApiDate(milestoneData.dueDate),
                status: milestoneData.status
            });
            return response.data;
        } catch (error) {
            console.error(`Error updating milestone ${milestoneId}:`, error);
            throw error;
        }
    },

    delete: async (milestoneId: string): Promise<any> => {
        try {
            const response = await api.delete(`/api/projects/milestones/${milestoneId}`);
            return response.data;
        } catch (error) {
            console.error(`Error deleting milestone ${milestoneId}:`, error);
            throw error;
        }
    },

    getById: async (milestoneId: string): Promise<Milestone | null> => {
        try {
            const response = await api.get(`/api/projects/milestones/${milestoneId}`);
            return response.data.data || response.data;
        } catch (error) {
            console.error(`Error fetching milestone ${milestoneId}:`, error);
            return null;
        }
    },

    getTasksByMilestone: async (milestoneId: string): Promise<Task[]> => {
        try {
            const response = await api.get(`/api/projects/milestones/${milestoneId}/tasks`);
            return response.data.data || response.data || [];
        } catch (error) {
            console.error(`Error fetching tasks for milestone ${milestoneId}:`, error);
            return [];
        }
    }
};
