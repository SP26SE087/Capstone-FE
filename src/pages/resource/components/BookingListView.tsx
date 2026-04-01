import React from 'react';
import { Booking, BookingStatus } from '@/types/booking';
import { Calendar, Clock, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface BookingListViewProps {
    bookings: Booking[];
    selectedId: string | null;
    onSelect: (booking: Booking) => void;
    isSplit?: boolean;
}

const getStatusConfig = (status: BookingStatus) => {
    switch (status) {
        case BookingStatus.Pending: return { label: 'Pending', color: '#d97706', bg: '#fefce8', border: '#fde68a' };
        case BookingStatus.Approved: return { label: 'Approved', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' };
        case BookingStatus.Rejected: return { label: 'Rejected', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
        case BookingStatus.Cancelled: return { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' };
        case BookingStatus.Completed: return { label: 'Completed', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
        case BookingStatus.InUse: return { label: 'In Use', color: '#7c3aed', bg: '#f5f3ff', border: '#e9d5ff' };
        default: return { label: 'Unknown', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
    }
};

const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const BookingListView: React.FC<BookingListViewProps> = ({
    bookings,
    selectedId,
    onSelect,
    isSplit: _isSplit = false
}) => {
    if (bookings.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                <Calendar size={48} style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>No Bookings</h3>
                <p style={{ fontSize: '0.85rem' }}>No bookings found matching your criteria.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {bookings.map(booking => {
                const isSelected = booking.id === selectedId;
                const statusConfig = getStatusConfig(booking.status);

                return (
                    <div
                        key={booking.id}
                        onClick={() => onSelect(booking)}
                        style={{
                            padding: '14px 16px',
                            borderRadius: '12px',
                            border: isSelected ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                            background: isSelected ? 'var(--accent-bg)' : '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px'
                        }}
                    >
                        {/* Status indicator */}
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: statusConfig.bg,
                            border: `1px solid ${statusConfig.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {booking.status === BookingStatus.Pending && <Clock size={18} color={statusConfig.color} />}
                            {booking.status === BookingStatus.Approved && <CheckCircle2 size={18} color={statusConfig.color} />}
                            {booking.status === BookingStatus.Rejected && <XCircle size={18} color={statusConfig.color} />}
                            {booking.status === BookingStatus.Cancelled && <XCircle size={18} color={statusConfig.color} />}
                            {booking.status === BookingStatus.Completed && <CheckCircle2 size={18} color={statusConfig.color} />}
                            {booking.status === BookingStatus.InUse && <Loader2 size={18} color={statusConfig.color} />}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    color: '#1e293b',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {booking.title}
                                </span>
                                <span style={{
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    color: statusConfig.color,
                                    background: statusConfig.bg,
                                    border: `1px solid ${statusConfig.border}`,
                                    padding: '1px 6px',
                                    borderRadius: '6px',
                                    flexShrink: 0,
                                    textTransform: 'uppercase'
                                }}>
                                    {statusConfig.label}
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: '#64748b' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Calendar size={11} /> {formatDate(booking.startTime)}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={11} /> {formatTime(booking.startTime)} — {formatTime(booking.endTime)}
                                </span>
                                {booking.userName && (
                                    <span style={{ fontWeight: 600 }}>{booking.userName}</span>
                                )}
                            </div>
                        </div>

                        {/* Arrow */}
                        <ChevronRight size={16} style={{ color: isSelected ? 'var(--accent-color)' : '#cbd5e1', flexShrink: 0 }} />
                    </div>
                );
            })}
        </div>
    );
};

export default BookingListView;
