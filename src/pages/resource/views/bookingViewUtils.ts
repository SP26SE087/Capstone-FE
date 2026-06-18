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
    [BookingStatus.Approved]:  { label: 'Approved',  color: '#166534', bg: '#ecfdf5', border: '#bbf7d0', dot: '#22c55e' },
    [BookingStatus.Rejected]:  { label: 'Rejected',  color: '#6b7280', bg: '#f8fafc', border: '#e5e7eb', dot: '#ef4444' },
    [BookingStatus.Cancelled]: { label: 'Cancelled', color: '#6b7280', bg: '#f8fafc', border: '#e5e7eb', dot: '#ef4444' },
    [BookingStatus.Completed]: { label: 'Completed', color: '#6b7280', bg: '#f8fafc', border: '#e5e7eb', dot: '#9ca3af' },
    [BookingStatus.InUse]:     { label: 'In Use',    color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6' },
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
    // 1. booking.resources[0].resourceTypeName (populated in list endpoints)
    if (booking.resources?.[0]?.resourceTypeName) {
        return getResourceTypeMeta(booking.resources[0].resourceTypeName);
    }
    // 2. look up resource by ID from the full resource list using resources[]
    const firstId = booking.resources?.[0]?.id;
    if (firstId) {
        const r = resources.find(x => x.id === firstId || x.ids?.includes(firstId));
        if (r?.resourceTypeName) return getResourceTypeMeta(r.resourceTypeName);
        if (r?.name) return getResourceTypeMeta(r.name);
    }
    return RT_META_DEFAULT;
}

/** Primary resource display name for a booking */
export function getBookingResourceLabel(booking: Booking, resources: Resource[]): string {
    const ids = booking.resources?.map(r => r.id) || booking.resourceIds || [];
    if (ids.length > 0) {
        const firstId = ids[0];
        const r = resources.find(x => x.id === firstId || x.ids?.includes(firstId));
        const firstName = booking.resources?.[0]?.name || r?.name || 'Unknown resource';
        if (ids.length === 1) return firstName;
        return `${firstName} (+${ids.length - 1} more)`;
    }
    return 'Unknown resource';
}

// ─── Date/time helpers ───────────────────────────────────────────────────────

export function fmtTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
}

export function fmtDate(iso: string | Date): string {
    return new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
}

export function fmtFullDate(iso: string | Date): string {
    return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
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

// ─── Booking group utility ────────────────────────────────────────────────────
/**
 * Merge bookings that share the same (title + userId + startTime + endTime)
 * into a single virtual Booking with combined resources[].
 * Bookings that differ in ANY of those fields stay separate.
 * The merged booking uses the first booking's id (for click → detail).
 *
 * NOTE: Status is intentionally NOT part of the key. When a user books resources
 * managed by different managers, the backend creates one booking per manager.
 * Each manager approves independently, so the statuses may differ at any given time
 * (e.g. one is Approved while another is still Pending). We always group them together
 * so the UI shows a single coherent card for the whole booking request.
 */
export function groupBookings(bookings: Booking[]): Booking[] {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
        // Normalize times to minute precision to avoid sub-second mismatches
        const start = b.startTime.slice(0, 16);
        const end   = b.endTime.slice(0, 16);
        const uid   = b.userId ?? b.userFullName ?? b.userName ?? '';
        // Group by user and time window, omitting title/resourceName
        const key   = `${uid}|${start}|${end}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(b);
    }

    const result: Booking[] = [];
    for (const group of map.values()) {
        if (group.length === 1) {
            result.push(group[0]);
            continue;
        }
        // Merge: combine all resources[], keep first booking's metadata
        const allResources = group.flatMap(b => b.resources ?? []);
        // Deduplicate by resource id
        const seen = new Set<string>();
        const mergedResources = allResources.filter(r => {
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
        });
        // Store all constituent IDs so approve/reject can act on all of them
        const allIds = group.map(b => b.bookingId || b.id).filter(Boolean) as string[];

        // When bookings have mixed statuses (e.g. one manager approved, another hasn't),
        // pick the most "attention-needed" status to surface on the merged card.
        // Priority: Pending > InUse > Approved > Completed > Rejected/Cancelled
        const STATUS_PRIORITY: Record<number, number> = {
            [BookingStatus.Pending]:   0,
            [BookingStatus.InUse]:     1,
            [BookingStatus.Approved]:  2,
            [BookingStatus.Completed]: 3,
            [BookingStatus.Rejected]:  4,
            [BookingStatus.Cancelled]: 5,
        };
        const representative = group.slice().sort(
            (a, b) => (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99)
        )[0];

        result.push({ ...representative, resources: mergedResources, _groupedIds: allIds });
    }

    return result;
}
