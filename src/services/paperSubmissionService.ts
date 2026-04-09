import api from './api';
import type {
    PaperSubmissionResponse,
    CreatePaperRequest,
    UpdatePaperRequest,
    SemanticSearchRequest,
    SubmissionStatus,
} from '@/types/paperSubmission';
import type { PagedResult } from '@/types/pagination';

const BASE = '/api/papersubmissions';

/** Build a FormData from create/update payload */
function buildFormData(data: CreatePaperRequest | UpdatePaperRequest, extra?: Record<string, string>): FormData {
    const fd = new FormData();
    if (data.projectId) fd.append('ProjectId', data.projectId);
    fd.append('Title', data.title);
    fd.append('Abstract', data.abstract ?? '');
    if (data.paperUrl) fd.append('PaperUrl', data.paperUrl);
    fd.append('ConferenceName', data.conferenceName ?? '');
    if (data.document instanceof File) {
        fd.append('Document', data.document, data.document.name);
    }
    if (data.documents) fd.append('Documents', data.documents);
    if (extra) Object.entries(extra).forEach(([k, v]) => v && fd.append(k, v));
    (data.members ?? []).forEach((m, i) => {
        fd.append(`Members[${i}][membershipId]`, m.membershipId);
        fd.append(`Members[${i}][role]`, String(m.role));
    });
    return fd;
}

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

    /** Semantic search across papers */
    search: async (params: SemanticSearchRequest): Promise<PaperSubmissionResponse[]> => {
        const response = await api.post(`${BASE}/search`, params);
        return response.data.data ?? response.data ?? [];
    },

    /** Get paper detail by ID */
    getById: async (id: string): Promise<PaperSubmissionResponse> => {
        const response = await api.get(`${BASE}/${id}`);
        return response.data.data || response.data;
    },

    /** Create a new paper (multipart/form-data) */
    create: async (data: CreatePaperRequest): Promise<PaperSubmissionResponse> => {
        const fd = buildFormData(data, {
            CreatedByMembershipId: data.createdByMembershipId ?? '',
        });
        const response = await api.post(BASE, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        return response.data.data || response.data;
    },

    /** Update an existing paper (multipart/form-data) */
    update: async (id: string, data: UpdatePaperRequest): Promise<PaperSubmissionResponse> => {
        try {
            const fd = buildFormData(data, {
                LastUpdatedByMembershipId: data.lastUpdatedByMembershipId ?? '',
            });
            const response = await api.put(`${BASE}/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
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

    /** Submit paper to venue (Approved → Submitted) */
    submitToVenue: async (id: string, paperUrl: string, targetStatus?: SubmissionStatus): Promise<PaperSubmissionResponse> => {
        const response = await api.post(`${BASE}/${id}/submit-venue`, { paperUrl, targetStatus });
        return response.data.data || response.data;
    },

    /** Mark as Revision Required (Submitted → Revision) */
    markRevision: async (id: string): Promise<PaperSubmissionResponse> => {
        const response = await api.post(`${BASE}/${id}/revision`);
        return response.data.data || response.data;
    },

    /** Record venue decision — uses changeStatus(Decision) since /venue-decision was removed */
    venueDecision: async (id: string): Promise<PaperSubmissionResponse> => {
        return paperSubmissionService.changeStatus(id, 6 as SubmissionStatus);
    },

    /** Manually change status */
    changeStatus: async (id: string, newStatus: SubmissionStatus): Promise<PaperSubmissionResponse> => {
        const response = await api.patch(`${BASE}/${id}/status`, { newStatus });
        return response.data.data || response.data;
    },
};
