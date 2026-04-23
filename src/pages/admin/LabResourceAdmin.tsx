import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import ResourceManagement from '@/features/resources/ResourceManagement';
import EquipmentLogList from '@/features/resources/EquipmentLogList';
import GlobalBookingList from '@/features/resources/GlobalBookingList';
import ConfirmModal from '@/components/common/ConfirmModal';
import { Resource, EquipmentLog, BookingStatus } from '@/types/booking';
import { resourceService } from '@/services/resourceService';
import { equipmentLogService } from '@/services/equipmentLogService';
import { userService } from '@/services/userService';
import { bookingService, BookingResponse } from '@/services/bookingService';
import { Package, Activity, Loader2, CalendarRange, Search, Plus, ShieldCheck, AlertCircle, Server } from 'lucide-react';
import { useToastStore } from '@/store/slices/toastSlice';
import { resourceTypeService, ResourceTypeItem, ResourceTypeCategory } from '@/services/resourceTypeService';

// New Panel Components
import AdminResourcePanel from './components/AdminResourcePanel';
import AdminBookingPanel from './components/AdminBookingPanel';
import AdminLogPanel from './components/AdminLogPanel';
import AdminServerPanel from './components/AdminServerPanel';

type TabType = 'inventory' | 'bookings' | 'logs' | 'servers';

interface LabResourceAdminProps {
  initialTab?: TabType;
}

interface ActivePanel {
  id: string;
  type: 'resource' | 'booking' | 'log' | 'server';
  data?: any;
  title: string;
}

const LabResourceAdmin: React.FC<LabResourceAdminProps> = ({ initialTab }) => {
  const { user } = useAuth();
  const { addToast } = useToastStore();
  
  // State
  const [activeTab, setActiveTab] = useState<TabType>(initialTab ?? 'inventory');
  const [resources, setResources] = useState<Resource[]>([]);
  const [logs, setLogs] = useState<EquipmentLog[]>([]);
  const [allBookings, setAllBookings] = useState<BookingResponse[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null);
  const [resourceToDelete, setResourceToDelete] = useState<string | null>(null);
  const [logToDelete, setLogToDelete] = useState<string | null>(null);

  // Stats calculation
  const stats = useMemo(() => {
    return {
      totalResources: resources.length,
      pendingBookings: allBookings.filter(b => b.status === BookingStatus.Pending).length,
      activeBookings: allBookings.filter(b => b.status === BookingStatus.Approved || b.status === BookingStatus.InUse).length,
      recentLogs: logs.slice(0, 5).length
    };
  }, [resources, allBookings, logs]);

  // Data Fetching
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resData, logsData, bookingsData, usersRes, typesData] = await Promise.all([
        resourceService.getAll(),
        equipmentLogService.getAll(),
        bookingService.getAllPages(),
        userService.getAll(),
        resourceTypeService.getAll(),
      ]);
      setResourceTypes(Array.isArray(typesData) ? typesData : []);

      const usersArray = Array.isArray(usersRes) ? usersRes : (usersRes as any).items || [];
      const userMap = new Map<string, string>(usersArray.map((u: any) => [String(u.id), String(u.fullName || u.userName)]));

      const rawRes = Array.isArray(resData) ? resData : (resData as any).items || [];
      setResources(rawRes);

      const rawLogs = (logsData as any).items || (Array.isArray(logsData) ? logsData : []);
      setLogs(rawLogs.map((log: any) => ({
        ...log,
        userName: userMap.get(log.userId) || log.userName || 'Unknown'
      })).sort((a: any, b: any) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()));

      setAllBookings((bookingsData as any[]).map(b => ({
        ...b,
        userName: userMap.get(b.userId ?? '') || b.userName || 'Unknown'
      })).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));

    } catch (error: any) {
      console.error(error);
      addToast(error.message || 'Error synchronizing admin data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenResource = (res?: Resource) => {
    setActivePanel({
      id: res ? `edit-${res.id}` : 'new-resource',
      type: 'resource',
      data: res,
      title: res ? 'Update Resource' : 'Register Resource'
    });
  };

  const handleOpenBooking = async (id: string) => {
    try {
      const b = await bookingService.getById(id);
      setActivePanel({
        id: `view-booking-${id}`,
        type: 'booking',
        data: b,
        title: 'Review Request'
      });
    } catch (error: any) {
      addToast(error.message || 'Failed to load booking details.', 'error');
    }
  };

  const handleOpenLog = (log?: EquipmentLog) => {
    setActivePanel({
      id: log ? `edit-log-${log.id}` : 'new-log',
      type: 'log',
      data: log,
      title: log ? 'Update Log Entry' : 'Create Log Record'
    });
  };

  const handleOpenServer = () => {
    setActivePanel({ id: `new-server-${Date.now()}`, type: 'server', title: 'Register Compute Server' });
  };

  const handleSaved = (reload: boolean, message?: string) => {
    if (reload) fetchData();
    if (message) addToast(message, 'success');
    setActivePanel(null);
  };

  const serverTypeIds = useMemo(
    () => new Set(resourceTypes.filter(t => t.category === ResourceTypeCategory.ServerCompute).map(t => t.id)),
    [resourceTypes]
  );

  const filteredResources = resources.filter(r =>
    !serverTypeIds.has(r.resourceTypeId ?? '__') &&
    (!searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()) || (r.location || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredServerResources = resources.filter(r =>
    serverTypeIds.has(r.resourceTypeId ?? '__') &&
    (!searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()) || (r.location || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredBookings = allBookings.filter(b => 
    !searchQuery || b.title.toLowerCase().includes(searchQuery.toLowerCase()) || (b.userName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLogs = logs.filter(l => 
    !searchQuery || (l.resourceName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.userName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout role={user.role} userName={user.name}>
      <div className="page-container" style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #0f172a, #334155)',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(15, 23, 42, 0.15)'
              }}>
                <ShieldCheck size={20} />
              </div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Lab Resource Management</h1>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0, fontWeight: 500 }}>Centralized administration of laboratory hardware and assets.</p>
          </div>
        </div>

        <div style={{
          background: 'white', padding: '1.25rem', borderRadius: '20px', border: '1px solid #e2e8f0',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)', marginBottom: '1.5rem'
        }}>
          {[
            { label: 'Total Resources', val: stats.totalResources, icon: <Package size={16} />, color: '#3b82f6' },
            { label: 'Pending Requests', val: stats.pendingBookings, icon: <AlertCircle size={16} />, color: '#f59e0b', highlight: stats.pendingBookings > 0 },
            { label: 'Active Sessions', val: stats.activeBookings, icon: <CalendarRange size={16} />, color: '#10b981' },
            { label: 'Audit Records', val: stats.recentLogs, icon: <Activity size={16} />, color: '#6366f1' }
          ].map((s, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 12px', borderRight: idx < 3 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: s.highlight ? `${s.color}20` : '#f8fafc', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>{s.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: s.highlight ? s.color : '#1e293b' }}>{s.val}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          marginBottom: '1.5rem', background: '#fff', padding: '0.75rem 1rem', borderRadius: '16px', border: '1px solid #e2e8f0' 
        }}>
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
            {[
              { id: 'inventory', label: 'Resource List', icon: <Package size={14} /> },
              { id: 'bookings', label: 'Global Bookings', icon: <CalendarRange size={14} /> },
              { id: 'logs', label: 'Operational Logs', icon: <Activity size={14} /> },
              { id: 'servers', label: 'Compute Servers', icon: <Server size={14} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as TabType); setActivePanel(null); }}
                style={{
                  padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', borderRadius: '9px',
                  background: activeTab === tab.id ? 'white' : 'transparent',
                  color: activeTab === tab.id ? '#1e293b' : '#64748b',
                  boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                  fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
             <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  placeholder="Master Search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ 
                    padding: '8px 12px 8px 34px', borderRadius: '10px', border: '1px solid #e2e8f0', 
                    fontSize: '0.85rem', width: '240px', outline: 'none', background: '#f8fafc' 
                  }}
                />
             </div>
             {activeTab === 'inventory' && (
                <button onClick={() => handleOpenResource()} style={{ 
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '0.8rem', fontWeight: 600, padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
                }}>
                  <Plus size={14} /> Register Resource
                </button>
             )}
              {activeTab === 'logs' && (
                <button onClick={() => handleOpenLog()} style={{ 
                  background: 'linear-gradient(135deg, #f59e0b, #e67e22)', color: 'white', display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '0.8rem', fontWeight: 600, padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)'
                }}>
                  <Plus size={14} /> Create Log Record
                </button>
             )}
             {activeTab === 'servers' && (
                <button onClick={handleOpenServer} style={{ 
                  background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: 'white', display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '0.8rem', fontWeight: 600, padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)'
                }}>
                  <Plus size={14} /> Register Server
                </button>
             )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 320px)', minHeight: '620px' }}>
          
          <div style={{ 
            flex: activePanel ? 6 : 10, transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)', 
            overflow: 'hidden', display: 'flex', flexDirection: 'column' 
          }}>
            <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                  <Loader2 size={32} className="animate-spin" style={{ marginBottom: '12px' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Synchronizing laboratory data...</span>
                </div>
              ) : (
                <>
                  {activeTab === 'inventory' && (
                    <ResourceManagement 
                      resources={filteredResources} 
                      loading={false} 
                      onAdd={() => handleOpenResource()} 
                      onEdit={handleOpenResource}
                      onDelete={setResourceToDelete}
                      isSplit={!!activePanel}
                      selectedId={activePanel?.type === 'resource' ? activePanel.data?.id : null}
                    />
                  )}
                  {activeTab === 'bookings' && (
                    <GlobalBookingList 
                      bookings={filteredBookings} 
                      loading={false} 
                      onView={(id) => handleOpenBooking(id)}
                      isSplit={!!activePanel}
                    />
                  )}
                  {activeTab === 'logs' && (
                    <EquipmentLogList 
                      logs={filteredLogs} 
                      loading={false} 
                      onAdd={() => handleOpenLog()}
                      onEdit={handleOpenLog}
                      onDelete={setLogToDelete}
                      isSplit={!!activePanel}
                    />
                  )}
                  {activeTab === 'servers' && (
                    filteredServerResources.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: '12px', color: '#94a3b8' }}>
                        <Server size={40} style={{ opacity: 0.35 }} />
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>No compute servers registered yet.</p>
                        <button onClick={handleOpenServer} style={{ padding: '8px 20px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                          Register First Server
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredServerResources.map(r => (
                          <div key={r.id} style={{ padding: '12px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Server size={18} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{r.name}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{r.resourceTypeName || 'Compute Server'}{r.location ? ` · ${r.location}` : ''}</div>
                            </div>
                            {r.modelSeries && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: '#eff6ff', color: '#2563eb', whiteSpace: 'nowrap' as const }}>
                                {r.modelSeries}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </div>

          {activePanel && (
            <div style={{ 
              flex: 4, background: 'white', border: '1px solid #e2e8f0', borderRadius: '24px', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.04)', padding: '1.5rem', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.4s cubic-bezier(0, 0, 0.2, 1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{activePanel.title}</h2>
                <button onClick={() => setActivePanel(null)} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer', color: '#64748b' }}>
                  <Plus size={18} style={{ transform: 'rotate(45deg)' }} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }} className="custom-scrollbar">
                {activePanel.type === 'resource' && (
                  <AdminResourcePanel 
                    editingResource={activePanel.data} 
                    onClose={() => setActivePanel(null)} 
                    onSaved={handleSaved} 
                  />
                )}
                {activePanel.type === 'booking' && (
                  <AdminBookingPanel 
                    booking={activePanel.data} 
                    onClose={() => setActivePanel(null)} 
                    onSaved={handleSaved} 
                    actionLoading={false}
                  />
                )}
                {activePanel.type === 'log' && (
                  <AdminLogPanel 
                    resources={resources}
                    editingLog={activePanel.data} 
                    onClose={() => setActivePanel(null)} 
                    onSaved={handleSaved} 
                  />
                )}
                {activePanel.type === 'server' && (
                  <AdminServerPanel
                    onClose={() => setActivePanel(null)}
                    onSaved={handleSaved}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <ConfirmModal
          isOpen={!!resourceToDelete}
          onClose={() => setResourceToDelete(null)}
          onConfirm={async () => {
            try {
              await resourceService.delete(resourceToDelete!);
              fetchData();
              addToast('Resource deleted successfully.', 'success');
            } catch { addToast('Delete failed.', 'error'); }
            setResourceToDelete(null);
          }}
          title="Archive Resource"
          message="This will permanently move this resource out of active service. Confirm database deletion?"
          confirmText="Yes, Delete Resource"
          variant="danger"
        />

        <ConfirmModal
          isOpen={!!logToDelete}
          onClose={() => setLogToDelete(null)}
          onConfirm={async () => {
            try {
              await equipmentLogService.delete(logToDelete!);
              fetchData();
              addToast('Log removed.', 'success');
            } catch { addToast('Delete failed.', 'error'); }
            setLogToDelete(null);
          }}
          title="Delete Activity Log"
          message="Deleting historical logs is not recommended for compliance. Continue?"
          confirmText="Delete Record"
          variant="danger"
        />

        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(30px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; borderRadius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
          .animate-spin { animation: spin 1s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </MainLayout>
  );
};

export default LabResourceAdmin;
