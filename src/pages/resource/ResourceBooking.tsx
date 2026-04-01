import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { Resource, Booking, BookingStatus } from '@/types/booking';
import { bookingService } from '@/services/bookingService';
import { resourceService } from '@/services/resourceService';
import Toast, { ToastType } from '@/components/common/Toast';
import {
    Search,
    Package,
    Loader2,
    Calendar,
    Plus,
    Filter,
    Clock,
    CheckCircle2,
    AlertTriangle,
    ClipboardList,
    Settings
} from 'lucide-react';

import ResourceListView from './components/ResourceListView';
import CreateResourceForm from './components/CreateResourceForm';
import ResourceDetailPanel from './components/ResourceDetailPanel';
import BookingResourceForm from './components/BookingResourceForm';
import BookingListView from './components/BookingListView';
import BookingDetailPanel from './components/BookingDetailPanel';

type TabType = 'resources' | 'my_bookings' | 'all_bookings' | 'my_managed';

interface ActivePanel {
    id: string;
    type: 'create_resource' | 'view_resource' | 'create_booking' | 'view_booking';
    targetId?: string;
    title: string;
    // Full resource object stored to avoid re-fetch and blank page
    resource?: Resource;
    preSelectedResource?: Resource;
}

const ResourceBooking: React.FC = () => {
    const { user } = useAuth();

    // Data
    const [activeTab, setActiveTab] = useState<TabType>('resources');
    const [resources, setResources] = useState<Resource[]>([]);
    const [myBookings, setMyBookings] = useState<Booking[]>([]);
    const [allBookings, setAllBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Panel system
    const [activePanel, setActivePanel] = useState<ActivePanel | null>(null);

    const isLabDirector = useMemo(() => {
        if (!user) return false;
        const role = Number(user.role);
        return role === 1 || role === 2;
    }, [user?.role]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (activeTab === 'resources' || activeTab === 'my_managed') {
                const data = await resourceService.getAll(1, 200);
                setResources(data.items || []);
            } else if (activeTab === 'my_bookings') {
                const [upcoming, history] = await Promise.all([
                    bookingService.getMyUpcoming(),
                    bookingService.getMyHistory(1, 200)
                ]);
                const historyItems = (history as any).items || [];
                const all = [...upcoming, ...historyItems];
                const unique = Array.from(new Map(all.map(b => [b.id, b])).values());
                unique.sort((a, b) => new Date(b.createdAt || b.startTime).getTime() - new Date(a.createdAt || a.startTime).getTime());
                setMyBookings(unique);
            } else if (activeTab === 'all_bookings') {
                const data = await bookingService.getAll(1, 200);
                const items = data.items || [];
                items.sort((a, b) => new Date(b.createdAt || b.startTime).getTime() - new Date(a.createdAt || a.startTime).getTime());
                setAllBookings(items);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const showToast = (message: string, type: ToastType = 'info') => {
        setToast({ message, type });
    };

    // Panel handlers
    const handleCreateResource = () => {
        setActivePanel({ id: `create-res-${Date.now()}`, type: 'create_resource', title: 'New Resource' });
    };

    const handleViewResource = (resource: Resource) => {
        // Store full resource object to avoid API re-fetch (avoids blank page)
        setActivePanel({
            id: `view-res-${resource.id}`,
            type: 'view_resource',
            targetId: resource.id,
            title: resource.name,
            resource
        });
    };

    const handleCreateBooking = (preSelectedResource?: Resource) => {
        setActivePanel({
            id: `create-booking-${Date.now()}`,
            type: 'create_booking',
            title: 'New Booking',
            preSelectedResource
        });
    };

    const handleViewBooking = (booking: Booking) => {
        setActivePanel({
            id: `view-booking-${booking.id}`,
            type: 'view_booking',
            targetId: booking.id,
            title: booking.title
        });
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

    // Filtered data
    const displayResources = useMemo(() => {
        const list = activeTab === 'my_managed'
            ? resources.filter(r => r.managedBy === user?.userId)
            : resources;
        return list.filter(r => {
            const q = searchQuery.toLowerCase();
            const matchesQuery = !q
                || r.name.toLowerCase().includes(q)
                || (r.description || '').toLowerCase().includes(q)
                || (r.location || '').toLowerCase().includes(q);
            const matchesType = !filterType || String(r.type) === filterType;
            return matchesQuery && matchesType;
        });
    }, [resources, activeTab, searchQuery, filterType, user?.userId]);

    const displayBookings = useMemo(() => {
        const list = activeTab === 'my_bookings' ? myBookings : allBookings;
        return list.filter(b => {
            const q = searchQuery.toLowerCase();
            const matchesQuery = !q
                || b.title.toLowerCase().includes(q)
                || (b.userName || '').toLowerCase().includes(q);
            const matchesStatus = !filterStatus || String(b.status) === filterStatus;
            return matchesQuery && matchesStatus;
        });
    }, [activeTab, myBookings, allBookings, searchQuery, filterStatus]);

    // Stats
    const pendingCount = useMemo(() => {
        const list = activeTab === 'all_bookings' ? allBookings : myBookings;
        return list.filter(b => b.status === BookingStatus.Pending).length;
    }, [activeTab, myBookings, allBookings]);

    const approvedCount = useMemo(() => {
        const list = activeTab === 'all_bookings' ? allBookings : myBookings;
        return list.filter(b => b.status === BookingStatus.Approved).length;
    }, [activeTab, myBookings, allBookings]);

    const availableResourceCount = resources.filter(r => r.availableQuantity > 0).length;

    const isResourceTab = activeTab === 'resources' || activeTab === 'my_managed';

    // Tabs definition
    const tabs = [
        { id: 'resources', label: 'All Resources', icon: <Package size={16} /> },
        { id: 'my_bookings', label: 'My Bookings', icon: <Calendar size={16} /> },
        { id: 'my_managed', label: 'My Resources', icon: <Settings size={16} /> },
        ...(isLabDirector ? [{ id: 'all_bookings', label: 'All Bookings', icon: <ClipboardList size={16} /> }] : [])
    ];

    return (
        <MainLayout role={user?.role} userName={user?.name}>
            <div className="page-container" style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 8px 16px rgba(245, 158, 11, 0.2)'
                            }}>
                                <Package size={24} />
                            </div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
                                Lab Resources
                            </h1>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>
                            Manage lab resources, book equipment, and track reservations.
                        </p>
                    </div>
                </div>

                {/* Status Board */}
                <div style={{
                    background: 'white', padding: '1.25rem 1.5rem', borderRadius: '20px',
                    border: '1px solid #e2e8f0', display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr', gap: '1.5rem', alignItems: 'start',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginBottom: '1.5rem'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Action Required
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', opacity: pendingCount > 0 ? 1 : 0.45 }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#f59e0b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <AlertTriangle size={14} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', flex: 1 }}>Pending Requests:</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: pendingCount > 0 ? '#1e293b' : '#94a3b8' }}>{pendingCount}</span>
                        </div>
                    </div>

                    <div style={{ width: '1px', alignSelf: 'stretch', background: '#f1f5f9' }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Resource Metrics
                        </h4>
                        {[
                            { icon: <Package size={14} />, color: '#3b82f6', label: 'Total Resources:', value: resources.length },
                            { icon: <CheckCircle2 size={14} />, color: '#10b981', label: 'Available:', value: availableResourceCount },
                            { icon: <Clock size={14} />, color: '#8b5cf6', label: 'Active Bookings:', value: approvedCount }
                        ].map(stat => (
                            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', opacity: stat.value > 0 ? 1 : 0.45 }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: stat.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {stat.icon}
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', flex: 1 }}>{stat.label}</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: stat.value > 0 ? '#1e293b' : '#94a3b8' }}>{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Search Bar */}
                <div style={{
                    padding: '0.75rem 1.5rem', borderRadius: '14px', background: '#fff',
                    border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem'
                }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder={isResourceTab ? 'Search by name, description, or location...' : 'Search bookings by title or user...'}
                                className="form-input"
                                style={{ paddingLeft: '40px', height: '42px', border: 'none', background: 'var(--surface-hover)', borderRadius: '10px', fontSize: '0.88rem' }}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '20px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        {isResourceTab ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Filter size={14} color="var(--text-muted)" />
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Type:</span>
                                <select
                                    style={{ height: '32px', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-color)' }}
                                    value={filterType}
                                    onChange={e => setFilterType(e.target.value)}
                                >
                                    <option value="">All Types</option>
                                    <option value="1">GPU</option>
                                    <option value="2">Equipment</option>
                                    <option value="3">Dataset</option>
                                    <option value="4">Lab Station</option>
                                </select>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Filter size={14} color="var(--text-muted)" />
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Status:</span>
                                <select
                                    style={{ height: '32px', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-color)' }}
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                >
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

                {/* Tabs + Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1, borderBottom: '1px solid #e2e8f0', overflowX: 'auto', whiteSpace: 'nowrap' as const }} className="custom-scrollbar">
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => switchTab(tab.id as TabType)}
                                    style={{
                                        padding: '12px 10px', display: 'flex', alignItems: 'center', gap: '8px',
                                        border: 'none', background: 'none', cursor: 'pointer',
                                        color: activeTab === tab.id ? 'var(--accent-color)' : '#64748b',
                                        borderBottom: activeTab === tab.id ? '3px solid var(--accent-color)' : '3px solid transparent',
                                        fontWeight: activeTab === tab.id ? 800 : 500,
                                        transition: 'all 0.2s', fontSize: '0.85rem',
                                        flex: '0 0 auto', minWidth: '120px', justifyContent: 'center'
                                    }}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginLeft: '1rem' }}>
                        {isResourceTab && (
                            <button
                                onClick={() => handleCreateBooking()}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700,
                                    padding: '10px 20px', borderRadius: '12px', fontSize: '0.85rem',
                                    background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none',
                                    color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' as const,
                                    height: '42px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                                }}
                            >
                                <Calendar size={18} /> Book Resource
                            </button>
                        )}
                        {isLabDirector && isResourceTab && (
                            <button
                                onClick={handleCreateResource}
                                className="btn btn-primary"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700,
                                    padding: '10px 20px', borderRadius: '12px', fontSize: '0.85rem',
                                    boxShadow: '0 4px 12px rgba(232, 114, 12, 0.2)',
                                    whiteSpace: 'nowrap' as const, height: '42px', marginBottom: '0px'
                                }}
                            >
                                <Plus size={18} /> Add Resource
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 340px)', minHeight: '650px' }}>
                    {/* Left: List */}
                    <div style={{
                        flex: activePanel ? 4 : 10,
                        display: 'flex', flexDirection: 'column',
                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        overflow: 'hidden'
                    }}>
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
                            {loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                                    <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-color)' }} />
                                </div>
                            ) : isResourceTab ? (
                                <>
                                    {activeTab === 'my_managed' && displayResources.length === 0 && !loading && (
                                        <div style={{
                                            padding: '12px 16px', marginBottom: '12px', background: '#eff6ff',
                                            border: '1px solid #bfdbfe', borderRadius: '10px',
                                            fontSize: '0.82rem', color: '#1d4ed8', fontWeight: 600
                                        }}>
                                            Showing resources you manage. No resources assigned to you yet.
                                        </div>
                                    )}
                                    {activeTab === 'my_managed' && displayResources.length > 0 && (
                                        <div style={{
                                            padding: '8px 12px', marginBottom: '10px', background: '#eff6ff',
                                            border: '1px solid #bfdbfe', borderRadius: '8px',
                                            fontSize: '0.78rem', color: '#2563eb', fontWeight: 600
                                        }}>
                                            {displayResources.length} resource(s) you manage
                                        </div>
                                    )}
                                    <ResourceListView
                                        resources={displayResources}
                                        selectedId={activePanel?.type === 'view_resource' ? activePanel.targetId || null : null}
                                        onSelect={handleViewResource}
                                    />
                                </>
                            ) : (
                                <BookingListView
                                    bookings={displayBookings}
                                    selectedId={activePanel?.type === 'view_booking' ? activePanel.targetId || null : null}
                                    onSelect={handleViewBooking}
                                />
                            )}
                        </div>
                    </div>

                    {/* Right: Panel */}
                    {activePanel && (
                        <div style={{
                            flex: 6, opacity: 1, pointerEvents: 'auto',
                            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            overflow: 'hidden', display: 'flex', flexDirection: 'column',
                            background: '#fff', borderRadius: '16px',
                            border: '1px solid var(--border-color)', padding: '1.5rem'
                        }}>
                            {activePanel.type === 'create_resource' && (
                                <CreateResourceForm
                                    onClose={handleClosePanel}
                                    onSaved={handlePanelSaved}
                                    onTitleChange={handleTitleChange}
                                />
                            )}
                            {activePanel.type === 'view_resource' && activePanel.resource && (
                                <ResourceDetailPanel
                                    resource={activePanel.resource}
                                    onClose={handleClosePanel}
                                    onSaved={handlePanelSaved}
                                    onTitleChange={handleTitleChange}
                                    isLabDirector={isLabDirector}
                                />
                            )}
                            {activePanel.type === 'create_booking' && (
                                <BookingResourceForm
                                    onClose={handleClosePanel}
                                    onSaved={handlePanelSaved}
                                    onTitleChange={handleTitleChange}
                                    preSelectedResource={activePanel.preSelectedResource}
                                />
                            )}
                            {activePanel.type === 'view_booking' && activePanel.targetId && (
                                <BookingDetailPanel
                                    bookingId={activePanel.targetId}
                                    onClose={handleClosePanel}
                                    onSaved={handlePanelSaved}
                                    onTitleChange={handleTitleChange}
                                    isLabDirector={isLabDirector}
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
