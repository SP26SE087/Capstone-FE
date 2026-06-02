import React, { useState, useMemo } from 'react';
import { Booking, BookingStatus, BasicResourceResponse } from '@/types/booking';
import {
    Calendar, Clock, CheckCircle2, XCircle, Loader2,
    SlidersHorizontal, Zap, Package, MapPin, Minus, Plus, User, ChevronDown, ChevronRight
} from 'lucide-react';

export interface QuickApproveOpts {
    note?: string;
    newResourceIds?: string[];
    adjustReason?: string;
}

interface BookingListViewProps {
    bookings: Booking[];
    selectedId: string | null;
    onSelect: (booking: Booking) => void;
    selectable?: boolean;
    selectedIds?: string[];
    onToggleSelect?: (id: string) => void;
    onQuickApprove?: (bookingId: string, opts?: QuickApproveOpts) => Promise<void>;
    onQuickReject?: (bookingId: string, reason: string) => Promise<void>;
    onLoadDetail?: (bookingId: string) => Promise<Booking>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CFG = {
    [BookingStatus.Pending]:   { label: 'Pending',   color: '#d97706', bg: '#fefce8', border: '#fde68a' },
    [BookingStatus.Approved]:  { label: 'Approved',  color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
    [BookingStatus.Rejected]:  { label: 'Rejected',  color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    [BookingStatus.Cancelled]: { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' },
    [BookingStatus.Completed]: { label: 'Completed', color: '#6b7280', bg: '#f8fafc', border: '#e5e7eb' },
    [BookingStatus.InUse]:     { label: 'In Use',    color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
} as const;

const cfg = (status: BookingStatus) =>
    STATUS_CFG[status] ?? { label: 'Unknown', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };

const fmtDate = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? 'N/A'
        : `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
};
const fmtTime = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
};

interface BookingGroup {
    key: string; title: string; startTime: string; endTime: string;
    userFullName?: string; managerFullNames: string[]; anyUrgent: boolean; bookings: Booking[];
}

function groupBookings(bookings: Booking[]): BookingGroup[] {
    const map = new Map<string, BookingGroup>();
    for (const b of bookings) {
        // Include userId/assignee in key so bookings for different people are never merged
        const uid = b.userId ?? b.userFullName ?? b.userName ?? '';
        const key = `${b.title}||${b.startTime}||${b.endTime}||${uid}`;
        if (!map.has(key))
            map.set(key, { key, title: b.title, startTime: b.startTime, endTime: b.endTime, userFullName: b.userFullName, managerFullNames: [], anyUrgent: false, bookings: [] });
        const g = map.get(key)!;
        g.bookings.push(b);
        if (b.isUrgent) g.anyUrgent = true;
        // Collect all unique manager names (different resources may have different managers)
        if (b.managerFullName && !g.managerFullNames.includes(b.managerFullName)) {
            g.managerFullNames.push(b.managerFullName);
        }
    }
    return [...map.values()];
}

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

// ─── Component ───────────────────────────────────────────────────────────────

type ExpandMode = 'approve' | 'reject' | 'adjust';

const BookingListView: React.FC<BookingListViewProps> = ({
    bookings, selectedId, onSelect,
    selectable = false, selectedIds = [], onToggleSelect,
    onQuickApprove, onQuickReject, onLoadDetail,
}) => {
    const groups = useMemo(() => groupBookings(bookings), [bookings]);

    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
        () => new Set(groupBookings(bookings).map(g => g.key))
    );



    const toggleGroupCollapse = (key: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    // ── Sections ─────────────────────────────────────────────────────────────
    const pendingGroups = groups.filter(g => g.bookings.some(b => b.status === BookingStatus.Pending));
    const activeGroups  = groups.filter(g =>
        !g.bookings.some(b => b.status === BookingStatus.Pending) &&
        g.bookings.some(b => b.status === BookingStatus.Approved || b.status === BookingStatus.InUse)
    );
    const closedGroups  = groups.filter(g =>
        g.bookings.every(b =>
            b.status === BookingStatus.Rejected || b.status === BookingStatus.Cancelled || b.status === BookingStatus.Completed
        )
    );

    if (groups.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                <Calendar size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>No Bookings</h3>
                <p style={{ fontSize: '0.8rem' }}>No bookings found matching your criteria.</p>
            </div>
        );
    }

    const SectionHeader = ({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color, background: bg, padding: '2px 8px', borderRadius: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' as const, flexShrink: 0 }}>
                {label}
            </span>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>{count}</span>
            <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
        </div>
    );

    const renderGroup = (group: BookingGroup) => {
        const isCollapsed = collapsedGroups.has(group.key);
        const hasPending  = group.bookings.some(b => b.status === BookingStatus.Pending);
        const hasInUse    = group.bookings.some(b => b.status === BookingStatus.InUse);
        const allDone     = group.bookings.every(b =>
            b.status === BookingStatus.Completed || b.status === BookingStatus.Cancelled || b.status === BookingStatus.Rejected
        );
        const groupAccent = hasPending ? '#f59e0b' : hasInUse ? '#059669' : allDone ? '#94a3b8' : '#059669';

        return (
            <div key={group.key} style={{ borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>

                {/* Group header */}
                <div
                    onClick={() => toggleGroupCollapse(group.key)}
                    style={{ padding: '8px 12px', borderLeft: `3px solid ${groupAccent}`, background: hasPending ? '#fffdf5' : '#fafbfc', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
                >
                    <div style={{ color: '#94a3b8', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' as const }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                {group.title}
                            </span>
                            {group.anyUrgent && (
                                <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '0 4px', borderRadius: '4px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                    <Zap size={8} /> Urgent
                                </span>
                            )}
                            {group.bookings.length > 1 && (
                                <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #e9d5ff', padding: '0 5px', borderRadius: '4px', flexShrink: 0 }}>
                                    {group.bookings.length} items
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.65rem', color: '#64748b', marginTop: '1px', flexWrap: 'wrap' as const }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Calendar size={9} /> {fmtDate(group.startTime)}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Clock size={9} /> {fmtTime(group.startTime)} – {fmtTime(group.endTime)}</span>
                            {group.userFullName && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600, color: '#2563eb', background: '#eff6ff', padding: '1px 5px', borderRadius: '4px' }}>
                                    <User size={9} /> Borrower: {group.userFullName}
                                </span>
                            )}
                            {group.managerFullNames && group.managerFullNames.length > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600, color: '#059669', background: '#f0fdf4', padding: '1px 5px', borderRadius: '4px' }}>
                                    <User size={9} /> Manager{group.managerFullNames.length > 1 ? 's' : ''}: {group.managerFullNames.join(', ')}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Status summary pills */}
                    <div style={{ display: 'flex', gap: '3px', flexShrink: 0, flexWrap: 'wrap' as const, justifyContent: 'flex-end' }}>
                        {(() => {
                            const counts = new Map<BookingStatus, number>();
                            group.bookings.forEach(b => counts.set(b.status, (counts.get(b.status) ?? 0) + 1));
                            return [...counts.entries()].map(([status, count]) => {
                                const s = cfg(status);
                                return (
                                    <span key={status} style={{ fontSize: '0.58rem', fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: '1px 6px', borderRadius: '8px', whiteSpace: 'nowrap' as const }}>
                                        {s.label}{count > 1 ? ` ×${count}` : ''}
                                    </span>
                                );
                            });
                        })()}
                    </div>
                </div>

                {/* Booking rows */}
                {!isCollapsed && (
                    <div style={{ borderTop: '1px solid #f1f5f9' }}>
                        {group.bookings.map((booking, idx) => {
                            const isSelected   = booking.id === selectedId;
                            const isChecked    = selectedIds.includes(booking.id);
                            const isPending    = booking.status === BookingStatus.Pending;
                            const isApproved   = booking.status === BookingStatus.Approved;
                            const isInUse      = booking.status === BookingStatus.InUse;
                            const isSelectable = isPending || isApproved || isInUse;
                            const sc           = cfg(booking.status);
                            const isLast       = idx === group.bookings.length - 1;

                            const resourceLabel = booking.resources?.[0]?.name
                                || (booking.quantity != null && booking.quantity > 0 ? `${booking.quantity} unit${booking.quantity > 1 ? 's' : ''}` : 'Resource');

                            return (
                                <div
                                    key={booking.id}
                                    style={{
                                        borderBottom: isLast ? 'none' : '1px solid #f8fafc',
                                        background: isSelected ? '#f0f9ff' : '#fff',
                                        borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                                        transition: 'background 0.12s',
                                    }}
                                >
                                    {/* Row */}
                                    <div
                                        onClick={() => onSelect(booking)}
                                        style={{ padding: '7px 12px 7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        {/* Checkbox — pending, approved, in-use only */}
                                        {selectable && isSelectable && (
                                            <div
                                                onClick={e => { e.stopPropagation(); onToggleSelect?.(booking.id); }}
                                                style={{ width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0, border: `2px solid ${isChecked ? '#4f46e5' : '#cbd5e1'}`, background: isChecked ? '#4f46e5' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                            >
                                                {isChecked && <svg width="8" height="6" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                            </div>
                                        )}

                                        {/* Status icon */}
                                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: sc.bg, border: `1px solid ${sc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Package size={11} color={sc.color} />
                                        </div>

                                        {/* Name */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                                    {resourceLabel}
                                                </span>
                                                {booking.isUrgent && (
                                                    <span style={{ fontSize: '0.56rem', fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '0 3px', borderRadius: '3px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
                                                        <Zap size={7} /> Urgent
                                                    </span>
                                                )}
                                            </div>
                                            {booking.resources && booking.resources.length > 1 && (
                                                <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{booking.resources.length} units</div>
                                            )}
                                        </div>

                                        {/* Right: status badge */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`, padding: '2px 7px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                                {sc.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingGroups.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <SectionHeader label="Pending" count={pendingGroups.length} color="#d97706" bg="#fefce8" />
                    {pendingGroups.map(renderGroup)}
                </div>
            )}
            {activeGroups.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <SectionHeader label="Approved & Active" count={activeGroups.length} color="#1d4ed8" bg="#eff6ff" />
                    {activeGroups.map(renderGroup)}
                </div>
            )}
            {closedGroups.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <SectionHeader label="Closed" count={closedGroups.length} color="#6b7280" bg="#f3f4f6" />
                    {closedGroups.map(renderGroup)}
                </div>
            )}
        </div>
    );
};

export default BookingListView;
