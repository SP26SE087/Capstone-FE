export enum VisitorRegistrationStatus {
    Pending = 0,
    Approved = 1,
    Rejected = 2,
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
    createdAt: string;
}

export interface CreateVisitorRegistrationRequest {
    FullName: string;
    Email: string;
    ContactEmail: string;
    AppointmentDateTime: string; // ISO 8601 UTC
    photo: File;
    cccdImage: File;
}

export interface UpdateVisitorRegistrationStatusRequest {
    status: 1 | 2; // 1 = Approved, 2 = Rejected
    reason?: string;
}
