import api from './api';
import { Booking, BasicBookingResponse, CreateBookingRequest, UpdateBookingRequest, ApproveBookingRequest, BulkApproveItem, BulkApproveResult, PaginatedResponse } from '@/types/booking';

const PAGE_SIZE_MAX = 200;

/**
 * Fetches every page of a paginated endpoint and returns all items merged.
 * Uses pageSize=200 (the server maximum) and auto-advances until all pages
 * are retrieved, so callers never have to guess a large pageSize.
 */
async function fetchAllPages<T>(
  fetcher: (pageIndex: number, pageSize: number) => Promise<PaginatedResponse<T>>,
): Promise<T[]> {
  const first = await fetcher(1, PAGE_SIZE_MAX);
  const items: T[] = [...(first.items ?? [])];
  const totalPages = first.totalPages ?? Math.ceil((first.totalCount ?? items.length) / PAGE_SIZE_MAX);
  for (let page = 2; page <= totalPages; page++) {
    const next = await fetcher(page, PAGE_SIZE_MAX);
    items.push(...(next.items ?? []));
  }
  return items;
}

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

  create: async (request: CreateBookingRequest): Promise<Booking[]> => {
    const response = await api.post('/api/bookings', request);
    const data = response.data.data || response.data;
    const arr: any[] = Array.isArray(data) ? data : [data];
    return arr.map((item: any) => ({ ...item, id: item.id || item.bookingId }));
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

  approve: async (id: string, request?: ApproveBookingRequest): Promise<void> => {
    await api.put(`/api/bookings/${id}/approve`, {
      bookingId: id,
      ...request
    });
  },

  bulkApprove: async (items: BulkApproveItem[]): Promise<BulkApproveResult[]> => {
    const response = await api.post('/api/bookings/bulk-approve', { items });
    return response.data.data || response.data;
  },

  reject: async (id: string, rejectReason: string): Promise<void> => {
    await api.put(`/api/bookings/${id}/reject`, {
      bookingId: id,
      rejectReason
    });
  },

  checkIn: async (bookingId: string, note?: string): Promise<void> => {
    await api.post('/api/equipment-logs', { bookingId, action: 2, note: note || undefined });
  },

  checkOut: async (bookingId: string, resourceId: string, note?: string): Promise<void> => {
    await api.put('/api/equipment-logs', { resourceId, bookingId, action: 1, note: note || undefined });
  },

  /** Fetch ALL bookings across every page (auto-paginated, max 200/page). */
  getAllPages: (): Promise<Booking[]> =>
    fetchAllPages((p, s) => bookingService.getAll(p, s)),

  /** Fetch ALL managed bookings across every page (auto-paginated, max 200/page). */
  getManagedAllPages: (): Promise<Booking[]> =>
    fetchAllPages((p, s) => bookingService.getManaged(p, s)),

  /** Fetch ALL history bookings across every page (auto-paginated, max 200/page). */
  getMyHistoryAllPages: (): Promise<Booking[]> =>
    fetchAllPages((p, s) => bookingService.getMyHistory(p, s)),

  /**
   * GET /api/bookings/by-user
   * email = undefined → history of the currently authenticated user (from JWT)
   * email = "..." → history of the user with that email (any role can view)
   */
  getByUser: async (email?: string, pageIndex = 1, pageSize = 10): Promise<PaginatedResponse<BasicBookingResponse>> => {
    const params: Record<string, string | number> = { pageIndex, pageSize };
    if (email) params.email = email;
    const response = await api.get('/api/bookings/by-user', { params });
    const data = response.data.data || response.data;
    const normalize = (item: any): BasicBookingResponse => ({
      ...item,
      bookingId: item.bookingId || item.id,
    });
    if (Array.isArray(data)) {
      const items = data.map(normalize);
      return { items, totalCount: items.length, pageIndex: 1, pageSize: items.length, totalPages: 1 };
    }
    if (data.items && Array.isArray(data.items)) {
      data.items = data.items.map(normalize);
    }
    return data;
  },

  /**
   * GET /api/bookings/by-resource/{resourceId}
   * Returns paginated booking history for a specific resource unit.
   * Sorted by CreatedAt desc (server-side).
   */
  getByResource: async (resourceId: string, pageIndex = 1, pageSize = 10): Promise<PaginatedResponse<BasicBookingResponse>> => {
    const response = await api.get(`/api/bookings/by-resource/${resourceId}`, {
      params: { pageIndex, pageSize },
    });
    const data = response.data.data || response.data;
    const normalize = (item: any): BasicBookingResponse => ({
      ...item,
      bookingId: item.bookingId || item.id,
    });
    if (Array.isArray(data)) {
      const items = data.map(normalize);
      return { items, totalCount: items.length, pageIndex: 1, pageSize: items.length, totalPages: 1 };
    }
    if (data.items && Array.isArray(data.items)) {
      data.items = data.items.map(normalize);
    }
    return data;
  },
};
