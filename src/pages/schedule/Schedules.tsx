import React, { useState, useEffect, useMemo, useRef } from 'react';
import AppSelect from '@/components/common/AppSelect';
import { useBlocker } from 'react-router-dom';
import { useTranscriptionStore } from '@/store/slices/transcriptionStore';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import {
    Search,
    Calendar,
    Plus,
    Loader2,
    Clock,
    Target,
    Briefcase,
    Video,
    List,
    LayoutGrid,
    AlertTriangle,
    CheckCircle2,
    Users,
    UserCheck,
    ChevronRight,
    Sparkles,
    Zap,
    X,
    RotateCcw,
} from 'lucide-react';
import meetingService from '@/services/meetingService';
import seminarService from '@/services/seminarService';
import { transcriptionService } from '@/services/transcriptionService';
import { MeetingResponse, MeetingStatus } from '@/types/meeting';
import { SeminarMeetingResponse } from '@/types/seminar';
import { projectService, userService } from '@/services';
import { useToastStore } from '@/store/slices/toastSlice';

import ScheduleList from './components/ScheduleList';
import SchedulePanel from './components/SchedulePanel';
import TranscriptionPanel from './components/TranscriptionPanel';
import WeeklyTimetable, { TimetableEvent } from '@/components/common/WeeklyTimetable';

type ListTabType = 'my_meetings' | 'my_invited_meetings';

interface ScheduleTab {
    id: string;
    type: 'create' | 'view';
    meetingId?: string;
    actualMeetingId?: string;
    seminarMeetingId?: string;
    title: string;
    initialData?: MeetingResponse;
}

const hasTranscriptionSummaryHint = (item: any): boolean => {
    const summaryText = typeof item?.summary === 'string' ? item.summary.trim() : '';
    return Boolean(
        summaryText ||
        item?.hasSummary === true ||
        item?.isSummarized === true ||
        item?.summarizedAt
    );
};

const checkMeetingHasAiSummary = async (meetingId: string): Promise<boolean> => {
    try {
        const list = await transcriptionService.getByMeeting(meetingId);
        if (!Array.isArray(list) || list.length === 0) return false;

        if (list.some(item => hasTranscriptionSummaryHint(item as any))) {
            return true;
        }

        const sorted = [...list].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        for (const item of sorted.slice(0, 2)) {
            const detail = await transcriptionService.getById(item.id);
            const summaryText = detail?.summary?.trim();
            if (summaryText) return true;
        }

        return false;
    } catch {
        return false;
    }
};

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
    const [seminarMeetings, setSeminarMeetings] = useState<SeminarMeetingResponse[]>([]);
    const { addToast } = useToastStore();
    const [viewMode, setViewMode] = useState<'list' | 'timetable'>(() => {
        return (localStorage.getItem('schedule_viewMode') as 'list' | 'timetable') || 'list';
    });

    // Semantic search
    const [semanticResults, setSemanticResults] = useState<MeetingResponse[] | null>(null);
    const [isSemanticLoading, setIsSemanticLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [aiSummaryByMeetingId, setAiSummaryByMeetingId] = useState<Record<string, boolean>>({});
    const aiSummaryCacheRef = useRef<Record<string, boolean>>({});

    // Panel system
    const [activePanel, setActivePanel] = useState<ScheduleTab | null>(null);
    const [showTranscription, setShowTranscription] = useState(false);
    const [isExitingTranscription, setIsExitingTranscription] = useState(false);
    const [isTranscriptionProcessing, setIsTranscriptionProcessing] = useState(false);
    const [showConfirmSwitch, setShowConfirmSwitch] = useState(false);
    const [pendingTab, setPendingTab] = useState<ListTabType | null>(null);

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

    const hasCompletedTranscription = !!(
        storeTranscription?.transcribedText || storeTranscription?.status === 'Completed'
    );

    // Route-navigation blocker: only warn AFTER transcription succeeds (not during processing).
    // During processing the user can freely navigate away; state is preserved in the store
    // and polling will resume when they return.
    const shouldBlockNav = showTranscription && hasCompletedTranscription && !isTranscriptionProcessing;
    const blocker = useBlocker(({ nextLocation }) => {
        if (!shouldBlockNav) return false;
        const targetPath = (nextLocation.pathname || '').toLowerCase();
        if (targetPath === '/seminars' || targetPath === '/schedules') return false;
        return true;
    });

    // On mount: restore the transcription panel if it was open when the user navigated away
    useEffect(() => {
        const s = useTranscriptionStore.getState();
        if (s.showPanel && s.source === 'schedule') {
            setShowTranscription(true);
        }
    }, []); // eslint-disable-line

    // ── Panel open/close helpers that also sync the store ──────────────────────
    const handleOpenAINote = () => {
        const next = !showTranscription;
        const mId = activePanel?.type === 'view' ? (activePanel.actualMeetingId ?? null) : null;
        const mName = activePanel?.title ?? null;

        setShowTranscription(next);
        if (next) {
            storeSetPanelContext({ meetingId: mId, meetingName: mName, showPanel: true, source: 'schedule' });
        } else {
            storeSetShowPanel(false);
        }
    };

    const doCloseTranscription = () => {
        setIsExitingTranscription(false);
        setShowTranscription(false);
        storeClearTranscription();
    };

    const handleCloseTranscription = () => {
        setIsExitingTranscription(true);
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
            let data;
            let seminarData;
            if (activeListTab === 'my_invited_meetings') {
                [data, seminarData] = await Promise.all([
                    meetingService.getMyInvitedMeetings(),
                    seminarService.getInvitedSeminarMeetings(),
                ]);
            } else {
                [data, seminarData] = await Promise.all([
                    meetingService.getMyMeetings(),
                    seminarService.getMySeminarMeetings(),
                ]);
            }
            setMeetings(Array.isArray(data) ? data : []);
            setSeminarMeetings(Array.isArray(seminarData) ? seminarData : []);
        } catch (error) {
            console.error('Failed to fetch meetings:', error);
            setMeetings([]);
            setSeminarMeetings([]);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchMeetings();
        } finally {
            setRefreshing(false);
        }
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        addToast(message, type);
    };

    const handleSemanticSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSemanticLoading(true);
        try {
            const results = await meetingService.searchMeetings({
                query: searchQuery,
                topK: 20,
                projectId: filterProjectId || undefined,
            });
            setSemanticResults(Array.isArray(results) ? results : []);
        } catch {
            showToast('Semantic search failed.', 'error');
        } finally {
            setIsSemanticLoading(false);
        }
    };

    // Panel handlers
    const handleAddCreateTab = () => {
        const newId = `create-${Date.now()}`;
        setActivePanel({ id: newId, type: 'create', title: 'New Schedule' });
    };

    const seminarMeetingByEventId = useMemo(() => {
        const map: Record<string, SeminarMeetingResponse> = {};
        seminarMeetings.forEach(m => {
            if (m.googleCalendarEventId) {
                map[m.googleCalendarEventId] = m;
            }
            map[m.seminarMeetingId] = m;
        });
        return map;
    }, [seminarMeetings]);

    const handleOpenViewTab = (meeting: MeetingResponse) => {
        const eventId = meeting.googleCalendarEventId || meeting.id;
        const isSameSelectedMeeting =
            activePanel?.type === 'view' &&
            (activePanel.actualMeetingId === meeting.id || activePanel.meetingId === eventId);

        if (isSameSelectedMeeting) {
            setActivePanel(null);
            setShowTranscription(false);
            storeSetShowPanel(false);
            return;
        }

        const mappedSeminar = seminarMeetingByEventId[eventId] || null;
        setActivePanel({
            id: `view-${eventId}`,
            type: 'view',
            meetingId: eventId,
            actualMeetingId: meeting.id,
            seminarMeetingId: mappedSeminar?.seminarMeetingId,
            title: meeting.title || 'Schedule',
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

    const handleTabSwitch = (tabId: ListTabType) => {
        if (isTranscriptionProcessing) {
            setPendingTab(tabId);
            setShowConfirmSwitch(true);
        } else {
            setActiveListTab(tabId);
            setFilterStatus('');
            setFilterProjectId('');
            setShowTranscription(false);
            storeSetShowPanel(false);
            setActivePanel(null);
        }
    };

    const handleConfirmTabSwitch = () => {
        if (pendingTab) {
            setActiveListTab(pendingTab);
            setFilterStatus('');
            setFilterProjectId('');
            setShowTranscription(false);
            storeSetShowPanel(false);
            setActivePanel(null);
            setPendingTab(null);
        }
        setShowConfirmSwitch(false);
    };

    // Filtered meetings
    const displayMeetings = useMemo(() => {
        const sourceMeetings = semanticResults !== null ? semanticResults : meetings;

        return sourceMeetings.filter(m => {
            const query = searchQuery.toLowerCase();
            const matchesQuery = semanticResults !== null
                ? true
                : (!query ||
                    (m.title?.toLowerCase().includes(query)) ||
                    (m.description?.toLowerCase().includes(query)));
            const matchesStatus = filterStatus === '' || m.status === Number(filterStatus);
            const matchesProject = !filterProjectId || m.projectId === filterProjectId;
            return matchesQuery && matchesStatus && matchesProject;
        }).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }, [meetings, semanticResults, searchQuery, filterStatus, filterProjectId]);

    useEffect(() => {
        let isMounted = true;

        const visibleMeetingIds = Array.from(
            new Set(displayMeetings.map(m => m.id).filter(Boolean))
        );

        if (visibleMeetingIds.length === 0) {
            setAiSummaryByMeetingId({});
            return;
        }

        const syncVisibleMap = () => {
            const nextMap: Record<string, boolean> = {};
            visibleMeetingIds.forEach(id => {
                nextMap[id] = !!aiSummaryCacheRef.current[id];
            });
            setAiSummaryByMeetingId(nextMap);
        };

        const loadAiSummaryFlags = async () => {
            const missingIds = visibleMeetingIds.filter(id => aiSummaryCacheRef.current[id] === undefined);
            if (missingIds.length > 0) {
                const results = await Promise.all(
                    missingIds.map(async id => [id, await checkMeetingHasAiSummary(id)] as const)
                );

                if (!isMounted) return;

                results.forEach(([id, hasSummary]) => {
                    aiSummaryCacheRef.current[id] = hasSummary;
                });
            }

            if (!isMounted) return;
            syncVisibleMap();
        };

        loadAiSummaryFlags();

        return () => {
            isMounted = false;
        };
    }, [displayMeetings]);

    const scheduledCount = meetings.filter(m => m.status === MeetingStatus.Scheduled).length;
    const completedCount = meetings.filter(m => m.status === MeetingStatus.Completed).length;
    const inProgressCount = meetings.filter(m => m.status === MeetingStatus.InProgress).length;
    const cancelledCount = meetings.filter(m => m.status === MeetingStatus.Cancelled).length;

    // Timetable events
    const timetableEvents: TimetableEvent[] = useMemo(() => {
        return displayMeetings.map(m => ({
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
    }, [displayMeetings, usersMap]);

    const activeSeminarMeeting = useMemo(() => {
        if (!activePanel || activePanel.type !== 'view') return null;
        if (activePanel.seminarMeetingId) {
            return seminarMeetings.find(m => m.seminarMeetingId === activePanel.seminarMeetingId) || null;
        }
        if (activePanel.meetingId) {
            return seminarMeetingByEventId[activePanel.meetingId] || null;
        }
        return null;
    }, [activePanel, seminarMeetings, seminarMeetingByEventId]);

    return (
        <MainLayout role={user?.role} userName={user?.name}>
            <style>{`
                @keyframes tp-enter { from { opacity: 0; transform: translateX(56px) scale(0.97); } to { opacity: 1; transform: translateX(0) scale(1); } }
                @keyframes tp-exit  { from { opacity: 1; transform: translateX(0) scale(1); }        to { opacity: 0; transform: translateX(56px) scale(0.97); } }
                @keyframes panel-enter { from { opacity: 0; transform: translateX(40px) scale(0.97); } to { opacity: 1; transform: translateX(0) scale(1); } }
                @keyframes shimmer { from { background-position: -400px 0; } to { background-position: 400px 0; } }
                .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e8eef4 50%, #f1f5f9 75%); background-size: 800px 100%; animation: shimmer 1.4s infinite linear; border-radius: 6px; }
            `}</style>
            <div className="page-container" style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1.5rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(30,41,59,0.15)', flexShrink: 0 }}>
                                <Calendar size={24} />
                            </div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>Schedules</h1>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>
                            Manage meetings, video calls, and team schedules with Google Meet integration.
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        title="Refresh"
                        style={{
                            padding: '6px 8px', border: '1px solid #e2e8f0', background: 'white',
                            borderRadius: '8px', display: 'flex', alignItems: 'center',
                            cursor: refreshing ? 'not-allowed' : 'pointer',
                            color: '#64748b', flexShrink: 0,
                            opacity: refreshing ? 0.5 : 1, transition: 'opacity 0.2s',
                        }}
                    >
                        <RotateCcw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                </div>

                {/* Search Bar */}
                <div style={{
                    padding: '0.75rem 1.25rem',
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
                                onChange={(e) => { setSearchQuery(e.target.value); setSemanticResults(null); }}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSemanticSearch}
                            disabled={isSemanticLoading || !searchQuery.trim()}
                            style={{
                                height: '42px', padding: '0 1.1rem', borderRadius: '10px',
                                display: 'flex', alignItems: 'center', gap: '7px',
                                fontSize: '0.85rem', fontWeight: 700, border: 'none',
                                cursor: isSemanticLoading || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                                background: semanticResults !== null ? 'var(--primary-color)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff', opacity: !searchQuery.trim() ? 0.5 : 1,
                                boxShadow: '0 4px 12px rgba(99,102,241,0.25)', whiteSpace: 'nowrap' as const,
                            }}
                        >
                            {isSemanticLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                            AI Search
                        </button>
                    </div>

                    {semanticResults !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', borderRadius: '10px', background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)', border: '1px solid #c7d2fe', marginBottom: '10px' }}>
                            <Zap size={14} color="#6366f1" />
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4f46e5' }}>
                                AI Search — {semanticResults.length} meeting{semanticResults.length !== 1 ? 's' : ''} found
                            </span>
                            <button
                                type="button"
                                onClick={() => setSemanticResults(null)}
                                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: '6px' }}
                            >
                                <X size={12} /> Clear
                            </button>
                        </div>
                    )}

                    <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                                {([
                                    { value: '0', label: 'Scheduled', count: scheduledCount, icon: <Clock size={12} />, activeColor: '#2563eb', activeBg: '#eff6ff', activeBorder: '#bfdbfe' },
                                    { value: '1', label: 'In Progress', count: inProgressCount, icon: <Video size={12} />, activeColor: '#d97706', activeBg: '#fffbeb', activeBorder: '#fde68a' },
                                    { value: '2', label: 'Completed', count: completedCount, icon: <CheckCircle2 size={12} />, activeColor: '#059669', activeBg: '#f0fdf4', activeBorder: '#bbf7d0' },
                                    { value: '3', label: 'Cancelled', count: cancelledCount, icon: <AlertTriangle size={12} />, activeColor: '#dc2626', activeBg: '#fef2f2', activeBorder: '#fecaca' },
                                ] as const).map(({ value, label, count, icon, activeColor, activeBg, activeBorder }) => {
                                    const isActive = filterStatus === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setFilterStatus(isActive ? '' : value)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '5px',
                                                padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
                                                fontSize: '0.78rem', fontWeight: 700,
                                                border: `1.5px solid ${isActive ? activeBorder : '#e2e8f0'}`,
                                                background: isActive ? activeBg : '#f8fafc',
                                                color: isActive ? activeColor : '#64748b',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <span style={{ display: 'flex', color: isActive ? activeColor : '#94a3b8' }}>{icon}</span>
                                            {label}
                                            <span style={{
                                                padding: '0 5px', height: '18px', borderRadius: '5px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.72rem', fontWeight: 800,
                                                background: isActive ? activeColor : '#e2e8f0',
                                                color: isActive ? '#fff' : '#64748b',
                                                minWidth: '18px',
                                            }}>{count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                <Briefcase size={13} color="var(--text-muted)" />
                                <div style={{ width: '200px' }}>
                                    <AppSelect
                                        size="sm"
                                        variant="scheduleFilter"
                                        isSearchable={false}
                                        value={filterProjectId}
                                        onChange={setFilterProjectId}
                                        options={[
                                            { value: '', label: 'All Projects' },
                                            ...Object.entries(projectsMap).map(([id, name]) => ({ value: id, label: name as string })),
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* View Toggle */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem' }}>
                    <button
                        onClick={() => { setViewMode('list'); localStorage.setItem('schedule_viewMode', 'list'); }}
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
                        onClick={() => { setViewMode('timetable'); localStorage.setItem('schedule_viewMode', 'timetable'); setActivePanel(null); setShowTranscription(false); storeSetShowPanel(false); }}
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

                {/* Breadcrumb */}
                {activePanel && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem', fontSize: '0.78rem', fontWeight: 600 }}>
                        <button
                            onClick={() => { setActivePanel(null); setShowTranscription(false); storeSetShowPanel(false); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', fontSize: '0.78rem', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-bg)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                            Schedules
                        </button>
                        <ChevronRight size={13} color="#94a3b8" />
                        <span style={{ color: '#1e293b', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                            {activePanel.title}
                        </span>
                    </div>
                )}

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
                                    onClick={() => handleTabSwitch(tab.id as ListTabType)}
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
                    <div style={{ display: 'flex', gap: '8px', marginLeft: '1rem' }}>
                        <button
                            onClick={handleAddCreateTab}
                            className="btn btn-primary"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                fontWeight: 700, padding: '10px 20px', borderRadius: '12px',
                                fontSize: '0.85rem', height: '42px', marginBottom: '0px',
                                boxShadow: '0 4px 12px rgba(232, 114, 12, 0.2)',
                                whiteSpace: 'nowrap' as const,
                            }}
                        >
                            <Plus size={18} /> New Schedule
                        </button>
                    </div>
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
                    <div style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 340px)', minHeight: '650px' }}>
                        {/* List — hidden when transcription is open, shrinks when detail panel open */}
                        {!showTranscription && (
                            <div style={{
                                flex: activePanel ? 3 : 10,
                                minWidth: 0,
                                display: 'flex', flexDirection: 'column',
                                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                overflow: 'hidden'
                            }}>
                                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
                                    {loading ? (
                                        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                                            <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-color)' }} />
                                        </div>
                                    ) : displayMeetings.length > 0 ? (
                                        <ScheduleList
                                            meetings={displayMeetings}
                                            selectedId={activePanel?.type === 'view' ? activePanel.meetingId! : null}
                                            onSelect={handleOpenViewTab}
                                            projectsMap={projectsMap}
                                            usersMap={usersMap}
                                            aiSummaryMap={aiSummaryByMeetingId}
                                            isSplit={!!activePanel}
                                        />
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                                            <Target size={48} style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
                                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>No Schedules Found</h3>
                                            {(filterStatus !== '' || filterProjectId !== '' || searchQuery !== '') ? (
                                                <>
                                                    <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>No meetings match your current filters.</p>
                                                    <button
                                                        onClick={() => { setFilterStatus(''); setFilterProjectId(''); setSearchQuery(''); setSemanticResults(null); }}
                                                        style={{ padding: '8px 18px', borderRadius: '10px', border: '1.5px solid var(--accent-color)', background: 'var(--accent-bg)', color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                                                    >
                                                        Clear all filters
                                                    </button>
                                                </>
                                            ) : (
                                                <p style={{ fontSize: '0.85rem' }}>Create your first schedule to get started with team meetings.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Meeting detail panel — hidden when AI Notes is open */}
                        {activePanel && !showTranscription && (
                            <div key={activePanel.meetingId || activePanel.id} style={{
                                flex: 3, minWidth: 0, overflow: 'hidden',
                                display: 'flex', flexDirection: 'column',
                                background: '#fff', borderRadius: '16px',
                                border: '1px solid var(--border-color)', padding: '1.5rem',
                                animation: 'panel-enter 0.38s cubic-bezier(0,0,0.2,1) both',
                            }}>
                                <SchedulePanel
                                    key={activePanel.meetingId || activePanel.id}
                                    meetingId={activePanel.type === 'view' ? activePanel.meetingId! : null}
                                    actualMeetingId={activePanel.type === 'view' ? activePanel.actualMeetingId : null}
                                    initialData={activePanel.initialData}
                                    isCreating={activePanel.type === 'create'}
                                    onClose={() => { handleClosePanel(); handleCloseTranscription(); }}
                                    onSaved={(shouldClose = false, message?: string, newEventId?: string) => {
                                        fetchMeetings();
                                        if (message) showToast(message, 'success');
                                        if (activePanel.type === 'create' && newEventId) {
                                            setActivePanel({ id: `view-${newEventId}`, type: 'view', meetingId: newEventId, actualMeetingId: newEventId, title: 'Schedule Detail' });
                                        } else if (shouldClose) {
                                            handleClosePanel();
                                        }
                                    }}
                                    onTitleChange={handleTitleChange}
                                    projectsMap={projectsMap}
                                    seminarMeeting={activeSeminarMeeting}
                                    allowSeminarSwap={activeListTab === 'my_meetings'}
                                    onToggleAINote={handleOpenAINote}
                                    showAINote={showTranscription}
                                />
                            </div>
                        )}

                        {/* AI Notes / Transcription panel — to the right of the detail panel */}
                        {(showTranscription || isExitingTranscription) && (
                            <div
                                onAnimationEnd={() => { if (isExitingTranscription) doCloseTranscription(); }}
                                style={{
                                    flex: 6, minWidth: 0, overflow: 'hidden',
                                    display: 'flex', flexDirection: 'column',
                                    animation: isExitingTranscription
                                        ? 'tp-exit 0.3s cubic-bezier(0.4,0,1,1) forwards'
                                        : 'tp-enter 0.38s cubic-bezier(0,0,0.2,1) both',
                                }}>
                                <TranscriptionPanel
                                    onClose={handleCloseTranscription}
                                    meetingId={
                                        activePanel?.type === 'view'
                                            ? activePanel.actualMeetingId
                                            : (storeShowPanel && storeSource === 'schedule' ? (storeMeetingId ?? undefined) : undefined)
                                    }
                                    meetingName={
                                        activePanel?.title
                                        ?? (storeShowPanel && storeSource === 'schedule' ? (storeMeetingName ?? undefined) : undefined)
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

export default Schedules;
