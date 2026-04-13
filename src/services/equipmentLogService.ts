import api from './api';
import { EquipmentLog, AddEquipmentLogRequest, UpdateEquipmentLogRequest, PaginatedResponse } from '@/types/booking';

// Re-export for backward compatibility
export type { AddEquipmentLogRequest, UpdateEquipmentLogRequest } from '@/types/booking';

const BASE_URL = '/api/equipment-logs';

const normalize = (item: any): EquipmentLog => ({
  ...item,
  resourceName: item.resourceTitle || item.resourceName || '',
});

export const equipmentLogService = {
  getAll: async (pageIndex = 1, pageSize = 50): Promise<PaginatedResponse<EquipmentLog>> => {
    const response = await api.get(BASE_URL, {
      params: { pageIndex, pageSize }
    });
    const data = response.data.data || response.data;
    if (Array.isArray(data)) {
      const items = data.map(normalize);
      return { items, totalCount: items.length, pageIndex: 1, pageSize: items.length, totalPages: 1 };
    }
    // Handle .NET wrappers
    if (data.items) return { ...data, items: data.items.map(normalize) };
    const items = (data.value || data.result || []).map(normalize);
    return { items, totalCount: items.length, pageIndex: 1, pageSize: items.length, totalPages: 1 };
  },

  getById: async (id: string): Promise<EquipmentLog> => {
    const response = await api.get(`${BASE_URL}/${id}`);
    return normalize(response.data.data || response.data);
  },

  create: async (request: AddEquipmentLogRequest): Promise<EquipmentLog> => {
    const response = await api.post(BASE_URL, request);
    return response.data.data || response.data;
  },

  update: async (arg1: string | UpdateEquipmentLogRequest, arg2?: UpdateEquipmentLogRequest): Promise<EquipmentLog> => {
    // New API shape: PUT /api/equipment-logs with body (no logId path param)
    // Backward compatible: PUT /api/equipment-logs/{logId}
    if (typeof arg1 === 'string') {
      const response = await api.put(`${BASE_URL}/${arg1}`, arg2);
      return response.data.data || response.data;
    }

    const response = await api.put(BASE_URL, arg1);
    return response.data.data || response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_URL}/${id}`);
  }
};
