export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

export const getDaysRemaining = (dueDate: string): number => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export type UpcomingUrgencyLevel = 1 | 2 | 3;

export const getDaysUntilDate = (dateString: string): number | null => {
    const target = new Date(dateString);
    if (isNaN(target.getTime())) return null;

    const today = new Date();
    target.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export const getUpcomingUrgencyLevel = (dateString: string): UpcomingUrgencyLevel | null => {
    const daysUntil = getDaysUntilDate(dateString);
    if (daysUntil === 1 || daysUntil === 2 || daysUntil === 3) {
        return daysUntil;
    }
    return null;
};
