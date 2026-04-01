import api from './api';
import { Resource, CreateResourceRequest, UpdateResourceRequest, PaginatedResponse } from '@/types/booking';

// Re-export for backward compatibility
export type { CreateResourceRequest, UpdateResourceRequest } from '@/types/booking';

/**
 * Normalize raw API response (which uses 'ids', 'total', 'availableCount', 'damagedCount', 'serials')
 * into our internal Resource shape (which uses 'id', 'totalQuantity', 'availableQuantity', etc.)
 */
const normalize = (item: any): Resource => ({
  id: item.ids?.[0] || item.id || item.resourceId || '',
  ids: item.ids || (item.id ? [item.id] : item.resourceId ? [item.resourceId] : []),
  name: item.name || '',
  description: item.description,
  type: item.type,
  status: item.status,
  location: item.location,
  totalQuantity: item.total ?? item.totalQuantity ?? 0,
  availableQuantity: item.availableCount ?? item.availableQuantity ?? 0,
  damagedQuantity: item.damagedCount ?? item.damagedQuantity ?? 0,
  inUseCount: item.inUseCount ?? item.inUseQuantity ?? 0,
  isAvailable: item.isAvailable ?? (item.availableCount ?? item.availableQuantity ?? 0) > 0,
  isDamaged: item.isDamaged ?? false,
  isInUse: item.isInUse ?? false,
  serials: item.serials || [],
  managedBy: item.managedBy,
  managerName: item.managerName
});

export const resourceService = {
  getAll: async (pageIndex = 1, pageSize = 50): Promise<PaginatedResponse<Resource>> => {
    const response = await api.get('/api/resources', {
      params: { pageIndex, pageSize }
    });
    const data = response.data.data || response.data;
    if (Array.isArray(data)) {
      const items = data.map(normalize);
      return { items, totalCount: items.length, pageIndex: 1, pageSize: items.length, totalPages: 1 };
    }
    if (data.items && Array.isArray(data.items)) {
      return { ...data, items: data.items.map(normalize) };
    }
    return { items: [], totalCount: 0, pageIndex: 1, pageSize: 0, totalPages: 0 };
  },

  getById: async (id: string): Promise<Resource> => {
    const response = await api.get(`/api/resources/${id}`);
    const data = response.data.data || response.data;
    return normalize(data);
  },

  getByName: async (name: string, bookingDate?: string): Promise<Resource[]> => {
    const response = await api.get('/api/resources/by-name', {
      params: { name, bookingDate }
    });
    const data = response.data.data || response.data;
    const array = Array.isArray(data) ? data : (data.items || [data]);
    return array.map(normalize);
  },

  create: async (request: CreateResourceRequest): Promise<Resource> => {
    // managedBy is a query param per the API spec
    const { managedBy, ...body } = request;
    const url = managedBy ? `/api/resources?managedBy=${encodeURIComponent(managedBy)}` : '/api/resources';
    const response = await api.post(url, body);
    const data = response.data.data || response.data;
    return normalize(data);
  },

  update: async (id: string, request: UpdateResourceRequest): Promise<Resource> => {
    const response = await api.put(`/api/resources/${id}`, request);
    const data = response.data.data || response.data;
    return normalize(data);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/resources/${id}`);
  },

  assignManager: async (resourceId: string, managerId: string): Promise<void> => {
    await api.put(`/api/resources/${resourceId}/assign`, { managerId });
  }
};
