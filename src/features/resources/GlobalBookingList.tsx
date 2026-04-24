import React from 'react';
import { BookingStatus } from '@/types/booking';
import { BookingResponse } from '@/services/bookingService';
import { Clock, CheckCircle2, XCircle, Loader2, Info } from 'lucide-react';

interface GlobalBookingListProps {
  bookings: BookingResponse[];
  loading: boolean;
  onView: (id: string) => void;
  isSplit?: boolean;
}

const GlobalBookingList: React.FC<GlobalBookingListProps> = ({ bookings, loading, onView, isSplit }) => {
  const [page, setPage] = React.useState(1);
  const itemsPerPage = isSplit ? 6 : 8;
  const totalItems = bookings.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedBookings = bookings.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  React.useEffect(() => {
    setPage(1);
  }, [bookings.length]);

  const getStatusBadge = (status: BookingStatus) => {
    const commonStyle: React.CSSProperties = {
      padding: '4px 8px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '0.65rem',
      fontWeight: 700,
      borderRadius: '6px',
      textTransform: 'uppercase'
    };
    switch (status) {
      case BookingStatus.Pending:
        return <span style={{ ...commonStyle, background: '#fefce8', color: '#d97706' }}><Clock size={10} /> Pending</span>;
      case BookingStatus.Approved:
        return <span style={{ ...commonStyle, background: '#ecfdf5', color: '#059669' }}><CheckCircle2 size={10} /> Approved</span>;
      case BookingStatus.InUse:
        return <span style={{ ...commonStyle, background: '#f5f3ff', color: '#7c3aed' }}><Loader2 size={10} className="animate-spin" /> In Use</span>;
      case BookingStatus.Completed:
        return <span style={{ ...commonStyle, background: '#eff6ff', color: '#2563eb' }}><CheckCircle2 size={10} /> Completed</span>;
      case BookingStatus.Rejected:
        return <span style={{ ...commonStyle, background: '#fef2f2', color: '#dc2626' }}><XCircle size={10} /> Rejected</span>;
      case BookingStatus.Cancelled:
        return <span style={{ ...commonStyle, background: '#f3f4f6', color: '#6b7280' }}><XCircle size={10} /> Cancelled</span>;
      default:
        return <span style={{ ...commonStyle, background: '#f1f5f9', color: '#475569' }}>Other</span>;
    }
  };

  return (
    <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 700 }}>Reservation Ledger</h3>
        <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>System-wide resource booking history and requests</p>
      </div>

      <div style={{ flex: 1, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc' }}>Booking Detail</th>
              {!isSplit && <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc' }}>Resource</th>}
              <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc', textAlign: 'center' }}>Schedule</th>
              <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '4rem' }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: '#3b82f6', margin: '0 auto 12px' }} />
                  <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Fetching bookings...</p>
                </td>
              </tr>
            ) : paginatedBookings.length > 0 ? (
              paginatedBookings.map((booking) => (
                <tr key={booking.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} className="table-row-hover">
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{booking.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: '4px' }}>
                        Borrower: {booking.userFullName || booking.userName}
                      </span>
                      {booking.managerFullName && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', background: '#f0fdf4', padding: '1px 6px', borderRadius: '4px' }}>
                          Manager: {booking.managerFullName}
                        </span>
                      )}
                    </div>
                    {isSplit && <div style={{ fontSize: '0.7rem', color: '#3b82f6', marginTop: '2px', fontWeight: 600 }}>{booking.resourceName}</div>}
                  </td>
                  {!isSplit && (
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, 
                        background: '#f1f5f9', color: '#475569'
                      }}>
                        {booking.resourceName}
                      </span>
                    </td>
                  )}
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>{new Date(booking.startTime).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    {getStatusBadge(booking.status)}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                    <button 
                      onClick={() => onView(booking.id)}
                      style={{ 
                        padding: '6px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', 
                        background: 'white', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                      }}
                      className="btn-hover-premium"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                  <Info size={24} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <p style={{ fontSize: '0.9rem' }}>No reservation data.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center', background: '#fff' }}>
           <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: page === 1 ? '#f8fafc' : 'white', color: page === 1 ? '#cbd5e1' : '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: page === 1 ? 'default' : 'pointer' }}
          >
            Prev
          </button>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>{page} / {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: page === totalPages ? '#f8fafc' : 'white', color: page === totalPages ? '#cbd5e1' : '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: page === totalPages ? 'default' : 'pointer' }}
          >
            Next
          </button>
        </div>
      )}
      <style>{`
        .table-row-hover:hover { background-color: #f8fafc; }
        .btn-hover-premium:hover { background-color: #3b82f6; color: white !important; border-color: #3b82f6 !important; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default GlobalBookingList;
