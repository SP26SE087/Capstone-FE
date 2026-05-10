const cameraBaseUrl = () =>
  ((import.meta.env.VITE_FACE_SERVER_URL as string) || 'http://localhost:8000').replace(/\/$/, '');

const jsonHeaders = () => ({
  'Content-Type': 'application/json',
});

const gesturePostHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Camera-Api-Key': (import.meta.env.VITE_CAMERA_API_KEY as string) || '',
});

const parseResponseOrThrow = async <T>(res: Response, fallbackMessage: string): Promise<T> => {
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message = payload?.message || payload?.error || (
      res.status === 530
        ? 'Camera gateway returned HTTP 530. The camera backend or gateway is unavailable.'
        : `${fallbackMessage} (HTTP ${res.status})`
    );
    throw new Error(message);
  }

  return payload as T;
};

export type CameraActivityType =
  | 'checkin'
  | 'checkout'
  | 'unknown'
  | 'registered'
  | 'face_saved'
  | 'face_deleted'
  | 'face_cleared';

export interface CameraLogEvent {
  time: string;
  type: CameraActivityType;
  student_id: string;
  photo_url?: string;
}

export interface GestureMapping {
  checkin: string | null;
  checkout: string | null;
}

export interface GestureConfig {
  mapping: GestureMapping;
  available: string[];
}

export interface WhitelistPassItem {
  id: string;
  full_name: string;
  photo_url: string;
  active_from: string;
  active_until: string;
}

export type WhitelistByDate = Record<string, WhitelistPassItem[]>;

export interface DetectedFaceItem {
  filename: string;
  label: 'detected' | 'unknown';
  timestamp: string;
  url: string;
  public_id: string;
}

export interface DetectedFaceResponse {
  total: number;
  offset: number;
  limit: number;
  faces: DetectedFaceItem[];
}

export interface GestureUpdatePayload {
  checkin: string | null;
  checkout: string | null;
}

export type FaceLabelFilter = 'detected' | 'unknown';

export const cameraService = {
  getVideoFeedUrl: (): string => `${cameraBaseUrl()}/video_feed`,

  getLogsStreamUrl: (): string => `${cameraBaseUrl()}/logs/stream`,

  getGestures: async (): Promise<GestureConfig> => {
    const res = await fetch(`${cameraBaseUrl()}/config/gestures`);
    return parseResponseOrThrow<GestureConfig>(res, 'Failed to get gesture config');
  },

  setGestures: async (updates: GestureUpdatePayload): Promise<GestureConfig> => {
    const res = await fetch(`${cameraBaseUrl()}/config/gestures`, {
      method: 'POST',
      headers: gesturePostHeaders(),
      body: JSON.stringify(updates),
    });
    return parseResponseOrThrow<GestureConfig>(res, 'Failed to update gesture config');
  },

  getFaces: async (params?: { label?: FaceLabelFilter; limit?: number; offset?: number }): Promise<DetectedFaceResponse> => {
    const query = new URLSearchParams();
    if (params?.label) query.set('label', params.label);
    query.set('limit', String(params?.limit ?? 20));
    query.set('offset', String(params?.offset ?? 0));

    const res = await fetch(`${cameraBaseUrl()}/faces?${query.toString()}`);
    return parseResponseOrThrow<DetectedFaceResponse>(res, 'Failed to get detected faces');
  },

  deleteFace: async (filename: string): Promise<{ message?: string }> => {
    const res = await fetch(`${cameraBaseUrl()}/faces/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
    return parseResponseOrThrow<{ message?: string }>(res, 'Failed to delete face');
  },

  clearFaces: async (label?: FaceLabelFilter): Promise<{ message?: string }> => {
    const res = await fetch(`${cameraBaseUrl()}/faces/clear`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(label ? { label } : {}),
    });
    return parseResponseOrThrow<{ message?: string }>(res, 'Failed to clear faces');
  },

  startAddUser: async (userId: string): Promise<{ message?: string }> => {
    const res = await fetch(`${cameraBaseUrl()}/start_add_user`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ user_id: userId }),
    });
    return parseResponseOrThrow<{ message?: string }>(res, 'Failed to start adding user');
  },

  stopAddUser: async (): Promise<{ message?: string }> => {
    const res = await fetch(`${cameraBaseUrl()}/stop_add_user`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({}),
    });
    return parseResponseOrThrow<{ message?: string }>(res, 'Failed to stop adding user');
  },

  removeUser: async (userId: string): Promise<{ message?: string }> => {
    const res = await fetch(`${cameraBaseUrl()}/remove_user`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ user_id: userId }),
    });
    return parseResponseOrThrow<{ message?: string }>(res, 'Failed to remove user');
  },

  banUser: async (userId: string): Promise<{ message?: string }> => {
    const res = await fetch(`${cameraBaseUrl()}/ban_user`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ user_id: userId }),
    });
    return parseResponseOrThrow<{ message?: string }>(res, 'Failed to ban user');
  },

  unbanUser: async (userId: string): Promise<{ message?: string }> => {
    const res = await fetch(`${cameraBaseUrl()}/unban_user`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ user_id: userId }),
    });
    return parseResponseOrThrow<{ message?: string }>(res, 'Failed to unban user');
  },

  getWhitelist: async (): Promise<WhitelistByDate> => {
    const res = await fetch(`${cameraBaseUrl()}/whitelist`);
    return parseResponseOrThrow<WhitelistByDate>(res, 'Failed to load whitelist');
  },

  addWhitelistPass: async (payload: { image: File; date: string; fullName?: string }): Promise<{ message?: string }> => {
    const formData = new FormData();
    formData.append('image', payload.image);
    formData.append('date', payload.date);
    if (payload.fullName) {
      formData.append('full_name', payload.fullName);
    }

    const res = await fetch(`${cameraBaseUrl()}/whitelist/add`, {
      method: 'POST',
      body: formData,
    });
    return parseResponseOrThrow<{ message?: string }>(res, 'Failed to add whitelist pass');
  },

  deleteWhitelistPass: async (id: string): Promise<{ message?: string }> => {
    const res = await fetch(`${cameraBaseUrl()}/whitelist/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return parseResponseOrThrow<{ message?: string }>(res, 'Failed to delete whitelist pass');
  },

  clearWhitelist: async (date?: string): Promise<{ message?: string }> => {
    const res = await fetch(`${cameraBaseUrl()}/whitelist/clear`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(date ? { date } : {}),
    });
    return parseResponseOrThrow<{ message?: string }>(res, 'Failed to clear whitelist');
  },

  syncVisitors: async (): Promise<{ message?: string }> => {
    const res = await fetch(`${cameraBaseUrl()}/sync-visitors`, { method: 'POST' });
    return parseResponseOrThrow<{ message?: string }>(res, 'Failed to sync visitors');
  },
};
