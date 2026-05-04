import React, { useState, useMemo, useRef, useEffect } from 'react';
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
    const [filterTypes, setFilterTypes] = useState<string[]>([]);
    const [typeMenuOpen, setTypeMenuOpen] = useState(false);
    const [typeSearch, setTypeSearch] = useState('');
    const typeMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!typeMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) setTypeMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [typeMenuOpen]);

    const days = buildDayRange(rangeStart, rangeDays);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeStart.getDate() + rangeDays);

    const DAY_WIDTH = rangeDays <= 7 ? 130 : rangeDays <= 14 ? 80 : 50;
    const ROW_HEIGHT = 52;
    const LABEL_W = 220;
    const totalWidth = DAY_WIDTH * rangeDays;

    const typeOptions = useMemo(() => {
        const byKey = new Map<string, { label: string; count: number }>();
        resources.forEach(r => {
            const name = r.resourceTypeName?.trim();
            if (!name) return;
            const key = name.toLowerCase();
            const qty = Math.max(r.totalQuantity ?? r.ids?.length ?? 1, 1);
            const cur = byKey.get(key);
            if (cur) cur.count += qty; else byKey.set(key, { label: name, count: qty });
        });
        return Array.from(byKey.entries())
            .map(([key, v]) => ({ key, label: v.label, count: v.count }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [resources]);

    const selectedTypeKeys = useMemo(() => new Set(filterTypes.map(t => t.toLowerCase())), [filterTypes]);
    const filteredTypeOptions = useMemo(() => {
        const term = typeSearch.trim().toLowerCase();
        return term ? typeOptions.filter(o => o.label.toLowerCase().includes(term)) : typeOptions;
    }, [typeOptions, typeSearch]);

    const typeSummary = filterTypes.length === 0 ? 'All types' : filterTypes.length === 1 ? filterTypes[0] : `${filterTypes[0]} +${filterTypes.length - 1}`;
    const toggleType = (label: string) => setFilterTypes(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]);

    const visibleResources = useMemo(
        () => filterTypes.length > 0 ? resources.filter(r => r.resourceTypeName && selectedTypeKeys.has(r.resourceTypeName.toLowerCase())) : resources,
        [resources, filterTypes, selectedTypeKeys]
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', marginBottom: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filter</span>

                {/* Type dropdown — same as CalendarView */}
                <div ref={typeMenuRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setTypeMenuOpen(v => !v)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', fontSize: 14, fontWeight: 700, background: filterTypes.length > 0 ? '#eff6ff' : '#fff', color: filterTypes.length > 0 ? '#1d4ed8' : '#334155', border: `1px solid ${filterTypes.length > 0 ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: 999, cursor: 'pointer', maxWidth: 280 }}
                    >
                        <Package size={14} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeSummary}</span>
                        {filterTypes.length > 0 && (
                            <span style={{ minWidth: 20, height: 20, borderRadius: 10, padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#1d4ed8', color: '#fff', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                                {filterTypes.length}
                            </span>
                        )}
                    </button>

                    {typeMenuOpen && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 340, maxWidth: 'calc(100vw - 48px)', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 16px 28px rgba(15,23,42,0.14)', zIndex: 40, overflow: 'hidden' }}>
                            <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type filter</div>
                                <button onClick={() => setFilterTypes([])} disabled={filterTypes.length === 0} style={{ border: 'none', background: 'none', cursor: filterTypes.length === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, color: filterTypes.length === 0 ? '#94a3b8' : '#2563eb', padding: 0 }}>Clear</button>
                            </div>
                            <div style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
                                <input value={typeSearch} onChange={e => setTypeSearch(e.target.value)} placeholder="Search type..." style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div className="bk-scroll" style={{ maxHeight: 230, overflowY: 'auto', padding: '6px 0' }}>
                                {filteredTypeOptions.length === 0 ? (
                                    <div style={{ padding: '14px 12px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>No type matched.</div>
                                ) : filteredTypeOptions.map(opt => {
                                    const selected = selectedTypeKeys.has(opt.key);
                                    return (
                                        <button key={opt.key} onClick={() => toggleType(opt.label)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: 'none', borderLeft: selected ? '3px solid #2563eb' : '3px solid transparent', background: selected ? '#eff6ff' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                                            <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${selected ? '#2563eb' : '#cbd5e1'}`, background: selected ? '#2563eb' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                                                {selected ? '✓' : ''}
                                            </span>
                                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#334155' }}>{opt.label}</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{opt.count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

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
