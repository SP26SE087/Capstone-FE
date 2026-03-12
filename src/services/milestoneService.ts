import api from './api';
import { Milestone, Task } from '@/types';

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
            // Filter fields for AddMilestoneRequest (status not allowed on create)
            const payload = {
                projectId: milestoneData.projectId,
                name: milestoneData.name,
                description: milestoneData.description,
                startDate: milestoneData.startDate,
                dueDate: milestoneData.dueDate
            };
            const response = await api.post('/api/projects/milestones', payload);
            return response.data;
        } catch (error) {
            console.error('Error creating milestone:', error);
            throw error;
        }
    },

    update: async (milestoneId: string, milestoneData: any): Promise<any> => {
        try {
            const response = await api.patch(`/api/projects/milestones`, {
                milestoneId: milestoneId,
                name: milestoneData.name,
                description: milestoneData.description,
                startDate: milestoneData.startDate,
                dueDate: milestoneData.dueDate,
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
