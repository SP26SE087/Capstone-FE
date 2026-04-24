import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AppSelect from '@/components/common/AppSelect';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { Resource, Booking, BookingStatus, BasicBookingResponse, EquipmentLog, EquipmentLogAction } from '@/types/booking';
import { bookingService } from '@/services/bookingService';
import { resourceService } from '@/services/resourceService';
import { equipmentLogService } from '@/services/equipmentLogService';
import { resourceTypeService, ResourceTypeItem } from '@/services/resourceTypeService';
import { useToastStore } from '@/store/slices/toastSlice';
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
    ChevronLeft,
    Layers,
    Pencil,
    Trash2,
    X,
    Wrench,
    Activity,
    RotateCcw
} from 'lucide-react';

import ResourceListView from './components/ResourceListView';
import CreateResourceForm from './components/CreateResourceForm';
import ResourceDetailPanel from './components/ResourceDetailPanel';
import BookingResourceForm from './components/BookingResourceForm';
import NewBookingModal from '@/features/resources/NewBookingModal';
import BookingListView from './components/BookingListView';
import BookingDetailPanel from './components/BookingDetailPanel';
import ResourceTypePanel from './components/ResourceTypePanel';
import ConfirmModal from '@/components/common/ConfirmModal';
import CalendarView from './views/CalendarView';
import TimelineView from './views/TimelineView';
import WorkspaceView from './views/WorkspaceView';

// ─── Types ───────────────────────────────────────────────────────────────────
type BookingVariant = 'calendar' | 'timeline' | 'workspace' | 'management';
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

// ─── Equipment log action label ──────────────────────────────────────────────
const getLogActionConfig = (action: EquipmentLogAction) =>
    action === EquipmentLogAction.CheckOut
        ? { label: 'Check Out', color: '#2563eb', bg: '#eff6ff', icon: <LogOut size={12} style={{ transform: 'scaleX(-1)' }} /> }
        : { label: 'Check In', color: '#16a34a', bg: '#f0fdf4', icon: <LogIn size={12} /> };

const formatDate = (s: string) => {
    const d = new Date(s);
    if (isNaN(d.getTime())) return 'N/A';
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
};

// ─── Component ───────────────────────────────────────────────────────────────
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
    const [myBookingsPage, setMyBookingsPage] = useState(1);
    const [myBookingsPageSize] = useState(10);
    const [myBookingsTotalCount, setMyBookingsTotalCount] = useState(0);
    const [allBookings, setAllBookings] = useState<Booking[]>([]);
    const [managedBookings, setManagedBookings] = useState<Booking[]>([]);
    const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
    const [bulkApproving, setBulkApproving] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkApproveNote, setBulkApproveNote] = useState('');
    const [bulkChecking, setBulkChecking] = useState(false);
    const [bulkCheckInNote, setBulkCheckInNote] = useState('');
    const [bulkCheckOutNote, setBulkCheckOutNote] = useState('');
    const [equipmentLogs, setEquipmentLogs] = useState<EquipmentLog[]>([]);
    const [resourceTypes, setResourceTypes] = useState<ResourceTypeItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [confirmDeleteRtId, setConfirmDeleteRtId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterType, setFilterType] = useState('');
    const { addToast } = useToastStore();
    const [activePanel, setActivePanel] = useState<ActivePanel | null>(null);
    const [bookingCart, setBookingCart] = useState<{ resourceId: string; quantity: number }[]>([]);
    const [viewNewBookingOpen, setViewNewBookingOpen] = useState(false);
    const [viewNewBookingCart, setViewNewBookingCart] = useState<{ resourceId: string; quantity: number }[]>([]);

    const isLabDirector = useMemo(() => {
        if (!user) return false;
        const role = Number(user.role);
        return role === 1 || role === 2;
    }, [user?.role]);

    const isDirectorRole = useMemo(() => {
        if (!user) return false;
        return Number(user.role) === 1;
    }, [user?.role]);

    // ─── Booking variant (Calendar / Timeline / Workspace / Management) ──────
    const [bookingVariant, setBookingVariant] = useState<BookingVariant>('calendar');
    const [viewBookings, setViewBookings] = useState<Booking[]>([]);
    const [viewResources, setViewResources] = useState<Resource[]>([]);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewModalBookingId, setViewModalBookingId] = useState<string | null>(null);

    const fetchViewData = useCallback(async () => {
        setViewLoading(true);
        try {
            const [viewRes] = await Promise.all([
                resourceService.getAllPages(),
            ]);
            setViewResources(viewRes);

            if (isLabDirector) {
                const items = await bookingService.getAllPages();
                setViewBookings(items);
            } else {
                const [managed, upcoming, history] = await Promise.all([
                    bookingService.getManagedAllPages(),
                    bookingService.getMyUpcoming(),
                    bookingService.getMyHistoryAllPages(),
                ]);
                const all = [
                    ...managed,
                    ...(upcoming as Booking[]),
                    ...history,
                ];
                const unique = Array.from(new Map(all.map(b => [b.id, b])).values());
                setViewBookings(unique);
            }
        } catch (err) {
            console.error('fetchViewData error', err);
        } finally {
            setViewLoading(false);
        }
    }, [isLabDirector]);

    useEffect(() => {
        if (bookingVariant !== 'management') fetchViewData();
    }, [bookingVariant, fetchViewData]);

    const switchVariant = (v: BookingVariant) => {
        setBookingVariant(v);
        if (v === 'management') {
            setMainTab('resources');
            setResourceSubTab('all');
            setActivePanel(null);
        }
    };

    const handleViewApprove = async (bookingId: string, note?: string) => {
        try {
            await bookingService.approve(bookingId, { bookingId, note });
            showToast('Booking approved.', 'success');
            fetchViewData();
        } catch (err: any) {
            showToast(err?.response?.data?.message ?? 'Failed to approve.', 'error');
        }
    };

    const handleViewAdjust = async (bookingId: string, opts: { newResourceIds: string[]; adjustReason: string }) => {
        try {
            await bookingService.approve(bookingId, {
                bookingId,
                newResourceIds: opts.newResourceIds,
                adjustReason: opts.adjustReason,
            });
            showToast('Booking adjusted and approved.', 'success');
            fetchViewData();
        } catch (err: any) {
            showToast(err?.response?.data?.message ?? 'Failed to adjust booking.', 'error');
            throw err;
        }
    };

    const handleViewReject = async (bookingId: string, reason?: string) => {
        try {
            await bookingService.reject(bookingId, reason ?? 'Rejected');
            showToast('Booking rejected.', 'success');
            fetchViewData();
        } catch (err: any) {
            showToast(err?.response?.data?.message ?? 'Failed to reject.', 'error');
        }
    };

    const handleViewCheckOut = async (bookingId: string) => {
        // "Check out" = giao thiết bị cho user (Approved → InUse)
        // API: bookingService.checkIn = action=2 (equipment handed to user)
        try {
            await bookingService.checkIn(bookingId);
            showToast('Equipment checked out to user.', 'success');
            fetchViewData();
        } catch (err: any) {
            showToast(err?.response?.data?.message ?? 'Failed to check out.', 'error');
        }
    };

    const handleViewCheckIn = async (bookingId: string) => {
        // "Check in" = user trả lại thiết bị (InUse → Completed)
        // API: bookingService.checkOut = action=1 (equipment returned)
        const booking = viewBookings.find(b => b.id === bookingId);
        const resourceId = booking?.resourceIds?.[0] ?? booking?.resourceId ?? '';
        try {
            await bookingService.checkOut(bookingId, resourceId);
            showToast('Equipment returned.', 'success');
            fetchViewData();
        } catch (err: any) {
            showToast(err?.response?.data?.message ?? 'Failed to check in.', 'error');
        }
    };

    const handleViewOpenBooking = (booking: Booking) => {
        setViewModalBookingId(booking.id);
    };

    const handleViewNewBooking = (resource?: Resource, _date?: Date) => {
        setViewNewBookingCart(
            resource ? [{ resourceId: resource.id, quantity: 1 }] : []
        );
        setViewNewBookingOpen(true);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            switch (activeTab) {
                case 'resources': {
                    const [items, types] = await Promise.all([
                        resourceService.getAllPages(),
                        resourceTypeService.getAll()
                    ]);
                    setResources(items);
                    setResourceTypes(types);
                    break;
                }
                case 'my_managed': {
                    const [items, types] = await Promise.all([
                        resourceService.getManagedAllPages(),
                        resourceTypeService.getAll()
                    ]);
                    setResources(items);
                    setResourceTypes(types);
                    break;
                }
                case 'my_bookings': {
                    const result = await bookingService.getByUser(undefined, myBookingsPage, myBookingsPageSize);
                    const normalized: Booking[] = result.items.map((item: BasicBookingResponse) => ({
                        id: item.bookingId,
                        bookingId: item.bookingId,
                        title: item.resourceName || 'Booking',
                        resourceName: item.resourceName,
                        status: item.status,
                        startTime: item.startTime,
                        endTime: item.endTime,
                        createdAt: item.startTime,
                        userId: item.userId,
                        managerId: item.managerId,
                        managerFullName: item.managerFullName,
                        managerEmail: item.managerEmail,
                    }));
                    setMyBookings(normalized);
                    setMyBookingsTotalCount(result.totalCount || 0);
                    break;
                }
                case 'all_bookings': {
                    const items = await bookingService.getAllPages();
                    items.sort((a, b) =>
                        new Date(b.createdAt || b.startTime).getTime() - new Date(a.createdAt || a.startTime).getTime()
                    );
                    setAllBookings(items);
                    break;
                }
                case 'managed_bookings': {
                    const items = await bookingService.getManagedAllPages();
                    items.sort((a, b) =>
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
    }, [activeTab, myBookingsPage, myBookingsPageSize]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchData();
        } finally {
            setRefreshing(false);
        }
    };

    const showToast = (msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => addToast(msg, type);

    // Panel handlers
    const handleCreateResource = () =>
        setActivePanel({ id: `create-res-${Date.now()}`, type: 'create_resource', title: 'New Resource' });

    const handleViewResource = (resource: Resource) =>
        setActivePanel({ id: `view-res-${resource.id}`, type: 'view_resource', targetId: resource.id, title: resource.name, resource });

    const handleCreateBooking = (resource?: Resource) => {
        if (resource) {
            setBookingCart(prev =>
                prev.find(i => i.resourceId === resource.id) ? prev : [...prev, { resourceId: resource.id, quantity: 1 }]
            );
        }
        setActivePanel(prev =>
            prev?.type === 'create_booking' ? prev : { id: `create-booking-${Date.now()}`, type: 'create_booking', title: 'New Booking' }
        );
    };

    const handleViewBooking = (booking: Booking) =>
        setActivePanel({ id: `view-booking-${booking.id}`, type: 'view_booking', targetId: booking.id, title: booking.title });

    const handleCreateResourceType = () =>
        setActivePanel({ id: `create-rt-${Date.now()}`, type: 'resource_type_form', title: 'New Resource Type' });

    const handleEditResourceType = (rt: ResourceTypeItem) =>
        setActivePanel({ id: `edit-rt-${rt.id}`, type: 'resource_type_form', title: rt.name, editingResourceType: rt });

    const handleDeleteResourceType = (id: string) => {
        setConfirmDeleteRtId(id);
    };

    const handleConfirmDeleteResourceType = async () => {
        if (!confirmDeleteRtId) return;
        const id = confirmDeleteRtId;
        setConfirmDeleteRtId(null);
        try {
            await resourceTypeService.delete(id);
            showToast('Resource type deleted.', 'success');
            fetchData();
        } catch (err: any) {
            showToast(err?.response?.data?.message || 'Failed to delete.', 'error');
        }
    };

    const handleViewLog = (log: EquipmentLog) => setActivePanel({ id: `view-log-${log.id}`, type: 'view_log', targetId: log.id, title: log.resourceName, log });
    const handleClosePanel = () => {
        setActivePanel(null);
        setBookingCart([]);
    };

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
        setBulkSelectedIds([]);
        if (sub === 'my') setMyBookingsPage(1);
    };

    const toggleBulkSelect = (id: string) =>
        setBulkSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    // ── Inline quick actions ─────────────────────────────────────────────────
    const handleQuickApprove = async (bookingId: string, opts?: { note?: string; newResourceIds?: string[]; adjustReason?: string }) => {
        try {
            await bookingService.approve(bookingId, {
                bookingId,
                note: opts?.note,
                newResourceIds: opts?.newResourceIds,
                adjustReason: opts?.adjustReason,
            });
            showToast('Booking approved.', 'success');
            fetchData();
            if (activePanel?.type === 'view_booking' && activePanel.targetId === bookingId) setActivePanel(null);
        } catch (err: any) {
            showToast(err?.response?.data?.message || 'Failed to approve booking.', 'error');
            throw err;
        }
    };

    const handleQuickReject = async (bookingId: string, rejectReason: string) => {
        try {
            await bookingService.reject(bookingId, rejectReason);
            showToast('Booking rejected.', 'success');
            fetchData();
            if (activePanel?.type === 'view_booking' && activePanel.targetId === bookingId) setActivePanel(null);
        } catch (err: any) {
            showToast(err?.response?.data?.message || 'Failed to reject booking.', 'error');
            throw err;
        }
    };

    const handleBulkCheckIn = async () => {
        const targets = displayBookings.filter(b => bulkSelectedIds.includes(b.id) && b.status === BookingStatus.Approved);
        if (!targets.length) return;
        setBulkChecking(true);
        try {
            await Promise.all(targets.map(b => bookingService.checkIn(b.id, bulkCheckInNote.trim() || undefined)));
            const n = targets.length;
            showToast(`Check-out recorded for ${n} booking${n > 1 ? 's' : ''}.`, 'success');
            setBulkSelectedIds([]); setBulkCheckInNote('');
            fetchData();
        } catch (err: any) {
            showToast(err?.response?.data?.message || 'Check-out failed.', 'error');
        } finally { setBulkChecking(false); }
    };

    const handleBulkCheckOut = async () => {
        const targets = displayBookings.filter(b => bulkSelectedIds.includes(b.id) && b.status === BookingStatus.InUse);
        if (!targets.length) return;
        setBulkChecking(true);
        try {
            await Promise.all(targets.map(b => bookingService.checkOut(b.id, b.resourceIds?.[0] ?? '', bulkCheckOutNote.trim() || undefined)));
            const n = targets.length;
            showToast(`Check-in recorded for ${n} booking${n > 1 ? 's' : ''}.`, 'success');
            setBulkSelectedIds([]); setBulkCheckOutNote('');
            fetchData();
        } catch (err: any) {
            showToast(err?.response?.data?.message || 'Check-in failed.', 'error');
        } finally { setBulkChecking(false); }
    };

    const handleBulkApprove = async () => {
        if (bulkSelectedIds.length === 0) return;
        setBulkApproving(true);
        setShowBulkModal(false);
        try {
            const results = await bookingService.bulkApprove(
                bulkSelectedIds.map(bookingId => ({ bookingId, note: bulkApproveNote.trim() || undefined }))
            );
            const succeeded = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            if (succeeded > 0) showToast(`${succeeded} booking(s) approved.`, 'success');
            if (failed > 0) showToast(`${failed} booking(s) could not be approved.`, 'warning');
            setBulkSelectedIds([]);
            setBulkApproveNote('');
            fetchData();
        } catch (err: any) {
            showToast(err?.response?.data?.message || 'Bulk approve failed.', 'error');
        } finally {
            setBulkApproving(false);
        }
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
            && (!filterType || r.resourceTypeId === filterType);
    }), [resources, searchQuery, filterType]);

    const displayBookings = useMemo(() => bookingListForTab.filter(b => {
        const q = searchQuery.toLowerCase();
        return (!q || b.title.toLowerCase().includes(q) || (b.userName || '').toLowerCase().includes(q))
            && (!filterStatus || String(b.status) === filterStatus);
    }), [bookingListForTab, searchQuery, filterStatus]);

    const displayLogs = useMemo(() => equipmentLogs.filter(l => {
        const q = searchQuery.toLowerCase();
        return !q || (l.resourceName || '').toLowerCase().includes(q) || (l.borrowerFullName || l.userName || '').toLowerCase().includes(q);
    }), [equipmentLogs, searchQuery]);

    const pendingCount = useMemo(() =>
        bookingListForTab.filter(b => b.status === BookingStatus.Pending).length,
        [bookingListForTab]
    );
    const availableResourceCount = resources.reduce((sum, r) => sum + (r.availableQuantity ?? 0), 0);
    const damagedResourceCount = resources.reduce((sum, r) => sum + (r.damagedQuantity ?? 0), 0);
    const inUseResourceCount = resources.reduce((sum, r) => sum + (r.inUseCount ?? 0), 0);

    // ─── Style helpers ────────────────────────────────────────────────────────
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

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <MainLayout role={user?.role} userName={user?.name}>
            <div style={{ padding: '0.5rem 0', maxWidth: '1600px', margin: '0 auto' }}>

                {/* ── Page Header ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                                Resource Booking
                            </h1>
                            <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
                                See who's using what, when — and find open slots.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Variant Tab Strip ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: '0.5rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 5, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    {([
                        { id: 'calendar',   label: 'Calendar',   icon: Calendar },
                        { id: 'timeline',   label: 'Timeline',   icon: Layers },
                        { id: 'workspace',  label: 'Workspace',  icon: ClipboardList },
                    ] as const).map(({ id, label, icon: Icon }) => {
                        const active = bookingVariant === id;
                        return (
                            <button key={id} onClick={() => switchVariant(id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 7,
                                    padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                    fontSize: '0.88rem', fontWeight: active ? 700 : 500,
                                    background: active ? '#fff7ed' : 'transparent',
                                    color: active ? '#E8720C' : '#64748b',
                                    boxShadow: active ? '0 1px 4px rgba(232,114,12,0.15)' : 'none',
                                    transition: 'all 0.15s',
                                }}>
                                <Icon size={15} /> {label}
                            </button>
                        );
                    })}
                    <div style={{ width: 1, height: 24, background: '#e2e8f0', margin: '0 4px' }} />
                    {([
                        { id: 'management', label: 'Resources & Logs', icon: Package },
                    ] as const).map(({ id, label, icon: Icon }) => {
                        const active = bookingVariant === id;
                        return (
                            <button key={id} onClick={() => switchVariant(id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 7,
                                    padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                    fontSize: '0.88rem', fontWeight: active ? 700 : 500,
                                    background: active ? '#f1f5f9' : 'transparent',
                                    color: active ? '#1e293b' : '#64748b',
                                    transition: 'all 0.15s',
                                }}>
                                <Icon size={15} /> {label}
                            </button>
                        );
                    })}
                    <div style={{ flex: 1 }} />
                    {bookingVariant !== 'management' && (
                        <button onClick={() => { fetchViewData(); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', border: '1px solid #e2e8f0', background: 'white', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
                            <RotateCcw size={13} style={{ animation: viewLoading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
                        </button>
                    )}
                </div>

                {/* ── New Booking modal overlay (Calendar / Timeline / Workspace) ── */}
                {viewNewBookingOpen && (
                    <NewBookingModal
                        preSelectedResourceId={viewNewBookingCart[0]?.resourceId}
                        onClose={() => setViewNewBookingOpen(false)}
                        onSaved={(message) => {
                            if (message) showToast(message, 'success');
                            setViewNewBookingOpen(false);
                            fetchViewData();
                        }}
                    />
                )}

                {/* ── Booking detail modal overlay (Calendar / Timeline / Workspace) ── */}
                {viewModalBookingId && (
                    <div
                        onClick={() => setViewModalBookingId(null)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 100,
                            background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                            animation: 'bk-fade-in 0.2s ease-out',
                        }}
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            style={{
                                width: '100%', maxWidth: 600, maxHeight: '90vh',
                                background: '#fff', borderRadius: 16,
                                boxShadow: '0 24px 48px rgba(0,0,0,0.24)',
                                display: 'flex', flexDirection: 'column',
                                overflow: 'auto', zoom: 0.8,
                            }}
                            className="bk-scroll"
                        >
                            <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setViewModalBookingId(null)}
                                    className="icon-btn"
                                    style={{ width: 30, height: 30 }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div style={{ padding: '0 20px 20px', flex: 1, minHeight: 0 }}>
                                <BookingDetailPanel
                                    key={viewModalBookingId}
                                    bookingId={viewModalBookingId}
                                    onClose={() => setViewModalBookingId(null)}
                                    onSaved={(shouldClose, message) => {
                                        if (message) showToast(message, 'success');
                                        if (shouldClose) setViewModalBookingId(null);
                                        fetchViewData();
                                    }}
                                    isLabDirector={isLabDirector}
                                    isManagedView={isLabDirector}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Calendar / Timeline / Workspace Views ── */}
                {bookingVariant !== 'management' && (
                    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '16px 16px 12px', height: (isLabDirector && bookingVariant === 'calendar' && viewBookings.some(b => b.status === BookingStatus.Pending)) ? 'calc(115vh / 0.8)' : 'calc((115vh - 120px) / 0.8)', overflow: 'hidden', display: 'flex', flexDirection: 'column', zoom: 0.8 }}>
                        {viewLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6rem' }}>
                                <Loader2 className="animate-spin" size={36} style={{ color: '#E8720C' }} />
                            </div>
                        ) : bookingVariant === 'calendar' ? (
                            <CalendarView
                                bookings={viewBookings} resources={viewResources}
                                isManager={isLabDirector}
                                onOpenBooking={handleViewOpenBooking}
                                onNewBooking={handleViewNewBooking}
                                onApprove={handleViewApprove}
                                onReject={handleViewReject}
                                onAdjust={handleViewAdjust}
                            />
                        ) : bookingVariant === 'timeline' ? (
                            <TimelineView
                                bookings={viewBookings} resources={viewResources}
                                onOpenBooking={handleViewOpenBooking}
                                onNewBooking={handleViewNewBooking}
                            />
                        ) : (
                            <WorkspaceView
                                bookings={viewBookings} resources={viewResources}
                                isManager={isLabDirector}
                                isDirector={isDirectorRole}
                                onOpenBooking={handleViewOpenBooking}
                                onNewBooking={() => handleViewNewBooking()}
                                onApprove={handleViewApprove}
                                onReject={handleViewReject}
                                onCheckOut={handleViewCheckOut}
                                onCheckIn={handleViewCheckIn}
                            />
                        )}
                    </div>
                )}

                {/* ── Management Mode (Resources / Bookings / Logs) ── */}
                {bookingVariant === 'management' && (<>

                {/* - Unified Nav Card - */}
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
                            {/* Row 1 � Main tabs */}
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
                            {/* Row 2 � Sub-filter pills + CTA, visually linked to active tab */}
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
                                                <button style={pillStyle(bookingSubTab === 'managed', meta.color)} onClick={() => switchBookingSubTab('managed')}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        Managed
                                                        {managedBookings.filter(b => b.status === BookingStatus.Pending).length > 0 && (
                                                            <span style={{
                                                                fontSize: '0.62rem', fontWeight: 800,
                                                                background: bookingSubTab === 'managed' ? '#fff' : '#f97316',
                                                                color: bookingSubTab === 'managed' ? '#f97316' : '#fff',
                                                                minWidth: '18px', height: '18px', borderRadius: '9px',
                                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                padding: '0 5px', lineHeight: 1
                                                            }}>
                                                                {managedBookings.filter(b => b.status === BookingStatus.Pending).length}
                                                            </span>
                                                        )}
                                                    </span>
                                                </button>
                                                {isLabDirector && (
                                                    <button style={pillStyle(bookingSubTab === 'all', meta.color)} onClick={() => switchBookingSubTab('all')}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><ClipboardList size={12} /> All Bookings</span>
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                                        {mainTab === 'resources' && !isResourceTypeTab && (
                                            <button onClick={() => handleCreateBooking()} style={{
                                                display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700,
                                                padding: '0 14px', height: '32px', borderRadius: '8px', fontSize: '0.8rem',
                                                background: '#8b5cf6', border: 'none',
                                                color: '#fff', cursor: 'pointer', boxShadow: '0 2px 6px #8b5cf655'
                                            }}><Plus size={14} /> New Booking</button>
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
                            { label: 'Total', value: activeTab === 'my_bookings' ? myBookingsTotalCount : bookingListForTab.length, color: '#8b5cf6', icon: <Clock size={13} /> },
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
                        <div style={{ minWidth: '140px' }}>
                            <AppSelect
                                size="sm"
                                value={filterType}
                                onChange={setFilterType}
                                options={[
                                    { value: '', label: 'All Types' },
                                    ...resourceTypes.map(rt => ({ value: rt.id, label: rt.name })),
                                ]}
                            />
                        </div>
                    )}
                    {isBookingTab && (
                        <div style={{ minWidth: '140px' }}>
                            <AppSelect
                                size="sm"
                                value={filterStatus}
                                onChange={setFilterStatus}
                                options={[
                                    { value: '', label: 'All Status' },
                                    { value: '1', label: 'Pending' },
                                    { value: '2', label: 'Approved' },
                                    { value: '3', label: 'Rejected' },
                                    { value: '4', label: 'Cancelled' },
                                    { value: '5', label: 'In Use' },
                                    { value: '6', label: 'Completed' },
                                ]}
                            />
                        </div>
                    )}
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        style={{ padding: '6px 12px', border: '1px solid #e2e8f0', background: 'white', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0 }}
                    >
                        <RotateCcw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        Refresh
                    </button>
                    </div>
                </div>
                {/* ── Breadcrumb when panel open ── */}
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

                {/* ── Main content ── */}
                <div style={{ display: 'flex', height: 'calc(100vh - 320px)', minHeight: '560px', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                    {/* Left: List */}
                    <div style={{
                        flex: activePanel ? 5 : 10,
                        display: 'flex', flexDirection: 'column',
                        transition: 'flex 0.35s cubic-bezier(0.4,0,0.2,1)',
                        overflow: 'hidden', minWidth: 0,
                        borderRight: activePanel ? '1px solid #f1f5f9' : 'none',
                    }}>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 12px 12px' }} className="custom-scrollbar">
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
                                <>
                                    {/* Bulk action bar — managed tab only */}
                                    {bookingSubTab === 'managed' && (() => {
                                        const pendingIds   = displayBookings.filter(b => b.status === BookingStatus.Pending).map(b => b.id);
                                        const approvedIds  = displayBookings.filter(b => b.status === BookingStatus.Approved).map(b => b.id);
                                        const inUseIds     = displayBookings.filter(b => b.status === BookingStatus.InUse).map(b => b.id);
                                        const selPending   = bulkSelectedIds.filter(id => pendingIds.includes(id));
                                        const selApproved  = bulkSelectedIds.filter(id => approvedIds.includes(id));
                                        const selInUse     = bulkSelectedIds.filter(id => inUseIds.includes(id));
                                        const anySelected  = bulkSelectedIds.length > 0;
                                        const isBusy       = bulkApproving || bulkChecking;
                                        return (
                                            <div style={{ ...(anySelected ? { position: 'sticky', top: 0, zIndex: 10, background: '#fff', padding: '8px 12px 10px', margin: '0 -12px 10px', borderBottom: '1.5px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' } : { marginBottom: '10px' }), display: 'flex', flexDirection: 'column', gap: '6px' }}>

                                                {/* Status pills — always visible, click to toggle-select all of that status */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' as const }}>
                                                    {pendingIds.length > 0 && (
                                                        <button
                                                            onClick={() => setBulkSelectedIds(prev => selPending.length === pendingIds.length ? prev.filter(id => !pendingIds.includes(id)) : [...new Set([...prev, ...pendingIds])])}
                                                            style={{ fontSize: '0.68rem', fontWeight: 700, color: '#d97706', background: selPending.length > 0 ? '#fef3c7' : '#fff', border: '1px solid #fde68a', borderRadius: '6px', cursor: 'pointer', padding: '2px 9px' }}>
                                                            Pending ({selPending.length}/{pendingIds.length})
                                                        </button>
                                                    )}
                                                    {approvedIds.length > 0 && (
                                                        <button
                                                            onClick={() => setBulkSelectedIds(prev => selApproved.length === approvedIds.length ? prev.filter(id => !approvedIds.includes(id)) : [...new Set([...prev, ...approvedIds])])}
                                                            style={{ fontSize: '0.68rem', fontWeight: 700, color: '#059669', background: selApproved.length > 0 ? '#dcfce7' : '#fff', border: '1px solid #a7f3d0', borderRadius: '6px', cursor: 'pointer', padding: '2px 9px' }}>
                                                            Approved ({selApproved.length}/{approvedIds.length})
                                                        </button>
                                                    )}
                                                    {inUseIds.length > 0 && (
                                                        <button
                                                            onClick={() => setBulkSelectedIds(prev => selInUse.length === inUseIds.length ? prev.filter(id => !inUseIds.includes(id)) : [...new Set([...prev, ...inUseIds])])}
                                                            style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7c3aed', background: selInUse.length > 0 ? '#ede9fe' : '#fff', border: '1px solid #e9d5ff', borderRadius: '6px', cursor: 'pointer', padding: '2px 9px' }}>
                                                            In Use ({selInUse.length}/{inUseIds.length})
                                                        </button>
                                                    )}
                                                    {anySelected && (
                                                        <button onClick={() => { setBulkSelectedIds([]); setBulkCheckInNote(''); setBulkCheckOutNote(''); }}
                                                            style={{ fontSize: '0.68rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                                                            Clear all
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Approve row */}
                                                {selPending.length > 0 && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: '#fff', borderRadius: '9px', border: '1px solid #e0e7ff' }}>
                                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4f46e5', flexShrink: 0 }}>Approve</span>
                                                        <div style={{ flex: 1 }} />
                                                        <button onClick={() => setShowBulkModal(true)} disabled={isBusy}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 14px', borderRadius: '6px', border: 'none', background: isBusy ? '#94a3b8' : '#4f46e5', color: '#fff', fontSize: '0.72rem', fontWeight: 700, cursor: isBusy ? 'not-allowed' : 'pointer' }}>
                                                            {bulkApproving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                                                            Approve {selPending.length}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Check-out row (Approved → give resource to user) */}
                                                {selApproved.length > 0 && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', flexShrink: 0, width: '64px' }}>Check Out</span>
                                                        <input
                                                            value={bulkCheckInNote}
                                                            onChange={e => setBulkCheckInNote(e.target.value)}
                                                            placeholder="Note (optional)..."
                                                            style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', border: '1.5px solid #bfdbfe', fontSize: '0.78rem', outline: 'none', background: '#eff6ff', height: '34px', boxSizing: 'border-box' as const }}
                                                        />
                                                        <button onClick={handleBulkCheckIn} disabled={isBusy}
                                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', width: '128px', borderRadius: '7px', border: 'none', background: isBusy ? '#94a3b8' : '#2563eb', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: isBusy ? 'not-allowed' : 'pointer', flexShrink: 0, height: '34px' }}>
                                                            {bulkChecking ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} style={{ transform: 'scaleX(-1)' }} />}
                                                            Check Out {selApproved.length}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Check-in row (InUse → user returns resource) */}
                                                {selInUse.length > 0 && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', flexShrink: 0, width: '64px' }}>Check In</span>
                                                        <input
                                                            value={bulkCheckOutNote}
                                                            onChange={e => setBulkCheckOutNote(e.target.value)}
                                                            placeholder="Note (optional)..."
                                                            style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', border: '1.5px solid #a7f3d0', fontSize: '0.78rem', outline: 'none', background: '#f0fdf4', height: '34px', boxSizing: 'border-box' as const }}
                                                        />
                                                        <button onClick={handleBulkCheckOut} disabled={isBusy}
                                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', width: '128px', borderRadius: '7px', border: 'none', background: isBusy ? '#94a3b8' : '#059669', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: isBusy ? 'not-allowed' : 'pointer', flexShrink: 0, height: '34px' }}>
                                                            {bulkChecking ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={12} />}
                                                            Check In {selInUse.length}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    <BookingListView
                                        bookings={displayBookings}
                                        selectedId={activePanel?.type === 'view_booking' ? activePanel.targetId ?? null : null}
                                        onSelect={handleViewBooking}
                                        selectable={bookingSubTab === 'managed'}
                                        selectedIds={bulkSelectedIds}
                                        onToggleSelect={toggleBulkSelect}
                                        onQuickApprove={bookingSubTab === 'managed' ? handleQuickApprove : undefined}
                                        onQuickReject={bookingSubTab === 'managed' ? handleQuickReject : undefined}
                                        onLoadDetail={bookingService.getById}
                                    />
                                    {/* Pagination controls for My Bookings */}
                                    {bookingSubTab === 'my' && myBookingsTotalCount > myBookingsPageSize && (() => {
                                        const totalPages = Math.ceil(myBookingsTotalCount / myBookingsPageSize);
                                        return (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 0 4px', borderTop: '1px solid #f1f5f9', marginTop: '8px' }}>
                                                <button
                                                    disabled={myBookingsPage <= 1}
                                                    onClick={() => setMyBookingsPage(p => Math.max(1, p - 1))}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: '1px solid #e2e8f0', background: myBookingsPage <= 1 ? '#f8fafc' : '#fff', color: myBookingsPage <= 1 ? '#cbd5e1' : '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: myBookingsPage <= 1 ? 'not-allowed' : 'pointer' }}
                                                >
                                                    <ChevronLeft size={13} /> Prev
                                                </button>
                                                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                                                    Page {myBookingsPage} / {totalPages}
                                                </span>
                                                <button
                                                    disabled={myBookingsPage >= totalPages}
                                                    onClick={() => setMyBookingsPage(p => Math.min(totalPages, p + 1))}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: '1px solid #e2e8f0', background: myBookingsPage >= totalPages ? '#f8fafc' : '#fff', color: myBookingsPage >= totalPages ? '#cbd5e1' : '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: myBookingsPage >= totalPages ? 'not-allowed' : 'pointer' }}
                                                >
                                                    Next <ChevronRight size={13} />
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </>
                            ) : isLogTab ? (
                                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                    {displayLogs.length === 0 ? (
                                        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                                            <ScrollText size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                                            <div>No equipment log entries found.</div>
                                        </div>
                                    ) : displayLogs.map((log, idx) => {
                                        const action = getLogActionConfig(log.action);
                                        const logBooking = log.bookingId
                                            ? [...myBookings, ...allBookings, ...managedBookings].find(b => b.id === log.bookingId || b.bookingId === log.bookingId)
                                            : undefined;
                                        const cardHoursLate = (log.action === EquipmentLogAction.CheckOut && logBooking?.endTime)
                                            ? Math.floor((Date.now() - new Date(logBooking.endTime).getTime()) / 3_600_000)
                                            : 0;
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
                                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                        <span style={{ fontWeight: 700, color: '#2563eb' }}>Borrower:</span> {log.borrowerFullName || log.userFullName || log.userName}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>{formatDate(log.loggedAt)}</div>
                                                    {cardHoursLate > 0 && (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '5px', padding: '2px 6px', fontSize: '0.65rem', fontWeight: 800, color: '#dc2626' }}>
                                                            ⚠ LATE: {cardHoursLate}h
                                                        </div>
                                                    )}
                                                </div>
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
                            flex: 5, transition: 'flex 0.35s cubic-bezier(0.4,0,0.2,1)',
                            overflow: 'auto', display: 'flex', flexDirection: 'column',
                            background: '#fff', padding: '1.5rem',
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
                                    onTitleChange={handleTitleChange}
                                    cartItems={bookingCart} onCartChange={setBookingCart}
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
                                const relatedBooking = log.bookingId
                                    ? [...myBookings, ...allBookings, ...managedBookings].find(b => b.id === log.bookingId || b.bookingId === log.bookingId)
                                    : undefined;
                                const hoursLate = (log.action === EquipmentLogAction.CheckOut && relatedBooking?.endTime)
                                    ? Math.floor((Date.now() - new Date(relatedBooking.endTime).getTime()) / 3_600_000)
                                    : 0;
                                const cardStyle: React.CSSProperties = { background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '14px 16px', marginBottom: '10px' };
                                const labelSt: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '4px' };
                                const valueSt: React.CSSProperties = { fontSize: '0.88rem', fontWeight: 600, color: '#1e293b', wordBreak: 'break-word' };
                                const subValueSt: React.CSSProperties = { fontSize: '0.78rem', color: '#64748b', marginTop: '3px', wordBreak: 'break-word' };
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }} className="custom-scrollbar">
                                        {/* Header */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color, flexShrink: 0, border: `1px solid ${action.color}22` }}>
                                                    {action.icon}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>Activity Log</div>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, color: action.color, background: action.bg, border: `1px solid ${action.color}33`, padding: '2px 10px', borderRadius: '20px', marginTop: '2px' }}>
                                                        {action.icon} {action.label}
                                                    </span>
                                                </div>
                                            </div>
                                            <button onClick={handleClosePanel} style={{ width: '30px', height: '30px', border: 'none', background: '#f1f5f9', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><X size={16} /></button>
                                        </div>

                                        {/* Date */}
                                        <div style={cardStyle}>
                                            <div style={labelSt}>Logged At</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <div style={{ ...valueSt, color: '#2563eb' }}>{formatDate(log.loggedAt)}</div>
                                                {hoursLate > 0 && (
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 800, color: '#dc2626', letterSpacing: '0.4px' }}>
                                                        ⚠ LATE: {hoursLate}h
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Borrower */}
                                        <div style={cardStyle}>
                                            <div style={labelSt}>Borrower</div>
                                            <div style={valueSt}>{log.borrowerFullName || log.userFullName || log.userName}</div>
                                            {(log.borrowerEmail || log.userEmail) && <div style={subValueSt}>{log.borrowerEmail || log.userEmail}</div>}
                                        </div>

                                        {/* Handler */}
                                        <div style={cardStyle}>
                                            <div style={labelSt}>Handled By</div>
                                            {log.borrowerId && log.checkedOutById && log.borrowerId === log.checkedOutById ? (
                                                <div style={{ ...valueSt, color: '#94a3b8', fontStyle: 'italic' }}>(Self-handled)</div>
                                            ) : (
                                                <>
                                                    <div style={valueSt}>{log.checkedOutByFullName || log.userFullName || log.userName}</div>
                                                    {log.checkedOutByEmail && <div style={subValueSt}>{log.checkedOutByEmail}</div>}
                                                </>
                                            )}
                                        </div>

                                        {/* Resource */}
                                        <div style={cardStyle}>
                                            <div style={labelSt}>Resource</div>
                                            <div style={valueSt}>{log.resourceTitle || log.resourceName}</div>
                                            {log.resourceDescription && <div style={subValueSt}>{log.resourceDescription}</div>}
                                        </div>

                                        {/* Booking */}
                                        {(log.bookingTitle || log.bookingId) && (
                                            <div style={cardStyle}>
                                                <div style={labelSt}>Booking</div>
                                                <div style={valueSt}>{log.bookingTitle || log.bookingId}</div>
                                                {log.bookingDescription && log.bookingDescription !== log.bookingTitle && (
                                                    <div style={subValueSt}>{log.bookingDescription}</div>
                                                )}
                                            </div>
                                        )}

                                        {/* Note */}
                                        {log.note && (
                                            <div style={{ ...cardStyle, background: '#fffbeb', border: '1px solid #fde68a' }}>
                                                <div style={{ ...labelSt, color: '#d97706' }}>Note</div>
                                                <div style={{ ...valueSt, color: '#92400e' }}>{log.note}</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>

            {/* Bulk Approve Confirmation Modal */}
            {showBulkModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
                }} onClick={e => { if (e.target === e.currentTarget) { setShowBulkModal(false); } }}>
                    <div style={{
                        background: '#fff', borderRadius: '16px',
                        boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
                        width: '100%', maxWidth: '440px', overflow: 'hidden'
                    }}>
                        {/* Modal Header */}
                        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                                    <CheckCircle2 size={18} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                                        Bulk Approve Bookings
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                                        Approving {bulkSelectedIds.length} selected booking{bulkSelectedIds.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '20px 24px' }}>
                            {/* Summary chips */}
                            <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                                {bulkSelectedIds.slice(0, 5).map(id => {
                                    const booking = managedBookings.find(b => b.id === id);
                                    return (
                                        <span key={id} style={{
                                            fontSize: '0.72rem', fontWeight: 600,
                                            background: '#f0fdf4', color: '#065f46',
                                            border: '1px solid #bbf7d0',
                                            padding: '3px 10px', borderRadius: '20px',
                                            maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const
                                        }}>{booking?.title || id.slice(0, 8) + '…'}</span>
                                    );
                                })}
                                {bulkSelectedIds.length > 5 && (
                                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', padding: '3px 10px' }}>
                                        +{bulkSelectedIds.length - 5} more
                                    </span>
                                )}
                            </div>

                            {/* Note */}
                            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
                                Approval Note (optional)
                            </label>
                            <textarea
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                                    border: '1.5px solid #e2e8f0', fontSize: '0.85rem',
                                    fontFamily: 'inherit', outline: 'none',
                                    minHeight: '80px', resize: 'vertical' as const,
                                    background: '#f8fafc', boxSizing: 'border-box' as const
                                }}
                                value={bulkApproveNote}
                                onChange={e => setBulkApproveNote(e.target.value)}
                                placeholder="Optional note to include with all approvals..."
                                onFocus={e => { e.currentTarget.style.borderColor = '#059669'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                            />
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                onClick={() => { setShowBulkModal(false); setBulkApproveNote(''); }}
                                style={{ padding: '8px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkApprove}
                                disabled={bulkApproving}
                                style={{
                                    padding: '8px 24px', borderRadius: '10px', border: 'none',
                                    background: bulkApproving ? '#94a3b8' : '#059669',
                                    color: '#fff', cursor: bulkApproving ? 'not-allowed' : 'pointer',
                                    fontSize: '0.82rem', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                {bulkApproving
                                    ? <><Loader2 size={14} className="animate-spin" /> Approving…</>
                                    : <><CheckCircle2 size={14} /> Confirm Approve All</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmModal
                isOpen={confirmDeleteRtId !== null}
                onClose={() => setConfirmDeleteRtId(null)}
                onConfirm={handleConfirmDeleteResourceType}
                title="Delete Resource Type"
                message="Are you sure you want to delete this resource type? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
            />

                </>)} {/* end management mode */}
            </div>
        </MainLayout>
    );
};

export default ResourceBooking;
