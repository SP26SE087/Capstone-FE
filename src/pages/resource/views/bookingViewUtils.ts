import { Booking, BookingStatus, Resource } from '@/types/booking';

// ─── Status visual metadata ──────────────────────────────────────────────────

export interface StatusMeta {
    label: string;
    color: string;
    bg: string;
    border: string;
    dot: string;
}

export const STATUS_META: Record<number, StatusMeta> = {
    [BookingStatus.Pending]:   { label: 'Pending',   color: '#a16207', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
    [BookingStatus.Approved]:  { label: 'Approved',  color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6' },
    [BookingStatus.Rejected]:  { label: 'Rejected',  color: '#6b7280', bg: '#f8fafc', border: '#e5e7eb', dot: '#ef4444' },
    [BookingStatus.Cancelled]: { label: 'Cancelled', color: '#6b7280', bg: '#f8fafc', border: '#e5e7eb', dot: '#ef4444' },
    [BookingStatus.Completed]: { label: 'Completed', color: '#6b7280', bg: '#f8fafc', border: '#e5e7eb', dot: '#9ca3af' },
    [BookingStatus.InUse]:     { label: 'In Use',    color: '#166534', bg: '#ecfdf5', border: '#bbf7d0', dot: '#22c55e' },
};

// ─── Resource type visual metadata ──────────────────────────────────────────

export interface ResourceTypeMeta {
    icon: React.ElementType;
    color: string;
    bg: string;
}

// Keyword-based fallback — we import lucide icons inline
const RT_KEYWORD_MAP: Array<[RegExp, { color: string; bg: string; iconName: string }]> = [
    [/gpu|workstation|server|cuda/i,     { iconName: 'cpu',           color: '#7C3AED', bg: '#EDE9FE' }],
    [/microscop/i,                        { iconName: 'microscope',    color: '#0891B2', bg: '#CFFAFE' }],
    [/sensor|lidar|imu|radar/i,           { iconName: 'radio',         color: '#16A34A', bg: '#DCFCE7' }],
    [/station|robot|workbench/i,          { iconName: 'monitor',       color: '#D97706', bg: '#FEF3C7' }],
    [/instrument|spectro|analyti/i,       { iconName: 'flask-conical', color: '#DB2777', bg: '#FCE7F3' }],
    [/dataset|data|storage/i,             { iconName: 'database',      color: '#0284C7', bg: '#E0F2FE' }],
];

export interface RtMeta { color: string; bg: string; iconName: string }

const RT_META_DEFAULT: RtMeta = { iconName: 'package', color: '#64748B', bg: '#F1F5F9' };

export function getResourceTypeMeta(typeName?: string | null): RtMeta {
    if (!typeName) return RT_META_DEFAULT;
    for (const [re, meta] of RT_KEYWORD_MAP) {
        if (re.test(typeName)) return meta;
    }
    return RT_META_DEFAULT;
}

/** Find the primary resource metadata for a booking, falling back through available fields */
export function getBookingRtMeta(booking: Booking, resources: Resource[]): RtMeta {
    // 1. booking.resources[0].resourceTypeName (populated in some endpoints)
    if (booking.resources?.[0]?.resourceTypeName) {
        return getResourceTypeMeta(booking.resources[0].resourceTypeName);
    }
    // 2. look up resource by ID from the full resource list
    const firstId = booking.resourceIds?.[0] ?? booking.resourceId;
    if (firstId) {
        const r = resources.find(x => x.id === firstId || x.ids?.includes(firstId));
        if (r?.resourceTypeName) return getResourceTypeMeta(r.resourceTypeName);
        if (r?.name) return getResourceTypeMeta(r.name);
    }
    // 3. fall back to resourceName on booking
    if (booking.resourceName) return getResourceTypeMeta(booking.resourceName);
    return RT_META_DEFAULT;
}

/** Primary resource display name for a booking */
export function getBookingResourceLabel(booking: Booking, resources: Resource[]): string {
    if (booking.resources?.[0]?.name) return booking.resources[0].name;
    const firstId = booking.resourceIds?.[0] ?? booking.resourceId;
    if (firstId) {
        const r = resources.find(x => x.id === firstId || x.ids?.includes(firstId));
        if (r) return r.name;
    }
    return booking.resourceName ?? 'Unknown resource';
}

// ─── Date/time helpers ───────────────────────────────────────────────────────

export function fmtTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(iso: string | Date): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fmtFullDate(iso: string | Date): string {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function sameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

export function relTime(iso: string): string {
    const diff = (new Date(iso).getTime() - Date.now()) / 60000;
    const abs = Math.abs(diff);
    if (abs < 60) return diff < 0 ? `${Math.round(abs)}m ago` : `in ${Math.round(abs)}m`;
    if (abs < 1440) return diff < 0 ? `${Math.round(abs / 60)}h ago` : `in ${Math.round(abs / 60)}h`;
    return diff < 0 ? `${Math.round(abs / 1440)}d ago` : `in ${Math.round(abs / 1440)}d`;
}

export function initials(name = ''): string {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U';
}

// ─── Calendar math ───────────────────────────────────────────────────────────

export function buildMonthGrid(year: number, month: number): Date[] {
    const first = new Date(year, month, 1);
    const firstDow = (first.getDay() + 6) % 7; // Mon = 0
    const start = new Date(year, month, 1 - firstDow);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        days.push(d);
    }
    return days;
}

export function bookingsOnDay(bookings: Booking[], date: Date): Booking[] {
    return bookings.filter(b => {
        const s = new Date(b.startTime);
        return s.getFullYear() === date.getFullYear() &&
               s.getMonth() === date.getMonth() &&
               s.getDate() === date.getDate();
    });
}
