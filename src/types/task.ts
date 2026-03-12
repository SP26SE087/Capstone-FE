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
    members?: TaskMember[];
    tagIds?: string[];
    createdBy?: string;
    createdAt?: string;
    createdDate?: string; // Often comes as 'createdDate' in the new response
    updatedAt?: string;
    updatedDate?: string; // Often comes as 'updatedDate' in the new response
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
    Approved = 4,
    Rejected = 5,
    Completed = 6
}

export interface TaskMember {
    id: string;
    userName: string;
}
