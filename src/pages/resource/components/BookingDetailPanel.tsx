import React, { useState, useEffect } from 'react';
import { Booking, BookingStatus, EquipmentLogAction } from '@/types/booking';
import { bookingService } from '@/services/bookingService';
import { equipmentLogService } from '@/services/equipmentLogService';
import { useAuth } from '@/hooks/useAuth';
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
    LogIn,
    LogOut
} from 'lucide-react';

interface BookingDetailPanelProps {
    bookingId: string;
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string) => void;
    onTitleChange?: (title: string) => void;
    isLabDirector: boolean;
}

const labelStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
};

const sectionStyle: React.CSSProperties = {
    padding: '16px',
    background: 'var(--background-color)',
    borderRadius: '12px',
    border: '1px solid var(--border-light)',
    marginBottom: '16px'
};

const getStatusConfig = (status: BookingStatus) => {
    switch (status) {
        case BookingStatus.Pending: return { label: 'Pending', color: '#d97706', bg: '#fefce8', border: '#fde68a', icon: <Clock size={14} /> };
        case BookingStatus.Approved: return { label: 'Approved', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: <CheckCircle2 size={14} /> };
        case BookingStatus.Rejected: return { label: 'Rejected', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: <XCircle size={14} /> };
        case BookingStatus.Cancelled: return { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', icon: <XCircle size={14} /> };
        case BookingStatus.Completed: return { label: 'Completed', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: <CheckCircle2 size={14} /> };
        case BookingStatus.InUse: return { label: 'In Use', color: '#7c3aed', bg: '#f5f3ff', border: '#e9d5ff', icon: <Loader2 size={14} /> };
        default: return { label: 'Unknown', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', icon: null };
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

const BookingDetailPanel: React.FC<BookingDetailPanelProps> = ({
    bookingId,
    onClose,
    onSaved,
    onTitleChange,
    isLabDirector
}) => {
    const { user } = useAuth();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [cancelReason, setCancelReason] = useState('');
    const [approveNote, setApproveNote] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [showCancelForm, setShowCancelForm] = useState(false);
    const [showApproveForm, setShowApproveForm] = useState(false);
    const [logNote, setLogNote] = useState('');
    const [showLogForm, setShowLogForm] = useState<EquipmentLogAction | null>(null);

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

    const handleApprove = async () => {
        setActionLoading(true);
        try {
            await bookingService.approve(bookingId, approveNote.trim() || undefined);
            onSaved(false, 'Booking approved successfully.');
            setShowApproveForm(false);
            setApproveNote('');
            loadBooking();
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to approve booking.';
            alert(msg);
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
            alert(msg);
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
            alert(msg);
        } finally {
            setActionLoading(false);
        }
    };

    const handleEquipmentLog = async (action: EquipmentLogAction) => {
        setActionLoading(true);
        try {
            if (action === EquipmentLogAction.CheckIn) {
                const resolvedBookingId = booking?.id || bookingId;
                const resolvedResourceId =
                    (booking as any)?.resource?.id ||
                    booking?.resourceId ||
                    booking?.resourceIds?.[0];

                if (!resolvedResourceId) {
                    alert('Missing resourceId for this booking.');
                    return;
                }

                await equipmentLogService.update({
                    resourceId: resolvedResourceId,
                    bookingId: resolvedBookingId,
                    action,
                    note: logNote.trim() || undefined
                });
            } else {
                await equipmentLogService.create({
                    bookingId,
                    action,
                    note: logNote.trim() || undefined
                });
            }
            const msg = action === EquipmentLogAction.CheckOut ? 'Equipment checked out.' : 'Equipment checked in.';
            onSaved(false, msg);
            setShowLogForm(null);
            setLogNote('');
            loadBooking();
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to log equipment action.';
            alert(msg);
        } finally {
            setActionLoading(false);
        }
    };

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
    const canApproveReject = booking.status === BookingStatus.Pending && !!currentUserEmail && !!bookingUserEmail && !isRequester;
    const canCancel = (booking.status === BookingStatus.Pending || booking.status === BookingStatus.Approved);
    const canLogEquipment = isLabDirector || isRequester;
    const canCheckOut = canLogEquipment && booking.status === BookingStatus.Approved;
    const canCheckIn = canLogEquipment && booking.status === BookingStatus.InUse;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Panel Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        background: statusConfig.bg,
                        border: `1px solid ${statusConfig.border}`,
                        color: statusConfig.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Calendar size={16} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {booking.title}
                        </h3>
                        <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: statusConfig.color,
                            background: statusConfig.bg,
                            border: `1px solid ${statusConfig.border}`,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            {statusConfig.icon} {statusConfig.label}
                        </span>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                {/* Schedule Info */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><Clock size={12} /> Schedule</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>Pickup Time</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {formatDisplayDate(booking.startTime)}
                            </div>
                        </div>
                        <div style={{ padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>Return Time</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {formatDisplayDate(booking.endTime)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Requester Info */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><User size={12} /> Requester</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.72rem',
                            fontWeight: 700
                        }}>
                            {booking.userName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{booking.userName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Created: {formatDisplayDate(booking.createdAt)}</div>
                        </div>
                    </div>
                </div>

                {/* Purpose */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={12} /> Purpose</div>
                    <div style={{ padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.85rem', color: '#1e293b', lineHeight: '1.5' }}>
                        {booking.purpose || 'No purpose specified.'}
                    </div>
                </div>

                {/* Rejection / Cancellation Reason */}
                {booking.rejectReason && (
                    <div style={{
                        ...sectionStyle,
                        background: '#fef2f2',
                        border: '1px solid #fecaca'
                    }}>
                        <div style={{ ...labelStyle, color: '#dc2626' }}><XCircle size={12} /> Rejection Reason</div>
                        <div style={{ fontSize: '0.85rem', color: '#7f1d1d', lineHeight: '1.5' }}>{booking.rejectReason}</div>
                    </div>
                )}

                {booking.cancelReason && (
                    <div style={{
                        ...sectionStyle,
                        background: '#f3f4f6',
                        border: '1px solid #e5e7eb'
                    }}>
                        <div style={{ ...labelStyle, color: '#6b7280' }}><XCircle size={12} /> Cancellation Reason</div>
                        <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: '1.5' }}>{booking.cancelReason}</div>
                    </div>
                )}

                {booking.note && (
                    <div style={{
                        ...sectionStyle,
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0'
                    }}>
                        <div style={{ ...labelStyle, color: '#059669' }}><MessageSquare size={12} /> Approval Note</div>
                        <div style={{ fontSize: '0.85rem', color: '#065f46', lineHeight: '1.5' }}>{booking.note}</div>
                    </div>
                )}

                {/* Approve Form */}
                {showApproveForm && canApproveReject && (
                    <div style={{
                        ...sectionStyle,
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0'
                    }}>
                        <div style={{ ...labelStyle, color: '#059669' }}><CheckCircle2 size={12} /> Approve Booking</div>
                        <textarea
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '10px',
                                border: '1.5px solid #a7f3d0',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                fontFamily: 'inherit',
                                outline: 'none',
                                minHeight: '60px',
                                resize: 'vertical' as const,
                                background: '#fff',
                                marginBottom: '10px'
                            }}
                            value={approveNote}
                            onChange={e => setApproveNote(e.target.value)}
                            placeholder="Optional approval note..."
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleApprove}
                                disabled={actionLoading}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#059669',
                                    color: '#fff',
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Confirm Approve
                            </button>
                            <button
                                onClick={() => setShowApproveForm(false)}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: '#fff',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: 700
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Reject Form */}
                {showRejectForm && canApproveReject && (
                    <div style={{
                        ...sectionStyle,
                        background: '#fef2f2',
                        border: '1px solid #fecaca'
                    }}>
                        <div style={{ ...labelStyle, color: '#dc2626' }}><XCircle size={12} /> Reject Booking</div>
                        <textarea
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '10px',
                                border: '1.5px solid #fecaca',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                fontFamily: 'inherit',
                                outline: 'none',
                                minHeight: '60px',
                                resize: 'vertical' as const,
                                background: '#fff',
                                marginBottom: '10px'
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
                                    padding: '6px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: !rejectReason.trim() ? '#e2e8f0' : '#dc2626',
                                    color: '#fff',
                                    cursor: actionLoading || !rejectReason.trim() ? 'not-allowed' : 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Confirm Reject
                            </button>
                            <button
                                onClick={() => setShowRejectForm(false)}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: '#fff',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: 700
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Equipment Log Form (Check-Out / Check-In) */}
                {showLogForm !== null && (
                    <div style={{
                        ...sectionStyle,
                        background: showLogForm === EquipmentLogAction.CheckOut ? '#eff6ff' : '#f0fdf4',
                        border: `1px solid ${showLogForm === EquipmentLogAction.CheckOut ? '#bfdbfe' : '#bbf7d0'}`
                    }}>
                        <div style={{ ...labelStyle, color: showLogForm === EquipmentLogAction.CheckOut ? '#2563eb' : '#16a34a' }}>
                            {showLogForm === EquipmentLogAction.CheckOut ? <LogOut size={12} /> : <LogIn size={12} />}
                            {showLogForm === EquipmentLogAction.CheckOut ? 'Check Out Equipment' : 'Check In Equipment'}
                        </div>
                        <textarea
                            style={{
                                width: '100%', padding: '10px 14px', borderRadius: '10px',
                                border: `1.5px solid ${showLogForm === EquipmentLogAction.CheckOut ? '#bfdbfe' : '#bbf7d0'}`,
                                fontSize: '0.85rem', fontWeight: 500, fontFamily: 'inherit',
                                outline: 'none', minHeight: '60px', resize: 'vertical' as const,
                                background: '#fff', marginBottom: '10px'
                            }}
                            value={logNote}
                            onChange={e => setLogNote(e.target.value)}
                            placeholder="Optional note..."
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => handleEquipmentLog(showLogForm)}
                                disabled={actionLoading}
                                style={{
                                    padding: '6px 16px', borderRadius: '8px', border: 'none',
                                    background: showLogForm === EquipmentLogAction.CheckOut ? '#2563eb' : '#16a34a',
                                    color: '#fff', cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    fontSize: '0.78rem', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> :
                                    showLogForm === EquipmentLogAction.CheckOut ? <LogOut size={12} /> : <LogIn size={12} />}
                                Confirm
                            </button>
                            <button
                                onClick={() => { setShowLogForm(null); setLogNote(''); }}
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
                    <div style={{
                        ...sectionStyle,
                        background: '#f3f4f6',
                        border: '1px solid #e5e7eb'
                    }}>
                        <div style={{ ...labelStyle, color: '#6b7280' }}><AlertTriangle size={12} /> Cancel Booking</div>
                        <textarea
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '10px',
                                border: '1.5px solid #e5e7eb',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                fontFamily: 'inherit',
                                outline: 'none',
                                minHeight: '60px',
                                resize: 'vertical' as const,
                                background: '#fff',
                                marginBottom: '10px'
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
                                    padding: '6px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#6b7280',
                                    color: '#fff',
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Confirm Cancel
                            </button>
                            <button
                                onClick={() => setShowCancelForm(false)}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: '#fff',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: 700
                                }}
                            >
                                Back
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{
                paddingTop: '14px',
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px',
                marginTop: 'auto'
            }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {canCheckOut && !showLogForm && !showCancelForm && !showApproveForm && !showRejectForm && (
                        <button
                            onClick={() => setShowLogForm(EquipmentLogAction.CheckOut)}
                            style={{
                                padding: '8px 16px', borderRadius: '10px',
                                border: '1px solid #bfdbfe', background: '#eff6ff',
                                color: '#2563eb', cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <LogOut size={14} /> Check Out
                        </button>
                    )}
                    {canCheckIn && !showLogForm && !showCancelForm && (
                        <button
                            onClick={() => setShowLogForm(EquipmentLogAction.CheckIn)}
                            style={{
                                padding: '8px 16px', borderRadius: '10px',
                                border: '1px solid #bbf7d0', background: '#f0fdf4',
                                color: '#16a34a', cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <LogIn size={14} /> Check In
                        </button>
                    )}
                    {canCancel && !showCancelForm && !showApproveForm && !showRejectForm && !showLogForm && (
                        <button
                            onClick={() => { setShowCancelForm(true); setShowApproveForm(false); setShowRejectForm(false); }}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '10px',
                                border: '1px solid #e5e7eb',
                                background: '#fff',
                                color: '#6b7280',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <XCircle size={14} /> Cancel Booking
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 20px',
                            borderRadius: '10px',
                            border: '1px solid var(--border-color)',
                            background: '#fff',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            transition: 'all 0.2s'
                        }}
                    >
                        Close
                    </button>

                    {canApproveReject && !showApproveForm && !showRejectForm && !showCancelForm && (
                        <>
                            <button
                                onClick={() => { setShowRejectForm(true); setShowApproveForm(false); setShowCancelForm(false); }}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    border: '1px solid #fecaca',
                                    background: '#fff',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <XCircle size={14} /> Reject
                            </button>
                            <button
                                onClick={() => { setShowApproveForm(true); setShowRejectForm(false); setShowCancelForm(false); }}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: '#059669',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)'
                                }}
                            >
                                <CheckCircle2 size={14} /> Approve
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BookingDetailPanel;
