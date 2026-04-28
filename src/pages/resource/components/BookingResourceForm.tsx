import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Resource, ResourceType, CreateBookingRequest, Booking, BookingStatus } from '@/types/booking';
import { resourceService } from '@/services/resourceService';
import { bookingService } from '@/services/bookingService';
import {
    Save, Loader2, Calendar, Clock, FileText,
    Cpu, HardDrive, Box, Monitor, Zap,
    AlertCircle, AlertTriangle, CheckCircle,
    ChevronLeft, ChevronRight, ChevronDown, ArrowRight,
} from 'lucide-react';

// ---------- Props -----------------------------------------------------------
interface BookingResourceFormProps {
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string) => void;
    onTitleChange?: (title: string) => void;
    cartItems: BookingCartItem[];
    onCartChange: (items: BookingCartItem[]) => void;
}

export interface BookingCartItem {
    resourceId: string;
    quantity: number;
    isUrgent?: boolean;
}

// ---------- Constants -------------------------------------------------------
const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
];
const DAYS_SHORT = ['Mo','Tu','We','Th','Fr','Sa','Su'];

const DURATION_PRESETS = [
    { label: '2h',     hours: 2   },
    { label: '4h',     hours: 4   },
    { label: '8h',     hours: 8   },
    { label: '1 day',  hours: 24  },
    { label: '3 days', hours: 72  },
    { label: '1 week', hours: 168 },
];

const SESSION_TIMES = [
    { label: 'Morning',   sub: '08:00', mins: 480  },
    { label: 'Noon',      sub: '12:00', mins: 720  },
    { label: 'Afternoon', sub: '17:00', mins: 1020 },
];
const SESSION_MINS = SESSION_TIMES.map(s => s.mins);

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
    const h = Math.floor(i / 2);
    const m = i % 2 === 0 ? '00' : '30';
    return { value: h * 60 + (i % 2) * 30, label: `${String(h).padStart(2, '0')}:${m}` };
});

// ---------- Helpers ---------------------------------------------------------
const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtMins = (m: number) => `${pad2(Math.floor(m / 60))}:${m % 60 === 0 ? '00' : '30'}`;

const formatDuration = (start: Date, end: Date): string => {
    const total = Math.round((end.getTime() - start.getTime()) / 60000);
    if (total <= 0) return '--';
    const d = Math.floor(total / 1440);
    const h = Math.floor((total % 1440) / 60);
    const m = total % 60;
    const parts: string[] = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    return parts.join(' ');
};

function computeAvailableForWindow(
    resource: Resource,
    startIso: string,
    endIso: string,
    allBookings: Booking[],
): number {
    if (!resource.ids?.length) return resource.availableQuantity;
    if (!startIso || !endIso) return resource.availableQuantity;
    const s = new Date(startIso).getTime();
    const e = new Date(endIso).getTime();
    if (isNaN(s) || isNaN(e) || e <= s) return resource.availableQuantity;
    const unitIds = new Set(resource.ids);
    const bookedIds = new Set<string>();
    for (const b of allBookings) {
        if ([BookingStatus.Rejected, BookingStatus.Cancelled, BookingStatus.Completed].includes(b.status)) continue;
        const bs = new Date(b.startTime).getTime();
        const be = new Date(b.endTime).getTime();
        if (be <= s || bs >= e) continue;
        for (const id of (b.resourceIds ?? (b.resourceId ? [b.resourceId] : []))) {
            if (unitIds.has(id)) bookedIds.add(id);
        }
    }
    return Math.max(0, resource.ids.length - bookedIds.size);
}

// Keep icon map for potential use
const _RT_ICON: Record<number, React.ReactNode> = {
    [ResourceType.GPU]:        <Cpu size={13} />,
    [ResourceType.Equipment]:  <Box size={13} />,
    [ResourceType.Dataset]:    <Monitor size={13} />,
    [ResourceType.LabStation]: <Zap size={13} />,
    [ResourceType.Compute]:    <HardDrive size={13} />,
};
void _RT_ICON;

// ---------- Styles ----------------------------------------------------------
const baseInput: React.CSSProperties = {
    width: '100%', padding: '8px 11px', borderRadius: 8,
    border: '1.5px solid var(--border-color)', fontSize: '0.82rem',
    fontWeight: 500, fontFamily: 'inherit', outline: 'none',
    background: '#fff', transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box',
};
const sectionBox: React.CSSProperties = {
    padding: '14px 16px', background: 'var(--background-color)',
    borderRadius: 12, border: '1px solid var(--border-light)',
};
const capLabel: React.CSSProperties = {
    fontSize: '0.6rem', fontWeight: 800, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginBottom: 6, display: 'block',
};
const sectionHeading: React.CSSProperties = {
    fontSize: '0.65rem', fontWeight: 800, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.07px',
    display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12,
};
const fieldLabel: React.CSSProperties = {
    fontSize: '0.63rem', fontWeight: 800, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.6px',
    marginBottom: 4, display: 'block',
};
const errText: React.CSSProperties = {
    fontSize: '0.68rem', color: '#ef4444', marginTop: 4,
    display: 'block', fontWeight: 600,
};
const applyFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = 'var(--accent-color)';
    e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(232,114,12,0.08)';
};
const removeFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>, hasErr?: boolean) => {
    e.currentTarget.style.borderColor = hasErr ? '#ef4444' : 'var(--border-color)';
    e.currentTarget.style.boxShadow   = 'none';
};

// ---------- TimeDropdown ----------------------------------------------------
const TimeDropdown: React.FC<{
    value: number;
    onChange: (m: number) => void;
    accent: string;
    accentBg: string;
}> = ({ value, onChange, accent, accentBg }) => {
    const [open, setOpen] = useState(false);
    const ref     = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);

    useEffect(() => {
        if (!open || !listRef.current) return;
        (listRef.current.querySelector('[data-sel="true"]') as HTMLElement | null)
            ?.scrollIntoView({ block: 'center' });
    }, [open]);

    const isCustom = !SESSION_MINS.includes(value);
    const btnLabel = isCustom ? fmtMins(value) : 'Other';

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '5px 9px', borderRadius: 8,
                    border: `1.5px solid ${isCustom ? accent : '#e2e8f0'}`,
                    background: isCustom ? accentBg : '#f8fafc',
                    color: isCustom ? accent : '#64748b',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
                    lineHeight: 1.6,
                }}
            >
                {btnLabel} <ChevronDown size={9} />
            </button>
            {open && (
                <div ref={listRef} style={{
                    position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 9999,
                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
                    boxShadow: '0 8px 24px -4px rgba(0,0,0,0.14)',
                    maxHeight: 200, overflowY: 'auto', minWidth: 90, padding: '4px',
                }}>
                    {TIME_OPTIONS.filter(t => !SESSION_MINS.includes(t.value)).map(t => {
                        const sel = t.value === value;
                        return (
                            <div
                                key={t.value}
                                data-sel={sel}
                                onClick={() => { onChange(t.value); setOpen(false); }}
                                style={{
                                    padding: '5px 10px', borderRadius: 7,
                                    fontSize: 11, fontWeight: sel ? 800 : 600,
                                    color: sel ? accent : 'var(--text-primary)',
                                    background: sel ? accentBg : 'transparent',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
                                onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = sel ? accentBg : 'transparent'; }}
                            >
                                {t.label}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ---------- Component -------------------------------------------------------
const BookingResourceForm: React.FC<BookingResourceFormProps> = ({
    onClose, onSaved, onTitleChange, cartItems, onCartChange,
}) => {
    const today = useMemo(() => {
        const d = new Date(); d.setHours(0, 0, 0, 0); return d;
    }, []);

    // Schedule state
    const [startDate,      setStartDate]      = useState<Date | null>(null);
    const [startMinutes,   setStartMinutes]   = useState(480);
    const [returnMinutes,  setReturnMinutes]  = useState(720);
    const [selectedPreset, setSelectedPreset] = useState('8h');
    const [customHours,    setCustomHours]    = useState('8');
    const [calMonth,       setCalMonth]       = useState(new Date().getMonth());
    const [calYear,        setCalYear]        = useState(new Date().getFullYear());

    // Details state
    const [title,   setTitle]   = useState('');
    const [purpose, setPurpose] = useState('');

    const [resources,   setResources]   = useState<Resource[]>([]);
    const [allBookings, setAllBookings] = useState<Booking[]>([]);
    const [saving,      setSaving]      = useState(false);
    const [errors,      setErrors]      = useState<Record<string, string>>({});

    useEffect(() => {
        (async () => {
            try {
                const [res, bk] = await Promise.all([
                    resourceService.getAllPages(),
                    bookingService.getAllPages(),
                ]);
                setResources(res);
                setAllBookings(bk);
            } catch (err) {
                console.error('BookingResourceForm: load failed', err);
            }
        })();
    }, []);

    // Derived
    const durationHours = useMemo(() => {
        if (selectedPreset === 'custom') return parseInt(customHours) || 0;
        return DURATION_PRESETS.find(p => p.label === selectedPreset)?.hours ?? 0;
    }, [selectedPreset, customHours]);

    const startDateTime = useMemo(() => {
        if (!startDate) return null;
        const d = new Date(startDate);
        d.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
        return d;
    }, [startDate, startMinutes]);

    const endDate = useMemo(() => {
        if (!startDate || durationHours <= 0) return null;
        const s = new Date(startDate);
        s.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
        const raw = new Date(s.getTime() + durationHours * 3600000);
        const result = new Date(raw);
        result.setHours(Math.floor(returnMinutes / 60), returnMinutes % 60, 0, 0);
        if (result <= s) result.setDate(result.getDate() + 1);
        return result;
    }, [startDate, startMinutes, returnMinutes, durationHours]);

    const startIso = startDateTime?.toISOString() ?? '';
    const endIso   = endDate?.toISOString() ?? '';

    // Calendar grid
    const calDays = useMemo(() => {
        const first  = new Date(calYear, calMonth, 1);
        const offset = (first.getDay() + 6) % 7;
        const total  = new Date(calYear, calMonth + 1, 0).getDate();
        const cells: (Date | null)[] = [];
        for (let i = 0; i < offset; i++) cells.push(null);
        for (let d = 1; d <= total; d++) cells.push(new Date(calYear, calMonth, d));
        return cells;
    }, [calMonth, calYear]);

    const prevMonth = () => calMonth === 0
        ? (setCalMonth(11), setCalYear(y => y - 1))
        : setCalMonth(m => m - 1);
    const nextMonth = () => calMonth === 11
        ? (setCalMonth(0), setCalYear(y => y + 1))
        : setCalMonth(m => m + 1);

    // Availability map (for selected window)
    const availMap = useMemo(() => {
        const m = new Map<string, number>();
        for (const r of resources) {
            m.set(r.id, computeAvailableForWindow(r, startIso, endIso, allBookings));
        }
        return m;
    }, [resources, allBookings, startIso, endIso]);

    // Per-day availability status for calendar dots
    const dayStatusMap = useMemo(() => {
        const m = new Map<number, 'ok' | 'warn' | 'full'>();
        if (cartItems.length === 0 || resources.length === 0) return m;
        for (const day of calDays) {
            if (!day) continue;
            const dm = new Date(day.getFullYear(), day.getMonth(), day.getDate());
            if (dm < today) continue;
            const s = new Date(dm); s.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
            const e = new Date(dm); e.setHours(Math.floor(returnMinutes / 60), returnMinutes % 60, 0, 0);
            if (e <= s) e.setDate(e.getDate() + 1);
            const si = s.toISOString(), ei = e.toISOString();
            let nOk = 0, nWarn = 0;
            for (const item of cartItems) {
                const res = resources.find(r => r.id === item.resourceId);
                if (!res) continue;
                const avail = computeAvailableForWindow(res, si, ei, allBookings);
                if (avail >= item.quantity) nOk++; else nWarn++;
            }
            m.set(dm.getTime(), nWarn === 0 ? 'ok' : nOk === 0 ? 'full' : 'warn');
        }
        return m;
    }, [calDays, today, startMinutes, returnMinutes, cartItems, resources, allBookings]);

    // Validation
    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!title.trim())                     errs.title   = 'Title is required.';
        else if (title.trim().length > 300)    errs.title   = 'Max 300 characters.';
        if (!purpose.trim())                   errs.purpose = 'Purpose is required.';
        else if (purpose.trim().length > 2000) errs.purpose = 'Max 2000 characters.';
        if (cartItems.length === 0)            errs.schedule = 'Select at least one resource from the list.';
        else if (!startDate)                   errs.schedule = 'Please pick a pickup date.';
        else if (!endDate)                     errs.schedule = 'Please select a duration.';
        else if (startDateTime && startDateTime <= new Date())
            errs.schedule = 'Pickup time must be in the future.';
        else {
            for (const item of cartItems) {
                const avail = availMap.get(item.resourceId) ?? 0;
                const res   = resources.find(r => r.id === item.resourceId);
                if (item.quantity > avail) {
                    errs.schedule = `"${res?.name ?? item.resourceId}" only has ${avail} unit(s) available.`;
                    break;
                }
            }
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // Submit
    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            const isUrgent = cartItems.some(i => i.isUrgent);
            const request: CreateBookingRequest = {
                title:     title.trim(),
                purpose:   purpose.trim(),
                startTime: startIso,
                endTime:   endIso,
                isUrgent:  isUrgent || undefined,
                items: cartItems.map(item => {
                    const res    = resources.find(r => r.id === item.resourceId);
                    const pool   = res?.availableIds?.length
                        ? res.availableIds
                        : (res?.ids ?? [item.resourceId]);
                    const picked = pool.slice(0, item.quantity);
                    return { resourceIds: picked.length > 0 ? picked : [item.resourceId] };
                }),
            };
            await bookingService.create(request);
            onSaved(true, 'Booking request submitted successfully.');
        } catch (err: any) {
            const msg = err?.response?.data?.message
                || err?.response?.data?.title
                || 'Failed to create booking.';
            setErrors(prev => ({ ...prev, submit: msg }));
        } finally {
            setSaving(false);
        }
    };

    const [activeTab, setActiveTab] = useState<'schedule' | 'details'>('schedule');

    const totalUnits = cartItems.reduce((t, i) => t + i.quantity, 0);
    const duration   = (startDateTime && endDate) ? formatDuration(startDateTime, endDate) : '';

    // Helper: session time button
    const SessionBtn = (
        mins: number,
        label: string,
        sub: string,
        active: boolean,
        accent: string,
        onClick: () => void,
    ) => (
        <button
            key={mins}
            type="button"
            onClick={onClick}
            style={{
                padding: '5px 10px', borderRadius: 8,
                border: `1.5px solid ${active ? accent : '#e2e8f0'}`,
                background: active ? accent : '#fff',
                color: active ? '#fff' : '#475569',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                transition: 'all 0.12s', whiteSpace: 'nowrap' as const,
            }}
        >
            {label}<span style={{ opacity: active ? 0.85 : 0.55, fontWeight: 600 }}>{sub}</span>
        </button>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 14, paddingBottom: 12,
                borderBottom: '1px solid var(--border-light)',
            }}>
                <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                    color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0,
                }}>
                    <Calendar size={16} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                        New Booking Request
                    </h3>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Pick a date and duration &mdash; availability updates in real time
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: 'var(--background-color)', borderRadius: 10, padding: 4, border: '1px solid var(--border-light)' }}>
                {(['schedule', 'details'] as const).map(tab => {
                    const active = activeTab === tab;
                    const label  = tab === 'schedule' ? '1. Schedule' : '2. Details';
                    const done   = tab === 'schedule' && !!startDateTime && !!endDate;
                    return (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1, padding: '6px 10px', borderRadius: 7, border: 'none',
                                background: active ? '#fff' : 'transparent',
                                color: active ? 'var(--text-primary)' : '#94a3b8',
                                fontSize: '0.72rem', fontWeight: active ? 800 : 600,
                                cursor: 'pointer', fontFamily: 'inherit',
                                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                transition: 'all 0.15s',
                            }}
                        >
                            {tab === 'schedule' ? <Clock size={11} /> : <FileText size={11} />}
                            {label}
                            {done && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />}
                        </button>
                    );
                })}
            </div>

            {/* Scrollable body */}
            <div
                style={{ flex: 1, overflowY: 'auto', paddingRight: 2, display: 'flex', flexDirection: 'column', gap: 12 }}
                className="custom-scrollbar"
            >
                {/* 1. SCHEDULE */}
                <div style={{ ...sectionBox, display: activeTab === 'schedule' ? undefined : 'none' }}>
                    <div style={sectionHeading}><Clock size={12} /> Schedule</div>

                    {errors.schedule && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
                            padding: '7px 11px', background: '#fef2f2',
                            border: '1px solid #fecaca', borderRadius: 8,
                            fontSize: '0.7rem', color: '#ef4444', fontWeight: 600,
                        }}>
                            <AlertCircle size={12} /> {errors.schedule}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

                        {/* Calendar */}
                        <div style={{ flexShrink: 0, width: 208 }}>
                            <span style={capLabel}>Pickup Date</span>
                            <div style={{
                                background: '#fff',
                                border: '1.5px solid var(--border-color)',
                                borderRadius: 12, padding: '10px',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <button type="button" onClick={prevMonth} style={{
                                        width: 26, height: 26, borderRadius: 7,
                                        border: '1px solid #e2e8f0', background: '#f8fafc',
                                        cursor: 'pointer', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', color: '#64748b',
                                    }}>
                                        <ChevronLeft size={13} />
                                    </button>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>
                                        {MONTHS[calMonth].slice(0, 3)} {calYear}
                                    </span>
                                    <button type="button" onClick={nextMonth} style={{
                                        width: 26, height: 26, borderRadius: 7,
                                        border: '1px solid #e2e8f0', background: '#f8fafc',
                                        cursor: 'pointer', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', color: '#64748b',
                                    }}>
                                        <ChevronRight size={13} />
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 3 }}>
                                    {DAYS_SHORT.map(d => (
                                        <span key={d} style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textAlign: 'center' as const }}>
                                            {d}
                                        </span>
                                    ))}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, justifyItems: 'center' as const }}>
                                    {calDays.map((day, i) => {
                                        if (!day) return <div key={`e${i}`} style={{ width: 26, height: 30 }} />;
                                        const isPast = day < today;
                                        const sm = startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()) : null;
                                        const em = endDate   ? new Date(endDate.getFullYear(),   endDate.getMonth(),   endDate.getDate())   : null;
                                        const dm = new Date(day.getFullYear(), day.getMonth(), day.getDate());
                                        const isStart = sm ? dm.getTime() === sm.getTime() : false;
                                        const isEnd   = em ? dm.getTime() === em.getTime() : false;
                                        const inRange = !!(sm && em && dm > sm && dm < em);
                                        const bg  = isStart ? 'var(--accent-color)' : isEnd ? '#0ea5e9' : inRange ? 'rgba(232,114,12,0.12)' : 'transparent';
                                        const col = (isStart || isEnd) ? '#fff' : isPast ? '#cbd5e1' : 'var(--text-primary)';
                                        return (
                                            <div
                                                key={i}
                                                onClick={() => !isPast && setStartDate(new Date(day))}
                                                style={{
                                                    width: 26, height: 30, borderRadius: 7,
                                                    display: 'flex', flexDirection: 'column' as const,
                                                    alignItems: 'center', justifyContent: 'center',
                                                    cursor: isPast ? 'default' : 'pointer',
                                                    background: bg, color: col, gap: 1, paddingBottom: 2,
                                                    fontSize: 10, fontWeight: (isStart || isEnd) ? 800 : 500,
                                                    transition: 'background 0.1s',
                                                }}
                                                onMouseEnter={e => { if (!isPast && !isStart && !isEnd) (e.currentTarget as HTMLDivElement).style.background = inRange ? 'rgba(232,114,12,0.22)' : '#f1f5f9'; }}
                                                onMouseLeave={e => { if (!isStart && !isEnd) (e.currentTarget as HTMLDivElement).style.background = inRange ? 'rgba(232,114,12,0.12)' : 'transparent'; }}
                                            >
                                                {day.getDate()}
                                                {!isPast && cartItems.length > 0 && (() => {
                                                    const st = dayStatusMap.get(new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime());
                                                    if (!st) return null;
                                                    const dotColor = st === 'ok' ? '#22c55e' : st === 'warn' ? '#f59e0b' : '#ef4444';
                                                    const dotBg = (isStart || isEnd) ? 'rgba(255,255,255,0.85)' : dotColor;
                                                    return <div style={{ width: 4, height: 4, borderRadius: '50%', background: dotBg, flexShrink: 0 }} />;
                                                })()}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Right column: times + duration */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

                            {/* Pickup Time */}
                            <div>
                                <span style={capLabel}>Pickup Time</span>
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                                    {SESSION_TIMES.map(s => SessionBtn(
                                        s.mins, s.label, s.sub,
                                        startMinutes === s.mins,
                                        'var(--accent-color)',
                                        () => setStartMinutes(s.mins),
                                    ))}
                                    <TimeDropdown
                                        value={startMinutes}
                                        onChange={setStartMinutes}
                                        accent="var(--accent-color)"
                                        accentBg="rgba(232,114,12,0.08)"
                                    />
                                </div>
                            </div>

                            {/* Return Time */}
                            <div>
                                <span style={capLabel}>Return Time</span>
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                                    {SESSION_TIMES.map(s => SessionBtn(
                                        s.mins, s.label, s.sub,
                                        returnMinutes === s.mins,
                                        '#0ea5e9',
                                        () => setReturnMinutes(s.mins),
                                    ))}
                                    <TimeDropdown
                                        value={returnMinutes}
                                        onChange={setReturnMinutes}
                                        accent="#0ea5e9"
                                        accentBg="rgba(14,165,233,0.08)"
                                    />
                                </div>
                            </div>

                            {/* Duration */}
                            <div>
                                <span style={capLabel}>Duration</span>
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                                    {DURATION_PRESETS.map(p => {
                                        const active = selectedPreset === p.label;
                                        return (
                                            <button
                                                key={p.label}
                                                type="button"
                                                onClick={() => { setSelectedPreset(p.label); }}
                                                style={{
                                                    padding: '5px 10px', borderRadius: 8,
                                                    border: `1.5px solid ${active ? 'var(--accent-color)' : '#e2e8f0'}`,
                                                    background: active ? 'var(--accent-color)' : '#fff',
                                                    color: active ? '#fff' : '#475569',
                                                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                                    fontFamily: 'inherit', transition: 'all 0.12s',
                                                }}
                                            >
                                                {p.label}
                                            </button>
                                        );
                                    })}
                                    {selectedPreset === 'custom' ? (
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            padding: '3px 6px', borderRadius: 8,
                                            border: '1.5px solid var(--accent-color)',
                                            background: 'rgba(232,114,12,0.06)',
                                        }}>
                                            <button
                                                type="button"
                                                onClick={() => setCustomHours(String(Math.max(1, (parseInt(customHours) || 1) - 1)))}
                                                style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}
                                            >-</button>
                                            <input
                                                type="number" min="1" max="720"
                                                value={customHours === '' ? '' : parseInt(customHours) || 1}
                                                onChange={e => {
                                                    const v = parseInt(e.target.value);
                                                    setCustomHours(e.target.value === '' ? '' : String(Math.min(720, Math.max(1, isNaN(v) ? 1 : v))));
                                                }}
                                                style={{ width: 40, padding: '2px 0', border: 'none', outline: 'none', fontSize: 12, fontWeight: 800, textAlign: 'center', color: 'var(--accent-color)', fontFamily: 'inherit', background: 'transparent' }}
                                            />
                                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-color)' }}>h</span>
                                            <button
                                                type="button"
                                                onClick={() => setCustomHours(String(Math.min(720, (parseInt(customHours) || 0) + 1)))}
                                                style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}
                                            >+</button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedPreset('custom'); setCustomHours('8'); }}
                                            style={{
                                                padding: '5px 10px', borderRadius: 8,
                                                border: '1.5px solid #e2e8f0',
                                                background: '#fff', color: '#64748b',
                                                fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                            }}
                                        >
                                            Custom...
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Summary card / warning */}
                    {startDateTime && endDate ? (
                        <div style={{
                            marginTop: 14, display: 'flex', alignItems: 'stretch',
                            background: '#fff', border: '1.5px solid var(--border-color)',
                            borderRadius: 12, overflow: 'hidden',
                        }}>
                            <div style={{ flex: 1, padding: '10px 14px' }}>
                                <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.07em', display: 'block', marginBottom: 3 }}>Pickup</span>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                                    {startDateTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--accent-color)' }}>
                                    {fmtMins(startMinutes)}
                                </div>
                            </div>
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '0 10px',
                                borderLeft: '1px solid var(--border-light)',
                                borderRight: '1px solid var(--border-light)',
                                background: 'var(--background-color)',
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2 }}>
                                    <ArrowRight size={14} color="#94a3b8" />
                                    <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', whiteSpace: 'nowrap' as const }}>{duration}</span>
                                </div>
                            </div>
                            <div style={{ flex: 1, padding: '10px 14px' }}>
                                <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.07em', display: 'block', marginBottom: 3 }}>Return</span>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                                    {endDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: '#0ea5e9' }}>
                                    {pad2(endDate.getHours())}:{pad2(endDate.getMinutes())}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            marginTop: 12, display: 'flex', alignItems: 'center', gap: 7,
                            padding: '8px 12px', background: '#fffbeb',
                            border: '1px solid #fde68a', borderRadius: 9,
                            fontSize: '0.7rem', color: '#92400e', fontWeight: 600,
                        }}>
                            <AlertTriangle size={13} color="#d97706" />
                            Pick a pickup date on the calendar to continue
                        </div>
                    )}

                    {/* Availability per resource for selected window */}
                    {startDateTime && endDate && cartItems.length > 0 && resources.length > 0 && (
                        <div style={{ marginTop: 12, borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
                            <div style={{ ...sectionHeading, marginBottom: 8 }}>
                                <CheckCircle size={11} /> Resource Availability
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {cartItems.map(item => {
                                    const res   = resources.find(r => r.id === item.resourceId);
                                    const avail = availMap.get(item.resourceId) ?? 0;
                                    const total = res?.ids?.length ?? (res?.availableQuantity ?? 0);
                                    const ok    = avail >= item.quantity;
                                    return (
                                        <div key={item.resourceId} style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '6px 10px', borderRadius: 8,
                                            background: ok ? '#f0fdf4' : '#fef2f2',
                                            border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
                                        }}>
                                            <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: ok ? '#22c55e' : '#ef4444' }} />
                                            <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                                {res?.name ?? item.resourceId}
                                            </span>
                                            <span style={{ fontSize: 10, fontWeight: 800, color: ok ? '#16a34a' : '#ef4444', flexShrink: 0 }}>
                                                {avail}/{total} free
                                            </span>
                                            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>
                                                need {item.quantity}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. DETAILS */}
                <div style={{ ...sectionBox, display: activeTab === 'details' ? undefined : 'none' }}>
                    <div style={sectionHeading}><FileText size={12} /> Booking Details</div>

                    <div style={{ marginBottom: 12 }}>
                        <label style={fieldLabel}>Title *</label>
                        <input
                            style={{ ...baseInput, borderColor: errors.title ? '#ef4444' : undefined }}
                            value={title}
                            placeholder="e.g. GPU Training Session"
                            onChange={e => { setTitle(e.target.value); onTitleChange?.(e.target.value || 'New Booking'); }}
                            onFocus={applyFocus}
                            onBlur={e => removeFocus(e, !!errors.title)}
                        />
                        {errors.title && <span style={errText}>{errors.title}</span>}
                    </div>

                    <div>
                        <label style={fieldLabel}>Purpose *</label>
                        <textarea
                            style={{ ...baseInput, minHeight: 68, resize: 'vertical', borderColor: errors.purpose ? '#ef4444' : undefined }}
                            value={purpose}
                            placeholder="Describe what you will use these resources for..."
                            onChange={e => setPurpose(e.target.value)}
                            onFocus={applyFocus}
                            onBlur={e => removeFocus(e, !!errors.purpose)}
                        />
                        {errors.purpose && <span style={errText}>{errors.purpose}</span>}
                    </div>
                </div>

                {/* Submit error */}
                {activeTab === 'details' && errors.submit && (
                    <div style={{
                        padding: '10px 14px', background: '#fef2f2',
                        border: '1px solid #fecaca', borderRadius: 9,
                        color: '#dc2626', fontSize: '0.78rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <AlertCircle size={13} /> {errors.submit}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{
                paddingTop: 12, borderTop: '1px solid var(--border-light)',
                display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto',
            }}>
                {totalUnits > 0 ? (
                    <span style={{ flex: 1, fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>
                        {totalUnits} unit{totalUnits !== 1 ? 's' : ''} &middot; {cartItems.length} type{cartItems.length !== 1 ? 's' : ''}
                        {duration && <> &middot; {duration}</>}
                        {cartItems.some(i => i.isUrgent) && (
                            <span style={{ marginLeft: 7, color: '#dc2626', fontWeight: 800 }}>
                                {'\u26A1'} Urgent
                            </span>
                        )}
                    </span>
                ) : (
                    <span style={{ flex: 1 }} />
                )}
                {activeTab === 'schedule' ? (
                    <>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '8px 16px', borderRadius: 9,
                                border: '1px solid var(--border-color)', background: '#fff',
                                color: 'var(--text-secondary)', cursor: 'pointer',
                                fontSize: '0.78rem', fontWeight: 700,
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('details')}
                            style={{
                                padding: '8px 20px', borderRadius: 9, border: 'none',
                                background: 'var(--accent-color)', color: '#fff', cursor: 'pointer',
                                fontSize: '0.78rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: 6,
                                boxShadow: '0 4px 12px rgba(232,114,12,0.25)',
                            }}
                        >
                            Next &rarr;
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => setActiveTab('schedule')}
                            style={{
                                padding: '8px 16px', borderRadius: 9,
                                border: '1px solid var(--border-color)', background: '#fff',
                                color: 'var(--text-secondary)', cursor: 'pointer',
                                fontSize: '0.78rem', fontWeight: 700,
                            }}
                        >
                            &larr; Back
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                padding: '8px 20px', borderRadius: 9, border: 'none',
                                background: saving ? '#94a3b8' : 'var(--accent-color)',
                                color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                                fontSize: '0.78rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: 6,
                                boxShadow: saving ? 'none' : '0 4px 12px rgba(232,114,12,0.25)',
                            }}
                        >
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            Submit Booking
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default BookingResourceForm;