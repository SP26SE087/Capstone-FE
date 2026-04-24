import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    ChevronLeft, ChevronRight, Plus, AlertCircle,
    Database, Cpu, Radio, Monitor, Package,
    FlaskConical, Microscope, X, Check, SlidersHorizontal, Loader2, Minus
} from 'lucide-react';
import { Booking, Resource, BookingStatus, BasicResourceResponse } from '@/types/booking';
import {
    STATUS_META, getBookingRtMeta, getBookingResourceLabel,
    fmtTime, fmtDate, fmtFullDate, sameDay, relTime, initials,
    buildMonthGrid, bookingsOnDay,
} from './bookingViewUtils';

// ─── Helpers ─────────────────────────────────────────────────────────────────
interface ResGroup { key: string; name: string; resourceTypeName: string; location: string; ids: string[]; }

function groupResources(resources: BasicResourceResponse[]): ResGroup[] {
    const map = new Map<string, ResGroup>();
    for (const r of resources) {
        const key = `${r.name}||${r.resourceTypeName ?? ''}||${r.location ?? ''}`;
        if (!map.has(key)) map.set(key, { key, name: r.name, resourceTypeName: r.resourceTypeName ?? '', location: r.location ?? '', ids: [] });
        map.get(key)!.ids.push(r.id);
    }
    return [...map.values()];
}

// ─── Lucide icon by name (subset used in RT_META) ───────────────────────────
function RtIcon({ iconName, size = 13 }: { iconName: string; size?: number }) {
    const map: Record<string, React.ElementType> = {
        cpu: Cpu, microscope: Microscope, radio: Radio,
        monitor: Monitor, 'flask-conical': FlaskConical, database: Database, package: Package,
    };
    const Icon = map[iconName] ?? Package;
    return <Icon size={size} />;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name = '', size = 22 }: { name: string; size?: number }) {
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#E8720C,#FF9643)',
            color: '#fff', fontWeight: 700, fontSize: size * 0.38,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff', boxShadow: '0 0 0 1px #e2e8f0',
        }}>
            {initials(name)}
        </div>
    );
}

// ─── Status badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: BookingStatus }) {
    const m = STATUS_META[status];
    if (!m) return null;
    const isCheckedOut = status === BookingStatus.InUse;
    const isRejectedLike = status === BookingStatus.Rejected || status === BookingStatus.Cancelled;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 7px', background: m.bg, color: m.color,
            fontSize: 10, fontWeight: 700, borderRadius: 999,
            border: `1px solid ${m.border}`, whiteSpace: 'nowrap',
        }}>
            <span style={{
                width: 10,
                height: 10,
                borderRadius: 99,
                background: m.dot,
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                fontWeight: 800,
                lineHeight: 1,
            }}>
                {isRejectedLike ? 'x' : isCheckedOut ? '>' : ''}
            </span>
            {m.label}
            {isCheckedOut && (
                <span style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#166534',
                    border: '1px dashed #86efac',
                    background: '#f0fdf4',
                    borderRadius: 6,
                    padding: '0 3px',
                }}>
                    OUT
                </span>
            )}
        </span>
    );
}

const DAY_STATUS_ORDER: BookingStatus[] = [
    BookingStatus.Pending,
    BookingStatus.Approved,
    BookingStatus.InUse,
    BookingStatus.Completed,
    BookingStatus.Rejected,
];

function getStatusRank(status: BookingStatus): number {
    const idx = DAY_STATUS_ORDER.indexOf(status);
    if (idx >= 0) return idx;
    if (status === BookingStatus.Cancelled) return DAY_STATUS_ORDER.length + 1;
    return DAY_STATUS_ORDER.length;
}

function sortByBorrowTime(a: Booking, b: Booking): number {
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
}

function sortByStatusThenBorrowTime(a: Booking, b: Booking): number {
    const rankDiff = getStatusRank(a.status) - getStatusRank(b.status);
    if (rankDiff !== 0) return rankDiff;
    return sortByBorrowTime(a, b);
}

const MONTH_PREVIEW_STATUS_ORDER: BookingStatus[] = [
    BookingStatus.Pending,
    BookingStatus.InUse,
    BookingStatus.Approved,
    BookingStatus.Completed,
    BookingStatus.Rejected,
];

function getMonthPreviewStatusRank(status: BookingStatus): number {
    const idx = MONTH_PREVIEW_STATUS_ORDER.indexOf(status);
    if (idx >= 0) return idx;
    if (status === BookingStatus.Cancelled) return MONTH_PREVIEW_STATUS_ORDER.length + 1;
    return MONTH_PREVIEW_STATUS_ORDER.length;
}

function sortByMonthPreviewPriority(a: Booking, b: Booking): number {
    const urgentDiff = (a.isUrgent ? 0 : 1) - (b.isUrgent ? 0 : 1);
    if (urgentDiff !== 0) return urgentDiff;
    const statusDiff = getMonthPreviewStatusRank(a.status) - getMonthPreviewStatusRank(b.status);
    if (statusDiff !== 0) return statusDiff;
    return sortByBorrowTime(a, b);
}

function normalizeType(typeName?: string | null): string {
    return (typeName ?? '').trim().toLowerCase();
}

function getBookingTypeNames(booking: Booking, resources: Resource[]): string[] {
    const names = new Set<string>();

    booking.resources?.forEach(r => {
        if (r.resourceTypeName?.trim()) names.add(r.resourceTypeName.trim());
    });

    (booking.resourceIds ?? []).forEach(id => {
        const resource = resources.find(r => r.id === id || r.ids?.includes(id));
        if (resource?.resourceTypeName?.trim()) names.add(resource.resourceTypeName.trim());
    });

    if (names.size === 0 && booking.resourceId) {
        const resource = resources.find(r => r.id === booking.resourceId || r.ids?.includes(booking.resourceId));
        if (resource?.resourceTypeName?.trim()) names.add(resource.resourceTypeName.trim());
    }

    return Array.from(names);
}

// ─── Filter bar ──────────────────────────────────────────────────────────────
function FilterBar({
    filterStatus, setFilterStatus, onNewBooking,
    resources,
    filterTypes, setFilterTypes,
}: {
    filterStatus: string; setFilterStatus: (s: string) => void;
    onNewBooking: () => void;
    resources: Resource[];
    filterTypes: string[]; setFilterTypes: React.Dispatch<React.SetStateAction<string[]>>;
}) {
    const [typeMenuOpen, setTypeMenuOpen] = useState(false);
    const [typeSearch, setTypeSearch] = useState('');
    const typeMenuRef = useRef<HTMLDivElement | null>(null);

    const typeOptions = useMemo(() => {
        const byKey = new Map<string, { label: string; count: number }>();
        resources.forEach(r => {
            const rawName = r.resourceTypeName?.trim();
            if (!rawName) return;
            const key = normalizeType(rawName);
            const amount = Math.max(r.totalQuantity ?? r.ids?.length ?? 1, 1);
            const current = byKey.get(key);
            if (current) {
                current.count += amount;
            } else {
                byKey.set(key, { label: rawName, count: amount });
            }
        });
        return Array.from(byKey.entries())
            .map(([key, value]) => ({ key, label: value.label, count: value.count }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [resources]);

    const selectedTypeKeys = useMemo(
        () => new Set(filterTypes.map(type => normalizeType(type))),
        [filterTypes]
    );

    const filteredTypeOptions = useMemo(() => {
        const term = typeSearch.trim().toLowerCase();
        if (!term) return typeOptions;
        return typeOptions.filter(opt => opt.label.toLowerCase().includes(term));
    }, [typeOptions, typeSearch]);

    const typeSummary = useMemo(() => {
        if (filterTypes.length === 0) return 'All types';
        if (filterTypes.length === 1) return filterTypes[0];
        return `${filterTypes[0]} +${filterTypes.length - 1}`;
    }, [filterTypes]);

    useEffect(() => {
        if (!typeMenuOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (typeMenuRef.current && target && !typeMenuRef.current.contains(target)) {
                setTypeMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [typeMenuOpen]);

    const toggleType = (label: string) => {
        setFilterTypes(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]);
    };

    const clearTypeFilter = () => setFilterTypes([]);

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '12px 14px',
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
            marginBottom: 16,
        }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filter</span>

            <div ref={typeMenuRef} style={{ position: 'relative' }}>
                <button
                    onClick={() => setTypeMenuOpen(v => !v)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 14px',
                        fontSize: 14,
                        fontWeight: 700,
                        background: filterTypes.length > 0 ? '#eff6ff' : '#fff',
                        color: filterTypes.length > 0 ? '#1d4ed8' : '#334155',
                        border: `1px solid ${filterTypes.length > 0 ? '#bfdbfe' : '#e2e8f0'}`,
                        borderRadius: 999,
                        cursor: 'pointer',
                        maxWidth: 280,
                    }}
                >
                    <Package size={14} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeSummary}</span>
                    {filterTypes.length > 0 && (
                        <span style={{
                            minWidth: 20,
                            height: 20,
                            borderRadius: 10,
                            padding: '0 6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#1d4ed8',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 800,
                            flexShrink: 0,
                        }}>
                            {filterTypes.length}
                        </span>
                    )}
                </button>

                {typeMenuOpen && (
                    <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: 340,
                        maxWidth: 'calc(100vw - 48px)',
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        boxShadow: '0 16px 28px rgba(15, 23, 42, 0.14)',
                        zIndex: 40,
                        overflow: 'hidden',
                    }}>
                        <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type filter</div>
                            <button
                                onClick={clearTypeFilter}
                                disabled={filterTypes.length === 0}
                                style={{
                                    border: 'none',
                                    background: 'none',
                                    cursor: filterTypes.length === 0 ? 'not-allowed' : 'pointer',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: filterTypes.length === 0 ? '#94a3b8' : '#2563eb',
                                    padding: 0,
                                }}
                            >
                                Clear
                            </button>
                        </div>

                        <div style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
                            <input
                                value={typeSearch}
                                onChange={e => setTypeSearch(e.target.value)}
                                placeholder="Search type..."
                                style={{
                                    width: '100%',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 8,
                                    padding: '7px 10px',
                                    fontSize: 13,
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>

                        <div className="bk-scroll" style={{ maxHeight: 230, overflowY: 'auto', padding: '6px 0' }}>
                            {filteredTypeOptions.length === 0 ? (
                                <div style={{ padding: '14px 12px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
                                    No type matched.
                                </div>
                            ) : (
                                filteredTypeOptions.map(opt => {
                                    const selected = selectedTypeKeys.has(opt.key);
                                    return (
                                        <button
                                            key={opt.key}
                                            onClick={() => toggleType(opt.label)}
                                            style={{
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                padding: '8px 12px',
                                                border: 'none',
                                                borderLeft: selected ? '3px solid #2563eb' : '3px solid transparent',
                                                background: selected ? '#eff6ff' : '#fff',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                            }}
                                        >
                                            <span style={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: 4,
                                                border: `1.5px solid ${selected ? '#2563eb' : '#cbd5e1'}`,
                                                background: selected ? '#2563eb' : '#fff',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#fff',
                                                fontSize: 11,
                                                fontWeight: 800,
                                                flexShrink: 0,
                                            }}>
                                                {selected ? '✓' : ''}
                                            </span>
                                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#334155' }}>{opt.label}</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{opt.count}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                            {filterTypes.length === 0 ? 'All types are visible.' : `${filterTypes.length} type${filterTypes.length > 1 ? 's' : ''} selected.`}
                        </div>
                    </div>
                )}
            </div>

            <div style={{ width: 1, height: 26, background: '#e2e8f0' }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{
                    padding: '7px 12px', fontSize: 14, fontWeight: 600,
                    border: '1px solid #e2e8f0', borderRadius: 10,
                    background: '#fff', color: '#1e293b', cursor: 'pointer',
                    outline: 'none', fontFamily: 'inherit',
                }}>
                <option value="">All statuses</option>
                <option value="1">Pending</option>
                <option value="2">Approved</option>
                <option value="5">In use</option>
                <option value="6">Completed</option>
            </select>
            <div style={{ flex: 1 }} />
            <button onClick={onNewBooking} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', background: '#E8720C', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
                <Plus size={16} /> New booking
            </button>
        </div>
    );
}

// ─── Calendar event pill ─────────────────────────────────────────────────────
function CalEvent({ booking, resources: _resources, onClick, isStart = true }: {
    booking: Booking; resources: Resource[]; onClick: (b: Booking) => void; isStart?: boolean;
}) {
    const isPending = booking.status === BookingStatus.Pending;
    const isInUse = booking.status === BookingStatus.InUse;
    const isRejectedLike = booking.status === BookingStatus.Rejected || booking.status === BookingStatus.Cancelled;
    const sMeta = STATUS_META[booking.status];
    const isMultiDay = !sameDay(new Date(booking.startTime), new Date(booking.endTime));

    if (isMultiDay && !isStart) {
        // Continuation bar: colored strip, no time, just title
        return (
            <div
                onClick={e => { e.stopPropagation(); onClick(booking); }}
                className="bk-cal-event"
                style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '2px 6px',
                    background: sMeta?.color + '18', color: sMeta?.color,
                    borderRadius: 4, borderLeft: `3px solid ${sMeta?.color}`,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    opacity: 0.75,
                }}
                title={`${booking.title} · ${fmtTime(booking.startTime)} – ${fmtTime(booking.endTime)}`}
            >
                <span style={{ opacity: 0.6, fontSize: 9, flexShrink: 0 }}>↳</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{booking.title}</span>
            </div>
        );
    }

    return (
        <div
            onClick={e => { e.stopPropagation(); onClick(booking); }}
            className="bk-cal-event"
            style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 6px',
                background: isInUse
                    ? `repeating-linear-gradient(135deg, ${sMeta?.bg}, ${sMeta?.bg} 7px, #dcfce7 7px, #dcfce7 14px)`
                    : sMeta?.bg,
                color: sMeta?.color,
                borderRadius: 4, borderLeft: `3px solid ${sMeta?.color}`,
                fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                opacity: isPending ? 0.9 : 1,
                outline: isPending ? `1px dashed ${sMeta?.dot}` : 'none',
                outlineOffset: -2,
            }}
            title={`${booking.title} · ${booking.userFullName ?? booking.userName ?? ''} · ${fmtTime(booking.startTime)}-${fmtTime(booking.endTime)}`}
        >
            {isRejectedLike && (
                <span style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 800,
                    lineHeight: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    x
                </span>
            )}
            {isInUse && <span className="bk-pulse" style={{ width: 5, height: 5, borderRadius: 99, background: sMeta?.dot, flexShrink: 0 }} />}
            <span style={{ fontWeight: 700, minWidth: 28, flexShrink: 0 }}>{fmtTime(booking.startTime)}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{booking.title}</span>
            {isInUse && (
                <span style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#166534',
                    border: '1px dashed #86efac',
                    background: '#f0fdf4',
                    borderRadius: 5,
                    padding: '0 4px',
                    flexShrink: 0,
                }}>
                    OUT
                </span>
            )}
            {isMultiDay && (
                <span style={{ fontSize: 9, opacity: 0.7, flexShrink: 0, marginLeft: 2 }}>
                    →{Math.ceil((new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 86400000)}d
                </span>
            )}
        </div>
    );
}


// ─── Month grid ───────────────────────────────────────────────────────────────
function MonthCalendar({ year, month, bookings, resources, selectedDate, onSelectDate, onOpenBooking }: {
    year: number; month: number;
    bookings: Booking[]; resources: Resource[];
    selectedDate: Date; onSelectDate: (d: Date) => void;
    onOpenBooking: (b: Booking) => void;
}) {
    const days = buildMonthGrid(year, month);
    const today = new Date();
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="bk-card bk-scroll" style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div style={{ minWidth: 600 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(80px,1fr))', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {weekdays.map(w => (
                    <div key={w} style={{ padding: '9px 10px', fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{w}</div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(80px,1fr))', gridAutoRows: 'minmax(122px, 1fr)' }}>
                {days.map((day, i) => {
                    const inMonth = day.getMonth() === month;
                    const isToday = sameDay(day, today);
                    const isSelected = sameDay(day, selectedDate);
                    const dayBookings = bookingsOnDay(bookings, day)
                        .filter(b => b.status !== BookingStatus.Cancelled)
                        .sort(sortByMonthPreviewPriority);
                    const maxVisible = dayBookings.length > 2 ? 2 : 3;
                    const overflow = dayBookings.length - maxVisible;
                    return (
                        <div key={i} onClick={() => onSelectDate(day)}
                            className="bk-cal-cell"
                            style={{
                                borderRight: i % 7 !== 6 ? '1px solid #f1f5f9' : 'none',
                                borderBottom: i < 35 ? '1px solid #f1f5f9' : 'none',
                                padding: 6, display: 'flex', flexDirection: 'column', gap: 3,
                                background: isSelected ? '#fff7ed' : 'transparent',
                                cursor: 'pointer', minHeight: 0, opacity: inMonth ? 1 : 0.4, position: 'relative',
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 13.5, fontWeight: isToday ? 800 : 600,
                                    color: isToday ? '#fff' : isSelected ? '#E8720C' : '#1e293b',
                                    background: isToday ? '#E8720C' : 'transparent',
                                    width: isToday ? 22 : 'auto', height: isToday ? 22 : 'auto',
                                    borderRadius: isToday ? '50%' : 0,
                                }}>{day.getDate()}</span>
                                {dayBookings.length > 0 && (
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{dayBookings.length}</span>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {dayBookings.slice(0, maxVisible).map(b => {
                                    const isStart = sameDay(new Date(b.startTime), day);
                                    return <CalEvent key={b.id} booking={b} resources={resources} onClick={onOpenBooking} isStart={isStart} />;
                                })}
                                {overflow > 0 && (
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', padding: '2px 4px' }}>+{overflow} more</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>            </div>        </div>
    );
}

// ─── Day sidebar ─────────────────────────────────────────────────────────────
function DaySidebar({ selectedDate, bookings, resources, onOpenBooking }: {
    selectedDate: Date; bookings: Booking[]; resources: Resource[];
    onOpenBooking: (b: Booking) => void;
}) {
    const visibleBookings = useMemo(
        () => bookingsOnDay(bookings, selectedDate)
            .filter(b => b.status !== BookingStatus.Cancelled)
            .sort(sortByStatusThenBorrowTime),
        [bookings, selectedDate]
    );

    const groupedByStatus = useMemo(
        () => DAY_STATUS_ORDER
            .map(status => ({
                status,
                items: visibleBookings
                    .filter(b => b.status === status)
                    .sort(sortByBorrowTime),
            }))
            .filter(group => group.items.length > 0),
        [visibleBookings]
    );


    return (
        <div className="bk-card" style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#E8720C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {sameDay(selectedDate, new Date()) ? 'Today' : 'Selected day'}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2, letterSpacing: '-0.01em' }}>
                    {fmtFullDate(selectedDate)}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    {visibleBookings.length} booking{visibleBookings.length !== 1 ? 's' : ''}
                </div>
            </div>
            <div className="bk-scroll" style={{ overflow: 'auto', flex: 1 }}>
                {/* Bookings */}
                <div style={{ padding: '14px 16px 10px' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Bookings</div>
                    {visibleBookings.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Nothing booked on this day.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {groupedByStatus.map(group => {
                                const groupMeta = STATUS_META[group.status];
                                return (
                                    <div key={group.status} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <StatusBadge status={group.status} />
                                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>{group.items.length}</span>
                                            <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {group.items.map(b => {
                                                const rMeta = getBookingRtMeta(b, resources);
                                                const resourceTypeName = b.resources?.[0]?.resourceTypeName;
                                                return (
                                                    <div key={b.id} onClick={() => onOpenBooking(b)}
                                                        style={{
                                                            padding: '10px 12px', background: '#fff',
                                                            border: '1px solid #e2e8f0', borderLeft: `4px solid ${groupMeta?.color ?? '#94a3b8'}`,
                                                            borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}>
                                                        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                                                            <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.3 }}>{getBookingResourceLabel(b, resources)}</div>
                                                            <div style={{
                                                                fontSize: 11.5,
                                                                fontWeight: 800,
                                                                color: '#334155',
                                                                background: '#f8fafc',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: 999,
                                                                padding: '1px 8px',
                                                                whiteSpace: 'nowrap',
                                                            }}>
                                                                {fmtTime(b.startTime)} - {fmtTime(b.endTime)}
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 5 }}>
                                                            <span style={{ fontWeight: 700 }}>Booking title: </span>{b.title}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                                ↑ {fmtTime(b.startTime)}
                                                            </span>
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                                ↓ {fmtTime(b.endTime)}
                                                            </span>
                                                            {resourceTypeName && (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                                                    padding: '1px 7px',
                                                                    background: rMeta.bg,
                                                                    color: rMeta.color,
                                                                    border: `1px solid ${rMeta.color}33`,
                                                                    borderRadius: 999,
                                                                    fontSize: 10.5,
                                                                    fontWeight: 700,
                                                                    whiteSpace: 'nowrap',
                                                                }}>
                                                                    {resourceTypeName}
                                                                </span>
                                                            )}
                                                            {b.status === BookingStatus.InUse && (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                                                    padding: '1px 7px',
                                                                    background: '#f0fdf4',
                                                                    color: '#166534',
                                                                    border: '1px dashed #86efac',
                                                                    borderRadius: 999,
                                                                    fontSize: 10.5,
                                                                    fontWeight: 800,
                                                                    whiteSpace: 'nowrap',
                                                                }}>
                                                                    Checked out
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            <Avatar name={b.userFullName ?? b.userName ?? ''} size={18} />
                                                            <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500 }}>{b.userFullName ?? b.userName}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

// ─── Pending queue (manager/director only) ───────────────────────────────────
function PendingQueue({ bookings, resources, onApprove, onReject, onAdjust, onOpen }: {
    bookings: Booking[]; resources: Resource[];
    onApprove: (id: string, note?: string) => void;
    onReject: (id: string, reason?: string) => void;
    onAdjust?: (id: string, opts: { newResourceIds: string[]; adjustReason: string }) => Promise<void>;
    onOpen: (b: Booking) => void;
}) {
    type ActionType = 'approve' | 'reject' | 'adjust';
    const pending = bookings.filter(b => b.status === BookingStatus.Pending);
    const [activeAction, setActiveAction]       = useState<{ id: string; type: ActionType } | null>(null);
    const [actionReason, setActionReason]       = useState('');
    const [adjustResGroups, setAdjustResGroups] = useState<ResGroup[]>([]);
    const [groupKeptQtys, setGroupKeptQtys]     = useState<Record<string, number>>({});
    const [actionLoading, setActionLoading]     = useState(false);

    if (pending.length === 0) return null;

    const openAction = (b: Booking, type: ActionType) => {
        if (activeAction?.id === b.id && activeAction.type === type) { setActiveAction(null); return; }
        setActionReason('');
        if (type === 'adjust') {
            const bRes: BasicResourceResponse[] = b.resources?.length
                ? b.resources
                : (b.resourceIds ?? []).flatMap(id => {
                    const r = resources.find(r2 => r2.id === id || r2.ids?.includes(id));
                    return r ? [{ id, name: r.name, resourceTypeName: r.resourceTypeName, location: r.location } as BasicResourceResponse] : [];
                  });
            const rg = groupResources(bRes);
            const init: Record<string, number> = {};
            rg.forEach(g => { init[g.key] = g.ids.length; });
            setAdjustResGroups(rg);
            setGroupKeptQtys(init);
        }
        setActiveAction({ id: b.id, type });
    };

    const totalKept = adjustResGroups.reduce((s, g) => s + (groupKeptQtys[g.key] ?? g.ids.length), 0);
    const isAllZero = activeAction?.type === 'adjust' && adjustResGroups.length > 0 && totalKept === 0;

    const confirmAction = async () => {
        if (!activeAction) return;
        const { id, type } = activeAction;
        if ((type === 'reject' || type === 'adjust') && !actionReason.trim()) return;
        setActionLoading(true);
        try {
            if (type === 'approve') {
                onApprove(id, actionReason.trim() || undefined);
            } else if (type === 'reject') {
                onReject(id, actionReason.trim());
            } else {
                if (isAllZero) {
                    onReject(id, actionReason.trim());
                } else {
                    if (!onAdjust) return;
                    const newResourceIds = adjustResGroups.flatMap(g => g.ids.slice(0, groupKeptQtys[g.key] ?? g.ids.length));
                    await onAdjust(id, { newResourceIds, adjustReason: actionReason.trim() });
                }
            }
            setActiveAction(null);
        } catch { /* caller shows toast */ }
        finally { setActionLoading(false); }
    };

    const activeBooking = activeAction ? pending.find(b => b.id === activeAction.id) : null;
    const canConfirm    = !actionLoading && (activeAction?.type === 'approve' || !!actionReason.trim());

    // Per-action panel styling
    const panelBg      = activeAction?.type === 'approve' ? '#f0fdf4' : activeAction?.type === 'reject' ? '#fef2f2' : '#fff7ed';
    const panelBorder  = activeAction?.type === 'approve' ? '#bbf7d0' : activeAction?.type === 'reject' ? '#fecaca' : '#fed7aa';
    const panelLabel   = activeAction?.type === 'approve' ? '#166534' : activeAction?.type === 'reject' ? '#991b1b' : '#92400E';
    const confirmBg    = (isAllZero || activeAction?.type === 'reject') ? '#dc2626' : activeAction?.type === 'approve' ? '#16a34a' : '#ea580c';
    const confirmLabel = activeAction?.type === 'approve' ? 'Confirm Approve' : (isAllZero || activeAction?.type === 'reject') ? 'Confirm Reject' : 'Confirm Adjust';
    const textareaLabel = activeAction?.type === 'approve' ? 'Approval note (optional)' : isAllZero ? 'Rejection reason (all resources removed) *' : activeAction?.type === 'reject' ? 'Rejection reason *' : 'Adjustment reason *';
    const textareaPlaceholder = activeAction?.type === 'approve' ? 'Add an approval note... (optional)' : activeAction?.type === 'reject' ? 'Enter rejection reason...' : isAllZero ? 'Explain why you are rejecting this booking...' : 'Explain why resources are being adjusted...';

    return (
        <div className="bk-card" style={{ padding: '14px 16px', background: '#FFFBEB', borderColor: '#FDE68A', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertCircle size={16} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#92400E' }}>Needs your approval</div>
                <div style={{ fontSize: 14, color: '#B45309', marginLeft: 2 }}>{pending.length} waiting — oldest {relTime(pending[0].createdAt)}</div>
                <div style={{ flex: 1 }} />
                <button onClick={() => onOpen(pending[0])} style={{ padding: '6px 14px', background: '#fff', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Review queue
                </button>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }} className="bk-scroll">
                {pending.slice(0, 6).map(b => {
                    const label = getBookingResourceLabel(b, resources);
                    const activeType = activeAction?.id === b.id ? activeAction.type : null;
                    const cardBorder = activeType === 'approve' ? '#16a34a' : activeType === 'reject' ? '#dc2626' : activeType === 'adjust' ? '#f97316' : '#e2e8f0';
                    return (
                        <div
                            key={b.id}
                            onClick={() => onOpen(b)}
                            style={{
                                minWidth: 300,
                                padding: '12px 14px',
                                background: '#fff',
                                border: `1.5px solid ${cardBorder}`,
                                borderRadius: 12,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 7,
                                flexShrink: 0,
                                transition: 'border-color 0.15s',
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {b.isUrgent && <span style={{ fontSize: 10, fontWeight: 800, color: '#DC2626', background: '#FEE2E2', padding: '2px 7px', borderRadius: 5, letterSpacing: '0.05em' }}>URGENT</span>}
                                <div style={{ fontSize: 17, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                            </div>
                            <div style={{ fontSize: 14, color: '#64748b' }}>{label} · {fmtDate(b.startTime)} · {fmtTime(b.startTime)}-{fmtTime(b.endTime)}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                                <Avatar name={b.userFullName ?? b.userName ?? ''} size={22} />
                                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.userFullName ?? b.userName}</span>
                                {onAdjust && (
                                    <button onClick={e => { e.stopPropagation(); openAction(b, 'adjust'); }}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: activeType === 'adjust' ? '#fff7ed' : '#fff', color: activeType === 'adjust' ? '#ea580c' : '#64748b', border: `1px solid ${activeType === 'adjust' ? '#f97316' : '#e2e8f0'}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                        <SlidersHorizontal size={12} /> Adjust
                                    </button>
                                )}
                                <button onClick={e => { e.stopPropagation(); openAction(b, 'reject'); }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: activeType === 'reject' ? '#fef2f2' : '#fff', color: '#DC2626', border: `1px solid ${activeType === 'reject' ? '#fca5a5' : '#FECACA'}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                    <X size={12} /> Reject
                                </button>
                                <button onClick={e => { e.stopPropagation(); openAction(b, 'approve'); }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: activeType === 'approve' ? '#15803d' : '#059669', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                    <Check size={12} /> Approve
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Action panel (approve / reject / adjust) ── */}
            {activeBooking && activeAction && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: panelLabel, marginBottom: 8 }}>
                        {activeAction.type === 'approve' ? 'Approve' : activeAction.type === 'reject' ? 'Reject' : isAllZero ? 'Reject (all resources removed)' : 'Adjust resources for'}:{' '}
                        <span style={{ color: confirmBg }}>{activeBooking.title}</span>
                    </div>

                    {/* Resource +/- controls — adjust mode only */}
                    {activeAction.type === 'adjust' && adjustResGroups.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                            {adjustResGroups.map(g => {
                                const kept = groupKeptQtys[g.key] ?? g.ids.length;
                                return (
                                    <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fff', borderRadius: 8, border: `1px solid ${panelBorder}` }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                                            {g.resourceTypeName && <div style={{ fontSize: 10, color: '#94a3b8' }}>{g.resourceTypeName}{g.location ? ` · ${g.location}` : ''}</div>}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                            <button onClick={() => setGroupKeptQtys(q => ({ ...q, [g.key]: Math.max(0, (q[g.key] ?? g.ids.length) - 1) }))}
                                                style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${panelBorder}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                <Minus size={10} />
                                            </button>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: kept === 0 ? '#dc2626' : '#1e293b', minWidth: 32, textAlign: 'center' }}>
                                                {kept}<span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>/{g.ids.length}</span>
                                            </span>
                                            <button onClick={() => setGroupKeptQtys(q => ({ ...q, [g.key]: Math.min(g.ids.length, (q[g.key] ?? g.ids.length) + 1) }))}
                                                style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${panelBorder}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                <Plus size={10} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {isAllZero
                                ? <div style={{ fontSize: 10, color: '#dc2626', fontStyle: 'italic', fontWeight: 600 }}>All resources removed — this will be treated as a rejection.</div>
                                : <div style={{ fontSize: 10, color: '#b45309', fontStyle: 'italic' }}>Keeping {totalKept} of {adjustResGroups.reduce((s, g) => s + g.ids.length, 0)} unit(s)</div>
                            }
                        </div>
                    )}
                    {activeAction.type === 'adjust' && adjustResGroups.length === 0 && (
                        <div style={{ fontSize: 11, color: '#b45309', marginBottom: 8 }}>No resource details available — quantity adjustment skipped.</div>
                    )}

                    {/* Reason / note textarea */}
                    <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: panelLabel, display: 'block', marginBottom: 4 }}>{textareaLabel}</label>
                        <textarea
                            autoFocus
                            value={actionReason}
                            onChange={e => setActionReason(e.target.value)}
                            placeholder={textareaPlaceholder}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: `1.5px solid ${panelBorder}`, fontSize: '0.75rem', fontFamily: 'inherit', outline: 'none', minHeight: 44, resize: 'vertical', background: '#fff', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={confirmAction} disabled={!canConfirm}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 14px', borderRadius: 7, border: 'none', background: !canConfirm ? '#e2e8f0' : confirmBg, color: !canConfirm ? '#94a3b8' : '#fff', fontSize: 11, fontWeight: 700, cursor: !canConfirm ? 'not-allowed' : 'pointer' }}>
                            {actionLoading ? <Loader2 size={11} className="animate-spin" /> : (activeAction.type === 'approve' ? <Check size={11} /> : activeAction.type === 'reject' || isAllZero ? <X size={11} /> : <SlidersHorizontal size={11} />)}
                            {' '}{confirmLabel}
                        </button>
                        <button onClick={() => setActiveAction(null)}
                            style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${panelBorder}`, background: '#fff', color: '#64748b', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Month nav ────────────────────────────────────────────────────────────────
function MonthNav({ year, month, setMonth, setYear }: {
    year: number; month: number;
    setMonth: (m: number) => void; setYear: (y: number) => void;
}) {
    const monthName = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const prev = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
    const next = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };
    const goToday = () => { const t = new Date(); setMonth(t.getMonth()); setYear(t.getFullYear()); };
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={prev} className="icon-btn" style={{ width: 30, height: 30 }}><ChevronLeft size={16} /></button>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em', minWidth: 150, textAlign: 'center' }}>{monthName}</div>
            <button onClick={next} className="icon-btn" style={{ width: 30, height: 30 }}><ChevronRight size={16} /></button>
            <button onClick={goToday} style={{ padding: '5px 12px', background: '#fff', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Today
            </button>
        </div>
    );
}

// ─── Main CalendarView ────────────────────────────────────────────────────────
interface CalendarViewProps {
    bookings: Booking[];
    resources: Resource[];
    isManager: boolean;
    onOpenBooking: (b: Booking) => void;
    onNewBooking: (resource?: Resource, date?: Date) => void;
    onApprove: (id: string, note?: string) => void;
    onReject: (id: string, reason?: string) => void;
    onAdjust?: (id: string, opts: { newResourceIds: string[]; adjustReason: string }) => Promise<void>;
}

export default function CalendarView({ bookings, resources, isManager, onOpenBooking, onNewBooking, onApprove, onReject, onAdjust }: CalendarViewProps) {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState(today);
    const [filterTypes, setFilterTypes] = useState<string[]>([]);
    const [filterStatus, setFilterStatus] = useState('');

    const filtered = useMemo(() => {
        const selectedTypeKeys = new Set(filterTypes.map(type => normalizeType(type)));

        return bookings.filter(b => {
            if (b.status === BookingStatus.Cancelled) return false;

            if (selectedTypeKeys.size > 0) {
                const bookingTypeKeys = getBookingTypeNames(b, resources).map(type => normalizeType(type));
                if (bookingTypeKeys.length === 0) return false;
                if (!bookingTypeKeys.some(typeKey => selectedTypeKeys.has(typeKey))) return false;
            }

            if (filterStatus && String(b.status) !== filterStatus) return false;
            return true;
        });
    }, [bookings, resources, filterTypes, filterStatus]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Resource Booking</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>See who's using what, when — and find open slots.</div>
                </div>
                <MonthNav year={year} month={month} setMonth={setMonth} setYear={setYear} />
            </div>

            {/* Pending queue */}
            {isManager && <PendingQueue bookings={bookings} resources={resources} onApprove={onApprove} onReject={onReject} onAdjust={onAdjust} onOpen={onOpenBooking} />}

            {/* Filters */}
            <FilterBar
                filterStatus={filterStatus} setFilterStatus={setFilterStatus}
                filterTypes={filterTypes} setFilterTypes={setFilterTypes}
                resources={resources}
                onNewBooking={() => onNewBooking(undefined, selectedDate)}
            />

            {/* Calendar + sidebar */}
            <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>
                <MonthCalendar
                    year={year} month={month} bookings={filtered} resources={resources}
                    selectedDate={selectedDate} onSelectDate={setSelectedDate} onOpenBooking={onOpenBooking}
                />
                <DaySidebar
                    selectedDate={selectedDate} bookings={filtered} resources={resources}
                    onOpenBooking={onOpenBooking}
                />
            </div>
        </div>
    );
}
