import api from './api';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum PlanStatus {
  Draft = 0,
  PartiallyBooked = 1,
  FullyBooked = 2,
  Expired = 3,
}

export enum PlanItemStatus {
  Pending = 0,
  Booked = 1,
  Skipped = 2,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanWarningCode =
  | 'RESOURCE_TYPE_NOT_IN_SYSTEM'
  | 'ALL_RESOURCES_UNAVAILABLE'
  | 'NO_EQUIPMENT_NEEDED'
  | string;

export interface PlanWarning {
  code: PlanWarningCode;
  message: string;
  relatedTask: string | null;
  resourceTypeName: string | null;
}

export interface ProjectBookingPlanItemResponse {
  id: string;
  resourceId: string;
  resourceName: string;
  suggestedQuantity: number;
  suggestedStartDate: string;
  suggestedEndDate: string;
  note: string | null;
  relatedTask: string | null;
  bookingId: string | null;
  status: PlanItemStatus;
  hasManualBookingOverlap: boolean;
}

export interface ProjectBookingPlanResponse {
  id: string;
  projectId: string;
  generatedBy: string;
  generatedAt: string;
  status: PlanStatus;
  items: ProjectBookingPlanItemResponse[];
  /** Only populated immediately after POST /generate — always [] from GET */
  warnings: PlanWarning[];
}

export interface ManualPlanItemRequest {
  resourceId: string;
  suggestedQuantity: number;
  suggestedStartDate: string;
  suggestedEndDate: string;
  note?: string;
}

export interface CreateManualPlanRequest {
  items: ManualPlanItemRequest[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

const BASE = '/api/project-booking-plans';

export const projectBookingPlanService = {
  /** GET /api/project-booking-plans/by-project/{projectId} */
  getByProject: async (projectId: string): Promise<ProjectBookingPlanResponse | null> => {
    try {
      const res = await api.get(`${BASE}/by-project/${projectId}`);
      return res.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },

  /** POST /api/project-booking-plans/generate/{projectId} */
  generate: async (projectId: string): Promise<ProjectBookingPlanResponse> => {
    const res = await api.post(`${BASE}/generate/${projectId}`);
    return res.data;
  },

  /** POST /api/project-booking-plans/manual/{projectId} */
  createManual: async (
    projectId: string,
    body: CreateManualPlanRequest,
  ): Promise<ProjectBookingPlanResponse> => {
    const res = await api.post(`${BASE}/manual/${projectId}`, body);
    return res.data;
  },

  /** POST /api/project-booking-plans/{planId}/items/{itemId}/confirm */
  confirmItem: async (
    planId: string,
    itemId: string,
    body: { startDate: string; endDate: string },
  ): Promise<ProjectBookingPlanResponse> => {
    const res = await api.post(`${BASE}/${planId}/items/${itemId}/confirm`, body);
    return res.data;
  },

  /** POST /api/project-booking-plans/{planId}/items/{itemId}/skip */
  skipItem: async (
    planId: string,
    itemId: string,
  ): Promise<ProjectBookingPlanResponse> => {
    const res = await api.post(`${BASE}/${planId}/items/${itemId}/skip`);
    return res.data;
  },
};
