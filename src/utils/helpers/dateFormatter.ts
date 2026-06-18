const VN_TZ = 'Asia/Ho_Chi_Minh';

// ─── Helper: convert UTC ISO → local datetime string for <input type="datetime-local">
// datetime-local expects "YYYY-MM-DDTHH:MM" in LOCAL time, not UTC.
export const toLocalDatetimeInput = (d: Date = new Date()): string => {
    return d.toLocaleString('sv-SE', { timeZone: VN_TZ }).slice(0, 16).replace(' ', 'T');
};

// ─── Helper: get VN "today" date string in YYYY-MM-DD (for <input type="date"> min)
export const getVNTodayDateStr = (): string => {
    return new Date().toLocaleDateString('en-CA', { timeZone: VN_TZ });
};

export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: VN_TZ,
    });
};

export const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: VN_TZ,
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
