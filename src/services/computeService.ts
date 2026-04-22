import api from './api';
import { ComputeTier, ComputeAccess, ComputeAccessStatus, ComputeBookingConfig } from '@/types/booking';

// Mock compute tiers for development - replace with actual API calls
const MOCK_TIERS: ComputeTier[] = [
  {
    id: 'tier-small',
    name: 'Starter',
    description: 'Perfect for small experiments and prototyping',
    gpuCount: 1,
    gpuModel: 'NVIDIA RTX 3080',
    cpuCores: 8,
    ramGB: 16,
    storageGB: 100,
    pricePerHour: 0.5,
    available: true,
    maxDurationHours: 24
  },
  {
    id: 'tier-medium',
    name: 'Professional',
    description: 'Ideal for medium-scale training and inference',
    gpuCount: 2,
    gpuModel: 'NVIDIA RTX 4090',
    cpuCores: 16,
    ramGB: 32,
    storageGB: 250,
    pricePerHour: 1.5,
    available: true,
    maxDurationHours: 72
  },
  {
    id: 'tier-large',
    name: 'Enterprise',
    description: 'High-performance for large model training',
    gpuCount: 4,
    gpuModel: 'NVIDIA A100 40GB',
    cpuCores: 32,
    ramGB: 64,
    storageGB: 500,
    pricePerHour: 4.0,
    available: true,
    maxDurationHours: 168
  },
  {
    id: 'tier-xlarge',
    name: 'Research',
    description: 'Maximum compute for cutting-edge research',
    gpuCount: 8,
    gpuModel: 'NVIDIA A100 80GB',
    cpuCores: 64,
    ramGB: 128,
    storageGB: 1000,
    pricePerHour: 10.0,
    available: false,
    maxDurationHours: 336
  }
];

// Mock compute access for development
const mockComputeAccesses = new Map<string, ComputeAccess>();

export const computeService = {
  /**
   * Get available compute tiers
   */
  getTiers: async (): Promise<ComputeTier[]> => {
    try {
      const response = await api.get('/api/compute/tiers');
      return response.data.data || response.data;
    } catch {
      // Return mock data for development
      return MOCK_TIERS;
    }
  },

  /**
   * Get a specific tier by ID
   */
  getTierById: async (tierId: string): Promise<ComputeTier | null> => {
    try {
      const response = await api.get(`/api/compute/tiers/${tierId}`);
      return response.data.data || response.data;
    } catch {
      return MOCK_TIERS.find(t => t.id === tierId) || null;
    }
  },

  /**
   * Get compute access status for a booking
   */
  getAccessByBookingId: async (bookingId: string): Promise<ComputeAccess | null> => {
    try {
      const response = await api.get(`/api/compute/access/booking/${bookingId}`);
      return response.data.data || response.data;
    } catch {
      // Return mock data for development
      const mockAccess = mockComputeAccesses.get(bookingId);
      if (mockAccess) return mockAccess;
      
      // Create a mock access for demo purposes
      const newMockAccess: ComputeAccess = {
        id: `access-${bookingId}`,
        bookingId,
        tierId: 'tier-medium',
        tierName: 'Professional',
        status: ComputeAccessStatus.Ready,
        terminalUrl: `wss://terminal.example.com/ws/${bookingId}`,
        containerIp: '10.0.1.42',
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        gpuUtilization: 45,
        memoryUsage: 62
      };
      mockComputeAccesses.set(bookingId, newMockAccess);
      return newMockAccess;
    }
  },

  /**
   * Request compute access for a booking
   */
  requestAccess: async (bookingId: string, config: ComputeBookingConfig): Promise<ComputeAccess> => {
    try {
      const response = await api.post(`/api/compute/access`, {
        bookingId,
        ...config
      });
      return response.data.data || response.data;
    } catch {
      // Mock response for development
      const tier = MOCK_TIERS.find(t => t.id === config.tierId);
      const mockAccess: ComputeAccess = {
        id: `access-${bookingId}`,
        bookingId,
        tierId: config.tierId,
        tierName: tier?.name || 'Unknown',
        status: ComputeAccessStatus.Provisioning,
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (tier?.maxDurationHours || 24) * 60 * 60 * 1000).toISOString()
      };
      mockComputeAccesses.set(bookingId, mockAccess);
      return mockAccess;
    }
  },

  /**
   * Get terminal WebSocket token for secure connection
   */
  getTerminalToken: async (accessId: string): Promise<{ token: string; wsUrl: string }> => {
    try {
      const response = await api.post(`/api/compute/access/${accessId}/terminal-token`);
      return response.data.data || response.data;
    } catch {
      // Mock response for development
      return {
        token: `mock-token-${accessId}-${Date.now()}`,
        wsUrl: `wss://terminal.example.com/ws/${accessId}`
      };
    }
  },

  /**
   * Start a stopped compute instance
   */
  startInstance: async (accessId: string): Promise<ComputeAccess> => {
    try {
      const response = await api.post(`/api/compute/access/${accessId}/start`);
      return response.data.data || response.data;
    } catch {
      // Find and update mock access
      for (const [bookingId, access] of mockComputeAccesses) {
        if (access.id === accessId) {
          access.status = ComputeAccessStatus.Running;
          access.terminalUrl = `wss://terminal.example.com/ws/${bookingId}`;
          return access;
        }
      }
      throw new Error('Access not found');
    }
  },

  /**
   * Stop a running compute instance
   */
  stopInstance: async (accessId: string): Promise<ComputeAccess> => {
    try {
      const response = await api.post(`/api/compute/access/${accessId}/stop`);
      return response.data.data || response.data;
    } catch {
      // Find and update mock access
      for (const [, access] of mockComputeAccesses) {
        if (access.id === accessId) {
          access.status = ComputeAccessStatus.Stopped;
          access.terminalUrl = undefined;
          return access;
        }
      }
      throw new Error('Access not found');
    }
  },

  /**
   * Terminate and cleanup compute instance
   */
  terminateInstance: async (accessId: string): Promise<void> => {
    try {
      await api.delete(`/api/compute/access/${accessId}`);
    } catch {
      // Remove from mock storage
      for (const [bookingId, access] of mockComputeAccesses) {
        if (access.id === accessId) {
          mockComputeAccesses.delete(bookingId);
          return;
        }
      }
    }
  },

  /**
   * Get real-time metrics for a compute instance
   */
  getMetrics: async (accessId: string): Promise<{ gpuUtilization: number; memoryUsage: number; cpuUsage: number }> => {
    try {
      const response = await api.get(`/api/compute/access/${accessId}/metrics`);
      return response.data.data || response.data;
    } catch {
      // Return mock metrics
      return {
        gpuUtilization: Math.floor(Math.random() * 100),
        memoryUsage: Math.floor(Math.random() * 100),
        cpuUsage: Math.floor(Math.random() * 100)
      };
    }
  }
};
