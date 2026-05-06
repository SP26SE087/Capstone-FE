export enum VisitorRegistrationStatus {
    Pending = 0,
    Approved = 1,
    Rejected = 2,
}

export enum AssigneeTransferRequestStatus {
    Pending = 0,
    Accepted = 1,
    Rejected = 2,
}

export interface VisitorRegistrationLogResponse {
    id: string;
    actionType: string;
    actorEmail: string;
    fromAssigneeEmail: string | null;
    toAssigneeEmail: string | null;
    reason: string | null;
    activeFrom: string | null;
    activeUntil: string | null;
    occurredAt: string;
}

export interface VisitorRegistrationResponse {
    id: string;
    fullName: string;
    email: string;
    photoUrl: string;
    cccdImageUrl: string;
    contactEmail: string;
    appointmentDateTime: string;
    status: VisitorRegistrationStatus;
    assigneeId: string;
    assigneeEmail: string;
    assigneeFullName: string;
    isAssignee: boolean | null;
    labAccess: boolean;
    phoneNumber: string | null;
    notes: string | null;
    reason: string | null;
    activeFrom: string | null;
    activeUntil: string | null;
    createdAt: string;
    logs: VisitorRegistrationLogResponse[];
}

export interface UpdateVisitorRegistrationStatusRequest {
    status: 1 | 2;
    reason?: string;
    activeFrom?: string;
    durationHours?: number;
}

export interface TransferRequest {
    toAssigneeEmail: string;
}

export interface RespondTransferRequest {
    accept: boolean;
    reason?: string;
}

export interface AssigneeTransferRequestResponse {
    id: string;
    registrationId: string;
    fromAssigneeEmail: string;
    toAssigneeEmail: string;
    status: AssigneeTransferRequestStatus;
    reason: string | null;
    createdAt: string;
    processedAt: string | null;
}

export interface ContactorResponse {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    createdAt: string;
}

export interface CreateContactorRequest {
    fullName: string;
    email: string;
    phone: string;
}

export interface UpdateContactorRequest {
    fullName: string;
    phone: string;
}
