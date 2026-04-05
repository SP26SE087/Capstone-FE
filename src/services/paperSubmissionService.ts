import api from './api';
import type {
    PaperSubmissionResponse,
    CreatePaperRequest,
    UpdatePaperRequest,
    SubmissionStatus,
} from '@/types/paperSubmission';
import type { PagedResult } from '@/types/pagination';

const BASE = '/api/papersubmissions';

export const paperSubmissionService = {
    /** Get paged papers — optionally filter by projectId */
    getAll: async (params?: { projectId?: string; pageIndex?: number; pageSize?: number }): Promise<PagedResult<PaperSubmissionResponse>> => {
        const response = await api.get(BASE, { params });
        const data = response.data.data || response.data;
        return {
            items: data.items ?? data.Items ?? [],
            totalCount: data.totalCount ?? data.TotalCount ?? 0,
            pageIndex: data.pageIndex ?? data.PageIndex ?? params?.pageIndex ?? 1,
            pageSize: data.pageSize ?? data.PageSize ?? params?.pageSize ?? 10,
            totalPages: data.totalPages ?? data.TotalPages
        };
    },

    /** Get paper detail by ID */
    getById: async (id: string): Promise<PaperSubmissionResponse> => {
        const response = await api.get(`${BASE}/${id}`);
        return response.data.data || response.data;
    },

    /** Create a new paper */
    create: async (data: CreatePaperRequest, file?: File): Promise<PaperSubmissionResponse> => {
        const formData = new FormData();
        if (data.projectId) formData.append('ProjectId', data.projectId);
        formData.append('Title', data.title);
        formData.append('Abstract', data.abstract || '');
        formData.append('ConferenceName', data.conferenceName || '');
        formData.append('PaperUrl', data.paperUrl || '');
        if (data.submissionDeadline) formData.append('SubmissionDeadline', data.submissionDeadline);
        
        if (file) {
            formData.append('Document', file);
        }

        data.members?.forEach((m, index) => {
            formData.append(`Members[${index}].MembershipId`, m.membershipId);
            formData.append(`Members[${index}].Role`, m.role.toString());
        });

        const response = await api.post(BASE, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data.data || response.data;
    },

    /** Update an existing paper */
    update: async (id: string, data: UpdatePaperRequest, file?: File): Promise<PaperSubmissionResponse> => {
        try {
            const formData = new FormData();
            if (data.projectId) formData.append('ProjectId', data.projectId);
            formData.append('Title', data.title);
            formData.append('Abstract', data.abstract || '');
            formData.append('ConferenceName', data.conferenceName || '');
            formData.append('PaperUrl', data.paperUrl || '');
            if (data.submissionDeadline) formData.append('SubmissionDeadline', data.submissionDeadline);
            
            if (file) {
                formData.append('Document', file);
            }

            data.members?.forEach((m, index) => {
                formData.append(`Members[${index}].MembershipId`, m.membershipId);
                formData.append(`Members[${index}].Role`, m.role.toString());
            });

            const response = await api.put(`${BASE}/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data.data || response.data;
        } catch (error: any) {
            console.error('Update paper failed with:', error.response?.data);
            throw error;
        }
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

    /** Submit paper to venue (Approved → Submitted, or Submitted/Revision → Revision) */
    submitToVenue: async (id: string, paperUrl: string, targetStatus?: SubmissionStatus): Promise<PaperSubmissionResponse> => {
        const response = await api.post(`${BASE}/${id}/submit-venue`, { paperUrl, targetStatus });
        return response.data.data || response.data;
    },

    /** Manually change status */
    changeStatus: async (id: string, newStatus: SubmissionStatus): Promise<PaperSubmissionResponse> => {
        const response = await api.patch(`${BASE}/${id}/status`, { newStatus });
        return response.data.data || response.data;
    },
};
