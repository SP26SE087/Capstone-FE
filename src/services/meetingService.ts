import api from './api';
import {
    MeetingResponse,
    CreateMeetingRequest,
    UpdateMeetingRequest,
    UpdateMeetingDetailsRequest
} from '@/types/meeting';

const meetingService = {
    // Create a new meeting
    createMeeting: async (data: CreateMeetingRequest): Promise<MeetingResponse> => {
        try {
            const response = await api.post('/api/Meetings', data);
            return response.data;
        } catch (error) {
            console.error('Error creating meeting:', error);
            throw error;
        }
    },

    // Get meeting by event ID
    getMeetingById: async (eventId: string): Promise<MeetingResponse> => {
        try {
            const response = await api.get(`/api/Meetings/${eventId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching meeting ${eventId}:`, error);
            throw error;
        }
    },

    // Update a meeting (calendar event)
    updateMeeting: async (eventId: string, data: UpdateMeetingRequest): Promise<MeetingResponse> => {
        try {
            const response = await api.put(`/api/Meetings/${eventId}`, data);
            return response.data;
        } catch (error) {
            console.error(`Error updating meeting ${eventId}:`, error);
            throw error;
        }
    },

    // Delete a meeting
    deleteMeeting: async (eventId: string): Promise<void> => {
        try {
            await api.delete(`/api/Meetings/${eventId}`);
        } catch (error) {
            console.error(`Error deleting meeting ${eventId}:`, error);
            throw error;
        }
    },

    // Get my meetings
    getMyMeetings: async (): Promise<MeetingResponse[]> => {
        try {
            const response = await api.get('/api/Meetings/me');
            return response.data;
        } catch (error) {
            console.error('Error fetching my meetings:', error);
            throw error;
        }
    },

    // Get meetings I'm invited to
    getMyInvitedMeetings: async (): Promise<MeetingResponse[]> => {
        try {
            const response = await api.get('/api/Meetings/me/invited');
            return response.data;
        } catch (error) {
            console.error('Error fetching my invited meetings:', error);
            throw error;
        }
    },

    // Semantic search across meetings
    searchMeetings: async (params: { query: string; topK?: number; projectId?: string }): Promise<MeetingResponse[]> => {
        try {
            const response = await api.post('/api/Meetings/search', params);
            return response.data?.data ?? response.data ?? [];
        } catch (error) {
            console.error('Error searching meetings:', error);
            throw error;
        }
    },

    // Ensure a meeting is indexed/embedded before semantic search
    ensureEmbedding: async (id: string): Promise<void> => {
        try {
            await api.post(`/api/Meetings/${id}/ensure-embedding`);
        } catch (error) {
            console.error(`Error ensuring embedding for meeting ${id}:`, error);
            throw error;
        }
    },

    // Update meeting details (agenda, notes, action items, etc.)
    updateMeetingDetails: async (eventId: string, data: UpdateMeetingDetailsRequest): Promise<MeetingResponse> => {
        try {
            const response = await api.put(`/api/Meetings/${eventId}/details`, data);
            return response.data;
        } catch (error) {
            console.error(`Error updating meeting details ${eventId}:`, error);
            throw error;
        }
    }
};

export default meetingService;
