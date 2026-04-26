import api from './api';
import axios from 'axios';
import { API_BASE_URL } from './api';
import {
    VisitorRegistrationResponse,
    UpdateVisitorRegistrationStatusRequest,
    AssigneeTransferRequestResponse,
    TransferRequest,
    RespondTransferRequest,
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

    /**
     * Get a single registration by ID (includes full logs[]).
     * Requires JWT auth.
     */
    getById: async (id: string): Promise<VisitorRegistrationResponse> => {
        const response = await api.get(`/api/visitor-registrations/${id}`);
        const data = response.data?.data ?? response.data;
        return data as VisitorRegistrationResponse;
    },

    /**
     * Request transfer of a registration to another assignee.
     * Requires JWT auth; caller must be current assignee.
     */
    requestTransfer: async (id: string, body: TransferRequest): Promise<AssigneeTransferRequestResponse> => {
        const response = await api.post(`/api/visitor-registrations/${id}/transfer`, body);
        const data = response.data?.data ?? response.data;
        return data as AssigneeTransferRequestResponse;
    },

    /**
     * Get all pending transfer requests where the current user is the target recipient.
     */
    getPendingTransfers: async (): Promise<AssigneeTransferRequestResponse[]> => {
        const response = await api.get('/api/visitor-registrations/transfers/pending');
        const data = response.data?.data ?? response.data;
        return Array.isArray(data) ? data : [];
    },

    /**
     * Accept or reject a transfer request. Caller must be the toAssignee.
     */
    respondToTransfer: async (
        transferId: string,
        body: RespondTransferRequest,
    ): Promise<VisitorRegistrationResponse> => {
        const response = await api.patch(`/api/visitor-registrations/transfers/${transferId}`, body);
        const data = response.data?.data ?? response.data;
        return data as VisitorRegistrationResponse;
    },

    /**
     * Extract full name and portrait from a Vietnamese CCCD front-side image.
     * No auth required (AllowAnonymous).
     */
    extractCccd: async (image: File): Promise<{ fullName: string; faceImageBase64: string | null }> => {
        const anonAxios = axios.create({
            baseURL: API_BASE_URL,
            timeout: 30000,
        });
        const fd = new FormData();
        fd.append('image', image);
        const response = await anonAxios.post('/api/cccd/extract', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        const data = response.data?.data ?? response.data;
        return data as { fullName: string; faceImageBase64: string | null };
    },
};
