const cameraUrl = () =>
  (import.meta.env.VITE_FACE_SERVER_URL as string || '').replace(/\/$/, '');

const cameraHeaders = () => ({
  'X-Camera-Api-Key': import.meta.env.VITE_CAMERA_API_KEY as string,
  'Content-Type': 'application/json',
});

export interface GestureMapping {
  checkin: string | null;
  checkout: string | null;
}

export interface GestureConfig {
  mapping: GestureMapping;
  available: string[];
}

export const cameraService = {
  /** Get current gesture mapping (Lab Director only) */
  getGestures: async (): Promise<GestureConfig> => {
    const res = await fetch(`${cameraUrl()}/config/gestures`, {
      headers: cameraHeaders(),
    });
    if (!res.ok) throw new Error('Failed to get gestures');
    return res.json();
  },

  /** Update gesture mapping (Lab Director only) */
  setGestures: async (updates: { checkin?: string | null; checkout?: string | null }): Promise<GestureConfig> => {
    const res = await fetch(`${cameraUrl()}/config/gestures`, {
      method: 'POST',
      headers: cameraHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update gestures');
    return res.json();
  },

  /** Manually trigger visitor whitelist sync */
  syncVisitors: async (): Promise<any> => {
    const res = await fetch(`${cameraUrl()}/sync-visitors`, { method: 'POST' });
    return res.json();
  },
};
