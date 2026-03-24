import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import ResourceList from '@/features/resources/ResourceList';
import BookingModal from '@/features/resources/BookingModal';
import { Resource, CreateBookingRequest, Booking, BookingStatus } from '@/types/booking';
import { bookingService, BookingResponse } from '@/services/bookingService';
import { resourceService } from '@/services/resourceService';
import { useToastStore } from '@/store/slices/toastSlice';
import { Search, History, Calendar, CheckCircle2, Clock, XCircle, AlertCircle, Loader2, Info, X, Edit3, ShieldAlert } from 'lucide-react';

const ResourceBooking: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToastStore();
  const [activeTab, setActiveTab] = useState<'available' | 'my-bookings'>('available');
  const [activeSubTab, setActiveSubTab] = useState<'upcoming' | 'history'>('upcoming');
  const [resources, setResources] = useState<Resource[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [historyBookings, setHistoryBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [availablePage, setAvailablePage] = useState(1);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<BookingResponse | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const itemsPerPage = 5;
  const availableItemsPerPage = 15;

  const fetchData = useCallback(async () => {
     setLoading(true);
     try {
       if (activeTab === 'available') {
         const data = await resourceService.getAll();
         // Parse data format from API
         let resourcesArray: any[] = [];
         if (Array.isArray(data)) resourcesArray = data;
         else if (data && typeof data === 'object') {
           resourcesArray = (data as any).items || (data as any).data || (data as any).value || [];
         }
         
         const mapped = resourcesArray.map((res: any) => ({
           id: res.id,
           name: res.name,
           description: res.description || '',
           type: res.type,
           location: res.location || '',
           totalQuantity: res.totalQuantity,
           availableQuantity: res.availableQuantity,
           damagedQuantity: res.damagedQuantity
         }));
         setResources(mapped);
       } else {
         const [upcoming, history] = await Promise.all([
           bookingService.getMyUpcoming(),
           bookingService.getMyHistory(1, 100)
         ]);
         
         const historyItems = (history as any).items || history || [];
         
         // Sort by creation or start time descending
         const sortedUpcoming = [...upcoming].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
         const sortedHistory = [...historyItems].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
         
         setUpcomingBookings(sortedUpcoming as Booking[]);
         setHistoryBookings(sortedHistory as Booking[]);
       }
     } catch (error) {
       console.error('Error fetching resource/booking data:', error);
     } finally {
       setLoading(false);
     }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBookSubmit = async (request: CreateBookingRequest) => {
    setActionLoading(true);
    try {
      await bookingService.create(request);
      addToast('Reservation request submitted successfully.', 'success');
      setSelectedResource(null);
      if (activeTab === 'available') {
          // If we stay in available, refresh list to show updated quantities
          fetchData();
      } else {
          setActiveTab('my-bookings');
      }
    } catch (error) {
      addToast('Failed to create booking. Please check availability.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState('');

  const handleCancelBooking = (id: string) => {
    setCancellingId(id);
    setCancelReasonText('');
    setShowCancelModal(true);
  };

  const confirmCancelBooking = async () => {
    if (!cancellingId) return;
    
    setActionLoading(true);
    try {
      await bookingService.cancel(cancellingId, cancelReasonText || undefined);
      addToast('Booking cancelled successfully.', 'success');
      setShowCancelModal(false);
      setCancellingId(null);
      if (showDetailModal) setShowDetailModal(false);
      fetchData();
    } catch (error) {
      console.error('Cancel booking error:', error);
      addToast('Could not cancel booking. Check your connection or state.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true);
    setShowDetailModal(true);
    try {
      const detail = await bookingService.getById(id);
      setSelectedBooking(detail);
    } catch (error) {
      console.error('Fetch booking detail error:', error);
      addToast('Failed to fetch booking details.', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const getStatusBadge = (status: BookingStatus) => {
    const commonStyle: React.CSSProperties = { 
      padding: '4px 10px', 
      display: 'inline-flex', 
      alignItems: 'center', 
      gap: '4px', 
      fontSize: '0.7rem', 
      fontWeight: 800,
      borderRadius: '6px',
      textTransform: 'uppercase'
    };
    switch (status) {
      case BookingStatus.Pending:
        return <span className="badge" style={{ ...commonStyle, background: '#fefce8', color: '#d97706' }}><Clock size={12} /> Pending</span>;
      case BookingStatus.Approved:
        return <span className="badge" style={{ ...commonStyle, background: '#ecfdf5', color: '#059669' }}><CheckCircle2 size={12} /> Approved</span>;
      case BookingStatus.InUse:
        return <span className="badge" style={{ ...commonStyle, background: '#f5f3ff', color: '#7c3aed' }}><Loader2 size={12} className="animate-spin" /> In Use</span>;
      case BookingStatus.Completed:
        return <span className="badge" style={{ ...commonStyle, background: '#eff6ff', color: '#2563eb' }}><CheckCircle2 size={12} /> Completed</span>;
      case BookingStatus.Rejected:
        return <span className="badge" style={{ ...commonStyle, background: '#fef2f2', color: '#dc2626' }}><XCircle size={12} /> Rejected</span>;
      case BookingStatus.Cancelled:
        return <span className="badge" style={{ ...commonStyle, background: '#f3f4f6', color: '#6b7280' }}><XCircle size={12} /> Cancelled</span>;
      default:
        return <span className="badge badge-muted" style={commonStyle}>Unknown</span>;
    }
  };

  return (
    <MainLayout role={user.role} userName={user.name}>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="text-3xl font-bold">Lab Resource Booking</h1>
            <p className="text-gray-500">Secure equipment for your cutting-edge research projects.</p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem', padding: '0.4rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('available')}
              className={`btn ${activeTab === 'available' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, borderRadius: '8px' }}
            >
              <Calendar size={18} /> Available
            </button>
            <button
              onClick={() => setActiveTab('my-bookings')}
              className={`btn ${activeTab === 'my-bookings' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, borderRadius: '8px' }}
            >
              <History size={18} /> My Bookings
            </button>
          </div>
        </div>

        {activeTab === 'available' && (
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter by name or device type..."
                  className="form-input"
                  style={{ paddingLeft: '48px', height: '48px', borderRadius: '12px', border: '1px solid var(--border-color)' }}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setAvailablePage(1); // Reset to page 1 on search
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '8rem 0', textAlign: 'center' }}>
            <Loader2 className="animate-spin" size={48} style={{ margin: '0 auto 1rem', color: 'var(--accent-color)' }} />
            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Fetching available resources...</p>
          </div>
        ) : activeTab === 'available' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <ResourceList
              resources={resources
                .filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .slice((availablePage - 1) * availableItemsPerPage, availablePage * availableItemsPerPage)
              }
              onBook={(r) => setSelectedResource(r)}
            />
            
            {/* Pagination for Available Resources */}
            {(() => {
              const filtered = resources.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
              const totalPages = Math.ceil(filtered.length / availableItemsPerPage);
              if (totalPages <= 1) return null;

              return (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                  <button
                    disabled={availablePage === 1}
                    onClick={() => setAvailablePage(prev => Math.max(1, prev - 1))}
                    className="btn btn-outline"
                    style={{ padding: '4px 12px', fontSize: '0.85rem', opacity: availablePage === 1 ? 0.5 : 1, minWidth: 'unset', height: '32px' }}
                  >
                    Prev
                  </button>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => setAvailablePage(i + 1)}
                        className={`btn ${availablePage === i + 1 ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', minWidth: 'unset', borderRadius: '6px' }}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={availablePage === totalPages}
                    onClick={() => setAvailablePage(prev => Math.min(totalPages, prev + 1))}
                    className="btn btn-outline"
                    style={{ padding: '4px 12px', fontSize: '0.85rem', opacity: availablePage === totalPages ? 0.5 : 1, minWidth: 'unset', height: '32px' }}
                  >
                    Next
                  </button>
                </div>
              );
            })()}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Sub-tabs for My Reservations */}
            <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid #e5e7eb', marginBottom: '0.25rem', padding: '0 4px' }}>
              <button 
                onClick={() => setActiveSubTab('upcoming')}
                style={{ 
                  padding: '10px 0', 
                  fontSize: '0.9rem', 
                  fontWeight: 600, 
                  color: activeSubTab === 'upcoming' ? 'var(--accent-color)' : '#6b7280',
                  borderBottom: activeSubTab === 'upcoming' ? '2px solid var(--accent-color)' : '2px solid transparent',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                Upcoming
                <span style={{ 
                  background: activeSubTab === 'upcoming' ? 'var(--accent-bg)' : '#f3f4f6', 
                  color: activeSubTab === 'upcoming' ? 'var(--accent-color)' : '#6b7280', 
                  fontSize: '0.65rem', 
                  padding: '1px 6px', 
                  borderRadius: '10px' 
                }}>{upcomingBookings.length}</span>
              </button>
              <button 
                onClick={() => setActiveSubTab('history')}
                style={{ 
                  padding: '10px 0', 
                  fontSize: '0.9rem', 
                  fontWeight: 600, 
                  color: activeSubTab === 'history' ? 'var(--accent-color)' : '#6b7280',
                  borderBottom: activeSubTab === 'history' ? '2px solid var(--accent-color)' : '2px solid transparent',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                History
                <span style={{ 
                  background: activeSubTab === 'history' ? 'var(--accent-bg)' : '#f3f4f6', 
                  color: activeSubTab === 'history' ? 'var(--accent-color)' : '#6b7280', 
                  fontSize: '0.65rem', 
                  padding: '1px 6px', 
                  borderRadius: '10px' 
                }}>{historyBookings.length}</span>
              </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #eef2f6', borderRadius: '16px', boxShadow: '0 4px 20px -5px rgba(0,0,0,0.05)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9' }}>Reservation Details</th>
                      <th style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', textAlign: 'left' }}>Time & Schedule</th>
                      <th style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSubTab === 'upcoming' ? (
                      upcomingBookings.length > 0 ? (
                        upcomingBookings.slice((upcomingPage - 1) * itemsPerPage, upcomingPage * itemsPerPage).map((booking) => (
                          <tr key={booking.id} style={{ transition: 'all 0.2s', borderBottom: '1px solid #f8fafc' }} className="hover-row">
                            <td style={{ padding: '1.25rem 1.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '220px', maxWidth: '350px' }}>
                                <div style={{ 
                                  padding: '10px', 
                                  background: 'linear-gradient(135deg, #f5f3ff, #f0fdf4)', 
                                  borderRadius: '12px', 
                                  color: 'var(--accent-color)', 
                                  flexShrink: 0,
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                                }}>
                                  <Calendar size={18} />
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <p 
                                    style={{ 
                                      margin: 0, 
                                      fontWeight: 800, 
                                      fontSize: '0.95rem', 
                                      color: '#0f172a',
                                      overflow: 'hidden', 
                                      textOverflow: 'ellipsis', 
                                      whiteSpace: 'nowrap',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => handleViewDetail(booking.id)}
                                    title={booking.title}
                                  >
                                    {booking.title}
                                  </p>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                     <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                       {booking.resourceName}
                                     </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', textAlign: 'left' }}>
                              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: 700, fontSize: '0.85rem' }}>
                                  <Calendar size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                                  <span>{new Date(booking.startTime).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>
                                  <Clock size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                                  <span style={{ whiteSpace: 'nowrap' }}>
                                    {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                                    &nbsp;&rarr;&nbsp; 
                                    {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.9rem', fontWeight: 800, textAlign: 'center', color: '#0f172a' }}>
                              {booking.quantity}
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                              {getStatusBadge(booking.status)}
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                <button 
                                  className="btn btn-ghost"
                                  style={{ padding: '6px 16px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, height: '36px', background: '#f8fafc' }}
                                  onClick={() => handleViewDetail(booking.id)}
                                >
                                  Details
                                </button>
                                {(booking.status === BookingStatus.Pending || booking.status === BookingStatus.Approved) && (
                                  <button 
                                    className="btn btn-ghost" 
                                    style={{ color: '#e11d48', padding: '6px 16px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, height: '36px', background: '#fff1f2' }}
                                    onClick={() => handleCancelBooking(booking.id)}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ padding: '5rem', textAlign: 'center', color: '#94a3b8' }}>
                             <Info size={40} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                             <p style={{ fontWeight: 600 }}>No upcoming reservations found.</p>
                          </td>
                        </tr>
                      )
                    ) : (
                      historyBookings.length > 0 ? (
                        historyBookings.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage).map((booking) => (
                          <tr key={booking.id} style={{ borderBottom: '1px solid #f8fafc', transition: 'all 0.2s', opacity: 0.85 }} className="hover-row">
                            <td style={{ padding: '1.25rem 1.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '220px', maxWidth: '350px' }}>
                                <div style={{ padding: '10px', background: '#f1f5f9', borderRadius: '12px', color: '#64748b', flexShrink: 0 }}>
                                  <History size={18} />
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <p 
                                    style={{ 
                                      margin: 0, 
                                      fontWeight: 700, 
                                      fontSize: '0.9rem', 
                                      color: '#334155',
                                      overflow: 'hidden', 
                                      textOverflow: 'ellipsis', 
                                      whiteSpace: 'nowrap',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => handleViewDetail(booking.id)}
                                    title={booking.title}
                                  >
                                    {booking.title}
                                  </p>
                                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {booking.resourceName}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', textAlign: 'left' }}>
                              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#475569' }}>
                                    <Calendar size={13} style={{ flexShrink: 0 }} />
                                    <span>{new Date(booking.startTime).toLocaleDateString()}</span>
                                 </div>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                                    <Clock size={13} style={{ flexShrink: 0 }} />
                                    <span style={{ whiteSpace: 'nowrap' }}>{new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &rarr; {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                 </div>
                              </div>
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', color: '#475569' }}>
                              {booking.quantity}
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                              {getStatusBadge(booking.status)}
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                              <button 
                                className="btn btn-ghost"
                                style={{ padding: '6px 20px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600, height: '36px', background: '#f8fafc' }}
                                onClick={() => handleViewDetail(booking.id)}
                              >
                                View Log
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ padding: '5rem', textAlign: 'center', color: '#94a3b8' }}>
                             <History size={40} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                             <p style={{ fontWeight: 600 }}>Your reservation history is empty.</p>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Combined Pagination Logic */}
            {(() => {
              const currentList = activeSubTab === 'upcoming' ? upcomingBookings : historyBookings;
              const currentPage = activeSubTab === 'upcoming' ? upcomingPage : historyPage;
              const setCurrentPage = activeSubTab === 'upcoming' ? setUpcomingPage : setHistoryPage;
              const totalPages = Math.ceil(currentList.length / itemsPerPage);

              if (totalPages <= 1) return null;

              return (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="btn btn-outline"
                    style={{ padding: '4px 12px', fontSize: '0.85rem', opacity: currentPage === 1 ? 0.5 : 1, minWidth: 'unset', height: '32px' }}
                  >
                    Prev
                  </button>

                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`btn ${currentPage === i + 1 ? 'btn-primary' : 'btn-ghost'}`}
                        style={{
                          width: '32px',
                          height: '32px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                          minWidth: 'unset',
                          borderRadius: '6px'
                        }}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="btn btn-outline"
                    style={{ padding: '4px 12px', fontSize: '0.85rem', opacity: currentPage === totalPages ? 0.5 : 1, minWidth: 'unset', height: '32px' }}
                  >
                    Next
                  </button>
                </div>
              );
            })()}

            {upcomingBookings.length === 0 && historyBookings.length === 0 && (
              <div className="empty-state" style={{ padding: '4rem 0' }}>
                <div style={{ background: 'var(--background-color)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                  <AlertCircle size={32} style={{ color: 'var(--text-muted)' }} />
                </div>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '6px' }}>No reservations found</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>You haven't booked any laboratory resources yet.</p>
                <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('available')}>Browse Available Resources</button>
              </div>
            )}
          </div>
        )}

        {selectedResource && (
          <BookingModal
            resource={selectedResource}
            onClose={() => setSelectedResource(null)}
            onSubmit={handleBookSubmit}
          />
        )}

        {actionLoading && (
          <div className="loading-overlay" style={{ zIndex: 10002 }}>
             <div className="premium-loader">
                <div></div><div></div><div></div>
             </div>
             <p className="loading-text">Processing transaction...</p>
          </div>
        )}

        {/* Booking Detail Modal */}
        {showDetailModal && (
          <div className="modal-overlay" onClick={() => setShowDetailModal(false)} style={{ backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', width: '95%', background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)' }}>
              <div className="modal-header" style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)' }}>
                    <Info size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Reservation Details</h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reference ID: {selectedBooking?.id.substring(0, 8).toUpperCase()}</p>
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={() => setShowDetailModal(false)} style={{ padding: '8px' }}><X size={20} /></button>
              </div>
              
              <div className="modal-body" style={{ padding: '2.5rem', maxHeight: '75vh', overflowY: 'auto', background: 'linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)' }}>
                {detailLoading ? (
                  <div style={{ padding: '5rem 0', textAlign: 'center' }}>
                     <Loader2 size={44} className="animate-spin" style={{ color: 'var(--accent-color)', margin: '0 auto 1.5rem', opacity: 0.8 }} />
                     <p style={{ color: '#64748b', fontWeight: 600, fontSize: '1rem' }}>Retrieving your reservation details...</p>
                  </div>
                ) : selectedBooking ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    
                    {/* Status Banner */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      background: '#fff', 
                      padding: '1.75rem 2rem', 
                      borderRadius: '24px', 
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.02), 0 4px 6px -2px rgba(0,0,0,0.01)'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedBooking.title}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                           <div style={{ color: 'var(--accent-color)', background: 'var(--accent-bg)', padding: '2px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>{selectedBooking.resourceName}</div>
                           <span style={{ color: '#e2e8f0' }}>|</span>
                           <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Qty: {selectedBooking.quantity} units</span>
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, scale: '1.1' }}>{getStatusBadge(selectedBooking.status)}</div>
                    </div>
 
                    {/* Time Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                      <div style={{ padding: '1.5rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', transition: 'transform 0.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                           <div style={{ padding: '6px', background: '#f0fdf4', color: '#16a34a', borderRadius: '8px' }}><Calendar size={14} /></div>
                           <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Schedule</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{new Date(selectedBooking.startTime).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        <p style={{ margin: '6px 0 0 0', fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>{new Date(selectedBooking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div style={{ padding: '1.5rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                           <div style={{ padding: '6px', background: '#fef2f2', color: '#dc2626', borderRadius: '8px' }}><Calendar size={14} /></div>
                           <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Schedule</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{new Date(selectedBooking.endTime).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        <p style={{ margin: '6px 0 0 0', fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>{new Date(selectedBooking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
 
                    {/* Usage Purpose */}
                    <div style={{ background: '#fff', padding: '1.75rem', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                        <div style={{ padding: '6px', background: '#f5f3ff', color: '#7c3aed', borderRadius: '8px' }}><Edit3 size={16} /></div>
                        <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#1e293b' }}>Research & Usage Purpose</h5>
                      </div>
                      <div style={{ 
                        fontSize: '1rem', 
                        lineHeight: 1.7, 
                        color: '#475569', 
                        background: '#f8fafc', 
                        padding: '1.25rem', 
                        borderRadius: '16px',
                        border: '1px solid #f1f5f9',
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}>
                        {selectedBooking.purpose || 'No detailed purpose was provided for this reservation request.'}
                      </div>
                    </div>
 
                    {/* Reason/Feedback for Final States */}
                    {(selectedBooking.status === BookingStatus.Rejected || selectedBooking.status === BookingStatus.Cancelled) && (
                      <div style={{ 
                        padding: '1.75rem', 
                        background: selectedBooking.status === BookingStatus.Rejected ? '#fff1f2' : '#f8fafc', 
                        borderRadius: '24px', 
                        border: `1px solid ${selectedBooking.status === BookingStatus.Rejected ? '#fecaca' : '#e2e8f0'}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                          <div style={{ 
                            padding: '6px', 
                            background: selectedBooking.status === BookingStatus.Rejected ? '#ffe4e6' : '#f1f5f9', 
                            color: selectedBooking.status === BookingStatus.Rejected ? '#e11d48' : '#64748b', 
                            borderRadius: '8px' 
                          }}><ShieldAlert size={16} /></div>
                          <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: selectedBooking.status === BookingStatus.Rejected ? '#9f1239' : '#334155' }}>
                            {selectedBooking.status === BookingStatus.Rejected ? 'Feedback from Lab Director' : 'Cancellation Detail'}
                          </h5>
                        </div>
                        <p style={{ margin: 0, fontSize: '1rem', color: selectedBooking.status === BookingStatus.Rejected ? '#e11d48' : '#475569', lineHeight: 1.6, fontWeight: 500 }}>
                          {selectedBooking.status === BookingStatus.Rejected ? selectedBooking.rejectReason : selectedBooking.cancelReason || 'Standard cancellation requested.'}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '5rem 0', textAlign: 'center' }}>
                    <ShieldAlert size={56} style={{ color: '#ef4444', margin: '0 auto 1.5rem', opacity: 0.2 }} />
                    <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.1rem' }}>We couldn't load the reservation data.</p>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowDetailModal(false)} style={{ marginTop: '1rem' }}>Return to list</button>
                  </div>
                )}
              </div>
              
              <div className="modal-footer" style={{ padding: '1.25rem 2rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button className="btn btn-ghost" onClick={() => setShowDetailModal(false)} style={{ fontWeight: 600 }}>Dismiss</button>
                {!detailLoading && selectedBooking?.status === BookingStatus.Pending && (
                  <button className="btn btn-danger" onClick={() => handleCancelBooking(selectedBooking.id)} style={{ padding: '8px 20px', borderRadius: '10px', fontWeight: 700 }}>
                     Cancel Reservation
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Custom Cancel Modal */}
        {showCancelModal && (
          <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', zIndex: 10001 }}>
            <div className="modal-container" style={{ maxWidth: '480px', width: '90%', background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2)' }}>
              <div className="modal-header" style={{ padding: '1.25rem 2rem', background: '#fff1f2', borderBottom: '1px solid #fee2e2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <AlertCircle size={24} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#9f1239' }}>Cancel Reservation</h3>
                </div>
                <button className="btn btn-ghost" onClick={() => setShowCancelModal(false)} style={{ padding: '8px' }}><X size={20} /></button>
              </div>
              <div className="modal-body" style={{ padding: '2rem' }}>
                <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.95rem', color: '#475569', lineHeight: 1.6 }}>
                  Are you sure you want to cancel this reservation? If so, please provide a short reason for our records.
                </p>
                <textarea
                  value={cancelReasonText}
                  onChange={(e) => setCancelReasonText(e.target.value)}
                  placeholder="Reason for cancellation (optional)..."
                  style={{ 
                    width: '100%', 
                    height: '100px', 
                    padding: '12px 16px', 
                    borderRadius: '16px', 
                    border: '2px solid #f1f5f9', 
                    fontSize: '0.9rem', 
                    outline: 'none',
                    resize: 'none',
                    transition: 'border-color 0.2s',
                    background: '#f8fafc'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#e11d48'}
                  onBlur={(e) => e.target.style.borderColor = '#f1f5f9'}
                />
              </div>
              <div className="modal-footer" style={{ padding: '1.25rem 2rem', background: '#fcfcfc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button className="btn btn-ghost" onClick={() => setShowCancelModal(false)} style={{ fontWeight: 600 }}>Nevermind</button>
                <button 
                  className="btn btn-danger" 
                  onClick={confirmCancelBooking} 
                  style={{ 
                    padding: '10px 24px', 
                    borderRadius: '12px', 
                    fontWeight: 700, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.2)'
                  }}
                >
                   Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ResourceBooking;
