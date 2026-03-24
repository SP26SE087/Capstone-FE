import React from 'react';
import { BookingStatus } from '@/types/booking';
import { BookingResponse } from '@/services/bookingService';
import { Clock, CheckCircle2, XCircle, Loader2, Info, Search } from 'lucide-react';

interface GlobalBookingListProps {
  bookings: BookingResponse[];
  loading: boolean;
  onView: (id: string) => void;
}

const GlobalBookingList: React.FC<GlobalBookingListProps> = ({ bookings, loading, onView }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  const filteredAndSortedBookings = React.useMemo(() => {
    let result = [...bookings];

    // Filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(b => 
        (b.title?.toLowerCase().includes(term)) || 
        (b.resourceName?.toLowerCase().includes(term))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(b => b.status === Number(statusFilter));
    }

    // Sort: Pending (1) first, then date desc, Rejected/Approved last
    result.sort((a, b) => {
      const getPriority = (status: BookingStatus) => {
        if (status === BookingStatus.Pending) return 0; // Top priority for review
        if (status === BookingStatus.Approved || status === BookingStatus.Rejected || status === BookingStatus.Cancelled) return 2; // Bottom (already processed)
        return 1; // Middle (In Use, Completed)
      };

      const pA = getPriority(a.status);
      const pB = getPriority(b.status);

      if (pA !== pB) return pA - pB;
      // Secondary sort: newest first
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });

    return result;
  }, [bookings, searchTerm, statusFilter]);

  const [page, setPage] = React.useState(1);
  const itemsPerPage = 5;
  const totalItems = filteredAndSortedBookings.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedBookings = filteredAndSortedBookings.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Reset page on filter
  React.useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  const getStatusBadge = (status: BookingStatus) => {
    const commonStyle: React.CSSProperties = {
      padding: '4px 10px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '0.7rem',
      fontWeight: 700,
      borderRadius: '6px',
      textTransform: 'uppercase'
    };
    switch (status) {
      case BookingStatus.Pending:
        return <span style={{ ...commonStyle, background: '#fefce8', color: '#d97706' }}><Clock size={12} /> Pending</span>;
      case BookingStatus.Approved:
        return <span style={{ ...commonStyle, background: '#ecfdf5', color: '#059669' }}><CheckCircle2 size={12} /> Approved</span>;
      case BookingStatus.InUse:
        return <span style={{ ...commonStyle, background: '#f5f3ff', color: '#7c3aed' }}><Loader2 size={12} className="animate-spin" /> In Use</span>;
      case BookingStatus.Completed:
        return <span style={{ ...commonStyle, background: '#eff6ff', color: '#2563eb' }}><CheckCircle2 size={12} /> Completed</span>;
      case BookingStatus.Rejected:
        return <span style={{ ...commonStyle, background: '#fef2f2', color: '#dc2626' }}><XCircle size={12} /> Rejected</span>;
      case BookingStatus.Cancelled:
        return <span style={{ ...commonStyle, background: '#f3f4f6', color: '#6b7280' }}><XCircle size={12} /> Cancelled</span>;
      default:
        return <span style={{ ...commonStyle, background: '#f1f5f9', color: '#475569' }}>Other</span>;
    }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Booking List</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
               <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
               <input 
                  type="text" 
                  placeholder="Search by title..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ padding: '8px 12px 8px 34px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', width: '220px', outline: 'none' }}
               />
            </div>
            <select 
               value={statusFilter}
               onChange={(e) => setStatusFilter(e.target.value)}
               style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', background: '#fff', cursor: 'pointer' }}
            >
               <option value="all">All Status</option>
               <option value="1">Pending Review</option>
               <option value="2">Approved</option>
               <option value="3">Rejected</option>
               <option value="6">In Use</option>
               <option value="5">Completed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '25%', padding: '1rem 1.5rem', background: '#f8fafc', textAlign: 'left' }}>Booking Title</th>
              <th style={{ width: '20%', padding: '1rem 1.5rem', background: '#f8fafc', textAlign: 'left' }}>Equipment</th>
              <th style={{ width: '20%', padding: '1rem 1.5rem', background: '#f8fafc', textAlign: 'center' }}>Time & Date</th>
              <th style={{ width: '10%', textAlign: 'center', padding: '1rem 1.5rem', background: '#f8fafc' }}>Qty</th>
              <th style={{ width: '15%', textAlign: 'center', padding: '1rem 1.5rem', background: '#f8fafc' }}>Status</th>
              <th style={{ width: '10%', textAlign: 'center', padding: '1rem 1.5rem', background: '#f8fafc' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                  <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 12px', color: 'var(--accent-color)' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>Syncing registry...</p>
                </td>
              </tr>
            ) : paginatedBookings.length > 0 ? (
              paginatedBookings.map((booking) => (
                <tr key={booking.id} style={{ transition: 'background 0.2s', borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'left', maxWidth: '200px' }}>
                    <span style={{ 
                      fontWeight: 800, 
                      color: '#0f172a', 
                      fontSize: '0.95rem',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }} title={booking.title}>
                      {booking.title}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'left', maxWidth: '180px' }}>
                    <span style={{ 
                      padding: '4px 10px', 
                      background: '#f1f5f9', 
                      borderRadius: '6px', 
                      fontSize: '0.75rem', 
                      color: '#475569', 
                      fontWeight: 700,
                      display: 'inline-block',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }} title={booking.resourceName}>
                      {booking.resourceName}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem', alignItems: 'center' }}>
                      <div style={{ color: '#1e293b', fontWeight: 700 }}>
                        {new Date(booking.startTime).toLocaleDateString()}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 500 }}>
                        {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 800, padding: '1.25rem 1.5rem', color: '#0f172a' }}>{booking.quantity}</td>
                  <td style={{ textAlign: 'center', padding: '1.25rem 1.5rem' }}>{getStatusBadge(booking.status)}</td>
                  <td style={{ textAlign: 'center', padding: '1.25rem 1.5rem' }}>
                    <button 
                      className="btn btn-ghost" 
                      onClick={() => onView(booking.id)} 
                      style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, background: '#f8fafc' }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                  <div style={{ marginBottom: '8px' }}><Info size={32} style={{ opacity: 0.3 }} /></div>
                  <p>No bookings found matching filters.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ padding: '1.25rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="btn btn-ghost"
            style={{ padding: '6px 16px', borderRadius: '8px', background: page === 1 ? 'transparent' : '#f8fafc' }}
          >
            Previous
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 700 }}>
            <span style={{ color: 'var(--accent-color)', background: '#f5f3ff', padding: '4px 12px', borderRadius: '6px' }}>{page}</span>
            <span style={{ color: '#94a3b8' }}>of</span>
            <span style={{ color: '#64748b' }}>{totalPages}</span>
          </div>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="btn btn-ghost"
            style={{ padding: '6px 16px', borderRadius: '8px', background: page === totalPages ? 'transparent' : '#f8fafc' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default GlobalBookingList;
