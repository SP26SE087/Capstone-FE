import api from './api';
import { CreateBookingRequest, BookingStatus } from '@/types/booking';

export interface BookingResponse {
  id: string;
  resourceId: string;
  resourceName: string;
  userId: string;
  userName: string;
  title: string;
  purpose: string;
  startTime: string;
  endTime: string;
  quantity: number;
  status: BookingStatus;
  rejectReason?: string;
  cancelReason?: string;
  createdAt: string;
}

export interface PaginatedBookingResponse {
  items: BookingResponse[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  totalPages: number;
}

export const bookingService = {
  getAll: async (pageIndex = 1, pageSize = 50): Promise<PaginatedBookingResponse> => {
    const response = await api.get('/api/bookings', {
      params: { pageIndex, pageSize }
    });
    return response.data.data || response.data;
  },

  getById: async (id: string): Promise<BookingResponse> => {
    const response = await api.get(`/api/bookings/${id}`);
    return response.data.data || response.data;
  },

  getMyUpcoming: async (): Promise<BookingResponse[]> => {
    const response = await api.get('/api/bookings/my/upcoming');
    // For "upcoming", it might return a list directly or wrapped in data
    return response.data.data || response.data;
  },

  getMyHistory: async (pageIndex = 1, pageSize = 50): Promise<PaginatedBookingResponse> => {
    const response = await api.get('/api/bookings/my/history', {
      params: { pageIndex, pageSize }
    });
    return response.data.data || response.data;
  },

  create: async (request: CreateBookingRequest): Promise<BookingResponse> => {
    const response = await api.post('/api/bookings', request);
    return response.data.data || response.data;
  },

  update: async (id: string, request: Partial<CreateBookingRequest>): Promise<BookingResponse> => {
    const response = await api.put(`/api/bookings/${id}`, {
      bookingId: id,
      ...request
    });
    return response.data.data || response.data;
  },

  cancel: async (id: string, cancelReason?: string): Promise<void> => {
    await api.put(`/api/bookings/${id}/cancel`, {
      bookingId: id,
      cancelReason
    });
  },

  approve: async (id: string, note?: string): Promise<void> => {
    await api.put(`/api/bookings/${id}/approve`, {
      bookingId: id,
      note
    });
  },

  reject: async (id: string, rejectReason: string): Promise<void> => {
    await api.put(`/api/bookings/${id}/reject`, {
      bookingId: id,
      rejectReason
    });
  }
};
