// ============================================
// Meeting (Schedules) Types
// ============================================

export interface AttendeeResponse {
    id: string;
    email: string | null;
    displayName: string | null;
    responseStatus: AttendeeResponseStatus;
}

export enum AttendeeResponseStatus {
    NeedsAction = 0,
    Declined = 1,
    Tentative = 2,
    Accepted = 3
}

export interface PresenterInfo {
    email: string | null;
    name: string | null;
    topic: string | null;
}

export interface ActionItem {
    description: string | null;
    assigneeEmail: string | null;
    dueDate: string | null;
    isCompleted: boolean;
}

export interface MeetingResource {
    title: string | null;
    url: string | null;
    description: string | null;
}

export enum MeetingStatus {
    Scheduled = 0,
    InProgress = 1,
    Completed = 2,
    Cancelled = 3
}

export interface MeetingResponse {
    id: string;
    title: string | null;
    description: string | null;
    startTime: string;
    endTime: string;
    googleCalendarEventId: string | null;
    googleMeetLink: string | null;
    projectId: string | null;
    createdBy: string;
    createdByEmail: string | null;
    createdAt: string;
    status: MeetingStatus;
    attendees: AttendeeResponse[] | null;
    currentPresenter: PresenterInfo | null;
    recordingUrl: string | null;
}

export interface CreateMeetingRequest {
    title: string | null;
    description: string | null;
    startTime: string;
    endTime: string;
    projectId: string | null;
    attendeeEmails: string[] | null;
}

export interface UpdateMeetingRequest {
    title: string | null;
    description: string | null;
    startTime: string | null;
    endTime: string | null;
    attendeeEmails: string[] | null;
    status?: MeetingStatus;
}

export interface UpdateMeetingDetailsRequest {
    title: string | null;
    description: string | null;
    startTime: string | null;
    endTime: string | null;
    attendeeEmails: string[] | null;
    agendaItems: string[] | null;
    resources: MeetingResource[] | null;
    notes: string | null;
    actionItems: ActionItem[] | null;
    presenter: PresenterInfo | null;
    location: string | null;
    status: MeetingStatus;
}
