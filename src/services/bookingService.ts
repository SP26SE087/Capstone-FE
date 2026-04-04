import api from './api';
import { Booking, CreateBookingRequest, UpdateBookingRequest, PaginatedResponse } from '@/types/booking';

// Re-export for backward compatibility with existing feature components
export type BookingResponse = Booking;

export const bookingService = {
  getAll: async (pageIndex = 1, pageSize = 50): Promise<PaginatedResponse<Booking>> => {
    const response = await api.get('/api/bookings', {
      params: { pageIndex, pageSize }
    });
    const data = response.data.data || response.data;
    
    const normalize = (item: any) => ({ ...item, id: item.id || item.bookingId });

    if (Array.isArray(data)) {
      const items = data.map(normalize);
      return { items, totalCount: items.length, pageIndex: 1, pageSize: items.length, totalPages: 1 };
    }
    
    if (data.items && Array.isArray(data.items)) {
      data.items = data.items.map(normalize);
    } else if (data.data && Array.isArray(data.data)) {
      data.items = data.data.map(normalize);
    }
    
    return data;
  },

  getById: async (id: string): Promise<Booking> => {
    const response = await api.get(`/api/bookings/${id}`);
    const data = response.data.data || response.data;
    return { ...data, id: data.id || data.bookingId };
  },

  getManaged: async (pageIndex = 1, pageSize = 50): Promise<PaginatedResponse<Booking>> => {
    const response = await api.get('/api/bookings/managed', {
      params: { pageIndex, pageSize }
    });
    const data = response.data.data || response.data;
    const normalize = (item: any) => ({ ...item, id: item.id || item.bookingId });
    if (Array.isArray(data)) {
      const items = data.map(normalize);
      return { items, totalCount: items.length, pageIndex: 1, pageSize: items.length, totalPages: 1 };
    }
    if (data.items && Array.isArray(data.items)) {
      data.items = data.items.map(normalize);
    }
    return data;
  },

  getToday: async (pageIndex = 1, pageSize = 50): Promise<PaginatedResponse<Booking>> => {
    const response = await api.get('/api/bookings/today', {
      params: { pageIndex, pageSize }
    });
    const data = response.data.data || response.data;
    
    const normalize = (item: any) => ({ ...item, id: item.id || item.bookingId });
    
    if (Array.isArray(data)) {
      const items = data.map(normalize);
      return { items, totalCount: items.length, pageIndex: 1, pageSize: items.length, totalPages: 1 };
    }
    
    if (data.items && Array.isArray(data.items)) {
      data.items = data.items.map(normalize);
    }
    
    return data;
  },

  getMyUpcoming: async (): Promise<Booking[]> => {
    const response = await api.get('/api/bookings/my/upcoming');
    const data = response.data.data || response.data;
    const array = Array.isArray(data) ? data : (data.items || []);
    return array.map((item: any) => ({ ...item, id: item.id || item.bookingId }));
  },

  getMyHistory: async (pageIndex = 1, pageSize = 50): Promise<PaginatedResponse<Booking>> => {
    const response = await api.get('/api/bookings/my/history', {
      params: { pageIndex, pageSize }
    });
    const data = response.data.data || response.data;
    
    const normalize = (item: any) => ({ ...item, id: item.id || item.bookingId });
    
    if (Array.isArray(data)) {
      const items = data.map(normalize);
      return { items, totalCount: items.length, pageIndex: 1, pageSize: items.length, totalPages: 1 };
    }
    
    if (data.items && Array.isArray(data.items)) {
      data.items = data.items.map(normalize);
    }
    
    return data;
  },

  create: async (request: CreateBookingRequest): Promise<Booking> => {
    const response = await api.post('/api/bookings', request);
    const data = response.data.data || response.data;
    return { ...data, id: data.id || data.bookingId };
  },

  update: async (id: string, request: UpdateBookingRequest): Promise<Booking> => {
    const response = await api.put(`/api/bookings/${id}`, {
      bookingId: id,
      ...request
    });
    const data = response.data.data || response.data;
    return { ...data, id: data.id || data.bookingId };
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
