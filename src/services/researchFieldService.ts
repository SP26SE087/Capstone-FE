import api from './api';
import { ResearchField } from '@/types';

export const researchFieldService = {
    getAll: async (): Promise<ResearchField[]> => {
        try {
            const response = await api.get('/api/ResearchField');
            // Handle common API response patterns: direct array or { data: [...] }
            return response.data.data || response.data;
        } catch (error) {
            console.error('Error fetching research fields:', error);
            // Fallback mock data
            return [
                { id: '1', name: 'Machine Learning', description: 'AI and ML research' },
                { id: '2', name: 'Data Science', description: 'Data analysis and big data' },
                { id: '3', name: 'Computer Vision', description: 'Image processing and CV' },
                { id: '4', name: 'Robotics', description: 'Autonomous systems' },
                { id: '5', name: 'Blockchain', description: 'Distributed ledger technology' }
            ];
        }
    }
};
