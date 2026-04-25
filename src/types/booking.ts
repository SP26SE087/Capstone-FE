export enum ResourceType {
  GPU = 1,
  Equipment = 2,
  Dataset = 3,
  LabStation = 4,
  Compute = 5
}

export enum ResourceStatus {
  Available = 1,
  InUse = 2,
  Maintenance = 3,
  Retired = 4
}

export interface Resource {
  // Primary key - first id from ids array (normalized for internal use)
  id: string;
  // All unit IDs for this resource group (actual API field)
  ids: string[];
  name: string;
  description?: string;
  resourceTypeId?: string;
  resourceTypeName?: string;
  modelSeries?: string;
  type: ResourceType;
  status?: ResourceStatus;
  location?: string;
  // Normalized from API: total / availableCount / damagedCount
  totalQuantity: number;
  availableQuantity: number;
  availableIds?: string[];   // specific unit IDs that are currently available
  damagedQuantity: number;
  inUseCount?: number;
  isAvailable?: boolean;
  isDamaged?: boolean;
  isInUse?: boolean;
  // Serial numbers of each unit
  serials?: string[];
  managedBy?: string;
  managerName?: string;
  managerEmail?: string;
}

export interface BasicResourceResponse {
  id: string;
  name: string;
  resourceTypeId?: string;
  resourceTypeName?: string;
  resourceTypeCategory?: number; // 1 = Physical, 2 = ServerCompute
  status?: number;
  location?: string | null;
  modelSeries?: string;
  isAvailable?: boolean;
  isDamaged?: boolean;
  isInUse?: boolean;
}

export interface Booking {
  id: string;
  bookingId?: string;
  resourceId?: string;
  resourceName?: string;
  resourceIds?: string[];
  quantity?: number;
  userId?: string;
  userName?: string;
  userFullName?: string;
  userEmail?: string;
  // Manager fields (new)
  managerId?: string | null;
  managerFullName?: string;
  managerEmail?: string;
  title: string;
  purpose?: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  rejectReason?: string | null;
  cancelReason?: string | null;
  note?: string | null;
  adjustReason?: string | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedByEmail?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  isUrgent?: boolean;
  resources?: BasicResourceResponse[];
}

export enum BookingStatus {
  Pending = 1,
  Approved = 2,
  Rejected = 3,
  Cancelled = 4,
  Completed = 5,
  InUse = 6
}

export interface CreateBookingItem {
  resourceIds: string[];
}

export interface CreateBookingRequest {
  items: CreateBookingItem[];
  title: string;
  purpose: string;
  startTime: string;
  endTime: string;
  isUrgent?: boolean;
}

export interface ApproveBookingRequest {
  bookingId?: string;
  note?: string | null;
  newResourceIds?: string[] | null;
  adjustReason?: string | null;
}

export interface BulkApproveItem extends ApproveBookingRequest {
  bookingId: string;
}

export interface BulkApproveResult {
  bookingId: string;
  success: boolean;
  errorMessage: string | null;
  status: number | null;
}

export interface UpdateBookingRequest {
  title?: string;
  purpose?: string;
  startTime?: string;
  endTime?: string;
  resourceIds?: string[];
}

export interface CreateResourceRequest {
  name: string;
  description?: string;
  resourceTypeId: string;
  location?: string;
  managedByEmail: string;
  modelSeriesList: string[];
}

export interface UpdateResourceRequest {
  name?: string;
  description?: string;
  location?: string;
  modelSeries?: string;
  resourceTypeId?: string;
  isDamaged?: boolean;
  isInUse?: boolean;
}

export interface EquipmentLog {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceTitle?: string;
  resourceDescription?: string;
  bookingId?: string;
  bookingTitle?: string;
  bookingDescription?: string;
  // New fields (API v2)
  borrowerId?: string;
  borrowerFullName?: string;
  borrowerEmail?: string;
  checkedOutById?: string;
  checkedOutByFullName?: string;
  checkedOutByEmail?: string;
  // Legacy fields (kept for backward compat)
  userId?: string;
  userName?: string;
  userFullName?: string;
  userEmail?: string;
  action: EquipmentLogAction;
  note?: string;
  loggedAt: string;
  returnDeadline?: string;
}

export enum EquipmentLogAction {
  CheckIn = 1,
  CheckOut = 2
}

export interface AddEquipmentLogRequest {
  bookingId: string;
  action: EquipmentLogAction;
  note?: string;
}

export interface UpdateEquipmentLogRequest {
  resourceId: string;
  bookingId?: string;
  action: EquipmentLogAction;
  note?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  totalPages: number;
}

export interface BasicBookingResponse {
  bookingId: string;
  resourceName?: string;
  status: BookingStatus;
  startTime: string;
  endTime: string;
  userId?: string;
  managerId?: string | null;
  managerFullName?: string;
  managerEmail?: string;
}

// Compute/Server Resource Types
export interface ComputeTier {
  id: string;
  name: string;
  description: string;
  gpuCount: number;
  gpuModel: string;
  cpuCores: number;
  ramGB: number;
  storageGB: number;
  pricePerHour?: number;
  available: boolean;
  maxDurationHours: number;
}

export enum ComputeAccessStatus {
  Pending = 1,
  Provisioning = 2,
  Active = 3,
  Expired = 4,
  Revoked = 5,
}

export interface ComputeAccess {
  id: string;
  bookingId: string;
  tierId: string;
  tierName: string;
  status: ComputeAccessStatus;
  terminalUrl?: string;
  containerIp?: string;
  startedAt?: string;
  expiresAt?: string;
  gpuUtilization?: number;
  memoryUsage?: number;
  errorMessage?: string;
}

export interface ComputeBookingConfig {
  tierId: string;
  dockerImage?: string;
  environmentVariables?: Record<string, string>;
}
