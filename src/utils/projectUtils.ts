import { ProjectStatus } from '@/types';

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

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

export const isDefaultDate = (date: string | Date | null | undefined): boolean => {
    if (!date) return true;
    if (typeof date !== 'string') return false;
    return date.startsWith('0001-01-01');
};

export const formatProjectDate = (date: string | Date | null | undefined, fallback: string = 'N/A'): string => {
    if (isDefaultDate(date)) return fallback;
    try {
        const d = new Date(date!);
        if (isNaN(d.getTime())) return fallback;
        return d.toLocaleDateString('vi-VN', { timeZone: VIETNAM_TIME_ZONE });
    } catch {
        return fallback;
    }
};

export const getVietnamDateInputValue = (date: Date = new Date()): string => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: VIETNAM_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);

    const year = parts.find(part => part.type === 'year')?.value ?? '';
    const month = parts.find(part => part.type === 'month')?.value ?? '';
    const day = parts.find(part => part.type === 'day')?.value ?? '';

    return `${year}-${month}-${day}`;
};

export const toApiDate = (dateStr: string | null | undefined): string | null => {
    if (!dateStr || dateStr === '') return null;
    try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [year, month, day] = dateStr.split('-').map(Number);
            if (!year || !month || !day) return null;

            return new Date(Date.UTC(year, month - 1, day, 23, 59, 59)).toISOString();
        }

        const d = new Date(dateStr);
        if (isNaN(d.getTime()) || d.getFullYear() <= 1) return null;
        return d.toISOString();
    } catch {
        return null;
    }
};
