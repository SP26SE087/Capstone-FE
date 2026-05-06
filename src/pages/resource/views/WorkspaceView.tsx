import React, { useState, useMemo } from 'react';
import {
    Plus, Search, AlertCircle, CheckCircle2, Activity, Archive,
    Clock, Calendar, Check, LogOut, LogIn, X,
    Cpu, Database, Radio, Monitor, Package, FlaskConical, Microscope
} from 'lucide-react';
import { Booking, Resource, BookingStatus } from '@/types/booking';
import {
    STATUS_META, getBookingRtMeta, getBookingResourceLabel,
    fmtTime, fmtDate, relTime, initials,
    sameDay,
} from './bookingViewUtils';

// ─── Icon by name ─────────────────────────────────────────────────────────────
function RtIcon({ iconName, size = 13 }: { iconName: string; size?: number }) {
    const map: Record<string, React.ElementType> = {
        cpu: Cpu, microscope: Microscope, radio: Radio,
        monitor: Monitor, 'flask-conical': FlaskConical, database: Database, package: Package,
    };
    const Icon = map[iconName] ?? Package;
    return <Icon size={size} />;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
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

// ─── Booking card (Kanban) ────────────────────────────────────────────────────
function WSBookingCard({ booking, resources, onOpen, onApprove, onReject, onCheckOut, onCheckIn, isManager }: {
    booking: Booking; resources: Resource[];
    onOpen: (b: Booking) => void;
    onApprove: (id: string) => void; onReject: (id: string) => void;
    onCheckOut: (id: string) => void; onCheckIn: (id: string) => void;
    isManager: boolean;
}) {
    const rMeta = getBookingRtMeta(booking, resources);
    const sMeta = STATUS_META[booking.status];
    return (
        <div
            onClick={() => onOpen(booking)}
            className="bk-fade-in"
            style={{
                background: '#fff', border: '1px solid #e2e8f0',
                borderLeft: `3px solid ${sMeta?.dot ?? '#94a3b8'}`,
                borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 6,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = sMeta?.dot ?? '#e2e8f0'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
        >
            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'start', gap: 6 }}>
                {booking.isUrgent && <span style={{ fontSize: 9, fontWeight: 800, color: '#DC2626', background: '#FEE2E2', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.05em', flexShrink: 0 }}>URGENT</span>}
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, flex: 1, color: '#1e293b' }}>{booking.title}</div>
            </div>
            {/* Resource chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: rMeta.color }}>
                <RtIcon iconName={rMeta.iconName} size={11} />
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getBookingResourceLabel(booking, resources)}
                    {(booking.resources?.length ?? 0) > 1 ? ` +${booking.resources!.length - 1}` : ''}
                </span>
            </div>
            {/* Time */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
                <Clock size={11} />
                <span>{fmtDate(booking.startTime)} · {fmtTime(booking.startTime)}–{fmtTime(booking.endTime)}</span>
            </div>
            {/* Bottom: avatar + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Avatar name={booking.userFullName ?? booking.userName ?? ''} size={18} />
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {booking.userFullName ?? booking.userName}
                </span>
                {isManager && booking.status === BookingStatus.Pending && (
                    <>
                        <button onClick={e => { e.stopPropagation(); onReject(booking.id); }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0 7px', height: 24, background: '#fff', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            <X size={11} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); onApprove(booking.id); }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0 7px', height: 24, background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            <Check size={11} />
                        </button>
                    </>
                )}
                {isManager && booking.status === BookingStatus.Approved && (
                    <button onClick={e => { e.stopPropagation(); onCheckOut(booking.id); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 8px', height: 24, background: '#E8720C', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        <LogOut size={11} style={{ transform: 'scaleX(-1)' }} /> Check out
                    </button>
                )}
                {isManager && booking.status === BookingStatus.InUse && (
                    <button onClick={e => { e.stopPropagation(); onCheckIn(booking.id); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 8px', height: 24, background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        <LogIn size={11} /> Returned
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Kanban column ────────────────────────────────────────────────────────────
function KanbanColumn({ title, items, color, accent, icon: Icon, onOpen, onApprove, onReject, onCheckOut, onCheckIn, isManager, resources, emptyMsg }: {
    title: string; items: Booking[]; color: string; accent: string;
    icon: React.ElementType;
    onOpen: (b: Booking) => void;
    onApprove: (id: string) => void; onReject: (id: string) => void;
    onCheckOut: (id: string) => void; onCheckIn: (id: string) => void;
    isManager: boolean; resources: Resource[];
    emptyMsg?: string;
}) {
    return (
        <div style={{
            flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column',
            background: '#f8fafc', borderRadius: 12,
            border: '1px solid #e2e8f0', overflow: 'hidden',
        }}>
            <div style={{ padding: '10px 12px', borderBottom: `2px solid ${accent}`, background: '#fff', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: color, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={13} />
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1e293b' }}>{title}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: accent, background: color, padding: '1px 8px', borderRadius: 999 }}>{items.length}</span>
            </div>
            <div className="bk-scroll" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
                {items.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '18px 8px' }}>{emptyMsg ?? 'Nothing here.'}</div>
                ) : items.map(b => (
                    <WSBookingCard key={b.id} booking={b} resources={resources} onOpen={onOpen} onApprove={onApprove} onReject={onReject} onCheckOut={onCheckOut} onCheckIn={onCheckIn} isManager={isManager} />
                ))}
            </div>
        </div>
    );
}

// ─── Right rail ───────────────────────────────────────────────────────────────
function RightRail({ bookings, resources, onOpen, onNewBooking: _onNewBooking }: {
    bookings: Booking[]; resources: Resource[];
    onOpen: (b: Booking) => void; onNewBooking: () => void;
}) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    const inUse = bookings.filter(b => b.status === BookingStatus.InUse);
    const nextApproved = bookings
        .filter(b => b.status === BookingStatus.Approved && new Date(b.startTime) > now)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

    // Availability per resource type
    const typeNames = useMemo(() => {
        const seen = new Set<string>();
        const out: string[] = [];
        resources.forEach(r => { if (r.resourceTypeName && !seen.has(r.resourceTypeName)) { seen.add(r.resourceTypeName); out.push(r.resourceTypeName); } });
        return out;
    }, [resources]);

    const typeAvail = typeNames.map(t => {
        const rList = resources.filter(r => r.resourceTypeName === t);
        const busyIds = new Set<string>();
        bookings.filter(b => [BookingStatus.Approved, BookingStatus.InUse].includes(b.status))
            .filter(b => { const s = new Date(b.startTime), e = new Date(b.endTime); return s < tomorrow && e > today; })
            .forEach(b => (b.resourceIds ?? []).forEach(id => busyIds.add(id)));
        const busy = rList.filter(r => busyIds.has(r.id) || (r.ids ?? []).some(id => busyIds.has(id))).length;
        const meta = rList[0] ? getBookingRtMeta({ title: '', startTime: '', endTime: '', status: BookingStatus.Pending, createdAt: '' } as any, rList) : null;
        return { type: t, total: rList.length, free: rList.length - busy, meta };
    }).filter(x => x.total > 0);

    // 14-day heatmap
    const days14 = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(today); d.setDate(today.getDate() + i); return d;
    });
    const busyRatioFor = (d: Date) => {
        const end = new Date(d); end.setDate(d.getDate() + 1);
        const busyIds = new Set<string>();
        bookings.filter(b => [BookingStatus.Approved, BookingStatus.InUse].includes(b.status))
            .filter(b => new Date(b.startTime) < end && new Date(b.endTime) > d)
            .forEach(b => (b.resourceIds ?? []).forEach(id => busyIds.add(id)));
        return resources.length > 0 ? busyIds.size / resources.length : 0;
    };

    return (
        <div className="bk-scroll" style={{ width: 252, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
            {/* Right now */}
            <div className="bk-card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span className="bk-pulse" style={{ width: 8, height: 8, borderRadius: 99, background: '#7C3AED', display: 'inline-block' }} />
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Right now</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: '#7C3AED', lineHeight: 1 }}>{inUse.length}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>resources in active use</div>
                {nextApproved && (
                    <div style={{ marginTop: 12, padding: '8px 10px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, cursor: 'pointer' }}
                        onClick={() => onOpen(nextApproved)}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Next up</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextApproved.title}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{relTime(nextApproved.startTime)} · {nextApproved.userFullName ?? nextApproved.userName}</div>
                    </div>
                )}
            </div>

            {/* Today's availability */}
            <div className="bk-card" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Today's availability</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {typeAvail.map(t => {
                        const pct = t.total > 0 ? (t.free / t.total) * 100 : 0;
                        return (
                            <div key={t.type}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <div style={{ width: 18, height: 18, borderRadius: 5, background: t.meta?.bg, color: t.meta?.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <RtIcon iconName={t.meta?.iconName ?? 'package'} size={10} />
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1, textTransform: 'capitalize' }}>{t.type}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: t.free === 0 ? '#DC2626' : '#1e293b' }}>
                                        {t.free}<span style={{ color: '#94a3b8', fontWeight: 500 }}>/{t.total}</span>
                                    </span>
                                </div>
                                <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, height: '100%', background: pct === 0 ? '#EF4444' : pct < 50 ? '#F59E0B' : '#10B981', transition: 'width 0.3s' }} />
                                </div>
                            </div>
                        );
                    })}
                    {typeAvail.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>No resources loaded.</div>}
                </div>
            </div>

            {/* 14-day heatmap */}
            <div className="bk-card" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Next 14 days</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
                    {days14.map((d, i) => {
                        const ratio = busyRatioFor(d);
                        const isToday = sameDay(d, new Date());
                        let bg = '#F1F5F9';
                        if (ratio > 0.66) bg = '#FEE2E2';
                        else if (ratio > 0.33) bg = '#FEF3C7';
                        else if (ratio > 0) bg = '#DCFCE7';
                        return (
                            <div key={i} title={`${fmtDate(d)} · ${Math.round(ratio * 100)}% booked`}
                                style={{ aspectRatio: '1', borderRadius: 5, background: bg, border: isToday ? '2px solid #E8720C' : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: isToday ? 800 : 600, color: isToday ? '#E8720C' : '#64748b', cursor: 'pointer' }}>
                                {d.getDate()}
                            </div>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 10, color: '#94a3b8', flexWrap: 'wrap' }}>
                    {[['#F1F5F9', 'free'], ['#DCFCE7', 'light'], ['#FEF3C7', 'busy'], ['#FEE2E2', 'full']].map(([bg, label]) => (
                        <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: bg, border: '1px solid #e2e8f0' }} /> {label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── KPI strip ────────────────────────────────────────────────────────────────
function _KpiStrip({ bookings }: { bookings: Booking[] }) {
    const kpis = [
        { label: 'Pending',   value: bookings.filter(b => b.status === BookingStatus.Pending).length,   icon: AlertCircle,  color: STATUS_META[BookingStatus.Pending].color,   bg: STATUS_META[BookingStatus.Pending].bg },
        { label: 'Approved',  value: bookings.filter(b => b.status === BookingStatus.Approved).length,  icon: CheckCircle2, color: STATUS_META[BookingStatus.Approved].color,  bg: STATUS_META[BookingStatus.Approved].bg },
        { label: 'In use',    value: bookings.filter(b => b.status === BookingStatus.InUse).length,     icon: Activity,     color: STATUS_META[BookingStatus.InUse].color,     bg: STATUS_META[BookingStatus.InUse].bg },
        { label: 'Completed', value: bookings.filter(b => b.status === BookingStatus.Completed).length, icon: Archive,      color: STATUS_META[BookingStatus.Completed].color, bg: STATUS_META[BookingStatus.Completed].bg },
    ];
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
            {kpis.map(k => (
                <div key={k.label} className="bk-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: k.bg, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <k.icon size={17} />
                    </div>
                    <div>
                        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{k.value}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>{k.label}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Main WorkspaceView ───────────────────────────────────────────────────────
interface WorkspaceViewProps {
    bookings: Booking[];
    resources: Resource[];
    isManager: boolean;
    isDirector?: boolean;
    onOpenBooking: (b: Booking) => void;
    onNewBooking: () => void;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    onCheckOut: (id: string) => void;
    onCheckIn: (id: string) => void;
}

export default function WorkspaceView({
    bookings, resources, isManager, isDirector,
    onOpenBooking, onNewBooking,
    onApprove, onReject, onCheckOut, onCheckIn,
}: WorkspaceViewProps) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return bookings;
        return bookings.filter(b => {
            const resLabel = getBookingResourceLabel(b, resources).toLowerCase();
            return (
                b.title.toLowerCase().includes(q) ||
                (b.userFullName ?? b.userName ?? '').toLowerCase().includes(q) ||
                resLabel.includes(q)
            );
        });
    }, [bookings, search, resources]);

    const sortByStart = (a: Booking, b: Booking) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    const pending   = filtered.filter(b => b.status === BookingStatus.Pending).sort(sortByStart);
    const approved  = filtered.filter(b => b.status === BookingStatus.Approved).sort(sortByStart);
    const inUse     = filtered.filter(b => b.status === BookingStatus.InUse).sort(sortByStart);
    const completed = filtered.filter(b => b.status === BookingStatus.Completed).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).slice(0, 15);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 14, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Booking Workspace</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        {!isManager
                            ? 'Your requests flow through these stages. Click a card for details.'
                            : isDirector
                            ? 'Full oversight across all labs. KPIs, queue, and 14-day outlook.'
                            : 'Your approval queue on the left; everything in flight on the right.'}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', width: 240 }}>
                        <Search size={13} color="#94a3b8" />
                        <input
                            value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search title, user, resource…"
                            style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 12.5, fontFamily: 'inherit' }}
                        />
                    </div>
                    <button onClick={onNewBooking} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#E8720C', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        <Plus size={14} /> New booking
                    </button>
                </div>
            </div>

            {/* Body: 4 columns + right rail */}
            <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
                <div className="bk-scroll" style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0, overflowX: 'auto', paddingBottom: 4 }}>
                    <KanbanColumn title="Pending"   items={pending}  color="#FEF3C7" accent="#D97706" icon={AlertCircle}
                        onOpen={onOpenBooking} onApprove={onApprove} onReject={onReject} onCheckOut={onCheckOut} onCheckIn={onCheckIn}
                        isManager={isManager} resources={resources}
                        emptyMsg={isManager ? 'Nothing to approve.' : 'No pending requests from you.'} />
                    <KanbanColumn title="Upcoming"  items={approved} color="#DCFCE7" accent="#059669" icon={Calendar}
                        onOpen={onOpenBooking} onApprove={onApprove} onReject={onReject} onCheckOut={onCheckOut} onCheckIn={onCheckIn}
                        isManager={isManager} resources={resources}
                        emptyMsg="No approved bookings in the pipeline." />
                    <KanbanColumn title="In use"    items={inUse}    color="#EDE9FE" accent="#7C3AED" icon={Activity}
                        onOpen={onOpenBooking} onApprove={onApprove} onReject={onReject} onCheckOut={onCheckOut} onCheckIn={onCheckIn}
                        isManager={isManager} resources={resources}
                        emptyMsg="Nothing is active right now." />
                    <KanbanColumn title="Completed" items={completed} color="#E0F2FE" accent="#0284C7" icon={Check}
                        onOpen={onOpenBooking} onApprove={onApprove} onReject={onReject} onCheckOut={onCheckOut} onCheckIn={onCheckIn}
                        isManager={isManager} resources={resources}
                        emptyMsg="No recent activity." />
                </div>
                <RightRail bookings={bookings} resources={resources} onOpen={onOpenBooking} onNewBooking={onNewBooking} />
            </div>
        </div>
    );
}
