import api from './api';
import { Resource, CreateResourceRequest, UpdateResourceRequest, PaginatedResponse } from '@/types/booking';

// Re-export for backward compatibility
export type { CreateResourceRequest, UpdateResourceRequest } from '@/types/booking';

/**
 * Normalize raw API response.
 * `ids` from the API is the array of all unit GUIDs for this resource group.
 * Some APIs return `availableCount` / `damagedCount` / `inUseCount` as arrays of unit GUIDs.
 * We normalize those to numeric counts for UI.
 */
const normalize = (item: any): Resource => {
  const ids: string[] = item.ids || (item.id ? [item.id] : item.resourceId ? [item.resourceId] : []);

  const toResourceType = (value: any): Resource['type'] => {
    if (typeof value === 'number') return value;
    const name = String(value || '').toLowerCase();
    if (name === 'gpu') return 1;
    if (name === 'equipment') return 2;
    if (name === 'dataset') return 3;
    if (name === 'labstation' || name === 'lab station') return 4;
    return 2;
  };

  const toCount = (value: any): number => {
    if (Array.isArray(value)) return value.length;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return 0;
  };

  const availableQuantity =
    Array.isArray(item.availableCount) ? item.availableCount.length :
    (typeof item.availableQuantity === 'number' ? item.availableQuantity : ids.length);

  const damagedQuantity =
    Array.isArray(item.damagedCount) ? item.damagedCount.length :
    (typeof item.damagedQuantity === 'number' ? item.damagedQuantity : toCount(item.damagedCount));

  const inUseCount =
    Array.isArray(item.inUseCount) ? item.inUseCount.length :
    (typeof item.inUseQuantity === 'number' ? item.inUseQuantity : toCount(item.inUseCount));

  const totalQuantity =
    (typeof item.total === 'number' ? item.total :
    (typeof item.totalQuantity === 'number' ? item.totalQuantity : ids.length));

  return {
    id: ids[0] || '',
    ids,
    name: item.name || '',
    description: item.description,
    resourceTypeId: item.resourceTypeId,
    resourceTypeName: item.resourceTypeName,
    modelSeries: item.modelSeries,
    type: (typeof item.type === 'number' ? item.type : toResourceType(item.resourceTypeName)),
    status: item.status,
    location: item.location,
    totalQuantity,
    availableQuantity,
    damagedQuantity,
    inUseCount,
    isAvailable: item.isAvailable ?? (availableQuantity > 0),
    isDamaged: item.isDamaged ?? false,
    isInUse: item.isInUse ?? false,
    serials: item.serials || [],
    managedBy: item.managedBy,
    managerName: item.managerName
  };
};

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

  getBySerial: async (serial: string): Promise<Resource> => {
    const response = await api.get('/api/resources/by-serial', {
      params: { serial }
    });
    const data = response.data.data || response.data;
    return normalize(data);
  },

  getManaged: async (pageIndex = 1, pageSize = 50): Promise<PaginatedResponse<Resource>> => {
    const response = await api.get('/api/resources/managed', {
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

  create: async (request: CreateResourceRequest): Promise<Resource> => {
    const response = await api.post('/api/resources', request);
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
