import React, { useState, useEffect, useMemo } from 'react';
import { Booking, BookingStatus, BasicResourceResponse } from '@/types/booking';
import { bookingService } from '@/services/bookingService';
import { useAuth } from '@/hooks/useAuth';
import { useToastStore } from '@/store/slices/toastSlice';
import {
    Loader2,
    Calendar,
    Clock,
    FileText,
    User,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    MessageSquare,
    Package,
    Info,
    MapPin,
    Zap,
    Minus,
    Plus
} from 'lucide-react';

interface BookingDetailPanelProps {
    bookingId: string;
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string) => void;
    onTitleChange?: (title: string) => void;
    isLabDirector: boolean;
    isManagedView?: boolean;
}

const labelStyle: React.CSSProperties = {
    fontSize: '0.65rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.7px',
    marginBottom: '5px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
};

const sectionStyle: React.CSSProperties = {
    padding: '10px 12px',
    background: 'var(--background-color)',
    borderRadius: '8px',
    border: '1px solid var(--border-light)',
    marginBottom: '8px'
};

const getStatusConfig = (status: BookingStatus) => {
    switch (status) {
        case BookingStatus.Pending:   return { label: 'Pending',   color: '#d97706', bg: '#fefce8', border: '#fde68a', icon: <Clock size={14} /> };
        case BookingStatus.Approved:  return { label: 'Approved',  color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: <CheckCircle2 size={14} /> };
        case BookingStatus.Rejected:  return { label: 'Rejected',  color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: <XCircle size={14} /> };
        case BookingStatus.Cancelled: return { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', icon: <XCircle size={14} /> };
        case BookingStatus.Completed: return { label: 'Completed', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: <CheckCircle2 size={14} /> };
        case BookingStatus.InUse:     return { label: 'In Use',    color: '#7c3aed', bg: '#f5f3ff', border: '#e9d5ff', icon: <Loader2 size={14} /> };
        default:                      return { label: 'Unknown',   color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', icon: null };
    }
};

const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
};

// ─── Resource grouping ───────────────────────────────────────────────────────
interface ResourceGroup {
    key: string;
    name: string;
    resourceTypeName: string;
    location: string;
    ids: string[];          // individual resource IDs in this group
    hasDamaged?: boolean;
}

function groupResources(resources: BasicResourceResponse[]): ResourceGroup[] {
    const map = new Map<string, ResourceGroup>();
    for (const res of resources) {
        const key = `${res.name}||${res.resourceTypeName ?? ''}||${res.location ?? ''}`;
        if (!map.has(key)) {
            map.set(key, {
                key,
                name: res.name,
                resourceTypeName: res.resourceTypeName ?? '',
                location: res.location ?? '',
                ids: [],
                hasDamaged: false,
            });
        }
        const g = map.get(key)!;
        g.ids.push(res.id);
        if (res.isDamaged) g.hasDamaged = true;
    }
    return [...map.values()];
}

const BookingDetailPanel: React.FC<BookingDetailPanelProps> = ({
    bookingId,
    onClose,
    onSaved,
    onTitleChange,
    isLabDirector: _isLabDirector,
    isManagedView = false
}) => {
    const { user } = useAuth();
    const { addToast } = useToastStore();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [cancelReason, setCancelReason] = useState('');
    const [approveNote, setApproveNote] = useState('');
    const [approveAdjustReason, setApproveAdjustReason] = useState('');
    // null = no adjustment; Record<groupKey, keptQty> when user is adjusting
    const [groupKeptQtys, setGroupKeptQtys] = useState<Record<string, number> | null>(null);
    const [showAdjustments, setShowAdjustments] = useState(false);
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [showCancelForm, setShowCancelForm] = useState(false);
    const [showApproveForm, setShowApproveForm] = useState(false);

    useEffect(() => {
        if (bookingId) loadBooking();
    }, [bookingId]);

    const loadBooking = async () => {
        setLoading(true);
        try {
            const data = await bookingService.getById(bookingId);
            setBooking(data);
            onTitleChange?.(data.title || 'Booking');
        } catch (err) {
            console.error('Failed to load booking:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAdjustments = (groups: ResourceGroup[]) => {
        const willShow = !showAdjustments;
        setShowAdjustments(willShow);
        if (willShow) {
            // initialise: keep all
            const init: Record<string, number> = {};
            groups.forEach(g => { init[g.key] = g.ids.length; });
            setGroupKeptQtys(init);
            setApproveAdjustReason('');
        } else {
            setGroupKeptQtys(null);
        }
    };

    const handleApprove = async (groups: ResourceGroup[]) => {
        const hasAdjustment = groupKeptQtys !== null;
        if (hasAdjustment && !approveAdjustReason.trim()) {
            addToast('Adjust reason is required when making adjustments.', 'warning');
            return;
        }
        // Build newResourceIds from kept qtys per group
        let newResourceIds: string[] | undefined;
        if (hasAdjustment && groupKeptQtys) {
            newResourceIds = groups.flatMap(g => g.ids.slice(0, groupKeptQtys[g.key] ?? g.ids.length));
        }
        setActionLoading(true);
        try {
            await bookingService.approve(bookingId, {
                note: approveNote.trim() || null,
                newResourceIds: newResourceIds ?? undefined,
                adjustReason: hasAdjustment ? approveAdjustReason.trim() : null,
            });
            onSaved(false, 'Booking approved successfully.');
            setShowApproveForm(false);
            setApproveNote('');
            setApproveAdjustReason('');
            setGroupKeptQtys(null);
            setShowAdjustments(false);
            loadBooking();
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to approve booking.';
            addToast(msg, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) return;
        setActionLoading(true);
        try {
            await bookingService.reject(bookingId, rejectReason.trim());
            onSaved(false, 'Booking rejected.');
            setShowRejectForm(false);
            setRejectReason('');
            loadBooking();
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to reject booking.';
            addToast(msg, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancel = async () => {
        setActionLoading(true);
        try {
            await bookingService.cancel(bookingId, cancelReason.trim() || undefined);
            onSaved(false, 'Booking cancelled.');
            setShowCancelForm(false);
            setCancelReason('');
            loadBooking();
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to cancel booking.';
            addToast(msg, 'error');
        } finally {
            setActionLoading(false);
        }
    };


    // Hooks must come before any early returns
    const bookingResources = booking?.resources ?? [];
    const bookingResourceIds = booking?.resourceIds ?? bookingResources.map(r => r.id);
    const resourceGroups = useMemo(() => groupResources(bookingResources), [bookingResources]);

    const totalKept = groupKeptQtys
        ? resourceGroups.reduce((sum, g) => sum + (groupKeptQtys[g.key] ?? g.ids.length), 0)
        : bookingResourceIds.length;
    const allRemoved = showAdjustments && totalKept === 0;
    const hasChangedQty = showAdjustments && groupKeptQtys !== null && totalKept !== bookingResourceIds.length;

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
            </div>
        );
    }

    if (!booking) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--text-muted)' }}>
                <p>Select a booking to view details.</p>
            </div>
        );
    }

    const statusConfig = getStatusConfig(booking.status);
    const currentUserEmail = (user?.email || '').trim().toLowerCase();
    const bookingUserEmail = (booking.userEmail || '').trim().toLowerCase();
    const isRequester = !!currentUserEmail && !!bookingUserEmail && currentUserEmail === bookingUserEmail;
    const canApproveReject = isManagedView && booking.status === BookingStatus.Pending;
    const canCancel = isRequester && booking.status === BookingStatus.Pending;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Sticky Panel Header */}
            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: statusConfig.bg, border: `1px solid ${statusConfig.border}`,
                        color: statusConfig.color, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Calendar size={13} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                {booking.title}
                            </h3>
                            {booking.isUrgent && (
                                <span style={{
                                    fontSize: '0.6rem', fontWeight: 700, color: '#dc2626',
                                    background: '#fef2f2', border: '1px solid #fecaca',
                                    padding: '1px 6px', borderRadius: '8px',
                                    display: 'inline-flex', alignItems: 'center', gap: '3px'
                                }}>
                                    <Zap size={9} /> Urgent
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{
                                fontSize: '0.62rem', fontWeight: 700, color: statusConfig.color,
                                background: statusConfig.bg, border: `1px solid ${statusConfig.border}`,
                                padding: '1px 7px', borderRadius: '10px',
                                display: 'inline-flex', alignItems: 'center', gap: '3px'
                            }}>
                                {statusConfig.icon} {statusConfig.label}
                            </span>
                            {booking.approvedByName && (
                                <span style={{
                                    fontSize: '0.62rem', color: '#64748b',
                                    display: 'inline-flex', alignItems: 'center', gap: '3px'
                                }}>
                                    · <span style={{ fontWeight: 700, color: '#059669' }}>Manager:</span> <span style={{ fontWeight: 700, color: '#334155' }}>{booking.approvedByName}</span>
                                    {booking.approvedAt && (
                                        <span style={{ color: '#94a3b8' }}>· {formatDisplayDate(booking.approvedAt)}</span>
                                    )}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', minHeight: 0 }} className="custom-scrollbar">

                {/* Schedule Info */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><Clock size={11} /> Schedule</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div style={{ padding: '6px 10px', background: '#fff', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '1px' }}>Pickup</div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {formatDisplayDate(booking.startTime)}
                            </div>
                        </div>
                        <div style={{ padding: '6px 10px', background: '#fff', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '1px' }}>Return</div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {formatDisplayDate(booking.endTime)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Requester Info */}
                {(booking.userFullName || booking.userEmail) && (
                    <div style={sectionStyle}>
                        <div style={labelStyle}><User size={11} /> Borrower</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {booking.userFullName && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, minWidth: '40px' }}>Name</span>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{booking.userFullName}</span>
                                </div>
                            )}
                            {booking.userEmail && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, minWidth: '40px' }}>Email</span>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#2563eb' }}>{booking.userEmail}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Purpose */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={11} /> Purpose</div>
                    <div style={{ fontSize: '0.78rem', color: '#1e293b', lineHeight: '1.5' }}>
                        {booking.purpose || 'No purpose specified.'}
                    </div>
                </div>

                {/* Booked Resources — grouped by name + type + location */}
                {resourceGroups.length > 0 && (
                    <div style={sectionStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={labelStyle}><Package size={12} /> Booked Resources</div>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>
                                {bookingResources.length} unit{bookingResources.length !== 1 ? 's' : ''}
                                {booking.adjustReason && booking.status !== BookingStatus.Rejected && (
                                    <span style={{ marginLeft: '6px', color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', padding: '1px 5px', borderRadius: '4px' }}>Adjusted</span>
                                )}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {resourceGroups.map((g) => (
                                <div key={g.key} style={{
                                    padding: '8px 10px', background: '#fff', borderRadius: '7px',
                                    border: '1px solid var(--border-light)',
                                    display: 'flex', alignItems: 'center', gap: '8px'
                                }}>
                                    <Package size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{g.name}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px', flexWrap: 'wrap' as const }}>
                                            {g.resourceTypeName && (
                                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #e9d5ff', padding: '0px 5px', borderRadius: '4px' }}>
                                                    {g.resourceTypeName}
                                                </span>
                                            )}
                                            {g.location && (
                                                <span style={{ fontSize: '0.62rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                    <MapPin size={9} /> {g.location}
                                                </span>
                                            )}
                                            {g.hasDamaged && (
                                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '0px 5px', borderRadius: '4px' }}>Damaged</span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Quantity badge */}
                                    {g.ids.length > 1 ? (
                                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', background: '#334155', padding: '2px 8px', borderRadius: '6px', flexShrink: 0 }}>
                                            ×{g.ids.length}
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', flexShrink: 0 }}>×1</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Fallback: show resource name from list view if no detail resources */}
                {bookingResources.length === 0 && (booking.resourceName || (booking.quantity && booking.quantity > 0)) && (
                    <div style={sectionStyle}>
                        <div style={labelStyle}><Package size={12} /> Resource</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                            {booking.resourceName || '—'}
                            {booking.quantity && booking.quantity > 1 && (
                                <span style={{ marginLeft: '8px', fontSize: '0.72rem', color: '#64748b' }}>× {booking.quantity} units</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Rejection reason */}
                {booking.status === BookingStatus.Rejected && booking.rejectReason && (
                    <div style={{ ...sectionStyle, background: '#fef2f2', border: '1px solid #fecaca' }}>
                        <div style={{ ...labelStyle, color: '#dc2626' }}><XCircle size={12} /> Rejection Reason</div>
                        <div style={{ fontSize: '0.85rem', color: '#7f1d1d', lineHeight: '1.5' }}>{booking.rejectReason}</div>
                    </div>
                )}

                {/* Cancel reason */}
                {booking.cancelReason && (
                    <div style={{ ...sectionStyle, background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                        <div style={{ ...labelStyle, color: '#6b7280' }}><XCircle size={12} /> Cancellation Reason</div>
                        <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: '1.5' }}>{booking.cancelReason}</div>
                    </div>
                )}

                {/* Adjust reason (approved with adjustment) */}
                {booking.adjustReason && booking.status !== BookingStatus.Rejected && (
                    <div style={{ ...sectionStyle, background: '#fffbeb', border: '1px solid #fde68a' }}>
                        <div style={{ ...labelStyle, color: '#92400e' }}><Info size={12} /> Adjustment Reason</div>
                        <div style={{ fontSize: '0.85rem', color: '#78350f', lineHeight: '1.5' }}>{booking.adjustReason}</div>
                    </div>
                )}

                {/* Approval note */}
                {booking.note && (
                    <div style={{ ...sectionStyle, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                        <div style={{ ...labelStyle, color: '#059669' }}><MessageSquare size={12} /> Approval Note</div>
                        <div style={{ fontSize: '0.85rem', color: '#065f46', lineHeight: '1.5' }}>{booking.note}</div>
                    </div>
                )}

                {/* Approve Form */}
                {showApproveForm && canApproveReject && (
                    <div style={{ ...sectionStyle, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                        <div style={{ ...labelStyle, color: '#059669' }}><CheckCircle2 size={11} /> Approve Booking</div>
                        <textarea
                            style={{
                                width: '100%', padding: '7px 10px', borderRadius: '7px',
                                border: '1.5px solid #a7f3d0', fontSize: '0.78rem', fontFamily: 'inherit',
                                outline: 'none', minHeight: '48px', resize: 'vertical' as const,
                                background: '#fff', marginBottom: '8px', boxSizing: 'border-box' as const
                            }}
                            value={approveNote}
                            onChange={e => setApproveNote(e.target.value)}
                            placeholder="Optional approval note..."
                        />

                        {/* Adjustment toggle — only if booking has resources to adjust */}
                        {bookingResourceIds.length > 0 && (
                            <div style={{ marginBottom: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => handleToggleAdjustments(resourceGroups)}
                                    style={{
                                        fontSize: '0.75rem', fontWeight: 700,
                                        color: showAdjustments ? '#059669' : '#64748b',
                                        background: showAdjustments ? '#dcfce7' : '#f1f5f9',
                                        border: `1px solid ${showAdjustments ? '#a7f3d0' : '#e2e8f0'}`,
                                        borderRadius: '8px', padding: '5px 12px', cursor: 'pointer'
                                    }}
                                >
                                    {showAdjustments ? '− Hide Adjustments' : '+ Adjust Resource Quantities'}
                                </button>

                                {showAdjustments && groupKeptQtys && (
                                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {allRemoved && (
                                            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#dc2626' }}>
                                                ⚠ All resources removed — this will auto-reject the booking
                                            </div>
                                        )}

                                        {/* One stepper row per group */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            {resourceGroups.length > 0 ? resourceGroups.map(g => {
                                                const kept = groupKeptQtys[g.key] ?? g.ids.length;
                                                const isChanged = kept !== g.ids.length;
                                                const isZero = kept === 0;
                                                return (
                                                    <div key={g.key} style={{
                                                        padding: '9px 11px', borderRadius: '8px', background: '#fff',
                                                        border: `1.5px solid ${isZero ? '#fecaca' : isChanged ? '#fdba74' : '#fde68a'}`,
                                                        display: 'flex', alignItems: 'center', gap: '10px'
                                                    }}>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{g.name}</div>
                                                            <div style={{ fontSize: '0.62rem', color: '#92400e', marginTop: '1px' }}>
                                                                Requested: {g.ids.length}
                                                                {isChanged && !isZero && <span style={{ color: '#f97316', fontWeight: 700 }}> → {kept}</span>}
                                                                {isZero && <span style={{ color: '#dc2626', fontWeight: 700 }}> → removed</span>}
                                                            </div>
                                                            {g.location && (
                                                                <div style={{ fontSize: '0.6rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '1px' }}>
                                                                    <MapPin size={8} /> {g.location}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                            <button type="button"
                                                                onClick={() => setGroupKeptQtys(prev => ({ ...prev!, [g.key]: Math.max(0, (prev![g.key] ?? g.ids.length) - 1) }))}
                                                                disabled={kept <= 0}
                                                                style={{ width: '26px', height: '26px', borderRadius: '7px', border: '1.5px solid #e2e8f0', background: kept <= 0 ? '#f8fafc' : '#fff', cursor: kept <= 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: kept <= 0 ? '#cbd5e1' : '#475569' }}>
                                                                <Minus size={11} />
                                                            </button>
                                                            <span style={{ fontSize: '1rem', fontWeight: 800, minWidth: '22px', textAlign: 'center' as const, color: isZero ? '#dc2626' : isChanged ? '#f97316' : '#1e293b' }}>{kept}</span>
                                                            <button type="button"
                                                                onClick={() => setGroupKeptQtys(prev => ({ ...prev!, [g.key]: Math.min(g.ids.length, (prev![g.key] ?? g.ids.length) + 1) }))}
                                                                disabled={kept >= g.ids.length}
                                                                style={{ width: '26px', height: '26px', borderRadius: '7px', border: '1.5px solid #e2e8f0', background: kept >= g.ids.length ? '#f8fafc' : '#fff', cursor: kept >= g.ids.length ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: kept >= g.ids.length ? '#cbd5e1' : '#475569' }}>
                                                                <Plus size={11} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            }) : (
                                                <div style={{ fontSize: '0.75rem', color: '#92400e' }}>
                                                    {bookingResourceIds.length} resource ID{bookingResourceIds.length !== 1 ? 's' : ''} in this booking.
                                                    Detailed resource info not available — approve without adjustment.
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '0.68rem', color: '#92400e' }}>
                                                Adjust Reason * {allRemoved ? '(becomes reject reason)' : ''}
                                            </label>
                                            <textarea
                                                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #fde68a', fontSize: '0.83rem', fontFamily: 'inherit', outline: 'none', minHeight: '50px', resize: 'vertical' as const, background: '#fffbeb', boxSizing: 'border-box' as const }}
                                                value={approveAdjustReason}
                                                onChange={e => setApproveAdjustReason(e.target.value)}
                                                placeholder="Reason for adjusting quantities (required)..."
                                            />
                                        </div>

                                        {hasChangedQty && (
                                            <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 600 }}>
                                                Keeping {totalKept} of {bookingResourceIds.length} unit{bookingResourceIds.length !== 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => handleApprove(resourceGroups)}
                                disabled={actionLoading}
                                style={{
                                    padding: '6px 16px', borderRadius: '8px', border: 'none',
                                    background: '#059669', color: '#fff',
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    fontSize: '0.78rem', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Confirm Approve
                            </button>
                            <button
                                onClick={() => { setShowApproveForm(false); setShowAdjustments(false); setGroupKeptQtys(null); }}
                                style={{
                                    padding: '6px 16px', borderRadius: '8px',
                                    border: '1px solid var(--border-color)', background: '#fff',
                                    color: 'var(--text-secondary)', cursor: 'pointer',
                                    fontSize: '0.78rem', fontWeight: 700
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Reject Form */}
                {showRejectForm && canApproveReject && (
                    <div style={{ ...sectionStyle, background: '#fef2f2', border: '1px solid #fecaca' }}>
                        <div style={{ ...labelStyle, color: '#dc2626' }}><XCircle size={11} /> Reject Booking</div>
                        <textarea
                            style={{
                                width: '100%', padding: '7px 10px', borderRadius: '7px',
                                border: '1.5px solid #fecaca', fontSize: '0.78rem', fontFamily: 'inherit',
                                outline: 'none', minHeight: '48px', resize: 'vertical' as const,
                                background: '#fff', marginBottom: '8px', boxSizing: 'border-box' as const
                            }}
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection (required)..."
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleReject}
                                disabled={actionLoading || !rejectReason.trim()}
                                style={{
                                    padding: '6px 16px', borderRadius: '8px', border: 'none',
                                    background: !rejectReason.trim() ? '#e2e8f0' : '#dc2626',
                                    color: '#fff',
                                    cursor: actionLoading || !rejectReason.trim() ? 'not-allowed' : 'pointer',
                                    fontSize: '0.78rem', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Confirm Reject
                            </button>
                            <button
                                onClick={() => setShowRejectForm(false)}
                                style={{
                                    padding: '6px 16px', borderRadius: '8px',
                                    border: '1px solid var(--border-color)', background: '#fff',
                                    color: 'var(--text-secondary)', cursor: 'pointer',
                                    fontSize: '0.78rem', fontWeight: 700
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Cancel Form */}
                {showCancelForm && canCancel && (
                    <div style={{ ...sectionStyle, background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                        <div style={{ ...labelStyle, color: '#6b7280' }}><AlertTriangle size={12} /> Cancel Booking</div>
                        <textarea
                            style={{
                                width: '100%', padding: '10px 14px', borderRadius: '10px',
                                border: '1.5px solid #e5e7eb', fontSize: '0.85rem', fontWeight: 500,
                                fontFamily: 'inherit', outline: 'none', minHeight: '60px',
                                resize: 'vertical' as const, background: '#fff', marginBottom: '10px'
                            }}
                            value={cancelReason}
                            onChange={e => setCancelReason(e.target.value)}
                            placeholder="Reason for cancellation (optional)..."
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleCancel}
                                disabled={actionLoading}
                                style={{
                                    padding: '6px 16px', borderRadius: '8px', border: 'none',
                                    background: '#6b7280', color: '#fff',
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    fontSize: '0.78rem', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Confirm Cancel
                            </button>
                            <button
                                onClick={() => setShowCancelForm(false)}
                                style={{
                                    padding: '6px 16px', borderRadius: '8px',
                                    border: '1px solid var(--border-color)', background: '#fff',
                                    color: 'var(--text-secondary)', cursor: 'pointer',
                                    fontSize: '0.78rem', fontWeight: 700
                                }}
                            >
                                Back
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer — sticky, always visible */}
            <div style={{
                flexShrink: 0, paddingTop: '14px',
                borderTop: '1px solid var(--border-light)',
                display: 'flex', justifyContent: 'space-between',
                gap: '10px', marginTop: '12px'
            }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {canCancel && !showCancelForm && !showApproveForm && !showRejectForm && (
                        <button
                            onClick={() => { setShowCancelForm(true); setShowApproveForm(false); setShowRejectForm(false); }}
                            style={{
                                padding: '8px 16px', borderRadius: '10px',
                                border: '1px solid #e5e7eb', background: '#fff',
                                color: '#6b7280', cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <XCircle size={14} /> Cancel Booking
                        </button>
                    )}
                    {canApproveReject && !showApproveForm && !showRejectForm && !showCancelForm && (
                        <>
                            <button
                                onClick={() => { setShowApproveForm(true); setShowRejectForm(false); setShowCancelForm(false); }}
                                style={{
                                    padding: '7px 16px', borderRadius: '8px',
                                    border: 'none', background: '#059669',
                                    color: '#fff', cursor: 'pointer',
                                    fontSize: '0.78rem', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    boxShadow: '0 2px 8px rgba(5,150,105,0.2)'
                                }}
                            >
                                <CheckCircle2 size={13} /> Approve
                            </button>
                            <button
                                onClick={() => { setShowRejectForm(true); setShowApproveForm(false); setShowCancelForm(false); }}
                                style={{
                                    padding: '7px 14px', borderRadius: '8px',
                                    border: '1px solid #fecaca', background: '#fff',
                                    color: '#dc2626', cursor: 'pointer',
                                    fontSize: '0.78rem', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                }}
                            >
                                <XCircle size={13} /> Reject
                            </button>
                        </>
                    )}
                </div>

                <button
                    onClick={onClose}
                    style={{
                        padding: '7px 14px', borderRadius: '8px',
                        border: '1px solid var(--border-color)', background: '#fff',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                        fontSize: '0.78rem', fontWeight: 700,
                    }}
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default BookingDetailPanel;
