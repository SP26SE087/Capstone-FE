import React, { useState, useMemo } from 'react';
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
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 7px', background: m.bg, color: m.color,
            fontSize: 10, fontWeight: 700, borderRadius: 999,
            border: `1px solid ${m.border}`, whiteSpace: 'nowrap',
        }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: m.dot }} />
            {m.label}
        </span>
    );
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
    // Build unique resource type names from loaded resources
    const typeNames = useMemo(() => {
        const seen = new Set<string>();
        const out: string[] = [];
        resources.forEach(r => {
            const n = r.resourceTypeName;
            if (n && !seen.has(n)) { seen.add(n); out.push(n); }
        });
        return out;
    }, [resources]);

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            padding: '9px 12px',
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
            marginBottom: 14,
        }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filter</span>
            {typeNames.map(t => {
                const meta = getBookingRtMeta({ title: '', startTime: '', endTime: '', status: BookingStatus.Pending, createdAt: '' } as any, resources.filter(r => r.resourceTypeName === t));
                const active = filterTypes.length === 0 || filterTypes.includes(t);
                return (
                    <button key={t} onClick={() => setFilterTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px', fontSize: 12, fontWeight: 600,
                            background: active ? meta.bg : '#fff',
                            color: active ? meta.color : '#94a3b8',
                            border: `1px solid ${active ? meta.color + '33' : '#e2e8f0'}`,
                            borderRadius: 999, cursor: 'pointer',
                            opacity: active ? 1 : 0.6,
                        }}>
                        <RtIcon iconName={meta.iconName} size={12} />
                        {t}
                    </button>
                );
            })}
            <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{
                    padding: '5px 10px', fontSize: 12, fontWeight: 600,
                    border: '1px solid #e2e8f0', borderRadius: 8,
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
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', background: '#E8720C', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
                <Plus size={14} /> New booking
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
                    fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
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
                background: sMeta?.bg, color: sMeta?.color,
                borderRadius: 4, borderLeft: `3px solid ${sMeta?.color}`,
                fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                opacity: isPending ? 0.9 : 1,
                outline: isPending ? `1px dashed ${sMeta?.dot}` : 'none',
                outlineOffset: -2,
            }}
            title={`${booking.title} · ${booking.userFullName ?? booking.userName ?? ''} · ${fmtTime(booking.startTime)}-${fmtTime(booking.endTime)}`}
        >
            {isInUse && <span className="bk-pulse" style={{ width: 5, height: 5, borderRadius: 99, background: sMeta?.dot, flexShrink: 0 }} />}
            <span style={{ fontWeight: 700, minWidth: 28, flexShrink: 0 }}>{fmtTime(booking.startTime)}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{booking.title}</span>
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
            <div style={{ minWidth: 560 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(80px,1fr))', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {weekdays.map(w => (
                    <div key={w} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{w}</div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(80px,1fr))', gridAutoRows: 'minmax(110px, 1fr)' }}>
                {days.map((day, i) => {
                    const inMonth = day.getMonth() === month;
                    const isToday = sameDay(day, today);
                    const isSelected = sameDay(day, selectedDate);
                    const dayBookings = bookingsOnDay(bookings, day)
                        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
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
                                    fontSize: 12, fontWeight: isToday ? 800 : 600,
                                    color: isToday ? '#fff' : isSelected ? '#E8720C' : '#1e293b',
                                    background: isToday ? '#E8720C' : 'transparent',
                                    width: isToday ? 22 : 'auto', height: isToday ? 22 : 'auto',
                                    borderRadius: isToday ? '50%' : 0,
                                }}>{day.getDate()}</span>
                                {dayBookings.length > 0 && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{dayBookings.length}</span>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {dayBookings.slice(0, maxVisible).map(b => {
                                    const isStart = sameDay(new Date(b.startTime), day);
                                    return <CalEvent key={b.id} booking={b} resources={resources} onClick={onOpenBooking} isStart={isStart} />;
                                })}
                                {overflow > 0 && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', padding: '2px 4px' }}>+{overflow} more</span>
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
    const dayBookings = useMemo(
        () => bookingsOnDay(bookings, selectedDate).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
        [bookings, selectedDate]
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
                    {dayBookings.length} booking{dayBookings.length !== 1 ? 's' : ''}
                </div>
            </div>
            <div className="bk-scroll" style={{ overflow: 'auto', flex: 1 }}>
                {/* Bookings */}
                <div style={{ padding: '14px 16px 10px' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Bookings</div>
                    {dayBookings.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Nothing booked on this day.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {dayBookings.map(b => {
                                const rMeta = getBookingRtMeta(b, resources);
                                return (
                                    <div key={b.id} onClick={() => onOpenBooking(b)}
                                        style={{
                                            padding: '10px 12px', background: '#fff',
                                            border: '1px solid #e2e8f0', borderLeft: `3px solid ${rMeta.color}`,
                                            borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}>
                                        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{getBookingResourceLabel(b, resources)}</div>
                                            <StatusBadge status={b.status} />
                                        </div>
                                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                                            <span style={{ fontWeight: 700 }}>Booking title: </span>{b.title}
                                        </div>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 999, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                ↑ {fmtTime(b.startTime)}
                                            </span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 999, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                ↓ {fmtTime(b.endTime)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <Avatar name={b.userFullName ?? b.userName ?? ''} size={18} />
                                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{b.userFullName ?? b.userName}</span>
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
        <div className="bk-card" style={{ padding: '10px 12px', background: '#FFFBEB', borderColor: '#FDE68A', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertCircle size={13} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#92400E' }}>Needs your approval</div>
                <div style={{ fontSize: 11, color: '#B45309', marginLeft: 2 }}>{pending.length} waiting — oldest {relTime(pending[0].createdAt)}</div>
                <div style={{ flex: 1 }} />
                <button onClick={() => onOpen(pending[0])} style={{ padding: '3px 10px', background: '#fff', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Review queue
                </button>
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }} className="bk-scroll">
                {pending.slice(0, 6).map(b => {
                    const label = getBookingResourceLabel(b, resources);
                    const activeType = activeAction?.id === b.id ? activeAction.type : null;
                    const cardBorder = activeType === 'approve' ? '#16a34a' : activeType === 'reject' ? '#dc2626' : activeType === 'adjust' ? '#f97316' : '#e2e8f0';
                    return (
                        <div key={b.id} style={{ minWidth: 240, padding: '8px 10px', background: '#fff', border: `1.5px solid ${cardBorder}`, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0, transition: 'border-color 0.15s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {b.isUrgent && <span style={{ fontSize: 9, fontWeight: 800, color: '#DC2626', background: '#FEE2E2', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.05em' }}>URGENT</span>}
                                <div style={{ fontSize: 12, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{label} · {fmtDate(b.startTime)} · {fmtTime(b.startTime)}-{fmtTime(b.endTime)}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1, flexWrap: 'wrap' }}>
                                <Avatar name={b.userFullName ?? b.userName ?? ''} size={18} />
                                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.userFullName ?? b.userName}</span>
                                {onAdjust && (
                                    <button onClick={e => { e.stopPropagation(); openAction(b, 'adjust'); }}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', background: activeType === 'adjust' ? '#fff7ed' : '#fff', color: activeType === 'adjust' ? '#ea580c' : '#64748b', border: `1px solid ${activeType === 'adjust' ? '#f97316' : '#e2e8f0'}`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                        <SlidersHorizontal size={11} /> Adjust
                                    </button>
                                )}
                                <button onClick={e => { e.stopPropagation(); openAction(b, 'reject'); }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', background: activeType === 'reject' ? '#fef2f2' : '#fff', color: '#DC2626', border: `1px solid ${activeType === 'reject' ? '#fca5a5' : '#FECACA'}`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                    <X size={11} /> Reject
                                </button>
                                <button onClick={e => { e.stopPropagation(); openAction(b, 'approve'); }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', background: activeType === 'approve' ? '#15803d' : '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                    <Check size={11} /> Approve
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

    const filtered = useMemo(() => bookings.filter(b => {
        if (filterTypes.length > 0) {
            const typeName = b.resources?.[0]?.resourceTypeName;
            if (!typeName || !filterTypes.includes(typeName)) return false;
        }
        if (filterStatus && String(b.status) !== filterStatus) return false;
        return true;
    }), [bookings, filterTypes, filterStatus]);

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
