// ---- Enums (match BE CommonLibs.Common.Models.Enums) ----

export enum SubmissionStatus {
    Draft = 1,
    InternalReview = 2,
    Approved = 3,
    Submitted = 4,
    Revision = 5,
    Decision = 6,
    Rejected = 7,
}

export const SubmissionStatusLabel: Record<SubmissionStatus, string> = {
    [SubmissionStatus.Draft]: 'Draft',
    [SubmissionStatus.InternalReview]: 'Internal Review',
    [SubmissionStatus.Approved]: 'Approved',
    [SubmissionStatus.Submitted]: 'Submitted',
    [SubmissionStatus.Revision]: 'Revision Required',
    [SubmissionStatus.Decision]: 'Decision',
    [SubmissionStatus.Rejected]: 'Rejected',
};

export enum PaperRoleEnum {
    FirstAuthor = 1,
    CoAuthor = 2,
    Reviewer = 3,
    Supervisor = 4,
}

export const PaperRoleLabel: Record<PaperRoleEnum, string> = {
    [PaperRoleEnum.FirstAuthor]: 'First Author',
    [PaperRoleEnum.CoAuthor]: 'Co-Author',
    [PaperRoleEnum.Reviewer]: 'Reviewer',
    [PaperRoleEnum.Supervisor]: 'Supervisor',
};

// ---- Response DTOs ----

export interface PaperMemberResponse {
    paperMemberId: string;
    membershipId: string;
    role: PaperRoleEnum;
}

export interface ExternalUserResponse {
    externalUserId: string;
    email?: string | null;
    fullName?: string | null;
    avatarUrl?: string | null;
    phoneNumber?: string | null;
    studentId?: string | null;
    orcid?: string | null;
    googleScholarUrl?: string | null;
    githubUrl?: string | null;
    isActive: boolean;
    createdAt: string;
}

export interface PaperSubmissionResponse {
    paperSubmissionId: string;
    projectId?: string | null;
    title: string;
    abstract: string;
    status: SubmissionStatus;
    conferenceName: string;
    paperUrl: string;
    document?: string | null;
    documents?: string | null;
    submissionDeadline: string | null;
    createdAt: string;
    updatedAt: string;
    createdByMembershipId?: string | null;
    lastUpdatedByMembershipId?: string | null;
    editable: boolean;
    members: PaperMemberResponse[];
    externalUsers?: ExternalUserResponse[] | null;
}

// ---- Request DTOs ----

export interface PaperMemberRequest {
    membershipId: string;
    role: PaperRoleEnum;
}

export interface ExternalUserCreateDto {
    email?: string | null;
    fullName?: string | null;
    avatarUrl?: string | null;
    phoneNumber?: string | null;
    studentId?: string | null;
    orcid?: string | null;
    googleScholarUrl?: string | null;
    githubUrl?: string | null;
    isActive?: boolean;
}

export interface ExternalUserUpdateDto {
    email?: string | null;
    fullName?: string | null;
    avatarUrl?: string | null;
    phoneNumber?: string | null;
    studentId?: string | null;
    orcid?: string | null;
    googleScholarUrl?: string | null;
    githubUrl?: string | null;
    isActive?: boolean;
}

export interface CreatePaperRequest {
    projectId?: string | null;
    title: string;
    abstract: string;
    paperUrl?: string;
    document?: File | string | null;
    documents?: string;
    conferenceName: string;
    submissionDeadline: string | null;
    createdByMembershipId?: string | null;
    members: PaperMemberRequest[];
    externalUsers?: ExternalUserCreateDto[];
}

export interface UpdatePaperRequest {
    projectId?: string | null;
    title: string;
    abstract: string;
    paperUrl?: string;
    document?: File | string | null;
    documents?: string;
    conferenceName: string;
    submissionDeadline: string | null;
    lastUpdatedByMembershipId?: string | null;
    members: PaperMemberRequest[];
}

export interface SemanticSearchRequest {
    query: string;
    topK?: number;
    projectId?: string | null;
}

export interface SubmitToVenueRequest {
    paperUrl?: string | null;
    targetStatus?: SubmissionStatus;
}
