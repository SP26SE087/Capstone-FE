import api from './api';
import { ResearchField } from '@/types';

export interface CreateResearchFieldRequest {
    name: string;
    description?: string | null;
}

export interface UpdateResearchFieldRequest {
    id: string;
    name?: string | null;
    description?: string | null;
    status?: number | null;
}

export const researchFieldService = {
    getAll: async (): Promise<ResearchField[]> => {
        const response = await api.get('/api/ResearchField');
        const data = response.data.data || response.data;
        return Array.isArray(data) ? data.map((f: any) => ({
            ...f,
            researchFieldId: f.researchFieldId || f.id || f.ResearchFieldId
        })) : [];
    },

    create: async (payload: CreateResearchFieldRequest): Promise<ResearchField> => {
        const response = await api.post('/api/ResearchField', payload);
        const data = response.data.data || response.data;
        return { ...data, researchFieldId: data.researchFieldId || data.id };
    },

    update: async (id: string, payload: UpdateResearchFieldRequest): Promise<ResearchField> => {
        const response = await api.put(`/api/ResearchField/${id}`, { ...payload, id });
        const data = response.data.data || response.data;
        return { ...data, researchFieldId: data.researchFieldId || data.id };
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/api/ResearchField/${id}`);
    },
};
