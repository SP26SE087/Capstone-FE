export interface Project {
    id: string;
    projectName: string;
    projectDescription: string | null;
    status: ProjectStatus;
    researchFields: ResearchField[];
}

export enum ProjectStatus {
    Active = 1,
    Completed = 2,
    OnHold = 3,
    Cancelled = 4
}

export interface ResearchField {
    id: string;
    name: string;
    description: string | null;
}

export interface Task {
    id: string;
    name: string;
    description: string | null;
    priority: Priority;
    status: TaskStatus;
    startDate: string | null;
    dueDate: string | null;
    projectId: string;
    members: TaskMember[];
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
    Done = 4
}

export interface TaskMember {
    id: string;
    userName: string;
}

export interface Milestone {
    id: string;
    name: string;
    description: string | null;
    startDate: string;
    dueDate: string;
    status: MilestoneStatus;
}

export enum MilestoneStatus {
    Pending = 0,
    Active = 1,
    Completed = 2,
    Delayed = 3,
    Cancelled = 4
}
