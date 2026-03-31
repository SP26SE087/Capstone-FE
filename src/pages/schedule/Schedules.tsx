import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import {
    Search,
    Calendar,
    Plus,
    Loader2,
    X,
    Edit3,
    ChevronRight,
    Clock,
    Filter,
    Target,
    Briefcase,
    Video,
    List,
    LayoutGrid,
    AlertTriangle,
    CheckCircle2,
    Users,
    UserCheck
} from 'lucide-react';
import meetingService from '@/services/meetingService';
import { MeetingResponse, MeetingStatus } from '@/types/meeting';
import { projectService, userService } from '@/services';
import Toast, { ToastType } from '@/components/common/Toast';

import ScheduleList from './components/ScheduleList';
import SchedulePanel from './components/SchedulePanel';
import WeeklyTimetable, { TimetableEvent } from '@/components/common/WeeklyTimetable';

type ListTabType = 'my_meetings' | 'my_invited_meetings';

interface ScheduleTab {
    id: string;
    type: 'create' | 'view';
    meetingId?: string;
    title: string;
}

const Schedules: React.FC = () => {
    const { user } = useAuth();

    // Data
    const [activeListTab, setActiveListTab] = useState<ListTabType>('my_meetings');
    const [meetings, setMeetings] = useState<MeetingResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterProjectId, setFilterProjectId] = useState<string>('');
    const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'timetable'>('list');

    // Tab system
    const [openTabs, setOpenTabs] = useState<ScheduleTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
    const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
    const createDropdownRef = React.useRef<HTMLDivElement>(null);
    const viewDropdownRef = React.useRef<HTMLDivElement>(null);

    const activeTabObj = openTabs.find(t => t.id === activeTabId);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
                setIsCreateDropdownOpen(false);
            }
            if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
                setIsViewDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch metadata
    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [pData, uData] = await Promise.all([
                    projectService.getAll(),
                    userService.getAll()
                ]);
                const pMap: Record<string, string> = {};
                pData.forEach((p: any) => pMap[p.projectId] = p.projectName || p.name || 'Untitled Project');
                setProjectsMap(pMap);

                const uMap: Record<string, string> = {};
                uData.forEach((u: any) => uMap[u.userId || u.id] = u.fullName);
                setUsersMap(uMap);
            } catch (e) {
                console.error('Failed to load metadata', e);
            }
        };
        fetchMetadata();
    }, []);

    // Fetch meetings
    useEffect(() => {
        fetchMeetings();
    }, [activeListTab]);

    const fetchMeetings = async () => {
        setLoading(true);
        try {
            // Both tabs use Meetings/me; My Invited Meetings will use its own API when available
            const data = await meetingService.getMyMeetings();
            setMeetings(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch meetings:', error);
            setMeetings([]);
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: ToastType = 'info') => {
        setToast({ message, type });
    };

    // Tab handlers
    const handleAddCreateTab = () => {
        const createTabs = openTabs.filter(t => t.type === 'create');
        if (createTabs.length >= 3) {
            alert("Maximum 3 'Create' tabs allowed.");
            return;
        }
        if (openTabs.length >= 6) {
            alert("Maximum 6 total tabs allowed.");
            return;
        }
        const newId = `create-${Date.now()}`;
        const newTab: ScheduleTab = { id: newId, type: 'create', title: 'New Schedule' };
        setOpenTabs([...openTabs, newTab]);
        setActiveTabId(newId);
    };

    const handleOpenViewTab = (meeting: MeetingResponse) => {
        const eventId = meeting.googleCalendarEventId || meeting.id;
        const existing = openTabs.find(t => t.meetingId === eventId);
        if (existing) {
            setActiveTabId(existing.id);
            return;
        }
        const viewTabs = openTabs.filter(t => t.type === 'view');
        if (viewTabs.length >= 3) {
            alert("Maximum 3 'View' tabs allowed. Close some first.");
            return;
        }
        if (openTabs.length >= 6) {
            alert("Maximum 6 total tabs allowed.");
            return;
        }
        const newId = `view-${eventId}`;
        const newTab: ScheduleTab = { id: newId, type: 'view', meetingId: eventId, title: meeting.title || 'Schedule' };
        setOpenTabs([...openTabs, newTab]);
        setActiveTabId(newId);
    };

    const handleCloseTab = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const newTabs = openTabs.filter(t => t.id !== id);
        setOpenTabs(newTabs);
        if (activeTabId === id) {
            setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
        }
    };

    const handleTitleChange = (id: string, newTitle: string) => {
        setOpenTabs(prev => prev.map(t => t.id === id ? { ...t, title: newTitle } : t));
    };

    // Filtered meetings
    const displayMeetings = useMemo(() => {
        return meetings.filter(m => {
            const query = searchQuery.toLowerCase();
            const matchesQuery = !query ||
                (m.title?.toLowerCase().includes(query)) ||
                (m.description?.toLowerCase().includes(query));
            const matchesStatus = filterStatus === '' || m.status === Number(filterStatus);
            const matchesProject = !filterProjectId || m.projectId === filterProjectId;
            return matchesQuery && matchesStatus && matchesProject;
        }).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }, [meetings, searchQuery, filterStatus, filterProjectId]);

    // Stats
    const scheduledCount = meetings.filter(m => m.status === MeetingStatus.Scheduled).length;
    const completedCount = meetings.filter(m => m.status === MeetingStatus.Completed).length;
    const inProgressCount = meetings.filter(m => m.status === MeetingStatus.InProgress).length;
    const cancelledCount = meetings.filter(m => m.status === MeetingStatus.Cancelled).length;

    // Timetable events
    const timetableEvents: TimetableEvent[] = useMemo(() => {
        return meetings.map(m => ({
            id: m.googleCalendarEventId || m.id,
            title: m.title || 'Untitled',
            startTime: m.startTime,
            endTime: m.endTime,
            meetLink: m.googleMeetLink,
            presenter: m.currentPresenter?.name || m.currentPresenter?.email || null,
            creator: usersMap[m.createdBy] || m.createdBy,
            description: m.description,
            guests: m.attendees?.map(a => a.displayName || a.email).filter(Boolean) || [],
            type: 'meeting' as const
        }));
    }, [meetings, usersMap]);

    return (
        <MainLayout role={user?.role} userName={user?.name}>
            <div className="page-container" style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                background: 'var(--primary-color)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 8px 16px rgba(30, 41, 59, 0.15)'
                            }}>
                                <Calendar size={24} />
                            </div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>Schedules</h1>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>
                            Manage meetings, video calls, and team schedules with Google Meet integration.
                        </p>
                    </div>
                </div>

                {/* View Toggle */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem' }}>
                    <button
                        onClick={() => setViewMode('list')}
                        style={{
                            padding: '8px 16px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                            border: viewMode === 'list' ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                            background: viewMode === 'list' ? 'var(--accent-bg)' : '#fff',
                            color: viewMode === 'list' ? 'var(--accent-color)' : 'var(--text-secondary)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                        }}
                    >
                        <List size={16} /> List View
                    </button>
                    <button
                        onClick={() => setViewMode('timetable')}
                        style={{
                            padding: '8px 16px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                            border: viewMode === 'timetable' ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                            background: viewMode === 'timetable' ? 'var(--accent-bg)' : '#fff',
                            color: viewMode === 'timetable' ? 'var(--accent-color)' : 'var(--text-secondary)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                        }}
                    >
                        <LayoutGrid size={16} /> Timetable
                    </button>
                </div>

                {/* UNIFIED STATUS BOARD */}
                <div style={{
                    background: 'white', padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0',
                    display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1.5rem', alignItems: 'start',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginBottom: '1.5rem', position: 'relative'
                }}>
                    {/* LEFT COLUMN: CRITICAL ALERTS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Action Required
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', opacity: cancelledCount > 0 ? 1 : 0.45, transition: 'all 0.2s' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <AlertTriangle size={14} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', flex: 1 }}>Cancelled Meetings:</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: cancelledCount > 0 ? '#1e293b' : '#94a3b8' }}>{cancelledCount}</span>
                        </div>
                    </div>

                    {/* DIVIDER */}
                    <div style={{ width: '1px', alignSelf: 'stretch', background: '#f1f5f9' }}></div>

                    {/* RIGHT COLUMN: PROGRESS INDICATORS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Meeting Metrics
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', opacity: scheduledCount > 0 ? 1 : 0.45, transition: 'all 0.2s' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Clock size={14} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', flex: 1 }}>Scheduled:</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: scheduledCount > 0 ? '#1e293b' : '#94a3b8' }}>{scheduledCount}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', opacity: inProgressCount > 0 ? 1 : 0.45, transition: 'all 0.2s' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#f59e0b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Video size={14} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', flex: 1 }}>In Progress:</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: inProgressCount > 0 ? '#1e293b' : '#94a3b8' }}>{inProgressCount}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', opacity: completedCount > 0 ? 1 : 0.45, transition: 'all 0.2s' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <CheckCircle2 size={14} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', flex: 1 }}>Completed:</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: completedCount > 0 ? '#1e293b' : '#94a3b8' }}>{completedCount}</span>
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '14px',
                    background: '#fff',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)',
                    marginBottom: '1.5rem'
                }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search schedules..."
                                className="form-input"
                                style={{ paddingLeft: '40px', height: '42px', border: 'none', background: 'var(--surface-hover)', borderRadius: '10px', fontSize: '0.88rem' }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '20px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Filter size={14} color="var(--text-muted)" />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Status:</span>
                            <select
                                style={{ height: '32px', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-color)' }}
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                            >
                                <option value="">Any Status</option>
                                <option value="0">Scheduled</option>
                                <option value="1">In Progress</option>
                                <option value="2">Completed</option>
                                <option value="3">Cancelled</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Briefcase size={14} color="var(--text-muted)" />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Project:</span>
                            <select
                                style={{ height: '32px', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-color)' }}
                                value={filterProjectId}
                                onChange={e => setFilterProjectId(e.target.value)}
                            >
                                <option value="">All Projects</option>
                                {Object.entries(projectsMap).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* List Tabs + New Schedule Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1, borderBottom: '1px solid #e2e8f0', overflowX: 'auto', whiteSpace: 'nowrap' as const }} className="custom-scrollbar">
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {[
                                { id: 'my_meetings', label: 'My Meetings', icon: <Users size={16} /> },
                                { id: 'my_invited_meetings', label: 'My Invited Meetings', icon: <UserCheck size={16} /> },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveListTab(tab.id as ListTabType)}
                                    style={{
                                        padding: '12px 10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        color: activeListTab === tab.id ? 'var(--accent-color)' : '#64748b',
                                        borderBottom: activeListTab === tab.id ? '3px solid var(--accent-color)' : '3px solid transparent',
                                        fontWeight: activeListTab === tab.id ? 800 : 500,
                                        transition: 'all 0.2s',
                                        fontSize: '0.85rem',
                                        flex: '0 0 auto',
                                        minWidth: '140px',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={handleAddCreateTab}
                        className="btn btn-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 700,
                            padding: '10px 20px',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            boxShadow: '0 4px 12px rgba(232, 114, 12, 0.2)',
                            whiteSpace: 'nowrap' as const,
                            marginLeft: '1rem',
                            height: '42px',
                            marginBottom: '0px'
                        }}
                    >
                        <Plus size={18} /> New Schedule
                    </button>
                </div>

                {/* Main Content */}
                {viewMode === 'timetable' ? (
                    <div style={{ height: 'calc(100vh - 280px)', minHeight: '700px' }}>
                        <WeeklyTimetable
                            events={timetableEvents}
                            onEventClick={(evt) => {
                                const m = meetings.find(mm => (mm.googleCalendarEventId || mm.id) === evt.id);
                                if (m) handleOpenViewTab(m);
                            }}
                        />
                    </div>
                ) : (
                <div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 340px)', minHeight: '650px' }}>
                    {/* Left: List */}
                    <div style={{
                        flex: openTabs.length > 0 ? 4 : 10,
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        width: openTabs.length > 0 ? '40%' : '100%',
                        overflow: 'hidden'
                    }}>
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
                            {loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                                    <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-color)' }} />
                                </div>
                            ) : displayMeetings.length > 0 ? (
                                <ScheduleList
                                    meetings={displayMeetings}
                                    selectedId={activeTabObj?.meetingId || null}
                                    onSelect={handleOpenViewTab}
                                    projectsMap={projectsMap}
                                    usersMap={usersMap}
                                    isSplit={openTabs.length > 0}
                                />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                                    <Target size={48} style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>No Schedules</h3>
                                    <p style={{ fontSize: '0.85rem' }}>Create your first schedule to get started with team meetings.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Panel */}
                    <div style={{
                        flex: openTabs.length > 0 ? 6 : 0,
                        opacity: openTabs.length > 0 ? 1 : 0,
                        pointerEvents: openTabs.length > 0 ? 'auto' : 'none',
                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        width: openTabs.length > 0 ? '60%' : '0',
                        overflow: 'hidden',
                        display: openTabs.length > 0 ? 'flex' : 'none',
                        flexDirection: 'column',
                        background: '#fff',
                        borderRadius: '16px',
                        border: '1px solid var(--border-color)',
                        padding: '1rem'
                    }}>
                        {/* Tab Dropdowns */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                            {/* Create Dropdown */}
                            <div style={{ position: 'relative' }} ref={createDropdownRef}>
                                <button
                                    onClick={() => { setIsCreateDropdownOpen(!isCreateDropdownOpen); setIsViewDropdownOpen(false); }}
                                    style={{
                                        padding: '8px 16px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, border: '1px solid #e2e8f0',
                                        background: openTabs.some(t => t.id === activeTabId && t.type === 'create') ? 'var(--accent-color)' : '#fff',
                                        color: openTabs.some(t => t.id === activeTabId && t.type === 'create') ? '#fff' : '#64748b',
                                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    <Plus size={14} /> New ({openTabs.filter(t => t.type === 'create').length}/3)
                                    <ChevronRight size={14} style={{ transform: isCreateDropdownOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                </button>
                                {isCreateDropdownOpen && (
                                    <div style={{ position: 'absolute', top: '110%', left: 0, width: '240px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, padding: '8px' }}>
                                        {openTabs.filter(t => t.type === 'create').length === 0 ? (
                                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>No new schedules open.</div>
                                        ) : openTabs.filter(t => t.type === 'create').map(tab => (
                                            <div
                                                key={tab.id}
                                                onClick={() => { setActiveTabId(tab.id); setIsCreateDropdownOpen(false); }}
                                                style={{ padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: activeTabId === tab.id ? '#f1f5f9' : 'transparent', marginBottom: '2px' }}
                                            >
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: activeTabId === tab.id ? 'var(--accent-color)' : '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{tab.title}</div>
                                                <X size={14} onClick={(e) => handleCloseTab(tab.id, e)} style={{ color: '#94a3b8', cursor: 'pointer' }} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* View Dropdown */}
                            <div style={{ position: 'relative' }} ref={viewDropdownRef}>
                                <button
                                    onClick={() => { setIsViewDropdownOpen(!isViewDropdownOpen); setIsCreateDropdownOpen(false); }}
                                    style={{
                                        padding: '8px 16px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, border: '1px solid #e2e8f0',
                                        background: openTabs.some(t => t.id === activeTabId && t.type === 'view') ? 'var(--accent-color)' : '#fff',
                                        color: openTabs.some(t => t.id === activeTabId && t.type === 'view') ? '#fff' : '#64748b',
                                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    <Edit3 size={14} /> View/Edit ({openTabs.filter(t => t.type === 'view').length}/3)
                                    <ChevronRight size={14} style={{ transform: isViewDropdownOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                </button>
                                {isViewDropdownOpen && (
                                    <div style={{ position: 'absolute', top: '110%', left: 0, width: '240px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, padding: '8px' }}>
                                        {openTabs.filter(t => t.type === 'view').length === 0 ? (
                                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>No active schedules being viewed.</div>
                                        ) : openTabs.filter(t => t.type === 'view').map(tab => (
                                            <div
                                                key={tab.id}
                                                onClick={() => { setActiveTabId(tab.id); setIsViewDropdownOpen(false); }}
                                                style={{ padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: activeTabId === tab.id ? '#f1f5f9' : 'transparent', marginBottom: '2px' }}
                                            >
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: activeTabId === tab.id ? 'var(--accent-color)' : '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{tab.title}</div>
                                                <X size={14} onClick={(e) => handleCloseTab(tab.id, e)} style={{ color: '#94a3b8', cursor: 'pointer' }} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Panel Content */}
                        <div style={{ flex: 1, position: 'relative', overflowY: 'auto' }} className="custom-scrollbar">
                            {openTabs.map(tab => (
                                <div key={tab.id} style={{ display: activeTabId === tab.id ? 'block' : 'none', height: '100%' }}>
                                    <SchedulePanel
                                        meetingId={tab.type === 'view' ? tab.meetingId! : null}
                                        isCreating={tab.type === 'create'}
                                        onClose={() => handleCloseTab(tab.id)}
                                        onSaved={(shouldClose = false, message?: string, newEventId?: string) => {
                                            fetchMeetings();
                                            if (message) showToast(message, 'success');
                                            if (tab.type === 'create' && newEventId) {
                                                const updatedId = `view-${newEventId}`;
                                                setOpenTabs(prev => prev.map(t => t.id === tab.id ? {
                                                    ...t,
                                                    id: updatedId,
                                                    type: 'view' as const,
                                                    meetingId: newEventId,
                                                    title: t.title || 'Schedule Saved'
                                                } : t));
                                                setActiveTabId(updatedId);
                                            } else if (shouldClose) {
                                                handleCloseTab(tab.id);
                                            }
                                        }}
                                        onTitleChange={(title) => handleTitleChange(tab.id, title)}
                                        projectsMap={projectsMap}
                                        usersMap={usersMap}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                )}
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </MainLayout>
    );
};

export default Schedules;
