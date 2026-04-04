export enum ResourceType {
  GPU = 1,
  Equipment = 2,
  Dataset = 3,
  LabStation = 4
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
  damagedQuantity: number;
  inUseCount?: number;
  isAvailable?: boolean;
  isDamaged?: boolean;
  isInUse?: boolean;
  // Serial numbers of each unit
  serials?: string[];
  managedBy?: string;
  managerName?: string;
}

export interface Booking {
  id: string;
  bookingId?: string;
  resourceId?: string;
  resourceName?: string;
  resourceIds?: string[];
  userId: string;
  userName: string;
  userEmail?: string;
  title: string;
  purpose: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  rejectReason?: string;
  cancelReason?: string;
  note?: string;
  createdAt: string;
  resource?: {
    id: string;
    name?: string;
    resourceTypeId?: string;
    resourceTypeName?: string;
    status?: number;
    location?: string | null;
    modelSeries?: string;
    isAvailable?: boolean;
    isDamaged?: boolean;
    isInUse?: boolean;
  };
  resources?: { id: string; name: string; type: ResourceType }[];
}

export enum BookingStatus {
  Pending = 1,
  Approved = 2,
  Rejected = 3,
  Cancelled = 4,
  Completed = 5,
  InUse = 6
}

export interface CreateBookingRequest {
  resourceIds: string[];
  title: string;
  purpose: string;
  startTime: string;
  endTime: string;
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
  managedBy: string;
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
  bookingId?: string;
  userId: string;
  userName: string;
  action: EquipmentLogAction;
  note?: string;
  loggedAt: string;
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
