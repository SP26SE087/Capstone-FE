import api, { API_BASE_URL } from './api';
import { ComputeTier } from '@/types/booking';

// Mock tiers — used by ComputeTierSelector until a real /api/resource-types endpoint is wired
const MOCK_TIERS: ComputeTier[] = [
  {
    id: 'tier-small', name: 'Starter', description: 'Perfect for small experiments',
    gpuCount: 1, gpuModel: 'NVIDIA RTX 3080', cpuCores: 8, ramGB: 16,
    storageGB: 100, pricePerHour: 0.5, available: true, maxDurationHours: 24
  },
  {
    id: 'tier-medium', name: 'Professional', description: 'Ideal for medium-scale training',
    gpuCount: 2, gpuModel: 'NVIDIA RTX 4090', cpuCores: 16, ramGB: 32,
    storageGB: 250, pricePerHour: 1.5, available: true, maxDurationHours: 72
  },
  {
    id: 'tier-large', name: 'Enterprise', description: 'High-performance large model training',
    gpuCount: 4, gpuModel: 'NVIDIA A100 40GB', cpuCores: 32, ramGB: 64,
    storageGB: 500, pricePerHour: 4.0, available: true, maxDurationHours: 168
  },
];

/** Status values returned by GET /api/server-access/bookings/{bookingId} */
export type ServerAccessStatus = 'Pending' | 'Provisioning' | 'Active' | 'Provisioned' | 'Expired' | 'Revoked';

export interface ServerAccess {
  bookingId: string;
  status: ServerAccessStatus;
  provisionedAt?: string;
  expiresAt?: string;
}

/** Build a wss:// URL from the API base URL (or explicit terminal WS base) */
function toWsUrl(path: string): string {
  const explicitBase = (import.meta.env.VITE_TERMINAL_WS_URL || '').trim();
  const base = (explicitBase || API_BASE_URL || '').replace(/\/$/, '');
  const wsBase = base.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
  return `${wsBase}${path}`;
}

export const computeService = {
  /** Keep mock tiers for ComputeTierSelector */
  getTiers: async (): Promise<ComputeTier[]> => {
    try {
      const response = await api.get('/api/compute/tiers');
      return response.data.data || response.data;
    } catch {
      return MOCK_TIERS;
    }
  },

  getTierById: async (tierId: string): Promise<ComputeTier | null> => {
    try {
      const response = await api.get(`/api/compute/tiers/${tierId}`);
      return response.data.data || response.data;
    } catch {
      return MOCK_TIERS.find(t => t.id === tierId) ?? null;
    }
  },

  /**
   * Submit access request — POST /api/server-access/bookings/{bookingId}
   * Call when user wants to access a provisioned compute server booking.
   */
  requestAccess: async (bookingId: string): Promise<ServerAccess> => {
    try {
      const response = await api.post(`/api/server-access/bookings/${bookingId}`, {});
      return response.data.data || response.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.title || err.message;
      throw new Error(msg || 'Request failed');
    }
  },

  /**
   * Get access status — GET /api/server-access/bookings/{bookingId}
   * Returns null when no access request exists (404).
   */
  getAccessStatus: async (bookingId: string): Promise<ServerAccess | null> => {
    try {
      const response = await api.get(`/api/server-access/bookings/${bookingId}`);
      return response.data.data || response.data;
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      throw err;
    }
  },

  /**
   * Get terminal WebSocket token — GET /api/terminal/bookings/{bookingId}/token
   * Response: { token, expiresAt } — wsUrl is constructed from API_BASE_URL.
   * Requires booking to be in Approved status.
   */
  getTerminalToken: async (bookingId: string): Promise<{ token: string; wsUrl: string; expiresAt?: string }> => {
    try {
      const response = await api.get(`/api/terminal/bookings/${bookingId}/token`);
      const data = response.data.data || response.data;
      // Backend returns { token, expiresAt } — construct wsUrl from base URL
      if (!data.wsUrl && data.token) {
        data.wsUrl = toWsUrl(`/api/terminal/connect?token=${encodeURIComponent(data.token)}`);
      }
      return data;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.title || err.message;
      throw new Error(msg || 'Failed to get terminal token');
    }
  },

  /**
   * Admin: provision SSH credentials — POST /api/server-access/bookings/{bookingId}/provision
   * SSH credentials are encrypted server-side; the frontend never receives them.
   */
  provisionAccess: async (bookingId: string): Promise<void> => {
    await api.post(`/api/server-access/bookings/${bookingId}/provision`, {});
  },

  /**
   * Admin: revoke access — POST /api/server-access/bookings/{bookingId}/revoke
   */
  revokeAccess: async (bookingId: string): Promise<void> => {
    await api.post(`/api/server-access/bookings/${bookingId}/revoke`, {});
  },
};
