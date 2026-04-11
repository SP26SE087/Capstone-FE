import api from './api';
import {
    RecurringSeminarResponse,
    CreateRecurringSeminarRequest,
    Seminar,
    SeminarMeetingResponse,
    UpdateSeminarMeetingRequest,
    SeminarSwapRequestResponse,
    CreateSeminarSwapRequest,
    RespondSeminarSwapRequest
} from '@/types/seminar';

const seminarService = {
    // ===== Recurring Seminars =====

    // Create a recurring seminar series
    createRecurringSeminar: async (data: CreateRecurringSeminarRequest): Promise<RecurringSeminarResponse> => {
        try {
            const response = await api.post('/api/Seminars/recurring', data);
            return response.data;
        } catch (error) {
            console.error('Error creating recurring seminar:', error);
            throw error;
        }
    },

    // ===== Seminar Meetings =====

    // Get all seminar meetings
    getAllSeminarMeetings: async (): Promise<SeminarMeetingResponse[]> => {
        try {
            const response = await api.get('/api/Seminars/meetings');
            return response.data;
        } catch (error) {
            console.error('Error fetching all seminar meetings:', error);
            throw error;
        }
    },

    // Get my seminar meetings
    getMySeminarMeetings: async (): Promise<SeminarMeetingResponse[]> => {
        try {
            const response = await api.get('/api/Seminars/meetings/me');
            return response.data;
        } catch (error) {
            console.error('Error fetching my seminar meetings:', error);
            throw error;
        }
    },

    // Get seminars I'm invited to
    getMyInvitedSeminars: async (): Promise<Seminar[]> => {
        try {
            const response = await api.get('/api/Seminars/me/invited');
            return response.data;
        } catch (error) {
            console.error('Error fetching my invited seminars:', error);
            throw error;
        }
    },

    // Get seminar meetings I'm invited to
    getInvitedSeminarMeetings: async (): Promise<SeminarMeetingResponse[]> => {
        try {
            const response = await api.get('/api/Seminars/meetings/invited');
            return response.data;
        } catch (error) {
            console.error('Error fetching invited seminar meetings:', error);
            throw error;
        }
    },

    // Update a seminar meeting
    updateSeminarMeeting: async (seminarMeetingId: string, data: UpdateSeminarMeetingRequest): Promise<SeminarMeetingResponse> => {
        const formData = new FormData();
        if (data.title != null) formData.append('Title', data.title);
        if (data.description != null) formData.append('Description', data.description);
        if (data.location != null) formData.append('Location', data.location);
        if (data.slideUrl != null) formData.append('SlideUrl', data.slideUrl);
        if (data.file) formData.append('File', data.file);
        try {
            const response = await api.put(`/api/Seminars/meetings/${seminarMeetingId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    // ===== Swap Requests =====

    // Create a swap request
    createSwapRequest: async (data: CreateSeminarSwapRequest): Promise<SeminarSwapRequestResponse> => {
        try {
            const response = await api.post('/api/Seminars/swaps', data);
            return response.data;
        } catch (error) {
            console.error('Error creating swap request:', error);
            throw error;
        }
    },

    // Get my swap requests
    getMySwapRequests: async (): Promise<SeminarSwapRequestResponse[]> => {
        try {
            const response = await api.get('/api/Seminars/swaps/me');
            return response.data;
        } catch (error) {
            console.error('Error fetching my swap requests:', error);
            throw error;
        }
    },

    // Respond to a swap request
    respondToSwapRequest: async (swapRequestId: string, data: RespondSeminarSwapRequest): Promise<SeminarSwapRequestResponse> => {
        try {
            const response = await api.post(`/api/Seminars/swaps/${swapRequestId}/respond`, data);
            return response.data;
        } catch (error) {
            console.error(`Error responding to swap request ${swapRequestId}:`, error);
            throw error;
        }
    }
};

export default seminarService;
