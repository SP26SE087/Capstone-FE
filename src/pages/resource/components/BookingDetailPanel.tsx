import React, { useState, useEffect, useMemo } from 'react';
import { Booking, BookingStatus, BasicResourceResponse, ResourceType, ComputeAccess } from '@/types/booking';
import { bookingService } from '@/services/bookingService';
import ComputeAccessPanel from './ComputeAccessPanel';
import ServerTerminalModal from './ServerTerminalModal';
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
    Plus,
    LogIn,
    LogOut,
    Server,
    Tag,
    UserCheck,
    UserX,
    Timer,
    Shield,
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

const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTimeOnly = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const calcDuration = (start: string, end: string) => {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms <= 0) return null;
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days > 0 && hours > 0) return `${days}d ${hours}h`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    return `${hours}h`;
};

const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

// ─── FooterBtn helper ────────────────────────────────────────────────────────
type FooterBtnProps = {
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
} & (
    | { variant: 'primary'; color: string; shadow: string; borderColor?: never }
    | { variant: 'outline'; color: string; borderColor: string; shadow?: never }
    | { variant: 'ghost'; color?: never; borderColor?: never; shadow?: never }
);

function FooterBtn({ onClick, icon, label, disabled, ...rest }: FooterBtnProps) {
    const base: React.CSSProperties = {
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '8px 18px', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.82rem', fontWeight: 700, border: 'none',
        transition: 'opacity 0.15s, box-shadow 0.15s',
        opacity: disabled ? 0.55 : 1, flexShrink: 0,
    };
    if (rest.variant === 'primary') {
        return (
            <button onClick={onClick} disabled={disabled} style={{
                ...base, background: rest.color, color: '#fff',
                boxShadow: `0 3px 10px ${rest.shadow}`,
            }}>
                {icon} {label}
            </button>
        );
    }
    if (rest.variant === 'outline') {
        return (
            <button onClick={onClick} disabled={disabled} style={{
                ...base, background: '#fff',
                border: `1.5px solid ${rest.borderColor}`,
                color: rest.color,
            }}>
                {icon} {label}
            </button>
        );
    }
    return (
        <button onClick={onClick} disabled={disabled} style={{
            ...base, background: 'transparent',
            border: '1px solid #e2e8f0',
            color: '#64748b',
        }}>
            {icon} {label}
        </button>
    );
}

// ─── PersonCard helper ───────────────────────────────────────────────────────
function PersonCard({ label, icon, name, email, sub, accentColor, accentBg, accentBorder, placeholder }: {
    label: string; icon: React.ReactNode;
    name: string | null; email: string | null; sub?: string;
    accentColor: string; accentBg: string; accentBorder: string;
    placeholder?: string;
}) {
    const hasData = !!name;
    return (
        <div style={{
            padding: '12px 14px',
            background: hasData ? accentBg : '#fafafa',
            border: `1px solid ${hasData ? accentBorder : '#e2e8f0'}`,
            borderRadius: 12,
            display: 'flex', flexDirection: 'column', gap: 8,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.6rem', fontWeight: 800, color: hasData ? accentColor : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {icon} {label}
            </div>
            {hasData ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: accentColor + '1a', border: `1.5px solid ${accentBorder}`,
                        color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.72rem', fontWeight: 800, letterSpacing: '-0.01em',
                    }}>
                        {getInitials(name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                        {email && <div style={{ fontSize: '0.65rem', color: accentColor, marginTop: 1, wordBreak: 'break-all' }}>{email}</div>}
                        {sub && <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: '#f1f5f9', border: '1.5px dashed #cbd5e1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#cbd5e1',
                    }}>
                        <User size={14} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>{placeholder ?? 'Not assigned'}</span>
                </div>
            )}
        </div>
    );
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
    const [showCheckOutForm, setShowCheckOutForm] = useState(false);
    const [showCheckInForm, setShowCheckInForm] = useState(false);
    const [checkOutNote, setCheckOutNote] = useState('');
    const [checkInNote, setCheckInNote] = useState('');
    
    // Compute access state
    const [showTerminalModal, setShowTerminalModal] = useState(false);
    const [selectedComputeAccess, setSelectedComputeAccess] = useState<ComputeAccess | null>(null);

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

    const handleCheckOut = async () => {
        setActionLoading(true);
        try {
            await bookingService.checkIn(bookingId, checkOutNote.trim() || undefined);
            onSaved(false, 'Check-out recorded.');
            setShowCheckOutForm(false);
            setCheckOutNote('');
            loadBooking();
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Check-out failed.';
            addToast(msg, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCheckIn = async () => {
        const firstResourceId = bookingResourceIds[0] ?? '';
        setActionLoading(true);
        try {
            await bookingService.checkOut(bookingId, firstResourceId, checkInNote.trim() || undefined);
            onSaved(false, 'Check-in recorded.');
            setShowCheckInForm(false);
            setCheckInNote('');
            loadBooking();
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Check-in failed.';
            addToast(msg, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenTerminal = (access: ComputeAccess) => {
        setSelectedComputeAccess(access);
        setShowTerminalModal(true);
    };


    // Hooks must come before any early returns
    const bookingResources = booking?.resources ?? [];
    const bookingResourceIds = booking?.resourceIds ?? bookingResources.map(r => r.id);
    const resourceGroups = useMemo(() => groupResources(bookingResources), [bookingResources]);
    
    // Check if booking has compute resources (for terminal access)
    const hasComputeResources = useMemo(() => {
        return bookingResources.some(r => 
            r.resourceTypeName?.toLowerCase().includes('compute') ||
            r.resourceTypeName?.toLowerCase().includes('server') ||
            r.resourceTypeName?.toLowerCase().includes('gpu rental')
        );
    }, [bookingResources]);

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
    const canCheckOut = isManagedView && booking.status === BookingStatus.Approved;
    const canCheckIn = isManagedView && booking.status === BookingStatus.InUse;
    
    // Show compute access panel for approved/in-use bookings with compute resources
    const showComputeAccess = hasComputeResources && (
        booking.status === BookingStatus.Approved || 
        booking.status === BookingStatus.InUse
    );

    const duration = calcDuration(booking.startTime, booking.endTime);
    const anyFormOpen = showApproveForm || showRejectForm || showCancelForm || showCheckOutForm || showCheckInForm;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
            {/* ── Scrollable Content ── */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: 4 }} className="custom-scrollbar">

                {/* ═══════════════════════════════════════════
                    HERO HEADER
                ═══════════════════════════════════════════ */}
                <div style={{
                    borderRadius: 16, marginBottom: 16, overflow: 'hidden',
                    border: `1.5px solid ${statusConfig.border}`,
                    boxShadow: `0 4px 20px ${statusConfig.color}14`,
                }}>
                    {/* Colour bar */}
                    <div style={{ height: 5, background: `linear-gradient(90deg, ${statusConfig.color}, ${statusConfig.color}88)` }} />
                    <div style={{ padding: '16px 18px', background: `linear-gradient(135deg, ${statusConfig.bg} 0%, #fff 70%)` }}>
                        {/* Top row: title + badges */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                background: statusConfig.color + '1a',
                                border: `1.5px solid ${statusConfig.color}33`,
                                color: statusConfig.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Calendar size={20} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                                    <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                                        {booking.title}
                                    </h2>
                                    {booking.isUrgent && (
                                        <span style={{
                                            fontSize: '0.6rem', fontWeight: 800, color: '#b91c1c',
                                            background: '#fef2f2', border: '1px solid #fca5a5',
                                            padding: '2px 7px', borderRadius: 20,
                                            display: 'inline-flex', alignItems: 'center', gap: 3, letterSpacing: '0.04em',
                                        }}>
                                            <Zap size={9} /> URGENT
                                        </span>
                                    )}
                                    {booking.adjustReason && booking.status !== BookingStatus.Rejected && (
                                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', padding: '2px 7px', borderRadius: 20 }}>
                                            Adjusted
                                        </span>
                                    )}
                                </div>
                                <span style={{
                                    fontSize: '0.72rem', fontWeight: 700, color: statusConfig.color,
                                    background: statusConfig.bg, border: `1px solid ${statusConfig.border}`,
                                    padding: '3px 11px', borderRadius: 20,
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                }}>
                                    {statusConfig.icon} {statusConfig.label}
                                </span>
                            </div>
                        </div>

                        {/* Schedule timeline */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 0,
                            background: '#fff', border: '1px solid #e2e8f0',
                            borderRadius: 12, overflow: 'hidden',
                        }}>
                            <div style={{ flex: 1, padding: '10px 14px' }}>
                                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                                    Pickup
                                </div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                                    {formatTimeOnly(booking.startTime)}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 1 }}>
                                    {formatDateShort(booking.startTime)}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px', flexShrink: 0 }}>
                                <div style={{ width: 1, height: 10, background: '#e2e8f0' }} />
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 20,
                                    fontSize: '0.65rem', fontWeight: 700, color: '#64748b',
                                    whiteSpace: 'nowrap',
                                }}>
                                    <Timer size={10} /> {duration ?? '—'}
                                </div>
                                <div style={{ width: 1, height: 10, background: '#e2e8f0' }} />
                            </div>
                            <div style={{ flex: 1, padding: '10px 14px', borderLeft: '1px solid #f1f5f9' }}>
                                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                                    Return
                                </div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                                    {formatTimeOnly(booking.endTime)}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 1 }}>
                                    {formatDateShort(booking.endTime)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════
                    PEOPLE ROW — Borrower | Manager | Approved By
                ═══════════════════════════════════════════ */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                    {/* Borrower */}
                    <PersonCard
                        label="Borrower"
                        icon={<User size={11} />}
                        name={booking.userFullName}
                        email={booking.userEmail}
                        accentColor="#2563eb"
                        accentBg="#eff6ff"
                        accentBorder="#bfdbfe"
                    />
                    {/* Resource Manager */}
                    <PersonCard
                        label="Resource Manager"
                        icon={<Shield size={11} />}
                        name={booking.managerFullName}
                        email={booking.managerEmail}
                        accentColor="#7c3aed"
                        accentBg="#f5f3ff"
                        accentBorder="#e9d5ff"
                    />
                    {/* Approved By — always shown */}
                    <PersonCard
                        label="Approved By"
                        icon={booking.approvedByName ? <UserCheck size={11} /> : <UserX size={11} />}
                        name={booking.approvedByName ?? null}
                        email={booking.approvedByEmail ?? null}
                        sub={booking.approvedAt ? formatDisplayDate(booking.approvedAt) : undefined}
                        accentColor={booking.approvedByName ? '#059669' : '#94a3b8'}
                        accentBg={booking.approvedByName ? '#ecfdf5' : '#f8fafc'}
                        accentBorder={booking.approvedByName ? '#a7f3d0' : '#e2e8f0'}
                        placeholder="Not approved yet"
                    />
                </div>

                {/* ═══════════════════════════════════════════
                    PURPOSE
                ═══════════════════════════════════════════ */}
                <div style={{ ...sectionStyle, marginBottom: 14 }}>
                    <div style={labelStyle}><FileText size={11} /> Purpose</div>
                    <p style={{ margin: 0, fontSize: '0.83rem', color: '#334155', lineHeight: 1.7 }}>
                        {booking.purpose || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No purpose specified.</span>}
                    </p>
                </div>

                {/* ═══════════════════════════════════════════
                    RESOURCES
                ═══════════════════════════════════════════ */}
                {bookingResources.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <div style={labelStyle}><Package size={12} /> Booked Resources</div>
                            <span style={{
                                fontSize: '0.65rem', fontWeight: 800, color: '#475569',
                                background: '#f1f5f9', border: '1px solid #e2e8f0',
                                padding: '2px 9px', borderRadius: 20,
                            }}>
                                {bookingResources.length} unit{bookingResources.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 160, overflowY: 'scroll', paddingRight: 4 }}>
                            {bookingResources.map((r, idx) => (
                                <div key={r.id ?? idx} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 12px',
                                    background: '#fff',
                                    border: `1px solid ${r.isDamaged ? '#fecaca' : '#e2e8f0'}`,
                                    borderLeft: `4px solid ${r.isDamaged ? '#ef4444' : '#c7d2fe'}`,
                                    borderRadius: 10, flexShrink: 0,
                                }}>
                                    {/* Index badge */}
                                    <div style={{
                                        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                                        background: '#f1f5f9', border: '1px solid #e2e8f0',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.7rem', fontWeight: 800, color: '#64748b',
                                    }}>
                                        {idx + 1}
                                    </div>
                                    {/* Name + meta */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }} title={r.name}>
                                            {r.name}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'nowrap' as const, overflow: 'hidden' }}>
                                            {r.resourceTypeName && (
                                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #e9d5ff', padding: '1px 6px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                    {r.resourceTypeName}
                                                </span>
                                            )}
                                            {r.location && (
                                                <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                                    <MapPin size={8} style={{ flexShrink: 0 }} /> {r.location}
                                                </span>
                                            )}
                                            {r.isDamaged && (
                                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '1px 6px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                    ⚠ Damaged
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Model series */}
                                    {(r as any).modelSeries && (
                                        <div style={{ textAlign: 'right', flexShrink: 0, maxWidth: 120 }}>
                                            <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                                                Serial
                                            </div>
                                            <code style={{
                                                fontSize: '0.65rem', fontWeight: 700, color: '#334155',
                                                background: '#f8fafc', border: '1px solid #e2e8f0',
                                                padding: '2px 6px', borderRadius: 6, letterSpacing: '0.02em',
                                                display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>
                                                {(r as any).modelSeries}
                                            </code>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Fallback resource */}
                {bookingResources.length === 0 && (booking.resourceName || (booking.quantity && booking.quantity > 0)) && (
                    <div style={{ ...sectionStyle, marginBottom: 14 }}>
                        <div style={labelStyle}><Package size={12} /> Resource</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                            {booking.resourceName || '—'}
                            {booking.quantity && booking.quantity > 1 && (
                                <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#64748b' }}>× {booking.quantity} units</span>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════
                    NOTES / REASON BANNERS
                ═══════════════════════════════════════════ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {booking.status === BookingStatus.Rejected && booking.rejectReason && (
                        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #ef4444', borderRadius: 12 }}>
                            <div style={{ ...labelStyle, color: '#dc2626', marginBottom: 5 }}><XCircle size={12} /> Rejection Reason</div>
                            <div style={{ fontSize: '0.83rem', color: '#7f1d1d', lineHeight: 1.6 }}>{booking.rejectReason}</div>
                        </div>
                    )}
                    {booking.cancelReason && (
                        <div style={{ padding: '12px 16px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderLeft: '4px solid #9ca3af', borderRadius: 12 }}>
                            <div style={{ ...labelStyle, color: '#6b7280', marginBottom: 5 }}><XCircle size={12} /> Cancellation Reason</div>
                            <div style={{ fontSize: '0.83rem', color: '#374151', lineHeight: 1.6 }}>{booking.cancelReason}</div>
                        </div>
                    )}
                    {booking.adjustReason && booking.status !== BookingStatus.Rejected && (
                        <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b', borderRadius: 12 }}>
                            <div style={{ ...labelStyle, color: '#92400e', marginBottom: 5 }}><Info size={12} /> Adjustment Reason</div>
                            <div style={{ fontSize: '0.83rem', color: '#78350f', lineHeight: 1.6 }}>{booking.adjustReason}</div>
                        </div>
                    )}
                    {booking.note && (
                        <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderLeft: '4px solid #10b981', borderRadius: 12 }}>
                            <div style={{ ...labelStyle, color: '#059669', marginBottom: 5 }}><MessageSquare size={12} /> Approval Note</div>
                            <div style={{ fontSize: '0.83rem', color: '#065f46', lineHeight: 1.6 }}>{booking.note}</div>
                        </div>
                    )}
                </div>

                {/* Compute Access */}
                {showComputeAccess && (
                    <div style={{ ...sectionStyle, marginBottom: 14 }}>
                        <div style={{ ...labelStyle, color: 'var(--accent-color)', marginBottom: 10 }}>
                            <Server size={12} /> Compute Instance
                        </div>
                        <ComputeAccessPanel bookingId={bookingId} onOpenTerminal={handleOpenTerminal} />
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════
                FIXED ACTION AREA — never scrolls away
            ══════════════════════════════════════════════ */}
            <div style={{
                flexShrink: 0,
                borderTop: '1px solid #f1f5f9',
                background: '#fff',
            }}>
                {/* ── Approve form ── */}
                {showApproveForm && canApproveReject && (
                    <div style={{ padding: '14px 16px', background: '#f0fdf4', borderBottom: '1px solid #a7f3d0' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <CheckCircle2 size={11} /> Approve Booking
                        </div>
                        <textarea
                            autoFocus
                            value={approveNote} onChange={e => setApproveNote(e.target.value)}
                            placeholder="Approval note (optional)..."
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #a7f3d0', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', minHeight: 52, resize: 'none', background: '#fff', boxSizing: 'border-box', marginBottom: 8 }}
                        />
                        {bookingResourceIds.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                                <button type="button" onClick={() => handleToggleAdjustments(resourceGroups)}
                                    style={{ fontSize: '0.75rem', fontWeight: 700, color: showAdjustments ? '#059669' : '#64748b', background: showAdjustments ? '#dcfce7' : '#f1f5f9', border: `1px solid ${showAdjustments ? '#a7f3d0' : '#e2e8f0'}`, borderRadius: 8, padding: '4px 12px', cursor: 'pointer' }}>
                                    {showAdjustments ? '− Hide Adjustments' : '+ Adjust Quantities'}
                                </button>
                                {showAdjustments && groupKeptQtys && (
                                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {allRemoved && <div style={{ padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, fontSize: '0.75rem', fontWeight: 700, color: '#dc2626' }}>⚠ All removed — will auto-reject</div>}
                                        {resourceGroups.map(g => {
                                            const kept = groupKeptQtys[g.key] ?? g.ids.length;
                                            const isZero = kept === 0; const isChanged = kept !== g.ids.length;
                                            return (
                                                <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#fff', border: `1.5px solid ${isZero ? '#fecaca' : isChanged ? '#fdba74' : '#fde68a'}`, borderRadius: 8 }}>
                                                    <div style={{ flex: 1, fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{g.name}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                                        <button type="button" onClick={() => setGroupKeptQtys(p => ({ ...p!, [g.key]: Math.max(0, (p![g.key] ?? g.ids.length) - 1) }))} disabled={kept <= 0}
                                                            style={{ width: 24, height: 24, borderRadius: 6, border: '1.5px solid #e2e8f0', background: kept <= 0 ? '#f8fafc' : '#fff', cursor: kept <= 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: kept <= 0 ? '#cbd5e1' : '#475569' }}>
                                                            <Minus size={10} />
                                                        </button>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, minWidth: 20, textAlign: 'center' as const, color: isZero ? '#dc2626' : isChanged ? '#f97316' : '#1e293b' }}>{kept}</span>
                                                        <button type="button" onClick={() => setGroupKeptQtys(p => ({ ...p!, [g.key]: Math.min(g.ids.length, (p![g.key] ?? g.ids.length) + 1) }))} disabled={kept >= g.ids.length}
                                                            style={{ width: 24, height: 24, borderRadius: 6, border: '1.5px solid #e2e8f0', background: kept >= g.ids.length ? '#f8fafc' : '#fff', cursor: kept >= g.ids.length ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: kept >= g.ids.length ? '#cbd5e1' : '#475569' }}>
                                                            <Plus size={10} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <textarea value={approveAdjustReason} onChange={e => setApproveAdjustReason(e.target.value)}
                                            placeholder={`Adjustment reason${allRemoved ? ' (reject reason)' : ''} *`}
                                            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #fde68a', fontSize: '0.78rem', fontFamily: 'inherit', outline: 'none', minHeight: 44, resize: 'none', background: '#fffbeb', boxSizing: 'border-box' as const }} />
                                        {hasChangedQty && <div style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 600 }}>Keeping {totalKept} of {bookingResourceIds.length} unit(s)</div>}
                                    </div>
                                )}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleApprove(resourceGroups)} disabled={actionLoading}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 9, border: 'none', background: '#059669', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1 }}>
                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Confirm Approve
                            </button>
                            <button onClick={() => { setShowApproveForm(false); setShowAdjustments(false); setGroupKeptQtys(null); }}
                                style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Reject form ── */}
                {showRejectForm && canApproveReject && (
                    <div style={{ padding: '14px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <XCircle size={11} /> Reject Booking
                        </div>
                        <textarea autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection (required)..."
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #fecaca', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', minHeight: 52, resize: 'none', background: '#fff', boxSizing: 'border-box', marginBottom: 8 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={handleReject} disabled={actionLoading || !rejectReason.trim()}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 9, border: 'none', background: !rejectReason.trim() ? '#e2e8f0' : '#dc2626', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: actionLoading || !rejectReason.trim() ? 'not-allowed' : 'pointer' }}>
                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Confirm Reject
                            </button>
                            <button onClick={() => setShowRejectForm(false)}
                                style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Check Out form ── */}
                {showCheckOutForm && canCheckOut && (
                    <div style={{ padding: '14px 16px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <LogOut size={11} style={{ transform: 'scaleX(-1)' }} /> Check Out — Record Pickup
                        </div>
                        <textarea autoFocus value={checkOutNote} onChange={e => setCheckOutNote(e.target.value)}
                            placeholder="Note (optional)..."
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #bfdbfe', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', minHeight: 52, resize: 'none', background: '#fff', boxSizing: 'border-box', marginBottom: 8 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={handleCheckOut} disabled={actionLoading}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 9, border: 'none', background: '#2563eb', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1 }}>
                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} style={{ transform: 'scaleX(-1)' }} />} Confirm Check Out
                            </button>
                            <button onClick={() => { setShowCheckOutForm(false); setCheckOutNote(''); }}
                                style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Check In form ── */}
                {showCheckInForm && canCheckIn && (
                    <div style={{ padding: '14px 16px', background: '#f0fdf4', borderBottom: '1px solid #a7f3d0' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <LogIn size={11} /> Check In — Record Return
                        </div>
                        <textarea autoFocus value={checkInNote} onChange={e => setCheckInNote(e.target.value)}
                            placeholder="Note (optional)..."
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #a7f3d0', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', minHeight: 52, resize: 'none', background: '#fff', boxSizing: 'border-box', marginBottom: 8 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={handleCheckIn} disabled={actionLoading}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 9, border: 'none', background: '#059669', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1 }}>
                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={12} />} Confirm Check In
                            </button>
                            <button onClick={() => { setShowCheckInForm(false); setCheckInNote(''); }}
                                style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Cancel form ── */}
                {showCancelForm && canCancel && (
                    <div style={{ padding: '14px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <AlertTriangle size={11} /> Cancel Booking
                        </div>
                        <textarea autoFocus value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                            placeholder="Reason for cancellation (optional)..."
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', minHeight: 52, resize: 'none', background: '#fff', boxSizing: 'border-box', marginBottom: 8 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={handleCancel} disabled={actionLoading}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 9, border: 'none', background: '#64748b', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1 }}>
                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Confirm Cancel
                            </button>
                            <button onClick={() => setShowCancelForm(false)}
                                style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                                Back
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Button row ── */}
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                        {!anyFormOpen && canCheckOut && (
                            <FooterBtn onClick={() => setShowCheckOutForm(true)} variant="primary" color="#2563eb" shadow="rgba(37,99,235,0.22)"
                                icon={<LogOut size={14} style={{ transform: 'scaleX(-1)' }} />} label="Check Out" />
                        )}
                        {!anyFormOpen && canCheckIn && (
                            <FooterBtn onClick={() => setShowCheckInForm(true)} variant="primary" color="#059669" shadow="rgba(5,150,105,0.22)"
                                icon={<LogIn size={14} />} label="Check In" />
                        )}
                        {!anyFormOpen && canApproveReject && (
                            <>
                                <FooterBtn onClick={() => { setShowApproveForm(true); setShowRejectForm(false); setShowCancelForm(false); }}
                                    variant="primary" color="#059669" shadow="rgba(5,150,105,0.22)"
                                    icon={<CheckCircle2 size={14} />} label="Approve" />
                                <FooterBtn onClick={() => { setShowRejectForm(true); setShowApproveForm(false); setShowCancelForm(false); }}
                                    variant="outline" color="#dc2626" borderColor="#fca5a5"
                                    icon={<XCircle size={14} />} label="Reject" />
                            </>
                        )}
                        {!anyFormOpen && canCancel && (
                            <FooterBtn onClick={() => { setShowCancelForm(true); setShowApproveForm(false); setShowRejectForm(false); }}
                                variant="ghost" icon={<XCircle size={14} />} label="Cancel Booking" />
                        )}
                    </div>
                    <button onClick={onClose}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; }}>
                        Close
                    </button>
                </div>
            </div>

            {/* Server Terminal Modal */}
            {showTerminalModal && selectedComputeAccess && (
                <ServerTerminalModal
                    isOpen={showTerminalModal}
                    onClose={() => {
                        setShowTerminalModal(false);
                        setSelectedComputeAccess(null);
                    }}
                    access={selectedComputeAccess}
                />
            )}
        </div>
    );
};

export default BookingDetailPanel;
