import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { Resource, Booking, BookingStatus, EquipmentLog, EquipmentLogAction } from '@/types/booking';
import { bookingService } from '@/services/bookingService';
import { resourceService } from '@/services/resourceService';
import { equipmentLogService } from '@/services/equipmentLogService';
import { resourceTypeService, ResourceTypeItem } from '@/services/resourceTypeService';
import Toast, { ToastType } from '@/components/common/Toast';
import {
    Search,
    Package,
    Loader2,
    Calendar,
    Plus,
    Clock,
    CheckCircle2,
    AlertTriangle,
    ClipboardList,
    Settings,
    ScrollText,
    LogIn,
    LogOut,
    ChevronRight,
    Layers,
    Pencil,
    Trash2
} from 'lucide-react';

import ResourceListView from './components/ResourceListView';
import CreateResourceForm from './components/CreateResourceForm';
import ResourceDetailPanel from './components/ResourceDetailPanel';
import BookingResourceForm from './components/BookingResourceForm';
import BookingListView from './components/BookingListView';
import BookingDetailPanel from './components/BookingDetailPanel';
import ResourceTypePanel from './components/ResourceTypePanel';

type TabType = 'resources' | 'my_managed' | 'my_bookings' | 'all_bookings' | 'managed_bookings' | 'equipment_logs' | 'resource_types';

interface ActivePanel {
    id: string;
    type: 'create_resource' | 'view_resource' | 'create_booking' | 'view_booking' | 'resource_type_form';
    targetId?: string;
    title: string;
    resource?: Resource;
    preSelectedResource?: Resource;
    editingResourceType?: ResourceTypeItem;
}

// ─── Tab groups ─────────────────────────────────────────────────────────────
interface TabGroup {
    label: string;
    color: string;
    icon: React.ReactNode;
    tabs: { id: TabType; label: string; icon: React.ReactNode; directorOnly?: boolean }[];
}

const TAB_GROUPS: TabGroup[] = [
    {
        label: 'Resources',
        color: '#f97316',
        icon: <Package size={13} />,
        tabs: [
            { id: 'resources', label: 'All Resources', icon: <Package size={14} /> },
            { id: 'my_managed', label: 'My Managed', icon: <Settings size={14} /> },
            { id: 'resource_types', label: 'Resource Types', icon: <Layers size={14} />, directorOnly: true },
        ]
    },
    {
        label: 'Bookings',
        color: '#6366f1',
        icon: <Calendar size={13} />,
        tabs: [
            { id: 'my_bookings', label: 'My Bookings', icon: <Calendar size={14} /> },
            { id: 'all_bookings', label: 'All Bookings', icon: <ClipboardList size={14} />, directorOnly: true },
            { id: 'managed_bookings', label: 'Managed', icon: <ScrollText size={14} /> },
        ]
    },
    {
        label: 'Logs',
        color: '#0ea5e9',
        icon: <ScrollText size={13} />,
        tabs: [
            { id: 'equipment_logs', label: 'Equipment Logs', icon: <ScrollText size={14} /> },
        ]
    }
];

// ─── Equipment log action label ──────────────────────────────────────────────
const getLogActionConfig = (action: EquipmentLogAction) =>
    action === EquipmentLogAction.CheckOut
        ? { label: 'Check Out', color: '#2563eb', bg: '#eff6ff', icon: <LogOut size={12} /> }
        : { label: 'Check In', color: '#16a34a', bg: '#f0fdf4', icon: <LogIn size={12} /> };

const formatDate = (s: string) => {
    const d = new Date(s);
    if (isNaN(d.getTime())) return 'N/A';
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
};

// ─── Component ───────────────────────────────────────────────────────────────
const ResourceBooking: React.FC = () => {
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<TabType>('resources');
    const [resources, setResources] = useState<Resource[]>([]);
    const [myBookings, setMyBookings] = useState<Booking[]>([]);
    const [allBookings, setAllBookings] = useState<Booking[]>([]);
    const [managedBookings, setManagedBookings] = useState<Booking[]>([]);
    const [equipmentLogs, setEquipmentLogs] = useState<EquipmentLog[]>([]);
    const [resourceTypes, setResourceTypes] = useState<ResourceTypeItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterType, setFilterType] = useState('');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [activePanel, setActivePanel] = useState<ActivePanel | null>(null);

    const isLabDirector = useMemo(() => {
        if (!user) return false;
        const role = Number(user.role);
        return role === 1 || role === 2;
    }, [user?.role]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            switch (activeTab) {
                case 'resources': {
                    const data = await resourceService.getAll(1, 200);
                    setResources(data.items || []);
                    break;
                }
                case 'my_managed': {
                    const data = await resourceService.getManaged(1, 200);
                    setResources(data.items || []);
                    break;
                }
                case 'my_bookings': {
                    const [upcoming, history] = await Promise.all([
                        bookingService.getMyUpcoming(),
                        bookingService.getMyHistory(1, 200)
                    ]);
                    const all = [...upcoming, ...((history as any).items || [])];
                    const unique = Array.from(new Map(all.map(b => [b.id, b])).values());
                    unique.sort((a, b) => new Date(b.createdAt || b.startTime).getTime() - new Date(a.createdAt || a.startTime).getTime());
                    setMyBookings(unique);
                    break;
                }
                case 'all_bookings': {
                    const data = await bookingService.getAll(1, 200);
                    const items = (data.items || []).sort((a, b) =>
                        new Date(b.createdAt || b.startTime).getTime() - new Date(a.createdAt || a.startTime).getTime()
                    );
                    setAllBookings(items);
                    break;
                }
                case 'managed_bookings': {
                    const data = await bookingService.getManaged(1, 200);
                    const items = (data.items || []).sort((a, b) =>
                        new Date(b.createdAt || b.startTime).getTime() - new Date(a.createdAt || a.startTime).getTime()
                    );
                    setManagedBookings(items);
                    break;
                }
                case 'equipment_logs': {
                    const data = await equipmentLogService.getAll(1, 200);
                    setEquipmentLogs(data.items || []);
                    break;
                }
                case 'resource_types': {
                    const data = await resourceTypeService.getAll();
                    setResourceTypes(data);
                    break;
                }
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const showToast = (msg: string, type: ToastType = 'info') => setToast({ message: msg, type });

    // Panel handlers
    const handleCreateResource = () =>
        setActivePanel({ id: `create-res-${Date.now()}`, type: 'create_resource', title: 'New Resource' });

    const handleViewResource = (resource: Resource) =>
        setActivePanel({ id: `view-res-${resource.id}`, type: 'view_resource', targetId: resource.id, title: resource.name, resource });

    const handleCreateBooking = (preSelectedResource?: Resource) =>
        setActivePanel({ id: `create-booking-${Date.now()}`, type: 'create_booking', title: 'New Booking', preSelectedResource });

    const handleViewBooking = (booking: Booking) =>
        setActivePanel({ id: `view-booking-${booking.id}`, type: 'view_booking', targetId: booking.id, title: booking.title });

    const handleCreateResourceType = () =>
        setActivePanel({ id: `create-rt-${Date.now()}`, type: 'resource_type_form', title: 'New Resource Type' });

    const handleEditResourceType = (rt: ResourceTypeItem) =>
        setActivePanel({ id: `edit-rt-${rt.id}`, type: 'resource_type_form', title: rt.name, editingResourceType: rt });

    const handleDeleteResourceType = async (id: string) => {
        if (!window.confirm('Delete this resource type?')) return;
        try {
            await resourceTypeService.delete(id);
            showToast('Resource type deleted.', 'success');
            fetchData();
        } catch (err: any) {
            showToast(err?.response?.data?.message || 'Failed to delete.', 'error');
        }
    };

    const handleClosePanel = () => setActivePanel(null);

    const handleTitleChange = (newTitle: string) => {
        if (activePanel) setActivePanel({ ...activePanel, title: newTitle });
    };

    const handlePanelSaved = (shouldClose = false, message?: string) => {
        fetchData();
        if (message) showToast(message, 'success');
        if (shouldClose) handleClosePanel();
    };

    const switchTab = (tab: TabType) => {
        setActiveTab(tab);
        setActivePanel(null);
        setSearchQuery('');
        setFilterStatus('');
        setFilterType('');
    };

    // ─── Derived state ───────────────────────────────────────────────────────
    const isResourceTab = activeTab === 'resources' || activeTab === 'my_managed';
    const isBookingTab = activeTab === 'my_bookings' || activeTab === 'all_bookings' || activeTab === 'managed_bookings';
    const isLogTab = activeTab === 'equipment_logs';
    const isResourceTypeTab = activeTab === 'resource_types';

    const displayResourceTypes = useMemo(() => resourceTypes.filter(rt => {
        const q = searchQuery.toLowerCase();
        return !q || rt.name.toLowerCase().includes(q) || (rt.description || '').toLowerCase().includes(q);
    }), [resourceTypes, searchQuery]);

    const bookingListForTab: Booking[] = useMemo(() => {
        if (activeTab === 'my_bookings') return myBookings;
        if (activeTab === 'all_bookings') return allBookings;
        if (activeTab === 'managed_bookings') return managedBookings;
        return [];
    }, [activeTab, myBookings, allBookings, managedBookings]);

    const displayResources = useMemo(() => resources.filter(r => {
        const q = searchQuery.toLowerCase();
        return (!q || r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q) || (r.location || '').toLowerCase().includes(q))
            && (!filterType || String(r.type) === filterType);
    }), [resources, searchQuery, filterType]);

    const displayBookings = useMemo(() => bookingListForTab.filter(b => {
        const q = searchQuery.toLowerCase();
        return (!q || b.title.toLowerCase().includes(q) || (b.userName || '').toLowerCase().includes(q))
            && (!filterStatus || String(b.status) === filterStatus);
    }), [bookingListForTab, searchQuery, filterStatus]);

    const displayLogs = useMemo(() => equipmentLogs.filter(l => {
        const q = searchQuery.toLowerCase();
        return !q || (l.resourceName || '').toLowerCase().includes(q) || (l.userName || '').toLowerCase().includes(q);
    }), [equipmentLogs, searchQuery]);

    const pendingCount = useMemo(() =>
        bookingListForTab.filter(b => b.status === BookingStatus.Pending).length,
        [bookingListForTab]
    );
    const availableResourceCount = resources.filter(r => r.availableQuantity > 0).length;

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <MainLayout role={user?.role} userName={user?.name}>
            <div className="page-container" style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(245,158,11,0.2)'
                        }}>
                            <Package size={22} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>Lab Resources</h1>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500, margin: 0 }}>
                                Manage resources, bookings, and equipment logs
                            </p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {isResourceTab && (
                            <button onClick={() => handleCreateBooking()} style={{
                                display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700,
                                padding: '10px 20px', borderRadius: '12px', fontSize: '0.85rem',
                                background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none',
                                color: '#fff', cursor: 'pointer', height: '42px',
                                boxShadow: '0 4px 12px rgba(99,102,241,0.2)'
                            }}>
                                <Calendar size={16} /> Book Resource
                            </button>
                        )}
                        {isLabDirector && (
                            <button onClick={handleCreateResource} className="btn btn-primary" style={{
                                display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700,
                                padding: '10px 20px', borderRadius: '12px', fontSize: '0.85rem',
                                height: '42px', marginBottom: 0
                            }}>
                                <Plus size={16} /> Add Resource
                            </button>
                        )}
                    </div>
                </div>

                {/* Quick stats row */}
                <div style={{
                    display: 'flex', gap: '12px', marginBottom: '1.5rem', flexWrap: 'wrap' as const
                }}>
                    {[
                        { icon: <Package size={14} />, color: '#3b82f6', label: 'Total Resources', value: resources.length, show: isResourceTab },
                        { icon: <CheckCircle2 size={14} />, color: '#10b981', label: 'Available', value: availableResourceCount, show: isResourceTab },
                        { icon: <AlertTriangle size={14} />, color: '#f59e0b', label: 'Pending', value: pendingCount, show: isBookingTab },
                        { icon: <Clock size={14} />, color: '#8b5cf6', label: 'Total Bookings', value: bookingListForTab.length, show: isBookingTab },
                        { icon: <ScrollText size={14} />, color: '#0ea5e9', label: 'Log Entries', value: equipmentLogs.length, show: isLogTab },
                        { icon: <Layers size={14} />, color: '#8b5cf6', label: 'Resource Types', value: resourceTypes.length, show: isResourceTypeTab },
                    ].filter(s => s.show).map(stat => (
                        <div key={stat.label} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 16px', background: '#fff', borderRadius: '12px',
                            border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                        }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: stat.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {stat.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{stat.label}</div>
                                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{stat.value}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Chrome/Edge-style Tab Groups ── */}
                {(() => {
                    const activeGroupIdx = TAB_GROUPS.findIndex(g =>
                        g.tabs.some(t => t.id === activeTab)
                    );

                    return (
                        <div style={{ marginBottom: '1.5rem' }}>
                            {/* Tab bar */}
                            <div style={{
                                background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                display: 'flex', alignItems: 'stretch',
                                overflowX: 'auto', padding: '0 12px'
                            }} className="custom-scrollbar">
                                {TAB_GROUPS.map((group, gi) => {
                                    const visibleTabs = group.tabs.filter(t => !t.directorOnly || isLabDirector);
                                    if (visibleTabs.length === 0) return null;
                                    const isExpanded = gi === activeGroupIdx;

                                    return (
                                        <React.Fragment key={group.label}>
                                            {/* Separator between groups */}
                                            {gi > 0 && (
                                                <div style={{
                                                    width: '1px', background: '#f1f5f9',
                                                    margin: '10px 8px', flexShrink: 0
                                                }} />
                                            )}

                                            {/* Group container */}
                                            <div style={{
                                                display: 'flex', alignItems: 'stretch',
                                                borderBottom: isExpanded ? `2.5px solid ${group.color}` : '2.5px solid transparent',
                                                transition: 'border-color 0.2s'
                                            }}>
                                                {/* Group pill — always visible */}
                                                <button
                                                    onClick={() => {
                                                        const firstTab = visibleTabs[0];
                                                        if (firstTab) switchTab(firstTab.id);
                                                    }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '5px',
                                                        padding: '0 10px', border: 'none', cursor: 'pointer',
                                                        background: 'none', flexShrink: 0,
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    <span style={{
                                                        display: 'flex', alignItems: 'center', gap: '5px',
                                                        padding: '4px 10px', borderRadius: '20px',
                                                        fontSize: '0.72rem', fontWeight: 800,
                                                        letterSpacing: '0.04em',
                                                        background: isExpanded
                                                            ? group.color
                                                            : `${group.color}18`,
                                                        color: isExpanded ? '#fff' : group.color,
                                                        transition: 'all 0.2s',
                                                        whiteSpace: 'nowrap' as const
                                                    }}>
                                                        {group.icon} {group.label}
                                                    </span>
                                                </button>

                                                {/* Tabs — only visible when group is expanded */}
                                                <div style={{
                                                    display: 'flex', alignItems: 'stretch',
                                                    maxWidth: isExpanded ? '600px' : '0px',
                                                    overflow: 'hidden',
                                                    transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1)',
                                                    gap: '2px'
                                                }}>
                                                    {visibleTabs.map(tab => {
                                                        const isActiveTab = activeTab === tab.id;
                                                        return (
                                                            <button
                                                                key={tab.id}
                                                                onClick={() => switchTab(tab.id)}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                                    padding: '0 14px', border: 'none', background: 'none',
                                                                    cursor: 'pointer', whiteSpace: 'nowrap' as const,
                                                                    fontSize: '0.82rem',
                                                                    fontWeight: isActiveTab ? 700 : 400,
                                                                    color: isActiveTab ? group.color : '#64748b',
                                                                    position: 'relative' as const,
                                                                    transition: 'all 0.15s'
                                                                }}
                                                            >
                                                                {tab.icon} {tab.label}
                                                                {/* Active tab dot indicator */}
                                                                {isActiveTab && (
                                                                    <span style={{
                                                                        position: 'absolute' as const,
                                                                        bottom: '0', left: '14px', right: '14px',
                                                                        height: '2.5px',
                                                                        background: group.color,
                                                                        borderRadius: '2px 2px 0 0'
                                                                    }} />
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}

                                {/* Search + filter — pushed to right */}
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0 8px 12px', flexShrink: 0 }}>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            type="text"
                                            placeholder="Search..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            style={{
                                                paddingLeft: '28px', height: '32px', width: '180px',
                                                border: '1px solid #e2e8f0', borderRadius: '8px',
                                                fontSize: '0.8rem', outline: 'none', background: '#f8fafc'
                                            }}
                                        />
                                    </div>
                                    {isResourceTab && (
                                        <select value={filterType} onChange={e => setFilterType(e.target.value)}
                                            style={{ height: '32px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem', padding: '0 8px', background: '#f8fafc', outline: 'none', color: '#475569' }}>
                                            <option value="">All Types</option>
                                            <option value="1">GPU</option>
                                            <option value="2">Equipment</option>
                                            <option value="3">Dataset</option>
                                            <option value="4">Lab Station</option>
                                        </select>
                                    )}
                                    {isBookingTab && (
                                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                                            style={{ height: '32px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem', padding: '0 8px', background: '#f8fafc', outline: 'none', color: '#475569' }}>
                                            <option value="">All Status</option>
                                            <option value="1">Pending</option>
                                            <option value="2">Approved</option>
                                            <option value="3">Rejected</option>
                                            <option value="4">Cancelled</option>
                                            <option value="5">Completed</option>
                                            <option value="6">In Use</option>
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Breadcrumb */}
                {activePanel && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem', fontSize: '0.78rem', fontWeight: 600 }}>
                        <button
                            onClick={handleClosePanel}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f97316', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', fontSize: '0.78rem', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fff7ed')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                            {TAB_GROUPS.find(g => g.tabs.some(t => t.id === activeTab))?.label ?? activeTab}
                        </button>
                        <ChevronRight size={13} color="#94a3b8" />
                        <span style={{ color: '#1e293b', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                            {activePanel.title}
                        </span>
                    </div>
                )}

                {/* ── Main content ── */}
                <div style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 320px)', minHeight: '600px' }}>
                    {/* Left: List */}
                    <div style={{
                        flex: activePanel ? 4 : 10,
                        display: 'flex', flexDirection: 'column',
                        transition: 'flex 0.4s cubic-bezier(0.4,0,0.2,1)',
                        overflow: 'hidden', minWidth: 0
                    }}>
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                            {loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                                    <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-color)' }} />
                                </div>
                            ) : isResourceTab ? (
                                <>
                                    {activeTab === 'my_managed' && (
                                        <div style={{
                                            padding: '8px 12px', marginBottom: '10px', background: '#eff6ff',
                                            border: '1px solid #bfdbfe', borderRadius: '8px',
                                            fontSize: '0.78rem', color: '#2563eb', fontWeight: 600
                                        }}>
                                            {displayResources.length > 0
                                                ? `${displayResources.length} resource(s) you manage`
                                                : 'No resources assigned to you yet.'}
                                        </div>
                                    )}
                                    <ResourceListView
                                        resources={displayResources}
                                        selectedId={activePanel?.type === 'view_resource' ? activePanel.targetId ?? null : null}
                                        onSelect={handleViewResource}
                                    />
                                </>
                            ) : isBookingTab ? (
                                <BookingListView
                                    bookings={displayBookings}
                                    selectedId={activePanel?.type === 'view_booking' ? activePanel.targetId ?? null : null}
                                    onSelect={handleViewBooking}
                                />
                            ) : isLogTab ? (
                                /* Equipment Logs */
                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                    {displayLogs.length === 0 ? (
                                        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>No equipment log entries found.</div>
                                    ) : displayLogs.map((log, idx) => {
                                        const action = getLogActionConfig(log.action);
                                        return (
                                            <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', borderBottom: idx < displayLogs.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.15s' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '8px', background: action.bg, color: action.color, fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>
                                                    {action.icon} {action.label}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{log.resourceName || 'Unknown Resource'}</div>
                                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>by {log.userName} {log.note ? `· ${log.note}` : ''}</div>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>{formatDate(log.loggedAt)}</div>
                                                <ChevronRight size={14} color="#cbd5e1" style={{ flexShrink: 0 }} />
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : isResourceTypeTab ? (
                                /* Resource Types — lab director only */
                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                    {/* Header row with create button */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                                            {displayResourceTypes.length} type(s)
                                        </span>
                                        <button
                                            onClick={handleCreateResourceType}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent-color)', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            <Plus size={13} /> New Type
                                        </button>
                                    </div>
                                    {displayResourceTypes.length === 0 ? (
                                        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>No resource types found.</div>
                                    ) : displayResourceTypes.map((rt, idx) => (
                                        <div key={rt.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', borderBottom: idx < displayResourceTypes.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.15s' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>
                                                <Layers size={16} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{rt.name}</span>
                                                    {rt.isActive === false && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>Inactive</span>
                                                    )}
                                                </div>
                                                {rt.description && <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{rt.description}</div>}
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                                <button onClick={() => handleEditResourceType(rt)} style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                                    <Pencil size={13} />
                                                </button>
                                                <button onClick={() => handleDeleteResourceType(rt.id)} style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {/* Right: Panel */}
                    {activePanel && (
                        <div style={{
                            flex: 6, transition: 'flex 0.4s cubic-bezier(0.4,0,0.2,1)',
                            overflow: 'hidden', display: 'flex', flexDirection: 'column',
                            background: '#fff', borderRadius: '16px',
                            border: '1px solid var(--border-color)', padding: '1.5rem',
                            alignSelf: activePanel.type === 'resource_type_form' ? 'flex-start' : 'stretch'
                        }}>
                            {activePanel.type === 'create_resource' && (
                                <CreateResourceForm onClose={handleClosePanel} onSaved={handlePanelSaved} onTitleChange={handleTitleChange} />
                            )}
                            {activePanel.type === 'view_resource' && activePanel.resource && (
                                <ResourceDetailPanel
                                    resource={activePanel.resource} onClose={handleClosePanel}
                                    onSaved={handlePanelSaved} onTitleChange={handleTitleChange}
                                    isLabDirector={isLabDirector}
                                    allowSerialSelect={activeTab === 'my_managed'}
                                />
                            )}
                            {activePanel.type === 'create_booking' && (
                                <BookingResourceForm
                                    onClose={handleClosePanel} onSaved={handlePanelSaved}
                                    onTitleChange={handleTitleChange} preSelectedResource={activePanel.preSelectedResource}
                                />
                            )}
                            {activePanel.type === 'view_booking' && activePanel.targetId && (
                                <BookingDetailPanel
                                    bookingId={activePanel.targetId} onClose={handleClosePanel}
                                    onSaved={handlePanelSaved} onTitleChange={handleTitleChange}
                                    isLabDirector={isLabDirector}
                                />
                            )}
                            {activePanel.type === 'resource_type_form' && (
                                <ResourceTypePanel
                                    editing={activePanel.editingResourceType ?? null}
                                    onClose={handleClosePanel}
                                    onSaved={(msg) => { fetchData(); showToast(msg, 'success'); handleClosePanel(); }}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </MainLayout>
    );
};

export default ResourceBooking;
