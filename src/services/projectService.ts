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
        researchFields: []
    },
    {
        id: '2b3c4d5e-6f7g-8h9i-0j1k-2l3m4n5o6p7q',
        projectName: 'Smart Lab Inventory',
        projectDescription: 'IoT-based inventory management for lab equipment.',
        startDate: '2024-03-01T00:00:00Z',
        endDate: '2024-08-30T23:59:59Z',
        status: 2, // Inactive/Pending
        researchFields: []
    }
];

export const projectService = {
    getAll: async (): Promise<Project[]> => {
        try {
            const response = await api.get('/api/projects');
            // Assuming the API returns { success: true, data: Project[] } or just Project[]
            return response.data.data || response.data;
        } catch (error) {
            console.error('Error fetching projects:', error);
            return mockProjects; // Fallback to mock for now
        }
    },

    getById: async (id: string): Promise<Project | null> => {
        try {
            const response = await api.get(`/api/projects/${id}`);
            return response.data.data || response.data;
        } catch (error) {
            console.error(`Error fetching project ${id}:`, error);
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
    }
};
