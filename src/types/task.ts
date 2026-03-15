export interface Task {
    id: string;
    name: string;
    description: string | null;
    priority: Priority;
    status: TaskStatus;
    startDate: string | null;
    dueDate: string | null;
    projectId?: string;
    milestoneId?: string | null;
    memberId?: string; // Appears in the new response
    member?: any; // To store full details of primary assignee
    members?: TaskMember[];
    tagIds?: string[];
    createdBy?: string;
    createdAt?: string;
    createdDate?: string; // Often comes as 'createdDate' in the new response
    updatedAt?: string;
    updatedDate?: string;
    assignedToName?: string;
    projectName?: string;
}

export enum Priority {
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4
}

export enum TaskStatus {
    Todo = 1,
    InProgress = 2,
    Submitted = 3,
    Missed = 4,
    Adjusting = 5,
    Completed = 6
}

export interface TaskMember {
    id: string; // TaskMember association ID
    memberId?: string;
    membershipId?: string;
    userId?: string;
    userName?: string;
    fullName?: string;
    email?: string;
    projectRoleName?: string;
    roleName?: string;
    avatar?: string;
    avatarUrl?: string;
}

export interface TaskEvidence {
    id: number;
    taskId: string;
    fileUrl: string;
    fileName: string;
    submittedAt: string;
    // Keep these as optional fallbacks for safety
    url?: string;
    name?: string;
    createdDate?: string;
}
