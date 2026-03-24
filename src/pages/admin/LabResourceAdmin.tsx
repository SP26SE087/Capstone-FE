import React, { useState, useEffect } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import ResourceManagement from '@/features/resources/ResourceManagement';
import EquipmentLogList from '@/features/resources/EquipmentLogList';
import ResourceFormModal from '@/features/resources/ResourceFormModal';
import EquipmentLogFormModal from '@/features/resources/EquipmentLogFormModal';
import ConfirmModal from '@/components/common/ConfirmModal';
import { Resource, EquipmentLog, BookingStatus } from '@/types/booking';
import { resourceService, CreateResourceRequest } from '@/services/resourceService';
import { equipmentLogService, AddEquipmentLogRequest } from '@/services/equipmentLogService';
import { userService } from '@/services/userService';
import { Package, Activity, Loader2, CalendarRange, X, User, Calendar, Clock, Info } from 'lucide-react';
import { useToastStore } from '@/store/slices/toastSlice';
import GlobalBookingList from '@/features/resources/GlobalBookingList';
import { bookingService, BookingResponse } from '@/services/bookingService';

const LabResourceAdmin: React.FC<{ initialTab?: 'manage' | 'logs' }> = ({ initialTab = 'manage' }) => {
  const { user } = useAuth();
  const { addToast } = useToastStore();
  
  const [activeTab, setActiveTab] = useState<'manage' | 'logs' | 'bookings'>(initialTab);
  const [resources, setResources] = useState<Resource[]>([]);
  const [logs, setLogs] = useState<EquipmentLog[]>([]);
  const [allBookings, setAllBookings] = useState<BookingResponse[]>([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  const [resourceToDelete, setResourceToDelete] = useState<string | null>(null);
  const [logToDelete, setLogToDelete] = useState<string | null>(null);
  
  const [editingResource, setEditingResource] = useState<Resource | undefined>(undefined);
  const [editingLog, setEditingLog] = useState<EquipmentLog | undefined>(undefined);
  const [selectedBooking, setSelectedBooking] = useState<BookingResponse | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const fetchResources = async () => {
    setLoadingResources(true);
    try {
      const rawData = await resourceService.getAll();
      let resourcesArray: any[] = [];
      if (Array.isArray(rawData)) {
        resourcesArray = rawData;
      } else if (rawData && typeof rawData === 'object') {
        resourcesArray = (rawData as any).items || (rawData as any).data || (rawData as any).value || (rawData as any).result || [];
      }

      const mapped = resourcesArray.map(res => ({
        id: res.id,
        name: res.name,
        description: res.description || '',
        type: res.type,
        location: res.location || '',
        totalQuantity: res.totalQuantity,
        availableQuantity: res.availableQuantity,
        damagedQuantity: res.damagedQuantity,
        managedBy: res.managedBy
      }));
      setResources(mapped);
    } catch (error) {
      console.error('Failed to fetch resources:', error);
      addToast('Failed to load inventory.', 'error');
    } finally {
      setLoadingResources(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const [logsData, usersRes] = await Promise.all([
        equipmentLogService.getAll(),
        userService.getAll()
      ]);
      
      const usersData = Array.isArray(usersRes) ? usersRes : (usersRes as any).items || [];
      const userMap = new Map<string, string>(usersData.map((u: any) => [String(u.id), String(u.fullName || u.userName)]));
      
      const mappedLogs = logsData.map(log => ({
        ...log,
        userName: userMap.get(log.userId) || log.userName || log.userId || 'Unknown User'
      })).sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
      
      setLogs(mappedLogs);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      addToast('Failed to load operation logs.', 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchAllBookings = async () => {
    setLoadingBookings(true);
    try {
      const [res, usersRes] = await Promise.all([
        bookingService.getAll(1, 100),
        userService.getAll()
      ]);
      
      const usersData = Array.isArray(usersRes) ? usersRes : (usersRes as any).items || [];
      const userMap = new Map<string, string>(usersData.map((u: any) => [String(u.id), String(u.fullName || u.userName)]));
      
      const mappedBookings = (res.items || []).map(b => ({
        ...b,
        userName: userMap.get(b.userId) || b.userName || b.userId || 'Unknown User'
      })).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

      setAllBookings(mappedBookings);
    } catch (error) {
      console.error('Failed to fetch all bookings:', error);
      addToast('Failed to load global bookings.', 'error');
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    fetchResources();
    fetchLogs();
    fetchAllBookings();
  }, []);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState('');

  const handleApproveBooking = async () => {
    if (!approvingId) return;
    setActionLoading(true);
    try {
      await bookingService.approve(approvingId, actionNote);
      addToast('Booking request approved.', 'success');
      setShowBookingModal(false);
      setApprovingId(null);
      setActionNote('');
      fetchAllBookings();
    } catch (error) {
      addToast('Failed to approve booking.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectBooking = async () => {
    if (!rejectingId || !actionNote.trim()) {
      addToast('Please provide a valid rejection reason.', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await bookingService.reject(rejectingId, actionNote);
      addToast('Booking request rejected.', 'success');
      setShowBookingModal(false);
      setRejectingId(null);
      setActionNote('');
      fetchAllBookings();
    } catch (error) {
      addToast('Failed to reject booking.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResourceSubmit = async (data: Partial<Resource> & { managedBy: string }) => {
    setActionLoading(true);
    const managerId = data.managedBy || user.userId;
    
    try {
      const request: CreateResourceRequest = {
        name: data.name || '',
        description: data.description || '', 
        type: Number(data.type) || 1,
        location: data.location || null,
        totalQuantity: Number(data.totalQuantity) || 1,
        damagedQuantity: Number(data.damagedQuantity) || 0
      };

      if (editingResource) {
        await resourceService.update(editingResource.id, request);
        addToast('Resource updated successfully.', 'success');
      } else {
        await resourceService.create(managerId, request);
        addToast('Resource registered successfully.', 'success');
      }
      setIsResourceModalOpen(false);
      fetchResources();
    } catch (error: any) {
        addToast('Failed to save resource info.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteResource = async () => {
    if (!resourceToDelete) return;
    setActionLoading(true);
    try {
      await resourceService.delete(resourceToDelete);
      addToast('Resource removed successfully.', 'success');
      fetchResources();
    } catch (error) {
      addToast('Failed to delete resource.', 'error');
    } finally {
      setActionLoading(false);
      setResourceToDelete(null);
    }
  };

  const handleLogSubmit = async (logData: Partial<EquipmentLog>) => {
    setActionLoading(true);
    try {
      const request: AddEquipmentLogRequest = {
        resourceId: logData.resourceId || '',
        action: logData.action || '',
        note: logData.note || '',
        bookingId: logData.bookingId || null
      };

      if (editingLog) {
        await equipmentLogService.update(editingLog.id, request);
        addToast('Log entry updated successfully.', 'success');
      } else {
        await equipmentLogService.create(request);
        addToast('Event logged successfully.', 'success');
      }
      setIsLogModalOpen(false);
      setEditingLog(undefined);
      fetchLogs();
    } catch (error: any) {
      addToast('Failed to save log entry.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLog = async () => {
    if (!logToDelete) return;
    setActionLoading(true);
    try {
      await equipmentLogService.delete(logToDelete);
      addToast('Log entry removed.', 'success');
      fetchLogs();
    } catch (error) {
      addToast('Failed to delete log.', 'error');
    } finally {
      setActionLoading(false);
      setLogToDelete(null);
    }
  };

  return (
    <MainLayout role={user.role} userName={user.name}>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1>Lab Resource Management</h1>
            <p>System-level control of laboratory inventory, history, and active reservations.</p>
          </div>
        </div>

        {/* Admin Navigation Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div 
            className="card card-interactive"
            onClick={() => setActiveTab('manage')}
            style={{ 
                padding: '1.25rem', border: activeTab === 'manage' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                background: activeTab === 'manage' ? 'var(--accent-bg)' : 'white'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: activeTab === 'manage' ? 'var(--accent-color)' : 'var(--text-primary)' }}>
              <Package size={22} />
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Inventory</h3>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Equipment stock & details.</p>
          </div>

          <div 
            className="card card-interactive"
            onClick={() => setActiveTab('bookings')}
            style={{ 
                padding: '1.25rem', border: activeTab === 'bookings' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                background: activeTab === 'bookings' ? 'var(--accent-bg)' : 'white'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: activeTab === 'bookings' ? 'var(--accent-color)' : 'var(--text-primary)' }}>
              <CalendarRange size={22} />
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Bookings</h3>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>All active reservations.</p>
          </div>

          <div 
            className="card card-interactive"
            onClick={() => setActiveTab('logs')}
            style={{ 
                padding: '1.25rem', border: activeTab === 'logs' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                background: activeTab === 'logs' ? 'var(--accent-bg)' : 'white'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: activeTab === 'logs' ? 'var(--accent-color)' : 'var(--text-primary)' }}>
              <Activity size={22} />
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Logs</h3>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Historical system events.</p>
          </div>
        </div>

        {activeTab === 'manage' ? (
          <ResourceManagement
            resources={resources}
            loading={loadingResources}
            onAdd={() => {
              setEditingResource(undefined);
              setIsResourceModalOpen(true);
            }}
            onEdit={async (r) => {
              setLoadingDetail(true);
              try {
                const detail = await resourceService.getById(r.id);
                setEditingResource(detail as any);
                setIsResourceModalOpen(true);
              } catch (error) {
                addToast('Failed to load resource details.', 'error');
              } finally {
                setLoadingDetail(false);
              }
            }}
            onDelete={(id) => setResourceToDelete(id)}
          />
        ) : activeTab === 'bookings' ? (
          <GlobalBookingList
            bookings={allBookings}
            loading={loadingBookings}
            onView={async (id) => {
              setLoadingDetail(true);
              setRejectingId(null);
              setApprovingId(null);
              setActionNote('');
              try {
                const [b, usersData] = await Promise.all([
                   bookingService.getById(id),
                   userService.getAll()
                ]);
                
                const userMap = new Map(usersData.map(u => [u.id, u.fullName || u.userName]));
                const resourceMap = new Map(resources.map(r => [r.id, r.name]));

                const mappedDetail = {
                   ...b,
                   userName: userMap.get(b.userId) || b.userName || b.userId || 'Unknown User',
                   // API returns nested resource object
                   resourceName: (b as any).resource?.name || b.resourceName || resourceMap.get(b.resourceId) || 'Unknown Equipment'
                };
                
                setSelectedBooking(mappedDetail);
                setShowBookingModal(true);
              } catch {
                addToast('Failed to load booking detail.', 'error');
              } finally {
                setLoadingDetail(false);
              }
            }}
          />
        ) : (
          <EquipmentLogList
            logs={logs}
            loading={loadingLogs}
            onAdd={() => {
              setEditingLog(undefined);
              setIsLogModalOpen(true);
            }}
            onEdit={async (log) => {
              setLoadingDetail(true);
              try {
                const detail = await equipmentLogService.getById(log.id);
                setEditingLog(detail);
                setIsLogModalOpen(true);
              } catch {
                addToast('Failed to load log details.', 'error');
              } finally {
                setLoadingDetail(false);
              }
            }}
            onDelete={(id) => setLogToDelete(id)}
          />
        )}

        {/* Modals */}
        {isResourceModalOpen && (
          <ResourceFormModal
            resource={editingResource}
            onClose={() => setIsResourceModalOpen(false)}
            onSubmit={handleResourceSubmit}
          />
        )}

        {isLogModalOpen && (
          <EquipmentLogFormModal
            resources={resources}
            log={editingLog}
            onClose={() => setIsLogModalOpen(false)}
            onSubmit={handleLogSubmit}
          />
        )}

        {/* Global Booking Detail Modal */}
        {showBookingModal && selectedBooking && (
          <div className="modal-overlay" onClick={() => { if(!actionLoading) setShowBookingModal(false); }} style={{ 
            backdropFilter: 'blur(12px)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 10001,
            background: 'rgba(15, 23, 42, 0.4)'
          }}>
            <div className="modal-container" onClick={e => e.stopPropagation()} style={{ 
              maxWidth: '520px', 
              width: '95%', 
              background: 'white', 
              borderRadius: '24px', 
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{ 
                padding: '1.5rem 1.75rem', 
                borderBottom: '1px solid #f1f5f9', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                background: 'linear-gradient(to right, #fff, #f8fafc)'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Reservation Details</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ID: {selectedBooking.id.substring(0, 8).toUpperCase()}</p>
                </div>
                {!actionLoading && (
                  <button 
                    className="btn btn-ghost" 
                    onClick={() => setShowBookingModal(false)} 
                    style={{ padding: '10px', borderRadius: '12px', background: '#f1f5f9' }}
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <div style={{ padding: '1.75rem', maxHeight: '65vh', overflowY: 'auto' }}>
                {/* Header Info Card */}
                <div style={{ 
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', 
                  padding: '1.5rem', 
                  borderRadius: '20px', 
                  marginBottom: '1.75rem', 
                  border: '1px solid #e2e8f0',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', flex: 1 }}>{selectedBooking.title}</h4>
                    <div>
                      <span style={{ 
                        padding: '6px 14px', 
                        borderRadius: '100px', 
                        fontSize: '0.7rem', 
                        fontWeight: 800, 
                        textTransform: 'uppercase',
                        background: 
                          selectedBooking.status === BookingStatus.Pending ? '#fefce8' : 
                          selectedBooking.status === BookingStatus.Approved ? '#ecfdf5' : 
                          selectedBooking.status === BookingStatus.Rejected ? '#fef2f2' : 
                          selectedBooking.status === BookingStatus.Cancelled ? '#f3f4f6' : 
                          selectedBooking.status === BookingStatus.Completed ? '#eff6ff' : '#f5f3ff',
                        color: 
                          selectedBooking.status === BookingStatus.Pending ? '#d97706' : 
                          selectedBooking.status === BookingStatus.Approved ? '#059669' : 
                          selectedBooking.status === BookingStatus.Rejected ? '#dc2626' : 
                          selectedBooking.status === BookingStatus.Cancelled ? '#6b7280' : 
                          selectedBooking.status === BookingStatus.Completed ? '#2563eb' : '#7c3aed',
                        border: '1px solid rgba(0,0,0,0.05)'
                      }}>
                        {selectedBooking.status === BookingStatus.Pending ? 'Pending' : 
                         selectedBooking.status === BookingStatus.Approved ? 'Approved' : 
                         selectedBooking.status === BookingStatus.Rejected ? 'Rejected' : 
                         selectedBooking.status === BookingStatus.Cancelled ? 'Cancelled' : 
                         selectedBooking.status === BookingStatus.Completed ? 'Completed' : 'In Use'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                      <Package size={14} style={{ color: 'var(--accent-color)' }} />
                      <span style={{ color: '#475569', fontWeight: 500 }}>Equipment: <strong style={{ color: '#0f172a' }}>{selectedBooking.resourceName}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                      <User size={14} style={{ color: 'var(--accent-color)' }} />
                      <span style={{ color: '#475569', fontWeight: 500 }}>Reserved by: <strong style={{ color: '#0f172a' }}>{selectedBooking.userName}</strong></span>
                    </div>
                  </div>
                </div>
                
                {/* Time Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.75rem' }}>
                  <div style={{ padding: '1.25rem', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Clock size={12} style={{ color: '#64748b' }} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Start From</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>{new Date(selectedBooking.startTime).toLocaleDateString()}</p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{new Date(selectedBooking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div style={{ padding: '1.25rem', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Clock size={12} style={{ color: '#64748b' }} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>End Until</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>{new Date(selectedBooking.endTime).toLocaleDateString()}</p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{new Date(selectedBooking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: 750, color: '#0f172a' }}>Purpose & Requirements</p>
                    <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '16px', fontSize: '0.9rem', color: '#334155', border: '1px solid #f1f5f9' }}>
                        {selectedBooking.purpose || 'No purpose description provided.'}
                    </div>
                </div>

                {/* Reject/Approve Note Field if needed */}
                {(rejectingId || approvingId) && (
                  <div style={{ 
                    padding: '1.25rem', 
                    background: approvingId ? '#f0fdf4' : '#fff1f2', 
                    borderRadius: '16px', 
                    border: '1px solid',
                    borderColor: approvingId ? '#bbf7d0' : '#fecdd3',
                    marginBottom: '1.5rem',
                    animation: 'fadeIn 0.3s ease'
                  }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: approvingId ? '#15803d' : '#9f1239', marginBottom: '8px' }}>
                      {approvingId ? 'Approval Instructions / Note' : 'Rejection Reason'}
                    </label>
                    <textarea 
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder={approvingId ? "Add optional instructions for the user..." : "Please explain why this request is being rejected..."}
                      style={{ 
                        width: '100%', 
                        padding: '10px', 
                        borderRadius: '10px', 
                        border: '1px solid',
                        borderColor: approvingId ? '#86efac' : '#fda4af', 
                        fontSize: '0.85rem',
                        minHeight: '80px',
                        outline: 'none'
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={{ 
                padding: '1.5rem 1.75rem', 
                background: '#f8fafc', 
                borderTop: '1px solid #f1f5f9', 
                display: 'flex', 
                justifyContent: 'flex-end',
                gap: '12px'
              }}>
                {selectedBooking.status === 1 && !rejectingId && !approvingId ? (
                   <>
                     <button 
                        className="btn btn-ghost" 
                        onClick={() => setRejectingId(selectedBooking.id)}
                        disabled={actionLoading}
                        style={{ color: '#dc2626', fontWeight: 700 }}
                     >
                       Reject
                     </button>
                     <button 
                        className="btn btn-primary" 
                        onClick={() => setApprovingId(selectedBooking.id)}
                        disabled={actionLoading}
                        style={{ borderRadius: '12px', padding: '10px 24px' }}
                     >
                       Approve Request
                     </button>
                   </>
                ) : (rejectingId || approvingId) ? (
                   <>
                     <button 
                        className="btn btn-ghost" 
                        onClick={() => { setRejectingId(null); setApprovingId(null); setActionNote(''); }}
                        disabled={actionLoading}
                     >
                       Back
                     </button>
                     <button 
                        className={approvingId ? "btn btn-primary" : "btn btn-danger"} 
                        onClick={approvingId ? handleApproveBooking : handleRejectBooking}
                        disabled={actionLoading || (!!rejectingId && !actionNote.trim())}
                        style={{ 
                          borderRadius: '12px', 
                          padding: '10px 24px',
                          background: approvingId ? 'var(--accent-color)' : '#dc2626',
                          color: 'white'
                        }}
                     >
                       {actionLoading ? <Loader2 className="animate-spin" size={16} /> : 'Confirm Action'}
                     </button>
                   </>
                ) : (
                  <button className="btn btn-primary" onClick={() => setShowBookingModal(false)} style={{ borderRadius: '12px' }}>
                    Done Reviewing
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={!!resourceToDelete}
          onClose={() => setResourceToDelete(null)}
          onConfirm={handleDeleteResource}
          title="Delete Resource"
          message="Are you sure you want to permanently remove this resource? This action cannot be undone."
          confirmText="Delete Resource"
          variant="danger"
        />

        <ConfirmModal
          isOpen={!!logToDelete}
          onClose={() => setLogToDelete(null)}
          onConfirm={handleDeleteLog}
          title="Delete Log Entry"
          message="Are you sure you want to remove this activity log? This should usually be kept for audit trail purposes."
          confirmText="Delete Permanently"
          variant="danger"
        />

        {loadingDetail && (
          <div className="loading-overlay" style={{ zIndex: 10002 }}>
             <div className="premium-loader">
                <div></div><div></div><div></div>
             </div>
             <p className="loading-text">Fetching details...</p>
          </div>
        )}

        {actionLoading && (
          <div className="loading-overlay" style={{ zIndex: 10003, background: 'rgba(255,255,255,0.5)' }}>
             <Loader2 size={40} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default LabResourceAdmin;
