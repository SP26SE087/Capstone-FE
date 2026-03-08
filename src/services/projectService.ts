import api from './api';
import { Project } from '@/types';

// Mock data to return if API fails or for initial development
const mockProjects: Project[] = [
    {
        id: '1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p',
        projectName: 'AI Emotion Recognition',
        projectDescription: 'Developing a real-time emotion recognition system using deep learning.',
        startDate: '2024-01-15T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z',
        status: 1, // Active
        researchFields: [],
        totalTasks: 45,
        completedTasks: 30,
        membersCount: 12,
        members: [],
        projectRole: 1, // LabDirector
        roleName: 'Lab Director'
    },
    {
        id: '2b3c4d5e-6f7g-8h9i-0j1k-2l3m4n5o6p7q',
        projectName: 'Smart Lab Inventory',
        projectDescription: 'IoT-based inventory management for lab equipment.',
        startDate: '2024-03-01T00:00:00Z',
        endDate: '2024-08-30T23:59:59Z',
        status: 1, // Active
        researchFields: [],
        totalTasks: 100,
        completedTasks: 15,
        membersCount: 5,
        members: [],
        projectRole: 3, // Member
        roleName: 'Member'
    }
];


export const projectService = {
    getAll: async (): Promise<Project[]> => {
        try {
            const response = await api.get('/api/projects');
            return response.data.data || response.data;
        } catch (error) {
            console.error('Error fetching projects:', error);
            return mockProjects;
        }
    },

    getPublic: async (): Promise<Project[]> => {
        try {
            const response = await api.get('/api/projects/public');
            return response.data.data || response.data;
        } catch (error) {
            console.error('Error fetching public projects:', error);
            return mockProjects;
        }
    },

    getById: async (id: string): Promise<Project | null> => {
        try {
            console.log(`fetching project by id: ${id}`);
            const response = await api.get(`/api/projects/${id}`);
            console.log('getById response data:', response.data);

            // Standard .NET / OData / custom wrapper handlers
            const project = response.data.data || response.data.value || response.data;

            // If the response is an array (sometimes APIs return [item] for id queries)
            return Array.isArray(project) ? project[0] : project;
        } catch (error) {
            console.error(`Error fetching project by id ${id}:`, error);
            // Only fallback to mock if the real ID matches a specific mock pattern if needed, 
            // but for now let's just return null to indicate not found
            return mockProjects.find(p => p.id === id) || null;
        }
    },

    create: async (projectData: any): Promise<any> => {
        try {
            const response = await api.post('/api/projects', projectData);
            return response.data;
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    },

    update: async (projectData: any): Promise<any> => {
        try {
            const response = await api.patch('/api/projects', projectData);
            return response.data;
        } catch (error) {
            console.error('Error updating project:', error);
            throw error;
        }
    },

    delete: async (projectId: string): Promise<any> => {
        try {
            const response = await api.delete(`/api/projects/${projectId}`, {
                params: { id: projectId }
            });
            return response.data;
        } catch (error) {
            console.error('Error deleting project:', error);
            throw error;
        }
    },

    updateStatus: async (projectId: string, newStatus: number): Promise<any> => {
        try {
            const response = await api.patch('/api/projects/status', {
                projectId,
                newStatus
            });
            return response.data;
        } catch (error) {
            console.error('Error updating project status:', error);
            throw error;
        }
    },

    getCurrentMember: async (projectId: string): Promise<any> => {
        try {
            const response = await api.get(`/api/projects/${projectId}/member`);
            return response.data.data || response.data;
        } catch (error) {
            console.error('Error fetching current member project info:', error);
            return null;
        }
    }
};
