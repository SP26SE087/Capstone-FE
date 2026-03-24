import api from './api';
import { ResourceType } from '@/types/booking';

export interface CreateResourceRequest {
  name: string;
  description: string;
  type: ResourceType;
  location?: string | null;
  totalQuantity: number;
  damagedQuantity: number;
}

export interface ResourceResponse {
  id: string;
  name: string;
  description: string;
  type: ResourceType;
  status: number;
  location?: string;
  totalQuantity: number;
  damagedQuantity: number;
  inUseQuantity: number;
  availableQuantity: number;
  managedBy?: string;
  managerName?: string;
}

export const resourceService = {
  create: async (managedBy: string, request: CreateResourceRequest): Promise<ResourceResponse> => {
    // Write URL parameter explicitly to prevent issues with proxy query forwarding
    const response = await api.post(`/api/resources?managedBy=${encodeURIComponent(managedBy)}`, request);
    return response.data;
  },

  getAll: async (): Promise<ResourceResponse[]> => {
    const response = await api.get('/api/resources');
    return response.data.data || response.data;
  },

  getById: async (id: string): Promise<ResourceResponse> => {
    const response = await api.get(`/api/resources/${id}`);
    return response.data;
  },

  update: async (id: string, request: Partial<CreateResourceRequest>): Promise<ResourceResponse> => {
    const response = await api.put(`/api/resources/${id}`, request);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/resources/${id}`);
  }
};
