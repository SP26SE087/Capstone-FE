export interface Task {
    id: string;
    name: string;
    description: string | null;
    priority: Priority;
    status: TaskStatus;
    startDate: string | null;
    dueDate: string | null;
    projectId?: string;
    members?: TaskMember[];
    tagIds?: string[];
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

export enum Priority {
    Low = 1,
    Medium = 2,
    High = 3,
    Urgent = 4
}

export enum TaskStatus {
    Todo = 1,
    InProgress = 2,
    InReview = 3,
    Completed = 5,
    OnHold = 6,
    Cancelled = 7,
    Overdue = 8
}

export interface TaskMember {
    id: string;
    userName: string;
}
