import { ProjectStatus } from '@/types';

export interface StatusStyle {
    bg: string;
    color: string;
    label: string;
}

export const getProjectStatusStyle = (status: ProjectStatus): StatusStyle => {
    switch (status) {
        case ProjectStatus.Active:
            return {
                bg: '#ecfdf5', // Light Green
                color: '#10b981', // Darker Green
                label: 'Active'
            };
        case ProjectStatus.Inactive:
            return {
                bg: '#fff3e0', // Light Orange
                color: '#f57c00', // Darker Orange
                label: 'Inactive'
            };
        case ProjectStatus.Archived:
            return {
                bg: '#f3f4f6', // Light Gray
                color: '#6b7280', // Gray
                label: 'Archived'
            };

        case ProjectStatus.Completed:
            return {
                bg: '#eff6ff', // Light Blue
                color: '#3b82f6', // Darker Blue
                label: 'Completed'
            };
        default:
            return {
                bg: '#f1f5f9',
                color: '#64748b',
                label: 'Unknown'
            };
    }
};
