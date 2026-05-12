// ============================================
// Seminar Types
// ============================================

import { PresenterInfo } from './meeting';

export enum DateOfWeek {
    Sunday = 0,
    Monday = 1,
    Tuesday = 2,
    Wednesday = 3,
    Thursday = 4,
    Friday = 5,
    Saturday = 6
}

export enum SeminarSwapRequestStatus {
    PendingTarget = 1,
    RejectedByTarget = 2,
    PendingOrganizer = 3,
    RejectedByOrganizer = 4,
    Approved = 5,
    Cancelled = 6,
    Expired = 7
}

export interface ScheduledSessionResponse {
    weekNumber: number;
    sessionDate: string;
    presenter: PresenterInfo | null;
    topic: string | null;
    googleCalendarEventId: string | null;
    googleMeetLink: string | null;
}

export interface RecurringSeminarResponse {
    seminarSeriesId: string;
    title: string | null;
    sessions: ScheduledSessionResponse[] | null;
    presenterRotation: PresenterInfo[] | null;
}

export interface SeminarSlot {
    dayOfWeek: number; // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
    startTime: string; // "HH:mm"
    durationMinutes: number;
}

export interface CreateRecurringSeminarRequest {
    title: string;
    description: string | null;
    seriesStartDate: string; // "YYYY-MM-DD"
    numberOfWeeks: number;
    slots: SeminarSlot[];
    presenters: PresenterInfo[] | null;
}

export interface SeminarPresenter {
    name: string;
    email: string;
    topic: string | null;
}

export interface SeminarMeetingResponse {
    seminarMeetingId: string;
    seminarId: string;
    title: string | null;
    description: string | null;
    location: string | null;
    meetingDate: string;
    startTime: string;
    endTime: string;
    googleCalendarEventId: string | null;
    meetingLink: string | null;
    recordingLink: string | null;
    slideUrl: string | null;
    presenterId: string;
    presenter: SeminarPresenter | null;
    attendeeCount: number;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string | null;
}

export interface UpdateSeminarMeetingRequest {
    title: string | null;
    description: string | null;
    location: string | null;
    slideUrl: string | null;
    file?: File | null;
}

export interface CreateSeminarSwapRequest {
    sourceSeminarMeetingId: string;
    targetSeminarMeetingId: string;
    reason: string | null;
    expiresAtUtc: string | null;
}

export interface RespondSeminarSwapRequest {
    accept: boolean;
    note: string | null;
}

export interface SeminarSwapRequestResponse {
    swapRequestId: string;
    seminarId: string;
    sourceSeminarMeetingId: string;
    targetSeminarMeetingId: string;
    requestedByUserId: string;
    targetUserId: string;
    reason: string | null;
    status: string | null;
    requestedAt: string;
    respondedAt: string | null;
    decidedAt: string | null;
    decidedByUserId: string | null;
    responseNote: string | null;
    expiresAtUtc: string | null;
}

export interface SeminarAttendee {
    attendeeId: string;
    userId: string;
    seminarMeetingId: string;
    isPresent: boolean;
}

export interface Seminar {
    seminarId: string;
    title: string | null;
    description: string | null;
    dayOfWeek: DateOfWeek;
    duration: number;
    totalWeek: number;
    startDate: string;
    endDate: string;
    createdAt: string;
    createdBy: string;
    isPublic: boolean;
    attendees: SeminarAttendee[] | null;
}
