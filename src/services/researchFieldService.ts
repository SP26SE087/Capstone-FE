import api from './api';
import { ResearchField } from '@/types';

export const researchFieldService = {
    getAll: async (): Promise<ResearchField[]> => {
        try {
            const response = await api.get('/api/ResearchField');
            const data = response.data.data || response.data;
            return Array.isArray(data) ? data.map((f: any) => ({
                ...f,
                researchFieldId: f.researchFieldId || f.id || f.ResearchFieldId
            })) : [];
        } catch (error) {
            console.error('Error fetching research fields:', error);
            // Fallback mock data
            return [
                { researchFieldId: '1', name: 'Machine Learning', description: 'AI and ML research', status: 1 },
                { researchFieldId: '2', name: 'Data Science', description: 'Data analysis and big data', status: 1 },
                { researchFieldId: '3', name: 'Computer Vision', description: 'Image processing and CV', status: 1 },
                { researchFieldId: '4', name: 'Robotics', description: 'Autonomous systems', status: 1 },
                { researchFieldId: '5', name: 'Blockchain', description: 'Distributed ledger technology', status: 1 }
            ];
        }
    }
};
