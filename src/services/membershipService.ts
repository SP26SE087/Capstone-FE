import api from './api';

export const membershipService = {
    getProjectMembers: async (projectId: string): Promise<any[]> => {
        try {
            const response = await api.get(`/api/projects/${projectId}/members`);
            return response.data.data || response.data;
        } catch (error) {
            console.error(`Error fetching members for project ${projectId}:`, error);
            return [];
        }
    },

    addMember: async (membershipData: any): Promise<any> => {
        try {
            const response = await api.post('/api/projects/memberships', membershipData);
            return response.data;
        } catch (error) {
            console.error('Error adding member to project:', error);
            throw error;
        }
    }
};
