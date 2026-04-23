import api from './api';

export enum ResourceTypeCategory {
  Physical = 1,
  ServerCompute = 2,
}

export interface ResourceTypeItem {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  category?: ResourceTypeCategory;
}

export const resourceTypeService = {
  getAll: async (): Promise<ResourceTypeItem[]> => {
    const response = await api.get('/api/resource-types');
    const data = response.data.data || response.data;
    return Array.isArray(data) ? data : (data.items || []);
  },

  create: async (name: string, description?: string, category?: ResourceTypeCategory): Promise<ResourceTypeItem> => {
    const response = await api.post('/api/resource-types', {
      name,
      description: description ?? null,
      isActive: true,
      category: category ?? ResourceTypeCategory.Physical,
    });
    return response.data.data || response.data;
  },

  update: async (id: string, payload: { name?: string; description?: string; isActive?: boolean; category?: ResourceTypeCategory }): Promise<ResourceTypeItem> => {
    const response = await api.put(`/api/resource-types/${id}`, { id, ...payload });
    return response.data.data || response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/resource-types/${id}`);
  }
};
