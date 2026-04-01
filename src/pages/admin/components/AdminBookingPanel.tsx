import React, { useState } from 'react';
import { BookingResponse, bookingService } from '@/services/bookingService';
import { BookingStatus } from '@/types/booking';
import { X, Clock, Package, User, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface AdminBookingPanelProps {
  booking: BookingResponse;
  onClose: () => void;
  onSaved: (reload: boolean, message?: string) => void;
  actionLoading: boolean;
}

const AdminBookingPanel: React.FC<AdminBookingPanelProps> = ({ 
  booking, 
  onClose, 
  onSaved,
  actionLoading: externalLoading
}) => {
  const [actionNote, setActionNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  const loading = externalLoading || localLoading;

  const handleApprove = async () => {
    setLocalLoading(true);
    try {
      await bookingService.approve(booking.id, actionNote);
      onSaved(true, 'Booking request approved successfully.');
    } catch (error) {
      console.error(error);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleReject = async () => {
    if (!actionNote.trim()) return;
    setLocalLoading(true);
    try {
      await bookingService.reject(booking.id, actionNote);
      onSaved(true, 'Booking request rejected.');
    } catch (error) {
      console.error(error);
    } finally {
      setLocalLoading(false);
    }
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case BookingStatus.Pending: return { bg: '#fffbeb', text: '#d97706', label: 'Pending' };
      case BookingStatus.Approved: return { bg: '#ecfdf5', text: '#059669', label: 'Approved' };
      case BookingStatus.Rejected: return { bg: '#fef2f2', text: '#dc2626', label: 'Rejected' };
      case BookingStatus.Cancelled: return { bg: '#f3f4f6', text: '#6b7280', label: 'Cancelled' };
      case BookingStatus.Completed: return { bg: '#eff6ff', text: '#2563eb', label: 'Completed' };
      case BookingStatus.InUse: return { bg: '#f5f3ff', text: '#7c3aed', label: 'In Use' };
      default: return { bg: '#f3f4f6', text: '#64748b', label: 'Unknown' };
    }
  };

  const status = getStatusColor(booking.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Review Reservation</h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0 0' }}>Request ID: {booking.id.substring(0, 8).toUpperCase()}</p>
        </div>
        <button onClick={onClose} style={{ padding: '8px', borderRadius: '10px', background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b' }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
        {/* Info Card */}
        <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', padding: '1.25rem', borderRadius: '16px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{booking.title}</h3>
            <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 600, background: status.bg, color: status.text }}>
              {status.label}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <Package size={14} color="#3b82f6" />
              <span style={{ color: '#475569' }}>Equipment: <span style={{ color: '#0f172a', fontWeight: 600 }}>{booking.resourceName}</span></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <User size={14} color="#3b82f6" />
              <span style={{ color: '#475569' }}>User: <span style={{ color: '#0f172a', fontWeight: 600 }}>{booking.userName}</span></span>
            </div>
          </div>
        </div>

        {/* Time Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.75rem', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={10} /> Start
            </span>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, margin: '2px 0' }}>{new Date(booking.startTime).toLocaleDateString()}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div style={{ padding: '0.75rem', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={10} /> End
            </span>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, margin: '2px 0' }}>{new Date(booking.endTime).toLocaleDateString()}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>Purpose</h4>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', fontSize: '0.88rem', color: '#475569', border: '1px solid #f1f5f9', lineHeight: 1.5 }}>
            {booking.purpose || 'No description provided.'}
          </div>
        </div>

        {(isRejecting || isApproving) && (
          <div style={{ padding: '1rem', background: isApproving ? '#f0fdf4' : '#fff1f2', borderRadius: '12px', border: '1px solid', borderColor: isApproving ? '#bbf7d0' : '#fecdd3', marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: isApproving ? '#15803d' : '#9f1239', marginBottom: '6px' }}>
              {isApproving ? 'Approval Note (Optional)' : 'Rejection Reason (Required)'}
            </label>
            <textarea 
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder={isApproving ? "Instructions for user..." : "Explain why..."}
              style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', minHeight: '80px', resize: 'none', outline: 'none' }}
            />
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        {booking.status === BookingStatus.Pending && !isRejecting && !isApproving ? (
          <>
            <button 
              onClick={() => setIsRejecting(true)}
              style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #fecdd3', color: '#dc2626', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Reject
            </button>
            <button 
              onClick={() => setIsApproving(true)}
              style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', color: 'white', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Approve Request
            </button>
          </>
        ) : (isRejecting || isApproving) ? (
          <>
            <button 
              disabled={loading}
              onClick={() => { setIsRejecting(false); setIsApproving(false); setActionNote(''); }}
              style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', color: '#64748b', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button 
              disabled={loading || (isRejecting && !actionNote.trim())}
              onClick={isApproving ? handleApprove : handleReject}
              style={{ 
                padding: '8px 20px', 
                background: isApproving ? '#10b981' : '#ef4444', 
                border: 'none', 
                color: 'white', 
                borderRadius: '10px', 
                fontSize: '0.85rem', 
                fontWeight: 600, 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirm'}
            </button>
          </>
        ) : (
          <button 
            onClick={onClose}
            style={{ padding: '8px 20px', background: '#3b82f6', border: 'none', color: 'white', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Done Reviewing
          </button>
        )}
      </div>
    </div>
  );
};

export default AdminBookingPanel;
