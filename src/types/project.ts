export interface Project {
    id: string;
    projectName: string;
    projectDescription: string | null;
    startDate: string | null;
    endDate: string | null;
    status: ProjectStatus;
    researchFields: ResearchField[];
    members?: ProjectMember[];
    membersCount?: number;
    totalTasks?: number;
    completedTasks?: number;
    createdBy?: string;
    nameProjectCreator?: string;
    NameProjectCreator?: string;
    createdAt?: string;
    updatedAt?: string;
    projectRole?: number;
    roleName?: string;
    milestones?: any[];
    tasks?: any[];
}

export interface ProjectMember {
    id?: string;
    memberId?: string;
    userId: string;
    userName?: string;
    fullName?: string;
    email: string;
    phoneNumber?: string;
    projectRoleId?: string;
    projectRoleName?: string;
    projectRole?: number;
    roleName?: string;
    status?: MemberStatus;
}

export enum ProjectStatus {
    Active = 1,
    Inactive = 2,
    Archived = 3,
    Completed = 4
}

export enum MemberStatus {
    Active = 1,
    Inactive = 2,
    Banned = 3
}

export enum ProjectRoleEnum {
    LabDirector = 1,
    SeniorResearcher = 2,
    Member = 3,
    Leader = 4,
}

export enum ResearchFieldStatus {
    Active = 1,
    Inactive = 2
}

export interface ResearchField {
    id: string;
    name: string;
    description: string | null;
    status: ResearchFieldStatus;
}

