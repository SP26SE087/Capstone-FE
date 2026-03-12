export interface Milestone {
    id: string;
    name: string;
    description: string | null;
    startDate: string;
    dueDate: string;
    status: MilestoneStatus;
    progress?: number;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
    tasks?: Task[];
}

import { Task } from './task';

export enum MilestoneStatus {
    NotStarted = 0,
    InProgress = 1,
    Completed = 2,
    OnHold = 3,
    Cancelled = 4
}
