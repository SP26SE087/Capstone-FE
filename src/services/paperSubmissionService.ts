import api from './api';
import type {
    PaperSubmissionResponse,
    CreatePaperRequest,
    UpdatePaperRequest,
    SubmissionStatus,
} from '@/types/paperSubmission';

const BASE = '/api/papersubmissions';

export const paperSubmissionService = {
    /** Get all papers — optionally filter by projectId */
    getAll: async (projectId?: string): Promise<PaperSubmissionResponse[]> => {
        const params = projectId ? { projectId } : {};
        const response = await api.get(BASE, { params });
        return response.data.data || response.data;
    },

    /** Get paper detail by ID */
    getById: async (id: string): Promise<PaperSubmissionResponse> => {
        const response = await api.get(`${BASE}/${id}`);
        return response.data.data || response.data;
    },

    /** Create a new paper */
    create: async (data: CreatePaperRequest): Promise<PaperSubmissionResponse> => {
        const response = await api.post(BASE, data);
        return response.data.data || response.data;
    },

    /** Update an existing paper */
    update: async (id: string, data: UpdatePaperRequest): Promise<PaperSubmissionResponse> => {
        const response = await api.put(`${BASE}/${id}`, data);
        return response.data.data || response.data;
    },

    /** Delete a paper */
    delete: async (id: string): Promise<void> => {
        await api.delete(`${BASE}/${id}`);
    },

    /** Submit for internal review (Draft → InternalReview) */
    submitForReview: async (id: string): Promise<PaperSubmissionResponse> => {
        const response = await api.post(`${BASE}/${id}/internal-review`);
        return response.data.data || response.data;
    },

    /** Director review (InternalReview → Approved / Rejected) */
    directorReview: async (id: string, isApproved: boolean): Promise<PaperSubmissionResponse> => {
        const response = await api.post(`${BASE}/${id}/director-review`, isApproved);
        return response.data.data || response.data;
    },

    /** Submit paper to venue (Approved → Submitted) */
    submitToVenue: async (id: string, paperUrl: string): Promise<PaperSubmissionResponse> => {
        const response = await api.post(`${BASE}/${id}/submit-venue`, { paperUrl });
        return response.data.data || response.data;
    },

    /** Record venue decision (Submitted → Decision) */
    venueDecision: async (id: string): Promise<PaperSubmissionResponse> => {
        const response = await api.post(`${BASE}/${id}/venue-decision`);
        return response.data.data || response.data;
    },

    /** Manually change status */
    changeStatus: async (id: string, newStatus: SubmissionStatus): Promise<PaperSubmissionResponse> => {
        const response = await api.patch(`${BASE}/${id}/status`, { newStatus });
        return response.data.data || response.data;
    },
};
