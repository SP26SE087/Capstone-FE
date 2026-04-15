import React, { useState, useEffect, useMemo } from 'react';
import AppSelect from '@/components/common/AppSelect';
import { useBlocker } from 'react-router-dom';
import { useTranscriptionStore } from '@/store/slices/transcriptionStore';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import {
    Search,
    Presentation,
    Loader2,
    Calendar,
    Plus,
    Clock,
    Filter,
    Target,
    ArrowLeftRight,
    List,
    LayoutGrid,
    AlertTriangle,
    CheckCircle2,
    FileText,
    Users
} from 'lucide-react';
import seminarService from '@/services/seminarService';
import { SeminarMeetingResponse } from '@/types/seminar';
import { projectService, userService } from '@/services';
import { useToastStore } from '@/store/slices/toastSlice';

import SeminarList from './components/SeminarList';
import SeminarPanel from './components/SeminarPanel';
import CreateSeminarForm from './components/CreateSeminarForm';
import SwapRequests from './components/SwapRequests';
import WeeklyTimetable, { TimetableEvent } from '@/components/common/WeeklyTimetable';
import TranscriptionPanel from '@/pages/schedule/components/TranscriptionPanel';

type TabType = 'my_seminars' | 'all_seminars' | 'invited_seminars' | 'swap_requests';

interface SeminarTab {
    id: string;
    type: 'create' | 'view';
    meetingId?: string;
    title: string;
    initialData?: SeminarMeetingResponse;
}

const Seminars: React.FC = () => {
    const { user } = useAuth();

    // Data
    const [activeTab, setActiveTab] = useState<TabType>('my_seminars');
    const [meetings, setMeetings] = useState<SeminarMeetingResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTimeframe, setFilterTimeframe] = useState<string>('');
    const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    const [emailsMap, setEmailsMap] = useState<Record<string, string>>({});
    const { addToast } = useToastStore();
    const [viewMode, setViewMode] = useState<'list' | 'timetable'>('list');
    const [filterSeason, setFilterSeason] = useState<string>('');

    // Panel system
    const [activePanel, setActivePanel] = useState<SeminarTab | null>(null);
    const [showTranscription, setShowTranscription] = useState(false);
    const [isTranscriptionProcessing, setIsTranscriptionProcessing] = useState(false);
    const [showConfirmSwitch, setShowConfirmSwitch] = useState(false);
    const [pendingTab, setPendingTab] = useState<TabType | null>(null);

    // Transcription store – persists panel state across route navigation
    const {
        transcription: storeTranscription,
        meetingId: storeMeetingId,
        meetingName: storeMeetingName,
        showPanel: storeShowPanel,
        source: storeSource,
        setPanelContext: storeSetPanelContext,
        setShowPanel: storeSetShowPanel,
        clear: storeClearTranscription,
    } = useTranscriptionStore();

    const hasCompletedTranscription = !!(storeTranscription?.transcribedText || storeTranscription?.status === 'Completed');

    // Route-navigation blocker: only warn AFTER transcription succeeds (not during processing).
    // During processing the user can freely navigate away; state is preserved in the store
    // and polling will resume when they return.
    const shouldBlockNav = showTranscription && hasCompletedTranscription && !isTranscriptionProcessing;
    const blocker = useBlocker(shouldBlockNav);

    // On mount: restore the transcription panel if it was open when user navigated away
    useEffect(() => {
        const s = useTranscriptionStore.getState();
        if (s.showPanel && s.source === 'seminar') {
            setShowTranscription(true);
        }
    }, []); // eslint-disable-line

    // ── Panel open/close helpers that also sync the store ──────────────────────
    const handleOpenAINote = () => {
        const next = !showTranscription;
        const mId = activePanel?.type === 'view' ? (activePanel.meetingId ?? null) : null;
        const mName = activePanel?.title ?? null;

        setShowTranscription(next);
        if (next) {
            storeSetPanelContext({ meetingId: mId, meetingName: mName, showPanel: true, source: 'seminar' });
        } else {
            storeSetShowPanel(false);
        }
    };

    const handleCloseTranscription = () => {
        setShowTranscription(false);
        storeClearTranscription();
    };

    const isLabDirector = React.useMemo(() => {
        if (!user) return false;
        const role = Number(user.role);
        return role === 1 || role === 2;
    }, [user?.role]);

    const handleTabSwitch = (tabId: TabType) => {
        if (isTranscriptionProcessing) {
            setPendingTab(tabId);
            setShowConfirmSwitch(true);
        } else {
            setActiveTab(tabId);
            setShowTranscription(false);
            storeSetShowPanel(false);
            setActivePanel(null);
        }
    };

    const handleConfirmTabSwitch = () => {
        if (pendingTab) {
            setActiveTab(pendingTab);
            setShowTranscription(false);
            storeSetShowPanel(false);
            setActivePanel(null);
            setPendingTab(null);
        }
        setShowConfirmSwitch(false);
    };

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
                const eMap: Record<string, string> = {};
                uData.forEach((u: any) => {
                    const id = u.userId || u.id;
                    uMap[id] = u.fullName;
                    if (u.email) eMap[id] = u.email;
                });
                setUsersMap(uMap);
                setEmailsMap(eMap);
            } catch (e) {
                console.error('Failed to load metadata', e);
            }
        };
        fetchMetadata();
    }, []);

    // Fetch seminars
    useEffect(() => {
        if (activeTab !== 'swap_requests') {
            fetchSeminars();
        }
    }, [activeTab]);

    const fetchSeminars = async () => {
        setLoading(true);
        try {
            let data;
            if (activeTab === 'all_seminars') {
                data = await seminarService.getAllSeminarMeetings();
            } else if (activeTab === 'invited_seminars') {
                data = await seminarService.getInvitedSeminarMeetings();
            } else {
                data = await seminarService.getMySeminarMeetings();
            }
            setMeetings(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch seminar meetings:', error);
            setMeetings([]);
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        addToast(message, type);
    };

    // Panel handlers
    const handleAddCreateTab = () => {
        const newId = `create-${Date.now()}`;
        setActivePanel({ id: newId, type: 'create', title: 'New Seminar' });
    };

    const handleOpenViewTab = (meeting: SeminarMeetingResponse) => {
        setActivePanel({
            id: `view-${meeting.seminarMeetingId}`,
            type: 'view',
            meetingId: meeting.seminarMeetingId,
            title: meeting.title || 'Seminar',
            initialData: meeting
        });
    };

    const handleClosePanel = () => {
        setActivePanel(null);
    };

    const handleTitleChange = (newTitle: string) => {
        if (activePanel && activePanel.title !== newTitle) {
            setActivePanel({ ...activePanel, title: newTitle });
        }
    };

    // Derive seasons from meetings (since there's no GET recurring API)
    const seasons = useMemo(() => {
        const map = new Map<string, string>();
        meetings.forEach(m => {
            if (m.seminarId && !map.has(m.seminarId)) {
                const baseTitle = m.title ? m.title.replace(/\s*-\s*Session\s*\d+.*$/i, '') : `Season ${map.size + 1}`;
                map.set(m.seminarId, baseTitle);
            }
        });
        return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
    }, [meetings]);

    // Filtered meetings
    const displayMeetings = useMemo(() => {
        return meetings.filter(m => {
            const query = searchQuery.toLowerCase();
            const matchesQuery = !query ||
                (m.title?.toLowerCase().includes(query)) ||
                (m.description?.toLowerCase().includes(query)) ||
                (m.location?.toLowerCase().includes(query));

            let matchesTimeframe = true;
            if (filterTimeframe === 'upcoming') {
                matchesTimeframe = new Date(m.meetingDate).getTime() > Date.now();
            } else if (filterTimeframe === 'past') {
                matchesTimeframe = new Date(m.meetingDate).getTime() < Date.now();
            }

            const matchesSeason = !filterSeason || m.seminarId === filterSeason;

            return matchesQuery && matchesTimeframe && matchesSeason;
        }).sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());
    }, [meetings, searchQuery, filterTimeframe, filterSeason]);

    const timetableEvents: TimetableEvent[] = useMemo(() => {
        return displayMeetings.map(m => {
            const startDayStr = m.meetingDate.split('T')[0];
            
            // Normalize time string to HH:mm:ss if it's just HH:mm or HH
            const normalizeTime = (t: string) => {
                if (!t) return '00:00:00';
                if (t.includes('T')) return t.split('T')[1];
                const parts = t.split(':');
                const h = (parts[0] || '0').padStart(2, '0');
                const min = (parts[1] || '0').padStart(2, '0');
                const sec = (parts[2] || '0').padStart(2, '0');
                return `${h}:${min}:${sec}`;
            };

            return {
                id: m.seminarMeetingId,
                title: m.title || 'Seminar',
                startTime: `${startDayStr}T${normalizeTime(m.startTime)}`,
                endTime: `${startDayStr}T${normalizeTime(m.endTime)}`,
                meetLink: m.meetingLink,
                presenter: usersMap[m.presenterId] || null,
                description: m.description,
                type: 'seminar' as const,
                color: '#8b5cf6'
            };
        });
    }, [displayMeetings, usersMap]);

    // Stats
    const upcomingCount = meetings.filter(m => new Date(m.meetingDate).getTime() > Date.now()).length;
    const pastCount = meetings.filter(m => new Date(m.meetingDate).getTime() <= Date.now()).length;
    const withSlidesCount = meetings.filter(m => m.slideUrl).length;

    return (
        <MainLayout role={user?.role} userName={user?.name}>
            <div className="page-container" style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)'
                            }}>
                                <Presentation size={24} />
                            </div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>Seminars</h1>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>
                            Manage recurring seminars, session schedules, and presenter rotations.
                        </p>
                    </div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', opacity: 1, transition: 'all 0.2s' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#f59e0b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <AlertTriangle size={14} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', flex: 1 }}>Missing Slides:</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>{upcomingCount - withSlidesCount < 0 ? 0 : upcomingCount - withSlidesCount}</span>
                        </div>
                    </div>

                    {/* DIVIDER */}
                    <div style={{ width: '1px', alignSelf: 'stretch', background: '#f1f5f9' }}></div>

                    {/* RIGHT COLUMN: PROGRESS INDICATORS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Seminar Metrics
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', opacity: upcomingCount > 0 ? 1 : 0.45, transition: 'all 0.2s' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Clock size={14} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', flex: 1 }}>Upcoming:</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: upcomingCount > 0 ? '#1e293b' : '#94a3b8' }}>{upcomingCount}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', opacity: pastCount > 0 ? 1 : 0.45, transition: 'all 0.2s' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <CheckCircle2 size={14} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', flex: 1 }}>Completed:</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: pastCount > 0 ? '#1e293b' : '#94a3b8' }}>{pastCount}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', opacity: withSlidesCount > 0 ? 1 : 0.45, transition: 'all 0.2s' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#8b5cf6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <FileText size={14} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', flex: 1 }}>With Slides:</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: withSlidesCount > 0 ? '#1e293b' : '#94a3b8' }}>{withSlidesCount}</span>
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
                                placeholder="Search seminars by title, description, or location..."
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
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Timeframe:</span>
                            <AppSelect
                                size="sm"
                                value={filterTimeframe}
                                onChange={setFilterTimeframe}
                                options={[
                                    { value: '', label: 'All' },
                                    { value: 'upcoming', label: 'Upcoming' },
                                    { value: 'past', label: 'Past' },
                                ]}
                            />
                        </div>
                        {activeTab !== 'swap_requests' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Presentation size={14} color="var(--text-muted)" />
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Season:</span>
                                <AppSelect
                                    size="sm"
                                    value={filterSeason}
                                    onChange={setFilterSeason}
                                    options={[
                                        { value: '', label: 'All Seasons' },
                                        ...seasons.map(s => ({ value: s.id, label: s.title })),
                                    ]}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* View Toggle */}
                {activeTab !== 'swap_requests' && (
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
                            onClick={() => { setViewMode('timetable'); setActivePanel(null); setShowTranscription(false); storeSetShowPanel(false); }}
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
                )}

                {/* Tabs */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1, borderBottom: '1px solid #e2e8f0', overflowX: 'auto', whiteSpace: 'nowrap' as const }} className="custom-scrollbar">
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {[
                                { id: 'my_seminars', label: 'My Seminars', icon: <Presentation size={16} /> },
                                { id: 'all_seminars', label: 'All Seminars', icon: <Calendar size={16} /> },
                                { id: 'invited_seminars', label: 'Invited', icon: <Users size={16} /> },
                                { id: 'swap_requests', label: 'Swap Requests', icon: <ArrowLeftRight size={16} /> }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabSwitch(tab.id as TabType)}
                                    style={{
                                        padding: '12px 10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        color: activeTab === tab.id ? 'var(--accent-color)' : '#64748b',
                                        borderBottom: activeTab === tab.id ? '3px solid var(--accent-color)' : '3px solid transparent',
                                        fontWeight: activeTab === tab.id ? 800 : 500,
                                        transition: 'all 0.2s',
                                        fontSize: '0.85rem',
                                        flex: '0 0 auto',
                                        minWidth: '120px',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {isLabDirector && activeTab !== 'swap_requests' && (
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
                            <Plus size={18} /> New Seminar Series
                        </button>
                    )}
                </div>

                {/* Main Content */}
                {viewMode === 'timetable' ? (
                    <div style={{ height: 'calc(100vh - 280px)', minHeight: '700px' }}>
                        <WeeklyTimetable
                            events={timetableEvents}
                            onEventClick={(evt) => {
                                const m = meetings.find(mm => mm.seminarMeetingId === evt.id);
                                if (m) handleOpenViewTab(m);
                            }}
                        />
                    </div>
                ) : (
                <div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 340px)', minHeight: '650px' }}>
                    {/* Left: List or Swap Requests — hidden when transcription is open */}
                    {!showTranscription && (
                    <div style={{
                        flex: activePanel ? 4 : 10,
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        minWidth: 0,
                        overflow: 'hidden'
                    }}>
                        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
                            {activeTab === 'swap_requests' ? (
                                <SwapRequests
                                    usersMap={usersMap}
                                    emailsMap={emailsMap}
                                    onActionComplete={() => {
                                        showToast('Swap request updated.', 'success');
                                        fetchSeminars();
                                    }}
                                />
                            ) : loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                                    <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-color)' }} />
                                </div>
                            ) : displayMeetings.length > 0 ? (
                                <SeminarList
                                    meetings={displayMeetings}
                                    selectedId={activePanel?.meetingId || null}
                                    onSelect={handleOpenViewTab}
                                    usersMap={usersMap}
                                />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                                    <Target size={48} style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>No Seminars</h3>
                                    <p style={{ fontSize: '0.85rem' }}>
                                        {activeTab === 'my_seminars'
                                            ? 'You have no upcoming or past seminar sessions.'
                                            : 'No seminar sessions found.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    )}

                    {/* Right: Panel — hidden when AI Notes is open */}
                    {activePanel && !showTranscription && (
                        <div style={{
                            flex: 6,
                            opacity: 1,
                            pointerEvents: 'auto',
                            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            background: '#fff',
                            borderRadius: '16px',
                            border: '1px solid var(--border-color)',
                            padding: '1.5rem'
                        }}>
                            {activePanel.type === 'create' ? (
                                <CreateSeminarForm
                                    onClose={handleClosePanel}
                                    onSaved={(shouldClose = false, message?: string) => {
                                        fetchSeminars();
                                        if (message) showToast(message, 'success');
                                        if (shouldClose) handleClosePanel();
                                    }}
                                    onTitleChange={handleTitleChange}
                                    projectsMap={projectsMap}
                                />
                            ) : (
                                <SeminarPanel
                                    key={activePanel.meetingId || activePanel.id}
                                    meetingId={activePanel.type === 'view' ? activePanel.meetingId! : null}
                                    initialData={activePanel.initialData}
                                    isCreating={false}
                                    onClose={() => { handleClosePanel(); handleCloseTranscription(); }}
                                    onSaved={(shouldClose = false, message?: string) => {
                                        fetchSeminars();
                                        if (message) showToast(message, 'success');
                                        if (shouldClose) handleClosePanel();
                                    }}
                                    onTitleChange={handleTitleChange}
                                    projectsMap={projectsMap}
                                    usersMap={usersMap}
                                    emailsMap={emailsMap}
                                    onToggleAINote={handleOpenAINote}
                                    showAINote={showTranscription}
                                />
                            )}
                        </div>
                    )}

                    {/* AI Notes / Transcription panel — takes full width */}
                    {showTranscription && (
                        <div style={{
                            flex: 10, minWidth: 0, overflow: 'hidden',
                            display: 'flex', flexDirection: 'column',
                            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}>
                            <TranscriptionPanel
                                onClose={handleCloseTranscription}
                                meetingId={
                                    activePanel?.type === 'view'
                                        ? activePanel.meetingId
                                        : (storeShowPanel && storeSource === 'seminar' ? (storeMeetingId ?? undefined) : undefined)
                                }
                                meetingName={
                                    activePanel?.title
                                    ?? (storeShowPanel && storeSource === 'seminar' ? (storeMeetingName ?? undefined) : undefined)
                                }
                                onProcessingChange={setIsTranscriptionProcessing}
                            />
                        </div>
                    )}
                </div>
                )}
            </div>


            {/* Custom Confirmation Modal */}
            {showConfirmSwitch && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10000, animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: '#fff', borderRadius: '24px', padding: '32px',
                        width: '90%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                        textAlign: 'center', animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '20px',
                            background: '#fff7ed', color: '#f97316',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px auto', border: '1px solid #ffedd5'
                        }}>
                            <AlertTriangle size={32} />
                        </div>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', fontWeight: 900, color: '#1e293b' }}>
                            Process in Progress
                        </h3>
                        <p style={{ margin: '0 0 28px 0', fontSize: '1rem', color: '#64748b', lineHeight: '1.6' }}>
                            AI is currently working on your task. Switching tabs now will stop the process and you might lose the results.
                        </p>
                        <div style={{ display: 'flex', gap: '14px' }}>
                            <button
                                onClick={() => setShowConfirmSwitch(false)}
                                style={{
                                    flex: 1, padding: '14px', borderRadius: '14px', border: '2px solid #f1f5f9',
                                    background: '#fff', color: '#64748b', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                            >
                                Stay Here
                            </button>
                            <button
                                onClick={handleConfirmTabSwitch}
                                style={{
                                    flex: 1, padding: '14px', borderRadius: '14px', border: 'none',
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontWeight: 800, fontSize: '0.9rem',
                                    cursor: 'pointer', boxShadow: '0 8px 16px rgba(239,68,68,0.25)',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                Yes, Switch
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Route Navigation Blocker Modal — only fires after transcription completes */}
            {blocker.state === 'blocked' && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10000, animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: '#fff', borderRadius: '24px', padding: '32px',
                        width: '90%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                        textAlign: 'center', animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '20px',
                            background: '#fef2f2', color: '#ef4444',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px auto',
                            border: '1px solid #fee2e2'
                        }}>
                            <AlertTriangle size={32} />
                        </div>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', fontWeight: 900, color: '#1e293b' }}>
                            Leave Transcription Session?
                        </h3>
                        <p style={{ margin: '0 0 28px 0', fontSize: '1rem', color: '#64748b', lineHeight: '1.6' }}>
                            You have a completed transcription session. If you navigate away, the current summary and suggested tasks will no longer be accessible.
                        </p>
                        <div style={{ display: 'flex', gap: '14px' }}>
                            <button
                                onClick={() => blocker.reset?.()}
                                style={{
                                    flex: 1, padding: '14px', borderRadius: '14px', border: '2px solid #f1f5f9',
                                    background: '#fff', color: '#64748b', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                            >
                                Stay Here
                            </button>
                            <button
                                onClick={() => {
                                    storeClearTranscription();
                                    blocker.proceed?.();
                                }}
                                style={{
                                    flex: 1, padding: '14px', borderRadius: '14px', border: 'none',
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontWeight: 800, fontSize: '0.9rem',
                                    cursor: 'pointer', boxShadow: '0 8px 16px rgba(239,68,68,0.25)',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                Leave & Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </MainLayout>
    );
};

export default Seminars;
