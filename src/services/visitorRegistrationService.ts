import api from './api';
import axios from 'axios';
import { API_BASE_URL } from './api';
import {
    VisitorRegistrationResponse,
    UpdateVisitorRegistrationStatusRequest,
} from '@/types/visitorRegistration';

export const visitorRegistrationService = {
    /**
     * Submit a new visitor registration (anonymous, no auth).
     * Uses a raw axios instance so no Authorization header is added.
     */
    create: async (formData: FormData): Promise<VisitorRegistrationResponse> => {
        const anonAxios = axios.create({
            baseURL: API_BASE_URL,
            timeout: 30000,
        });
        const response = await anonAxios.post('/api/visitor-registrations', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        const data = response.data?.data ?? response.data;
        return data as VisitorRegistrationResponse;
    },

    /**
     * Get visitor registrations where contactEmail = current user's email.
     * Requires JWT auth.
     */
    getMyList: async (): Promise<VisitorRegistrationResponse[]> => {
        const response = await api.get('/api/visitor-registrations');
        const data = response.data?.data ?? response.data;
        return Array.isArray(data) ? data : [];
    },

    /**
     * Approve or reject a visitor registration.
     * Requires JWT auth and caller must be the contactEmail.
     */
    updateStatus: async (
        id: string,
        body: UpdateVisitorRegistrationStatusRequest,
    ): Promise<VisitorRegistrationResponse> => {
        const response = await api.patch(`/api/visitor-registrations/${id}/status`, body);
        const data = response.data?.data ?? response.data;
        return data as VisitorRegistrationResponse;
    },
};
