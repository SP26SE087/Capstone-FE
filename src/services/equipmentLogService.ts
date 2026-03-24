import api from './api';
import { EquipmentLog } from '@/types/booking';

export interface AddEquipmentLogRequest {
  resourceId: string;
  bookingId?: string | null;
  action: string;
  note?: string | null;
}

export interface EquipmentLogResponse extends EquipmentLog {
  userId: string;
  userName: string;
  createdAt: string;
}

const BASE_URL = '/api/equipment-logs';

export const equipmentLogService = {
  getAll: async (pageIndex: number = 1, pageSize: number = 50): Promise<EquipmentLogResponse[]> => {
    const response = await api.get(BASE_URL, {
      params: { pageIndex, pageSize }
    });
    // Support common .NET wrappers
    const data = response.data;
    return data.items || data.data || data.value || data.result || (Array.isArray(data) ? data : []);
  },

  getById: async (id: string): Promise<EquipmentLogResponse> => {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  create: async (request: AddEquipmentLogRequest): Promise<EquipmentLogResponse> => {
    const response = await api.post(BASE_URL, request);
    return response.data;
  },

  update: async (id: string, request: Partial<AddEquipmentLogRequest>): Promise<EquipmentLogResponse> => {
    const response = await api.put(`${BASE_URL}/${id}`, request);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_URL}/${id}`);
  }
};
