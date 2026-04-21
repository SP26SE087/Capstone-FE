import React, { useState, useMemo } from 'react';
import {
    ChevronLeft, ChevronRight, Plus,
    Cpu, Database, Radio, Monitor, Package, FlaskConical, Microscope
} from 'lucide-react';
import { Booking, Resource, BookingStatus } from '@/types/booking';
import {
    STATUS_META, getBookingRtMeta, fmtTime, fmtDate, fmtFullDate, sameDay, initials,
} from './bookingViewUtils';

// ─── Icon by name ─────────────────────────────────────────────────────────────
function RtIcon({ iconName, size = 14 }: { iconName: string; size?: number }) {
    const map: Record<string, React.ElementType> = {
        cpu: Cpu, microscope: Microscope, radio: Radio,
        monitor: Monitor, 'flask-conical': FlaskConical, database: Database, package: Package,
    };
    const Icon = map[iconName] ?? Package;
    return <Icon size={size} />;
}

// ─── Build N-day range starting from a given date ────────────────────────────
function buildDayRange(start: Date, days: number): Date[] {
    const out: Date[] = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        d.setHours(0, 0, 0, 0);
        out.push(d);
    }
    return out;
}

// ─── Segmented control ────────────────────────────────────────────────────────
function Segmented<T extends string | number>({ value, onChange, options }: {
    value: T; onChange: (v: T) => void;
    options: { value: T; label: string }[];
}) {
    return (
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2, gap: 2 }}>
            {options.map(opt => (
                <button key={String(opt.value)} onClick={() => onChange(opt.value)}
                    style={{
                        padding: '4px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: value === opt.value ? '#fff' : 'transparent',
                        color: value === opt.value ? '#1e293b' : '#64748b',
                        boxShadow: value === opt.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.15s',
                    }}>
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

// ─── Main TimelineView ────────────────────────────────────────────────────────
interface TimelineViewProps {
    bookings: Booking[];
    resources: Resource[];
    onOpenBooking: (b: Booking) => void;
    onNewBooking: (resource?: Resource, date?: Date) => void;
}

export default function TimelineView({ bookings, resources, onOpenBooking, onNewBooking }: TimelineViewProps) {
    const today = new Date();
    // Start from Monday of current week
    const dow = (today.getDay() + 6) % 7;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dow);
    weekStart.setHours(0, 0, 0, 0);

    const [rangeStart, setRangeStart] = useState(weekStart);
    const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14);
    const [filterType, setFilterType] = useState('');

    const days = buildDayRange(rangeStart, rangeDays);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeStart.getDate() + rangeDays);

    const DAY_WIDTH = rangeDays <= 7 ? 130 : rangeDays <= 14 ? 80 : 50;
    const ROW_HEIGHT = 52;
    const LABEL_W = 220;
    const totalWidth = DAY_WIDTH * rangeDays;

    // Unique resource type names
    const typeNames = useMemo(() => {
        const seen = new Set<string>();
        const out: string[] = [];
        resources.forEach(r => { if (r.resourceTypeName && !seen.has(r.resourceTypeName)) { seen.add(r.resourceTypeName); out.push(r.resourceTypeName); } });
        return out;
    }, [resources]);

    const visibleResources = useMemo(
        () => filterType ? resources.filter(r => r.resourceTypeName === filterType) : resources,
        [resources, filterType]
    );

    // Position a booking block in pixels
    const posFor = (booking: Booking) => {
        const s = new Date(booking.startTime);
        const e = new Date(booking.endTime);
        if (e < rangeStart || s > rangeEnd) return null;
        const clampedS = s < rangeStart ? rangeStart : s;
        const clampedE = e > rangeEnd ? rangeEnd : e;
        const msPerDay = 86400000;
        const left = ((clampedS.getTime() - rangeStart.getTime()) / msPerDay) * DAY_WIDTH;
        const width = Math.max(((clampedE.getTime() - clampedS.getTime()) / msPerDay) * DAY_WIDTH, 24);
        return { left, width };
    };

    // Group bookings by resource ID
    const bookingsByResource = useMemo(() => {
        const map: Record<string, Booking[]> = {};
        resources.forEach(r => { map[r.id] = []; });
        bookings.forEach(b => {
            (b.resourceIds ?? (b.resourceId ? [b.resourceId] : [])).forEach(id => {
                const r = resources.find(x => x.id === id || x.ids?.includes(id));
                if (r && map[r.id]) map[r.id].push(b);
            });
        });
        return map;
    }, [bookings, resources]);

    const prevRange = () => { const d = new Date(rangeStart); d.setDate(d.getDate() - rangeDays); setRangeStart(d); };
    const nextRange = () => { const d = new Date(rangeStart); d.setDate(d.getDate() + rangeDays); setRangeStart(d); };
    const goToday = () => {
        const t = new Date();
        const dw = (t.getDay() + 6) % 7;
        const w = new Date(t);
        w.setDate(t.getDate() - dw);
        w.setHours(0, 0, 0, 0);
        setRangeStart(w);
    };

    const nowLeft = ((Date.now() - rangeStart.getTime()) / 86400000) * DAY_WIDTH;
    const nowInRange = nowLeft >= 0 && nowLeft <= totalWidth;
    const rangeLabel = `${fmtDate(rangeStart)} – ${fmtDate(days[days.length - 1])}`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Resource Timeline</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Horizontal schedule — spot conflicts and find open slots at a glance.</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={prevRange} className="icon-btn" style={{ width: 30, height: 30 }}><ChevronLeft size={16} /></button>
                    <div style={{ fontSize: 14, fontWeight: 700, minWidth: 180, textAlign: 'center' }}>{rangeLabel}</div>
                    <button onClick={nextRange} className="icon-btn" style={{ width: 30, height: 30 }}><ChevronRight size={16} /></button>
                    <button onClick={goToday} style={{ padding: '5px 12px', background: '#fff', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Today</button>
                    <div style={{ width: 1, height: 22, background: '#e2e8f0', margin: '0 4px' }} />
                    <Segmented
                        value={rangeDays}
                        onChange={(v) => setRangeDays(v as 7 | 14 | 30)}
                        options={[{ value: 7, label: 'Week' }, { value: 14, label: '2 weeks' }, { value: 30, label: 'Month' }]}
                    />
                </div>
            </div>

            {/* Filter row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '9px 12px', marginBottom: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filter by type</span>
                <button onClick={() => setFilterType('')}
                    style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 999, background: !filterType ? '#E8720C' : '#fff', color: !filterType ? '#fff' : '#64748b', border: `1px solid ${!filterType ? '#E8720C' : '#e2e8f0'}`, cursor: 'pointer' }}>
                    All ({resources.length})
                </button>
                {typeNames.map(t => {
                    const meta = getBookingRtMeta({ title: '', startTime: '', endTime: '', status: BookingStatus.Pending, createdAt: '' } as any, resources.filter(r => r.resourceTypeName === t));
                    const active = filterType === t;
                    const count = resources.filter(r => r.resourceTypeName === t).length;
                    return (
                        <button key={t} onClick={() => setFilterType(t)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 999, background: active ? meta.bg : '#fff', color: active ? meta.color : '#64748b', border: `1px solid ${active ? meta.color + '55' : '#e2e8f0'}`, cursor: 'pointer' }}>
                            <RtIcon iconName={meta.iconName} size={12} />
                            {t} ({count})
                        </button>
                    );
                })}
                <div style={{ flex: 1 }} />
                {/* Legend */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#94a3b8' }}>
                    {[
                        { bg: '#DCFCE7', border: '#A7F3D0', label: 'Approved' },
                        { bg: '#EDE9FE', border: '#DDD6FE', label: 'In use' },
                        { bg: '#FEF3C7', border: '#F59E0B', label: 'Pending', dashed: true },
                    ].map(l => (
                        <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: l.bg, border: `1px ${l.dashed ? 'dashed' : 'solid'} ${l.border}` }} />
                            {l.label}
                        </span>
                    ))}
                </div>
            </div>

            {/* Timeline grid */}
            <div className="bk-card bk-scroll" style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
                <div style={{ minWidth: LABEL_W + totalWidth }}>
                    {/* Day header */}
                    <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 4, background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ width: LABEL_W, flexShrink: 0, padding: '10px 14px', borderRight: '1px solid #e2e8f0', fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>
                            {visibleResources.length} Resource{visibleResources.length !== 1 ? 's' : ''}
                        </div>
                        <div style={{ display: 'flex' }}>
                            {days.map((d, i) => {
                                const isToday = sameDay(d, today);
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                return (
                                    <div key={i} style={{ width: DAY_WIDTH, flexShrink: 0, padding: '8px 6px', borderRight: '1px solid #f1f5f9', background: isToday ? '#fff7ed' : isWeekend ? '#f8fafc' : '#fff', textAlign: 'center' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? '#E8720C' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {d.toLocaleDateString(undefined, { weekday: 'short' })}
                                        </div>
                                        <div style={{ fontSize: 14, fontWeight: isToday ? 800 : 600, color: isToday ? '#E8720C' : '#1e293b', marginTop: 1 }}>
                                            {d.getDate()}
                                            {d.getDate() === 1 && <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, marginLeft: 3 }}>{d.toLocaleDateString(undefined, { month: 'short' })}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Resource rows */}
                    <div style={{ position: 'relative' }}>
                        {/* Now line */}
                        {nowInRange && (
                            <div style={{ position: 'absolute', top: 0, bottom: 0, left: LABEL_W + nowLeft, width: 2, background: '#E8720C', zIndex: 3, boxShadow: '0 0 0 3px rgba(232,114,12,0.15)', pointerEvents: 'none' }}>
                                <div style={{ position: 'absolute', top: -6, left: -5, width: 12, height: 12, borderRadius: 99, background: '#E8720C', border: '2px solid #fff' }} />
                            </div>
                        )}

                        {visibleResources.map((r, ridx) => {
                            const rMeta = getBookingRtMeta({ title: '', startTime: '', endTime: '', status: BookingStatus.Pending, createdAt: '' } as any, [r]);
                            const rBookings = (bookingsByResource[r.id] ?? [])
                                .filter(b => [BookingStatus.Approved, BookingStatus.InUse, BookingStatus.Pending, BookingStatus.Completed].includes(b.status));

                            // Lane assignment for overlaps
                            const laned: { b: Booking; lane: number }[] = [];
                            rBookings
                                .slice()
                                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                                .forEach(b => {
                                    let lane = 0;
                                    while (laned.some(x =>
                                        x.lane === lane &&
                                        new Date(x.b.endTime) > new Date(b.startTime) &&
                                        new Date(x.b.startTime) < new Date(b.endTime)
                                    )) lane++;
                                    laned.push({ b, lane });
                                });
                            const maxLane = Math.max(0, ...laned.map(x => x.lane));
                            const rowHeight = ROW_HEIGHT + maxLane * 28;

                            return (
                                <div key={r.id} style={{ display: 'flex', borderBottom: ridx < visibleResources.length - 1 ? '1px solid #f1f5f9' : 'none', height: rowHeight, position: 'relative' }}>
                                    {/* Label */}
                                    <div style={{ width: LABEL_W, flexShrink: 0, padding: '10px 14px', borderRight: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', left: 0, zIndex: 2, background: '#fff' }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 7, background: rMeta.bg, color: rMeta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <RtIcon iconName={rMeta.iconName} size={14} />
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                                            <div style={{ fontSize: 10.5, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.location ?? r.resourceTypeName}</div>
                                        </div>
                                    </div>
                                    {/* Track */}
                                    <div style={{ position: 'relative', flex: 1, height: '100%' }}>
                                        {/* Day grid lines / click targets */}
                                        {days.map((d, i) => {
                                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                            return (
                                                <div key={i}
                                                    style={{ position: 'absolute', left: i * DAY_WIDTH, top: 0, bottom: 0, width: DAY_WIDTH, borderRight: '1px solid #f1f5f9', background: isWeekend ? 'rgba(241,245,249,0.5)' : 'transparent', cursor: 'pointer' }}
                                                    onClick={() => onNewBooking(r, d)}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#fff7ed'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = isWeekend ? 'rgba(241,245,249,0.5)' : 'transparent'; }}
                                                />
                                            );
                                        })}
                                        {/* Booking blocks */}
                                        {laned.map(({ b, lane }, i) => {
                                            const p = posFor(b);
                                            if (!p) return null;
                                            const sMeta = STATUS_META[b.status];
                                            const isPending = b.status === BookingStatus.Pending;
                                            const isInUse = b.status === BookingStatus.InUse;
                                            return (
                                                <div key={b.id + '-' + i}
                                                    onClick={e => { e.stopPropagation(); onOpenBooking(b); }}
                                                    style={{
                                                        position: 'absolute',
                                                        left: p.left + 2, width: p.width - 4,
                                                        top: 6 + lane * 28, height: 38,
                                                        background: sMeta?.bg ?? '#f1f5f9',
                                                        color: sMeta?.color ?? '#64748b',
                                                        border: isPending ? `1.5px dashed ${sMeta?.dot}` : `1px solid ${sMeta?.border}`,
                                                        borderLeft: !isPending ? `4px solid ${sMeta?.dot}` : undefined,
                                                        borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                                                        overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                                                        transition: 'all 0.15s', zIndex: 1,
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.12)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                                                    title={`${b.title}\n${b.userFullName ?? b.userName ?? ''}\n${fmtFullDate(b.startTime)} ${fmtTime(b.startTime)} – ${fmtTime(b.endTime)}`}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                                                        {isInUse && <span className="bk-pulse" style={{ width: 6, height: 6, borderRadius: 99, background: sMeta?.dot, flexShrink: 0 }} />}
                                                        <span style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
                                                    </div>
                                                    {p.width > 80 && (
                                                        <div style={{ fontSize: 10, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.8 }}>
                                                            {b.userFullName ?? b.userName} · {fmtTime(b.startTime)}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, textAlign: 'center' }}>
                Click an empty slot to request a booking · Click a block to see details
            </div>
        </div>
    );
}
