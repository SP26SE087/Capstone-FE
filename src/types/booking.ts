export enum ResourceType {
  GPU = 1,
  Equipment = 2,
  Dataset = 3,
  LabStation = 4
}

export enum ResourceStatus {
  Available = 0,
  Maintenance = 1,
  Booked = 2,
  Damaged = 3
}

export interface Resource {
  id: string;
  name: string;
  description?: string;
  type: ResourceType;
  status?: ResourceStatus;
  location?: string;
  totalQuantity: number;
  availableQuantity: number;
  damagedQuantity: number;
  managedBy?: string;
  managerName?: string;
}

export interface Booking {
  id: string;
  resourceId: string;
  resourceName: string;
  userId: string;
  userName: string;
  title: string;
  purpose: string;
  startTime: string;
  endTime: string;
  quantity: number;
  status: BookingStatus;
  rejectReason?: string;
  cancelReason?: string;
  createdAt: string;
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
  resourceId: string;
  title: string;
  purpose: string;
  startTime: string;
  endTime: string;
  quantity: number;
}

export interface EquipmentLog {
  id: string;
  resourceId: string;
  resourceName: string;
  bookingId?: string;
  userId: string;
  userName: string;
  action: string;
  note?: string;
  loggedAt: string;
}
