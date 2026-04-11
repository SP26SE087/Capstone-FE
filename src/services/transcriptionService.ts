import api from './api';

export interface TranscriptionModel {
    id: string | null;
    name: string | null;
    description: string | null;
}

export interface TranscriptionSegment {
    startTime: number;
    endTime: number;
    text: string | null;
    language: string | null;
    confidence: number | null;
    startTimeFormatted: string | null;
    endTimeFormatted: string | null;
}

export interface TranscriptionResponse {
    id: string;
    meetingId: string;
    fileName: string | null;
    language: string | null;
    transcribedText: string | null;
    durationInSeconds: number;
    status: string | null;
    errorMessage: string | null;
    confidence: number | null;
    createdAt: string;
    completedAt: string | null;
    segments: TranscriptionSegment[] | null;
    summary: string | null;
    summarizedAt: string | null;
}

export interface TranscriptionMeetingListItemResponse {
    id: string;
    meetingId: string;
    fileName: string | null;
    language: string | null;
    status: string | null;
    confidence: number | null;
    createdAt: string;
    completedAt: string | null;
}

export interface SummaryResponse {
    transcriptionId: string;
    summary: string | null;
    success: boolean;
    errorMessage: string | null;
    inputTokens: number;
    outputTokens: number;
    generatedAt: string;
}

export interface TaskSuggestion {
    name: string;
    description?: string;
    priority?: number;
    status?: number;
    estimatedHours?: number;
    startDate?: string | null;
    dueDate?: string | null;
    assigneeEmail?: string;
    assigneeId?: string;
    milestoneId?: string;
    tags?: string[];
    [key: string]: any;
}

export const transcriptionService = {
    getModels: async (): Promise<TranscriptionModel[]> => {
        try {
            const res = await api.get('/api/Transcriptions/models');
            const data = res.data;
            return data?.models || data || [];
        } catch (err) {
            console.error('Failed to fetch transcription models:', err);
            return [];
        }
    },

    getAll: async (): Promise<TranscriptionResponse[]> => {
        try {
            const res = await api.get('/api/Transcriptions');
            return Array.isArray(res.data) ? res.data : [];
        } catch (err) {
            console.error('Failed to fetch transcriptions:', err);
            return [];
        }
    },

    getById: async (id: string): Promise<TranscriptionResponse | null> => {
        try {
            const res = await api.get(`/api/Transcriptions/${id}`);
            return res.data;
        } catch (err) {
            console.error('Failed to fetch transcription:', err);
            return null;
        }
    },

    getByMeeting: async (meetingId: string): Promise<TranscriptionMeetingListItemResponse[]> => {
        try {
            const res = await api.get(`/api/Transcriptions/meetings/${meetingId}`);
            return Array.isArray(res.data) ? res.data : [];
        } catch (err) {
            console.error('Failed to fetch meeting transcriptions:', err);
            return [];
        }
    },

    transcribe: async (file: File, meetingId?: string, model?: string, language?: string): Promise<TranscriptionResponse> => {
        const formData = new FormData();
        formData.append('file', file);
        const params: Record<string, string> = {};
        if (meetingId) params.meetingId = meetingId;
        if (model) params.model = model;
        if (language) params.language = language;
        const res = await api.post('/api/Transcriptions', formData, {
            params,
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 300000
        });
        return res.data;
    },

    summarize: async (id: string, opts?: { model?: string; language?: string; length?: string; style?: string; customPrompt?: string }): Promise<SummaryResponse> => {
        const res = await api.put(`/api/Transcriptions/${id}/summary`, {
            model: opts?.model || null,
            language: opts?.language || 'vi',
            length: opts?.length || 'medium',
            style: opts?.style || 'formal',
            customPrompt: opts?.customPrompt || null
        }, { timeout: 300000 });
        return res.data;
    },

    suggestTasks: async (text: string, projectId?: string, milestoneId?: string, maxResults = 10): Promise<TaskSuggestion[]> => {
        const res = await api.post('/api/Transcriptions/api/tasks/suggest', {
            text,
            projectId: projectId || null,
            milestoneId: milestoneId || null,
            maxResults
        }, { timeout: 300000 });
        const data = res.data;
        return Array.isArray(data) ? data : (data?.suggestions || data?.tasks || data?.data || []);
    }
};
