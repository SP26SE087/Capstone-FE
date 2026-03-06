export interface Project {
    id: string;
    projectName: string;
    projectDescription: string | null;
    startDate: string | null;
    endDate: string | null;
    status: ProjectStatus;
    researchFields: ResearchField[];
}

export enum ProjectStatus {
    Pending = 1,
    Active = 2,
    Suspended = 3,
    Completed = 4,
    Archived = 5
}

export interface ResearchField {
    id: string;
    name: string;
    description: string | null;
}
