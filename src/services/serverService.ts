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

export const serverService = {
  createServer: async (payload: CreateServerRequest): Promise<ServerResource> => {
    const response = await api.post('/api/resources/server', payload);
    return response.data.data || response.data;
  },
};
