import axios from 'axios';

import { setupInterceptors } from './api';

const reportApi = axios.create({
    baseURL: 'https://localhost:7262',
    headers: {
        'Content-Type': 'application/json',
    },
});

setupInterceptors(reportApi);

export interface Report {
    id: string;
    userId: string;
    projectId: string;
    milestoneId: string | null;
    title: string;
    description: string;
    goals: string;
    achievements: string;
    blockers: string;
    nextWeek: string;
    assigneeIds: string[] | null;
    assignees?: {
        id: string;
        email: string;
        fullName: string;
        role: number;
        isActive: boolean;
    }[];
    status: number;
    hasEmbedding?: boolean;
    submitedAt?: string;
    updateAt?: string;
}

export interface CreateReportRequest {
    userId: string;
    projectId?: string | null;
    milestoneId?: string | null;
    title: string;
    description?: string | null;
    goals: string;
    achievements: string;
    blockers: string;
    nextWeek: string;
    assigneeIds?: string[] | null;
}

export interface UpdateReportRequest {
    projectId?: string | null;
    milestoneId?: string | null;
    title?: string | null;
    description?: string | null;
    goals?: string | null;
    achievements?: string | null;
    blockers?: string | null;
    nextWeek?: string | null;
    status?: number;
    assigneeIds?: string[] | null;
}

export interface SemanticSearchRequest {
    query: string;
    topK: number;
    userId?: string;
    projectId?: string;
    milestoneId?: string;
    status?: number;
}

const reportService = {
    // Get all reports that the user has access to
    getAllReports: async () => {
        try {
            const response = await reportApi.get('/api/Reports');
            return response.data;
        } catch (error) {
            console.error('Error fetching all reports:', error);
            throw error;
        }
    },

    // Get reports for a specific user (using the new base endpoint)
    getReportsByUser: async (_userId: string) => {
        try {
            // Note: userId parameter is kept for compatibility but the endpoint is switched 
            // to /api/Reports as it now returns user-specific reports based on token.
            const response = await reportApi.get('/api/Reports');
            return response.data;
        } catch (error) {
            console.error(`Error fetching reports:`, error);
            throw error;
        }
    },

    // Get my owned reports
    getMyReports: async () => {
        try {
            const response = await reportApi.get('/api/Reports/me');
            return response.data;
        } catch (error) {
            console.error('Error fetching my reports:', error);
            throw error;
        }
    },

    // Get reports assigned to me
    getAssignedReports: async () => {
        try {
            const response = await reportApi.get('/api/Reports/me/assigned');
            return response.data;
        } catch (error) {
            console.error('Error fetching assigned reports:', error);
            throw error;
        }
    },

    // Ensure a report is indexed/embedded
    ensureEmbedding: async (id: string) => {
        try {
            const response = await reportApi.post(`/api/Reports/${id}/ensure-embedding`);
            return response.data;
        } catch (error) {
            console.error(`Error ensuring embedding for report ${id}:`, error);
            throw error;
        }
    },

    // Search reports
    searchReports: async (searchReq: SemanticSearchRequest) => {
        try {
            const response = await reportApi.post('/api/Reports/search', searchReq);
            return response.data;
        } catch (error) {
            console.error('Error searching reports:', error);
            throw error;
        }
    },

    // Create a new report
    createReport: async (reportData: CreateReportRequest) => {
        try {
            const response = await reportApi.post('/api/Reports', reportData);
            return response.data;
        } catch (error) {
            console.error('Error creating report:', error);
            throw error;
        }
    },

    // Update an existing report
    updateReport: async (id: string, reportData: UpdateReportRequest) => {
        try {
            const response = await reportApi.put(`/api/Reports/${id}`, reportData);
            return response.data;
        } catch (error) {
            console.error(`Error updating report ${id}:`, error);
            throw error;
        }
    },

    // Update report status
    updateReportStatus: async (id: string, status: number) => {
        try {
            const response = await reportApi.patch(`/api/Reports/${id}/status`, status, {
                headers: { 'Content-Type': 'application/json' }
            });
            return response.data;
        } catch (error) {
            console.error(`Error updating report status ${id}:`, error);
            throw error;
        }
    },

    // Get a single report by ID
    getReportById: async (id: string) => {
        try {
            const response = await reportApi.get(`/api/Reports/${id}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching report ${id}:`, error);
            throw error;
        }
    },

    // Delete a report
    deleteReport: async (id: string) => {
        try {
            const response = await reportApi.delete(`/api/Reports/${id}`);
            return response.data;
        } catch (error) {
            console.error(`Error deleting report ${id}:`, error);
            throw error;
        }
    }
};

export default reportService;
