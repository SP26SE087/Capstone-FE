export enum SystemRoleEnum {
    Admin = 1,
    LabDirector = 2,
    SeniorResearcher = 3,
    Member = 4,
    Guest = 5
}

export const SystemRoleMap: Record<number | string, string> = {
    [SystemRoleEnum.Admin]: 'Admin',
    [SystemRoleEnum.LabDirector]: 'Lab Director',
    [SystemRoleEnum.SeniorResearcher]: 'Senior Researcher',
    [SystemRoleEnum.Member]: 'Member',
    [SystemRoleEnum.Guest]: 'Guest',
    'Admin': 'Admin',
    'LabDirector': 'Lab Director',
    'SeniorResearcher': 'Senior Researcher',
    'Member': 'Member',
    'Guest': 'Guest'
};
