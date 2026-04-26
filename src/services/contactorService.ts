import api from './api';
import {
    ContactorResponse,
    CreateContactorRequest,
    UpdateContactorRequest,
} from '@/types/visitorRegistration';

export const contactorService = {
    getAll: async (): Promise<ContactorResponse[]> => {
        const response = await api.get('/api/contactors');
        const data = response.data?.data ?? response.data;
        return Array.isArray(data) ? data : [];
    },

    getById: async (id: string): Promise<ContactorResponse> => {
        const response = await api.get(`/api/contactors/${id}`);
        const data = response.data?.data ?? response.data;
        return data as ContactorResponse;
    },

    create: async (body: CreateContactorRequest): Promise<ContactorResponse> => {
        const response = await api.post('/api/contactors', body);
        const data = response.data?.data ?? response.data;
        return data as ContactorResponse;
    },

    update: async (id: string, body: UpdateContactorRequest): Promise<ContactorResponse> => {
        const response = await api.put(`/api/contactors/${id}`, body);
        const data = response.data?.data ?? response.data;
        return data as ContactorResponse;
    },

    deleteById: async (id: string): Promise<void> => {
        await api.delete(`/api/contactors/${id}`);
    },
};
