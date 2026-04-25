import api from './api';

export interface CreateServerRequest {
  name: string;
  description?: string;
  resourceTypeId: string;
  location?: string;
  sshHost: string;
  sshPort?: number;
  sshUsername: string;
  sshPrivateKey: string;
  gpuCount?: number;
  cpuCores?: number;
  ramGb?: number;
  maxConcurrentUsers?: number;
  modelSeries?: string;
}

export interface ServerResource {
  id: string;
  name: string;
  description?: string;
  resourceTypeId: string;
  resourceTypeName?: string;
  location?: string;
  sshHost?: string;
  sshPort?: number;
  sshUsername?: string;
  gpuCount?: number;
  cpuCores?: number;
  ramGb?: number;
  maxConcurrentUsers?: number;
  modelSeries?: string;
  status?: string;
}

/** Full server detail returned by GET /api/resources/server/{id} */
export interface ServerResourceDetail {
  id: string;
  name: string;
  description?: string;
  resourceTypeId: string;
  resourceTypeName?: string;
  status: number;           // 0 = Available, 1 = Unavailable
  location?: string | null;
  modelSeries?: string | null;
  isAvailable: boolean;
  isDamaged: boolean;
  isInUse: boolean;
  managedBy?: string;
  managedByName?: string;
  managedByEmail?: string;
  sshHost?: string;
  sshPort?: number;
  sshUsername?: string;
  gpuCount?: number;
  cpuCores?: number;
  ramGb?: number;
  maxConcurrentUsers?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateServerRequest {
  name?: string;
  description?: string;
  resourceTypeId?: string;
  location?: string;
  sshHost?: string;
  sshPort?: number;
  sshUsername?: string;
  /** Để trống nếu không muốn thay đổi */
  sshPrivateKey?: string;
  gpuCount?: number;
  cpuCores?: number;
  ramGb?: number;
  maxConcurrentUsers?: number;
  modelSeries?: string;
}

export const serverService = {
  createServer: async (payload: CreateServerRequest): Promise<ServerResource> => {
    const response = await api.post('/api/resources/server', payload);
    return response.data.data || response.data;
  },

  getServerDetail: async (resourceId: string): Promise<ServerResourceDetail> => {
    const response = await api.get(`/api/resources/server/${resourceId}`);
    return response.data.data || response.data;
  },

  updateServer: async (resourceId: string, payload: UpdateServerRequest): Promise<ServerResource> => {
    const response = await api.put(`/api/resources/server/${resourceId}`, payload);
    return response.data.data || response.data;
  },
};
