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
    Trash2,
    Filter,
    X,
    Wrench,
    Activity
} from 'lucide-react';

import ResourceListView from './components/ResourceListView';
import CreateResourceForm from './components/CreateResourceForm';
import ResourceDetailPanel from './components/ResourceDetailPanel';
import BookingResourceForm from './components/BookingResourceForm';
import BookingListView from './components/BookingListView';
import BookingDetailPanel from './components/BookingDetailPanel';
import ResourceTypePanel from './components/ResourceTypePanel';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type MainTab = 'resources' | 'bookings' | 'logs';
type ResourceSubTab = 'all' | 'my_managed' | 'types';
type BookingSubTab = 'my' | 'all' | 'managed';
type TabType = 'resources' | 'my_managed' | 'my_bookings' | 'all_bookings' | 'managed_bookings' | 'equipment_logs' | 'resource_types';

interface ActivePanel {
    id: string;
    type: 'create_resource' | 'view_resource' | 'create_booking' | 'view_booking' | 'resource_type_form' | 'view_log';
    targetId?: string;
    title: string;
    resource?: Resource;
    preSelectedResource?: Resource;
    editingResourceType?: ResourceTypeItem;
    log?: EquipmentLog;
}

// â”€â”€â”€ Equipment log action label â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const getLogActionConfig = (action: EquipmentLogAction) =>
    action === EquipmentLogAction.CheckOut
        ? { label: 'Check Out', color: '#2563eb', bg: '#eff6ff', icon: <LogOut size={12} /> }
        : { label: 'Check In', color: '#16a34a', bg: '#f0fdf4', icon: <LogIn size={12} /> };

const formatDate = (s: string) => {
    const d = new Date(s);
    if (isNaN(d.getTime())) return 'N/A';
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
};

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ResourceBooking: React.FC = () => {
    const { user } = useAuth();

    const [mainTab, setMainTab] = useState<MainTab>('resources');
    const [resourceSubTab, setResourceSubTab] = useState<ResourceSubTab>('all');
    const [bookingSubTab, setBookingSubTab] = useState<BookingSubTab>('my');

    // Derived active tab for data fetching (keeps backward compat)
    const activeTab = useMemo((): TabType => {
        if (mainTab === 'resources') {
            if (resourceSubTab === 'my_managed') return 'my_managed';
            if (resourceSubTab === 'types') return 'resource_types';
            return 'resources';
        }
        if (mainTab === 'bookings') {
            if (bookingSubTab === 'all') return 'all_bookings';
            if (bookingSubTab === 'managed') return 'managed_bookings';
            return 'my_bookings';
        }
        return 'equipment_logs';
    }, [mainTab, resourceSubTab, bookingSubTab]);

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
                    const data = await equipmentLogService.getAll(1, 20);
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

    const handleViewLog = (log: EquipmentLog) => setActivePanel({ id: `view-log-${log.id}`, type: 'view_log', targetId: log.id, title: log.resourceName, log });
    const handleClosePanel = () => setActivePanel(null);

    const handleTitleChange = (newTitle: string) => {
        if (activePanel) setActivePanel({ ...activePanel, title: newTitle });
    };

    const handlePanelSaved = (shouldClose = false, message?: string) => {
        fetchData();
        if (message) showToast(message, 'success');
        if (shouldClose) handleClosePanel();
    };

    const switchMainTab = (tab: MainTab) => {
        setMainTab(tab);
        setActivePanel(null);
        setSearchQuery('');
        setFilterStatus('');
        setFilterType('');
    };

    const switchResourceSubTab = (sub: ResourceSubTab) => {
        setResourceSubTab(sub);
        setActivePanel(null);
        setSearchQuery('');
        setFilterType('');
    };

    const switchBookingSubTab = (sub: BookingSubTab) => {
        setBookingSubTab(sub);
        setActivePanel(null);
        setSearchQuery('');
        setFilterStatus('');
    };

    // â”€â”€â”€ Derived state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    const availableResourceCount = resources.reduce((sum, r) => sum + (r.availableQuantity ?? 0), 0);
    const damagedResourceCount = resources.reduce((sum, r) => sum + (r.damagedQuantity ?? 0), 0);
    const inUseResourceCount = resources.reduce((sum, r) => sum + (r.inUseCount ?? 0), 0);

    // â”€â”€â”€ Style helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const mainTabStyle = (tab: MainTab): React.CSSProperties => {
        const isActive = mainTab === tab;
        const hasPills = mainTab === 'resources' || mainTab === 'bookings';
        const connectToPills = isActive && hasPills;
        const tabColors: Record<MainTab, { bg: string; color: string }> = {
            resources: { bg: '#fff7ed', color: '#ea580c' },
            bookings:  { bg: '#eef2ff', color: '#4f46e5' },
            logs:      { bg: '#f0f9ff', color: '#0284c7' },
        };
        const { bg, color } = tabColors[tab];
        return {
            display: 'flex', alignItems: 'center', gap: '8px',
            // Extra paddingBottom when connecting so button fills gap to pill row
            padding: connectToPills ? '10px 24px 13px' : '10px 24px',
            borderTop: connectToPills ? `3px solid ${color}` : 'none',
            borderLeft: connectToPills ? `3px solid ${color}` : 'none',
            borderRight: connectToPills ? `3px solid ${color}` : 'none',
            borderBottom: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem', fontWeight: isActive ? 700 : 500,
            // Square bottom corners when "opening" into pill row
            borderRadius: connectToPills ? '10px 10px 0 0' : '12px',
            transition: 'all 0.2s',
            background: isActive ? bg : 'transparent',
            color: isActive ? color : '#64748b',
            // Lift above pill row so background covers the pill row borderTop at tab position
            position: 'relative' as const,
            zIndex: connectToPills ? 2 : 'auto' as any,
            // Pull down by 3px to overlap pill row's borderTop, breaking the line under the tab
            marginBottom: connectToPills ? '-3px' : '0',
            boxShadow: isActive && !connectToPills ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
        };
    };

    const pillStyle = (isActive: boolean, color: string): React.CSSProperties => ({
        padding: '5px 14px', border: 'none', cursor: 'pointer',
        fontSize: '0.78rem', fontWeight: isActive ? 700 : 500,
        borderRadius: '20px', transition: 'all 0.15s',
        background: isActive ? color : '#f1f5f9',
        color: isActive ? '#fff' : '#475569',
    });

    // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return (
        <MainLayout role={user?.role} userName={user?.name}>
            <div style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                {/* â”€â”€ Page Header â”€â”€ */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '14px', flexShrink: 0,
                        background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 16px rgba(245,158,11,0.25)'
                    }}>
                        <Package size={22} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
                            Lab Resources
                        </h1>
                        <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
                            Manage resources, bookings, and equipment logs
                        </p>
                    </div>
                </div>

                {/* ─ Unified Nav Card ─ */}
                {(() => {
                    const tabMeta: Record<MainTab, { color: string; accentBg: string; borderColor: string }> = {
                        resources: { color: '#ea580c', accentBg: '#fff7ed', borderColor: '#fdba74' },
                        bookings:  { color: '#4f46e5', accentBg: '#eef2ff', borderColor: '#a5b4fc' },
                        logs:      { color: '#0284c7', accentBg: '#f0f9ff', borderColor: '#7dd3fc' },
                    };
                    const meta = tabMeta[mainTab];
                    const hasPills = mainTab === 'resources' || mainTab === 'bookings';
                    return (
                        <div style={{
                            background: '#fff', borderRadius: '16px',
                            border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            marginBottom: '1rem', overflow: 'hidden',
                        }}>
                            {/* Row 1 — Main tabs */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 6px 0', position: 'relative', zIndex: 1 }}>
                                <button style={mainTabStyle('resources')} onClick={() => switchMainTab('resources')}>
                                    <Package size={17} /> Resources
                                    {isResourceTab && resources.length > 0 && (
                                        <span style={{ padding: '1px 7px', borderRadius: '10px', background: '#ea580c', color: '#fff', fontSize: '0.7rem', fontWeight: 800 }}>
                                            {resources.length}
                                        </span>
                                    )}
                                </button>
                                <button style={mainTabStyle('bookings')} onClick={() => switchMainTab('bookings')}>
                                    <Calendar size={17} /> Bookings
                                    {isBookingTab && pendingCount > 0 && (
                                        <span style={{ padding: '1px 7px', borderRadius: '10px', background: '#4f46e5', color: '#fff', fontSize: '0.7rem', fontWeight: 800 }}>
                                            {pendingCount} pending
                                        </span>
                                    )}
                                </button>
                                <button style={mainTabStyle('logs')} onClick={() => switchMainTab('logs')}>
                                    <ScrollText size={17} /> Equipment Logs
                                </button>
                            </div>
                            {/* Row 2 — Sub-filter pills + CTA, visually linked to active tab */}
                            {hasPills && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    gap: '12px', flexWrap: 'wrap' as const,
                                    borderTop: `3px solid ${meta.color}`,
                                    background: meta.accentBg,
                                    padding: '7px 12px 7px 14px',
                                }}>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                                        {mainTab === 'resources' && (
                                            <>
                                                <button style={pillStyle(resourceSubTab === 'all', meta.color)} onClick={() => switchResourceSubTab('all')}>All Resources</button>
                                                <button style={pillStyle(resourceSubTab === 'my_managed', meta.color)} onClick={() => switchResourceSubTab('my_managed')}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Settings size={12} /> My Managed</span>
                                                </button>
                                                {isLabDirector && (
                                                    <button style={pillStyle(resourceSubTab === 'types', meta.color)} onClick={() => switchResourceSubTab('types')}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Layers size={12} /> Resource Types</span>
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {mainTab === 'bookings' && (
                                            <>
                                                <button style={pillStyle(bookingSubTab === 'my', meta.color)} onClick={() => switchBookingSubTab('my')}>My Bookings</button>
                                                <button style={pillStyle(bookingSubTab === 'managed', meta.color)} onClick={() => switchBookingSubTab('managed')}>Managed</button>
                                                {isLabDirector && (
                                                    <button style={pillStyle(bookingSubTab === 'all', meta.color)} onClick={() => switchBookingSubTab('all')}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><ClipboardList size={12} /> All Bookings</span>
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {mainTab === 'bookings' && (
                                            <button onClick={() => handleCreateBooking()} style={{
                                                display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700,
                                                padding: '0 14px', height: '32px', borderRadius: '8px', fontSize: '0.8rem',
                                                background: meta.color, border: 'none',
                                                color: '#fff', cursor: 'pointer', boxShadow: `0 2px 6px ${meta.color}55`
                                            }}><Plus size={14} /> New Booking</button>
                                        )}
                                        {mainTab === 'resources' && isResourceTypeTab && isLabDirector && (
                                            <button onClick={handleCreateResourceType} style={{
                                                display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700,
                                                padding: '0 14px', height: '32px', borderRadius: '8px', fontSize: '0.8rem',
                                                background: meta.color, border: 'none',
                                                color: '#fff', cursor: 'pointer', boxShadow: `0 2px 6px ${meta.color}55`
                                            }}><Plus size={14} /> New Type</button>
                                        )}
                                        {mainTab === 'resources' && !isResourceTypeTab && isLabDirector && (
                                            <button onClick={handleCreateResource} style={{
                                                display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700,
                                                padding: '0 14px', height: '32px', borderRadius: '8px', fontSize: '0.8rem',
                                                background: meta.color, border: 'none',
                                                color: '#fff', cursor: 'pointer', boxShadow: `0 2px 6px ${meta.color}55`
                                            }}><Plus size={14} /> Add Resource</button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
                {/* Search + filter toolbar + stats in one row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '1rem', flexWrap: 'wrap' as const }}>
                    {/* Left: stats chips */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                        {isResourceTab && !isResourceTypeTab && [
                            { label: 'Total', value: resources.length, color: '#3b82f6', icon: <Package size={13} /> },
                            { label: 'Available', value: availableResourceCount, color: '#10b981', icon: <CheckCircle2 size={13} /> },
                            { label: 'In Use', value: inUseResourceCount, color: '#f59e0b', icon: <Activity size={13} /> },
                            { label: 'Damaged', value: damagedResourceCount, color: '#ef4444', icon: <Wrench size={13} /> },
                        ].map(s => (
                            <div key={s.label} style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '5px 12px', background: '#fff', borderRadius: '8px',
                                border: '1px solid #e2e8f0', fontSize: '0.78rem', fontWeight: 700, color: '#475569'
                            }}>
                                <span style={{ color: s.color }}>{s.icon}</span>
                                {s.label}: <span style={{ color: '#1e293b' }}>{s.value}</span>
                            </div>
                        ))}
                        {isBookingTab && [
                            { label: 'Total', value: bookingListForTab.length, color: '#8b5cf6', icon: <Clock size={13} /> },
                            { label: 'Pending', value: pendingCount, color: '#f59e0b', icon: <AlertTriangle size={13} /> },
                        ].map(s => (
                            <div key={s.label} style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '5px 12px', background: '#fff', borderRadius: '8px',
                                border: '1px solid #e2e8f0', fontSize: '0.78rem', fontWeight: 700, color: '#475569'
                            }}>
                                <span style={{ color: s.color }}>{s.icon}</span>
                                {s.label}: <span style={{ color: '#1e293b' }}>{s.value}</span>
                            </div>
                        ))}
                        {isLogTab && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '5px 12px', background: '#fff', borderRadius: '8px',
                                border: '1px solid #e2e8f0', fontSize: '0.78rem', fontWeight: 700, color: '#475569'
                            }}>
                                <span style={{ color: '#0ea5e9' }}><ScrollText size={13} /></span>
                                Entries: <span style={{ color: '#1e293b' }}>{equipmentLogs.length}</span>
                            </div>
                        )}
                    </div>
                    {/* Right: search + filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                        <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '30px', paddingRight: searchQuery ? '28px' : '10px', height: '34px', width: '200px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.82rem', outline: 'none', background: '#fff', color: '#1e293b' }} />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}>
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    {isResourceTab && !isResourceTypeTab && (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Filter size={12} style={{ position: 'absolute', left: '9px', color: '#94a3b8', pointerEvents: 'none' }} />
                            <select value={filterType} onChange={e => setFilterType(e.target.value)}
                                style={{ height: '34px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.82rem', paddingLeft: '26px', paddingRight: '10px', background: '#fff', outline: 'none', color: '#475569', appearance: 'none' as const }}>
                                <option value="">All Types</option>
                                <option value="1">GPU</option>
                                <option value="2">Equipment</option>
                                <option value="3">Dataset</option>
                                <option value="4">Lab Station</option>
                            </select>
                        </div>
                    )}
                    {isBookingTab && (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Filter size={12} style={{ position: 'absolute', left: '9px', color: '#94a3b8', pointerEvents: 'none' }} />
                            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                                style={{ height: '34px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.82rem', paddingLeft: '26px', paddingRight: '10px', background: '#fff', outline: 'none', color: '#475569', appearance: 'none' as const }}>
                                <option value="">All Status</option>
                                <option value="1">Pending</option>
                                <option value="2">Approved</option>
                                <option value="3">Rejected</option>
                                <option value="4">Cancelled</option>
                                <option value="5">Completed</option>
                                <option value="6">In Use</option>
                            </select>
                        </div>
                    )}
                    </div>
                </div>
                {/* â”€â”€ Breadcrumb when panel open â”€â”€ */}
                {activePanel && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem', fontSize: '0.78rem', fontWeight: 600 }}>
                        <button
                            onClick={handleClosePanel}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f97316', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', fontSize: '0.78rem', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fff7ed')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                            {mainTab === 'resources' ? 'Resources' : mainTab === 'bookings' ? 'Bookings' : 'Logs'}
                        </button>
                        <ChevronRight size={13} color="#94a3b8" />
                        <span style={{ color: '#1e293b', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                            {activePanel.title}
                        </span>
                    </div>
                )}

                {/* â”€â”€ Main content â”€â”€ */}
                <div style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 320px)', minHeight: '560px' }}>
                    {/* Left: List */}
                    <div style={{
                        flex: activePanel ? 4 : 10,
                        display: 'flex', flexDirection: 'column',
                        transition: 'flex 0.35s cubic-bezier(0.4,0,0.2,1)',
                        overflow: 'hidden', minWidth: 0
                    }}>
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                            {loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '5rem' }}>
                                    <Loader2 className="animate-spin" size={32} style={{ color: '#f97316' }} />
                                </div>
                            ) : isResourceTab ? (
                                <>
                                    {activeTab === 'my_managed' && (
                                        <div style={{
                                            padding: '8px 12px', marginBottom: '10px', background: '#ecfdf5',
                                            border: '1px solid #a7f3d0', borderRadius: '8px',
                                            fontSize: '0.78rem', color: '#059669', fontWeight: 600
                                        }}>
                                            {displayResources.length > 0
                                                ? `${displayResources.length} resource(s) assigned to you`
                                                : 'No resources assigned to you yet.'}
                                        </div>
                                    )}
                                    <ResourceListView
                                        resources={displayResources}
                                        selectedId={activePanel?.type === 'view_resource' ? activePanel.targetId ?? null : null}
                                        onSelect={handleViewResource}
                                        onBook={handleCreateBooking}
                                    />
                                </>
                            ) : isBookingTab ? (
                                <BookingListView
                                    bookings={displayBookings}
                                    selectedId={activePanel?.type === 'view_booking' ? activePanel.targetId ?? null : null}
                                    onSelect={handleViewBooking}
                                />
                            ) : isLogTab ? (
                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                    {displayLogs.length === 0 ? (
                                        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                                            <ScrollText size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                                            <div>No equipment log entries found.</div>
                                        </div>
                                    ) : displayLogs.map((log, idx) => {
                                        const action = getLogActionConfig(log.action);
                                        return (
                                            <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', borderBottom: idx < displayLogs.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.15s', cursor: 'pointer', background: activePanel?.targetId === log.id ? '#f0f9ff' : 'transparent', outline: activePanel?.targetId === log.id ? '2px solid #0284c7' : 'none', outlineOffset: '-2px', borderRadius: activePanel?.targetId === log.id ? '8px' : undefined }}
                                                onClick={() => handleViewLog(log)}
                                                onMouseEnter={e => { if (activePanel?.targetId !== log.id) e.currentTarget.style.background = '#f8fafc'; }}
                                                onMouseLeave={e => { if (activePanel?.targetId !== log.id) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '8px', background: action.bg, color: action.color, fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>
                                                    {action.icon} {action.label}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{log.resourceName || 'Unknown Resource'}</div>
                                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>by {log.userName} {log.note ? `Â· ${log.note}` : ''}</div>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>{formatDate(log.loggedAt)}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : isResourceTypeTab ? (
                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                                            {displayResourceTypes.length} type(s)
                                        </span>
                                    </div>
                                    {displayResourceTypes.length === 0 ? (
                                        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>No resource types found.</div>
                                    ) : displayResourceTypes.map((rt, idx) => (
                                        <div key={rt.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', borderBottom: idx < displayResourceTypes.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.15s' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', flexShrink: 0 }}>
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

                    {/* Right: Detail / Form Panel */}
                    {activePanel && (
                        <div style={{
                            flex: 6, transition: 'flex 0.35s cubic-bezier(0.4,0,0.2,1)',
                            overflow: 'hidden', display: 'flex', flexDirection: 'column',
                            background: '#fff', borderRadius: '16px',
                            border: '1px solid #e2e8f0', padding: '1.5rem',
                            alignSelf: ['resource_type_form', 'view_booking'].includes(activePanel.type) ? 'flex-start' : 'stretch',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.07)'
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
                                    isManagedView={activeTab === 'managed_bookings'}
                                />
                            )}
                            {activePanel.type === 'resource_type_form' && (
                                <ResourceTypePanel
                                    editing={activePanel.editingResourceType ?? null}
                                    onClose={handleClosePanel}
                                    onSaved={(msg) => { fetchData(); showToast(msg, 'success'); handleClosePanel(); }}
                                />
                            )}
                            {activePanel.type === 'view_log' && activePanel.log && (() => {
                                const log = activePanel.log!;
                                const action = getLogActionConfig(log.action);
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, flexShrink: 0 }}>
                                                    {action.icon}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>{log.resourceName}</div>
                                                    <div style={{ fontSize: '0.75rem', color: action.color, fontWeight: 700 }}>{action.label}</div>
                                                </div>
                                            </div>
                                            <button onClick={handleClosePanel} style={{ width: '28px', height: '28px', border: 'none', background: '#f1f5f9', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '1rem' }}>×</button>
                                        </div>
                                        {[{ label: 'User', value: log.userName }, { label: 'Date', value: formatDate(log.loggedAt) }, { label: 'Resource ID', value: log.resourceId }, ...(log.bookingId ? [{ label: 'Booking ID', value: log.bookingId }] : []), ...(log.note ? [{ label: 'Note', value: log.note }] : [])].map(row => (
                                            <div key={row.label} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                                                <div style={{ width: '100px', flexShrink: 0, fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', paddingTop: '2px' }}>{row.label}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600, wordBreak: 'break-all' as const }}>{row.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
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
