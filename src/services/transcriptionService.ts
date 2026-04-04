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
    estimatedHours?: number;
    assigneeEmail?: string;
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

    transcribe: async (file: File, model?: string, language?: string): Promise<TranscriptionResponse> => {
        const formData = new FormData();
        formData.append('file', file);
        const params: Record<string, string> = {};
        if (model) params.model = model;
        if (language) params.language = language;
        const res = await api.post('/api/Transcriptions', formData, {
            params,
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data;
    },

    summarize: async (id: string, opts?: { model?: string; language?: string; length?: string; style?: string; customPrompt?: string }): Promise<SummaryResponse> => {
        const res = await api.post(`/api/Transcriptions/${id}/summary`, {
            model: opts?.model || null,
            language: opts?.language || null,
            length: opts?.length || null,
            style: opts?.style || null,
            customPrompt: opts?.customPrompt || null
        });
        return res.data;
    },

    suggestTasks: async (text: string, projectId?: string, milestoneId?: string, maxResults = 10): Promise<TaskSuggestion[]> => {
        const res = await api.post('/api/tasks/suggest', {
            text,
            projectId: projectId || null,
            milestoneId: milestoneId || null,
            maxResults
        });
        const data = res.data;
        return Array.isArray(data) ? data : (data?.suggestions || data?.tasks || data?.data || []);
    }
};
