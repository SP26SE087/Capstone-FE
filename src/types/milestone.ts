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
