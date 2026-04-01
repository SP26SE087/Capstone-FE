import api from './api';
import { EquipmentLog, AddEquipmentLogRequest, UpdateEquipmentLogRequest, PaginatedResponse } from '@/types/booking';

// Re-export for backward compatibility
export type { AddEquipmentLogRequest, UpdateEquipmentLogRequest } from '@/types/booking';

const BASE_URL = '/api/equipment-logs';

export const equipmentLogService = {
  getAll: async (pageIndex = 1, pageSize = 50): Promise<PaginatedResponse<EquipmentLog>> => {
    const response = await api.get(BASE_URL, {
      params: { pageIndex, pageSize }
    });
    const data = response.data.data || response.data;
    if (Array.isArray(data)) {
      return { items: data, totalCount: data.length, pageIndex: 1, pageSize: data.length, totalPages: 1 };
    }
    // Handle .NET wrappers
    if (data.items) return data;
    const items = data.value || data.result || [];
    return { items, totalCount: items.length, pageIndex: 1, pageSize: items.length, totalPages: 1 };
  },

  getById: async (id: string): Promise<EquipmentLog> => {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data.data || response.data;
  },

  create: async (request: AddEquipmentLogRequest): Promise<EquipmentLog> => {
    const response = await api.post(BASE_URL, request);
    return response.data.data || response.data;
  },

  update: async (id: string, request: UpdateEquipmentLogRequest): Promise<EquipmentLog> => {
    const response = await api.put(`${BASE_URL}/${id}`, request);
    return response.data.data || response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_URL}/${id}`);
  }
};
