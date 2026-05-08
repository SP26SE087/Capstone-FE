import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { useTranscriptionStore } from '@/store/slices/transcriptionStore';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import AppSelect from '@/components/common/AppSelect';
import {
    Search,
    Presentation,
    Loader2,
    Calendar,
    Plus,
    Clock,
    Target,
    ArrowLeftRight,
    List,
    LayoutGrid,
    AlertTriangle,
    CheckCircle2,
    FileText,
    Users,
    ChevronsUpDown,
    ChevronsDownUp
} from 'lucide-react';
import seminarService from '@/services/seminarService';
import { transcriptionService } from '@/services/transcriptionService';
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
    openSwapOnLoad?: boolean;
    panelNonce?: number;
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

const checkSeminarMeetingHasAiSummary = async (seminarMeetingId: string): Promise<boolean> => {
    try {
        const list = await transcriptionService.getByMeeting(seminarMeetingId);
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

const Seminars: React.FC = () => {
    const { user } = useAuth();

    // Data
    const [activeTab, setActiveTab] = useState<TabType>('all_seminars');
    const [meetings, setMeetings] = useState<SeminarMeetingResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTimeframe, setFilterTimeframe] = useState<string>('upcoming');
    const [filterSeminarId, setFilterSeminarId] = useState<string>('');
    const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    const [emailsMap, setEmailsMap] = useState<Record<string, string>>({});
    const { addToast } = useToastStore();
    const [viewMode, setViewMode] = useState<'list' | 'timetable'>(() =>
        (localStorage.getItem('seminar_viewMode') as 'list' | 'timetable') || 'list'
    );
    const [allExpanded, setAllExpanded] = useState<boolean | undefined>(undefined);
    const [aiSummaryBySeminarMeetingId, setAiSummaryBySeminarMeetingId] = useState<Record<string, boolean>>({});
    const aiSummaryCacheRef = useRef<Record<string, boolean>>({});

    // Panel system
    const [activePanel, setActivePanel] = useState<SeminarTab | null>(null);
    const [timetableModal, setTimetableModal] = useState<SeminarMeetingResponse | null>(null);
    const [openSwapInTimetableModal, setOpenSwapInTimetableModal] = useState(false);
    const [closingPanelId, setClosingPanelId] = useState<string | null>(null);
    const [showTranscription, setShowTranscription] = useState(false);
    const [isTranscriptionProcessing, setIsTranscriptionProcessing] = useState(false);
    const [showConfirmSwitch, setShowConfirmSwitch] = useState(false);
    const [pendingTab, setPendingTab] = useState<TabType | null>(null);

    const openTimetableModal = (meeting: SeminarMeetingResponse, openSwap: boolean = false) => {
        setOpenSwapInTimetableModal(openSwap);
        setTimetableModal(meeting);
    };

    const closeTimetableModal = () => {
        setTimetableModal(null);
        setOpenSwapInTimetableModal(false);
    };

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
    const blocker = useBlocker(({ nextLocation }) => {
        if (!shouldBlockNav) return false;
        const targetPath = (nextLocation.pathname || '').toLowerCase();
        if (targetPath === '/seminars' || targetPath === '/schedules') return false;
        return true;
    });

    // On mount: restore the transcription panel if it was open when user navigated away
    useEffect(() => {
        const s = useTranscriptionStore.getState();
        if (s.showPanel && s.source === 'seminar') {
            setShowTranscription(true);
        }
    }, []); // eslint-disable-line

    // Close AI Note when user clicks Schedules/Seminars in the sidebar
    useEffect(() => {
        const handler = () => {
            setShowTranscription(false);
            storeSetShowPanel(false);
        };
        window.addEventListener('closeAINote', handler);
        return () => window.removeEventListener('closeAINote', handler);
    }, []);

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
            setFilterTimeframe('');
            setFilterSeminarId('');
            if (tabId === 'swap_requests') setViewMode('list');
            setClosingPanelId(null);
            setShowTranscription(false);
            storeSetShowPanel(false);
            setActivePanel(null);
        }
    };

    const handleConfirmTabSwitch = () => {
        if (pendingTab) {
            setActiveTab(pendingTab);
            setFilterTimeframe('');
            setFilterSeminarId('');
            if (pendingTab === 'swap_requests') setViewMode('list');
            setClosingPanelId(null);
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
        setClosingPanelId(null);
        setActivePanel({ id: newId, type: 'create', title: 'New Seminar' });
    };

    const handleOpenViewTab = (meeting: SeminarMeetingResponse, opts?: { openSwapOnLoad?: boolean }) => {
        const isSameSelectedMeeting = activePanel?.type === 'view' && activePanel.meetingId === meeting.seminarMeetingId;

        if (isSameSelectedMeeting && !opts?.openSwapOnLoad) {
            handleClosePanelAnimated();
            return;
        }

        setClosingPanelId(null);
        setActivePanel({
            id: `view-${meeting.seminarMeetingId}`,
            type: 'view',
            meetingId: meeting.seminarMeetingId,
            title: meeting.title || 'Seminar',
            initialData: meeting,
            openSwapOnLoad: !!opts?.openSwapOnLoad,
            panelNonce: opts?.openSwapOnLoad ? Date.now() : undefined,
        });
    };

    const handleClosePanel = () => {
        setActivePanel(null);
        setClosingPanelId(null);
    };

    const handleClosePanelAnimated = () => {
        if (!activePanel) return;
        setClosingPanelId(activePanel.id);
    };

    const handleTitleChange = (newTitle: string) => {
        if (activePanel && activePanel.title !== newTitle) {
            setActivePanel({ ...activePanel, title: newTitle });
        }
    };

    const seminarSeriesOptions = useMemo(() => {
        const seriesNameMap = new Map<string, string>();
        meetings.forEach(m => {
            if (seriesNameMap.has(m.seminarId)) return;
            const baseTitle = m.title && m.title.includes(' - ')
                ? m.title.split(' - ')[0].trim()
                : (m.title || 'Untitled Seminar Series');
            seriesNameMap.set(m.seminarId, baseTitle);
        });

        return Array.from(seriesNameMap.entries())
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([value, label]) => ({ value, label }));
    }, [meetings]);

    // Filtered meetings
    const displayMeetings = useMemo(() => {
        return meetings.filter(m => {
            const query = searchQuery.toLowerCase();
            const matchesQuery = !query ||
                (m.title?.toLowerCase().includes(query)) ||
                (m.description?.toLowerCase().includes(query)) ||
                (m.location?.toLowerCase().includes(query));

            const isUpcoming = new Date(m.meetingDate).getTime() > Date.now();
            let matchesTimeframe = true;
            if (filterTimeframe === 'upcoming') matchesTimeframe = isUpcoming;
            else if (filterTimeframe === 'past') matchesTimeframe = !isUpcoming;
            else if (filterTimeframe === 'slides') matchesTimeframe = !!m.slideUrl;
            else if (filterTimeframe === 'missing') matchesTimeframe = isUpcoming && !m.slideUrl;

            const matchesSeries = !filterSeminarId || m.seminarId === filterSeminarId;

            return matchesQuery && matchesTimeframe && matchesSeries;
        }).sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());
    }, [meetings, searchQuery, filterTimeframe, filterSeminarId]);

    useEffect(() => {
        let isMounted = true;

        const visibleSeminarMeetingIds = Array.from(
            new Set(displayMeetings.map(m => m.seminarMeetingId).filter(Boolean))
        );

        if (visibleSeminarMeetingIds.length === 0) {
            setAiSummaryBySeminarMeetingId({});
            return;
        }

        const syncVisibleMap = () => {
            const nextMap: Record<string, boolean> = {};
            visibleSeminarMeetingIds.forEach(id => {
                nextMap[id] = !!aiSummaryCacheRef.current[id];
            });
            setAiSummaryBySeminarMeetingId(nextMap);
        };

        const loadAiSummaryFlags = async () => {
            const missingIds = visibleSeminarMeetingIds.filter(id => aiSummaryCacheRef.current[id] === undefined);
            if (missingIds.length > 0) {
                const results = await Promise.all(
                    missingIds.map(async id => [id, await checkSeminarMeetingHasAiSummary(id)] as const)
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

    const timetableEvents: TimetableEvent[] = useMemo(() => {
        return displayMeetings.map(m => {
            const startDayStr = m.meetingDate.split('T')[0];
            const presenterEmail = emailsMap[m.presenterId];
            const isOwnedByCurrentUser = !!user?.email && !!presenterEmail && user.email.toLowerCase() === presenterEmail.toLowerCase();
            const isUpcoming = new Date(m.meetingDate).getTime() > Date.now();
            
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
                color: '#e8720c',
                swapable: isOwnedByCurrentUser && isUpcoming,
                location: m.location || null,
                slideUrl: m.slideUrl || null,
                recordingUrl: m.recordingLink || null,
                status: isUpcoming ? 'upcoming' : 'past',
            };
        });
    }, [displayMeetings, usersMap, emailsMap, user?.email]);

    // Stats
    const upcomingCount = meetings.filter(m => new Date(m.meetingDate).getTime() > Date.now()).length;
    const pastCount = meetings.filter(m => new Date(m.meetingDate).getTime() <= Date.now()).length;
    const withSlidesCount = meetings.filter(m => m.slideUrl).length;
    const missingSlidesCount = meetings.filter(m => new Date(m.meetingDate).getTime() > Date.now() && !m.slideUrl).length;

    return (
        <MainLayout role={user?.role} userName={user?.name}>
            <div className="page-container" style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1.5rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(99,102,241,0.2)', flexShrink: 0 }}>
                                <Presentation size={24} />
                            </div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>Seminars</h1>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>
                            Manage recurring seminars, session schedules, and presenter rotations.
                        </p>
                    </div>
                </div>

                {/* Search Bar */}
                <div style={{
                    padding: '0.75rem 1.25rem',
                    borderRadius: '14px',
                    background: '#fff',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)',
                    marginBottom: '1.5rem',
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
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
                    <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                                {([
                                    { value: 'upcoming', label: 'Upcoming', count: upcomingCount, icon: <Clock size={12} />, activeColor: '#2563eb', activeBg: '#eff6ff', activeBorder: '#bfdbfe' },
                                    { value: 'past', label: 'Completed', count: pastCount, icon: <CheckCircle2 size={12} />, activeColor: '#059669', activeBg: '#f0fdf4', activeBorder: '#bbf7d0' },
                                    { value: 'slides', label: 'With Slides', count: withSlidesCount, icon: <FileText size={12} />, activeColor: '#7c3aed', activeBg: '#f5f3ff', activeBorder: '#ddd6fe' },
                                    { value: 'missing', label: 'Missing Slides', count: missingSlidesCount, icon: <AlertTriangle size={12} />, activeColor: '#d97706', activeBg: '#fffbeb', activeBorder: '#fde68a' },
                                ] as const).map(({ value, label, count, icon, activeColor, activeBg, activeBorder }) => {
                                    const isActive = filterTimeframe === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setFilterTimeframe(isActive ? '' : value)}
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
                                                fontSize: '0.72rem', fontWeight: 800, minWidth: '18px',
                                                background: isActive ? activeColor : '#e2e8f0',
                                                color: isActive ? '#fff' : '#64748b',
                                            }}>{count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {activeTab !== 'swap_requests' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 'clamp(180px, 28vw, 280px)', maxWidth: 'min(100%, 320px)' }}>
                                        <Presentation size={13} color="var(--text-muted)" />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <AppSelect
                                                size="sm"
                                                variant="scheduleFilter"
                                                placeholder="Seminar series"
                                                isSearchable={false}
                                                isDisabled={seminarSeriesOptions.length === 0}
                                                value={filterSeminarId}
                                                onChange={setFilterSeminarId}
                                                options={[
                                                    { value: '', label: 'All Seminar Series' },
                                                    ...seminarSeriesOptions,
                                                ]}
                                            />
                                        </div>
                                    </div>

                                    {viewMode !== 'timetable' && (
                                    <button
                                        type="button"
                                        onClick={() => setAllExpanded(v => v === true ? false : true)}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                            padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
                                            fontSize: '0.78rem', fontWeight: 700, minWidth: '110px',
                                            border: `1.5px solid ${allExpanded === true ? '#bfdbfe' : '#e2e8f0'}`,
                                            background: allExpanded === true ? '#eff6ff' : '#f8fafc',
                                            color: allExpanded === true ? '#2563eb' : '#475569',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {allExpanded === true
                                            ? <><ChevronsDownUp size={13} /> Collapse All</>
                                            : <><ChevronsUpDown size={13} /> Expand All</>}
                                    </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* View Toggle + Tabs — hidden when AI Note is open */}
                {!showTranscription && activeTab !== 'swap_requests' && (
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem' }}>
                        <button
                            onClick={() => { setViewMode('list'); localStorage.setItem('seminar_viewMode', 'list'); }}
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
                            onClick={() => { setViewMode('timetable'); localStorage.setItem('seminar_viewMode', 'timetable'); setActivePanel(null); setShowTranscription(false); storeSetShowPanel(false); }}
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
                {!showTranscription && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1, borderBottom: '1px solid #e2e8f0', overflowX: 'auto', whiteSpace: 'nowrap' as const }} className="custom-scrollbar">
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {[
                                { id: 'all_seminars', label: 'All Seminars', icon: <Calendar size={16} /> },
                                { id: 'my_seminars', label: 'My Seminars', icon: <Presentation size={16} /> },
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
                </div>}

                {/* Main Content */}
                <div
                    style={{
                        display: 'flex',
                        gap: '2rem',
                        height: (activeTab !== 'swap_requests' && viewMode === 'timetable')
                            ? 'calc(100vh - 280px)'
                            : 'calc(100vh - 340px)',
                        minHeight: (activeTab !== 'swap_requests' && viewMode === 'timetable') ? '700px' : '650px'
                    }}
                >
                    {/* Left: List or Swap Requests — hidden when transcription is open */}
                    {!showTranscription && (
                    <div style={{
                        flex: activePanel
                            ? ((activeTab !== 'swap_requests' && viewMode === 'timetable') ? 6 : 4)
                            : 10,
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        minWidth: 0,
                        overflow: 'hidden'
                    }}>
                        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
                            {activeTab !== 'swap_requests' && viewMode === 'timetable' ? (
                                <WeeklyTimetable
                                    events={timetableEvents}
                                    onEventClick={(evt) => {
                                        const m = displayMeetings.find(mm => mm.seminarMeetingId === evt.id);
                                        if (m) openTimetableModal(m, false);
                                    }}
                                    onSwapRequestClick={(evt) => {
                                        const m = displayMeetings.find(mm => mm.seminarMeetingId === evt.id);
                                        if (m) openTimetableModal(m, true);
                                    }}
                                />
                            ) : activeTab === 'swap_requests' ? (
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
                                    filterTimeframe={filterTimeframe}
                                    aiSummaryMap={aiSummaryBySeminarMeetingId}
                                    allExpanded={allExpanded}
                                />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                                    <Target size={48} style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>No Seminars Found</h3>
                                    {(filterTimeframe !== '' || filterSeminarId !== '' || searchQuery !== '') ? (
                                        <>
                                            <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>No sessions match your current filters.</p>
                                            <button
                                                onClick={() => { setFilterTimeframe(''); setFilterSeminarId(''); setSearchQuery(''); }}
                                                style={{ padding: '8px 18px', borderRadius: '10px', border: '1.5px solid var(--accent-color)', background: 'var(--accent-bg)', color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                                            >
                                                Clear all filters
                                            </button>
                                        </>
                                    ) : (
                                        <p style={{ fontSize: '0.85rem' }}>
                                            {activeTab === 'my_seminars'
                                                ? 'You have no upcoming or past seminar sessions.'
                                                : 'No seminar sessions found.'}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    )}

                    {/* Right: Panel — hidden when AI Notes is open */}
                    {activePanel && !showTranscription && (
                        <div
                            onAnimationEnd={() => {
                                if (closingPanelId && activePanel.id === closingPanelId) {
                                    setActivePanel(null);
                                    setClosingPanelId(null);
                                    handleCloseTranscription();
                                }
                            }}
                            style={{
                                flex: (activeTab !== 'swap_requests' && viewMode === 'timetable') ? 4 : 6,
                                opacity: 1,
                                pointerEvents: closingPanelId && activePanel.id === closingPanelId ? 'none' : 'auto',
                                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                background: '#fff',
                                borderRadius: '16px',
                                border: '1px solid var(--border-color)',
                                padding: '1.5rem',
                                animation: closingPanelId && activePanel.id === closingPanelId
                                    ? 'seminarPanelExit 0.24s cubic-bezier(0.4, 0, 1, 1) forwards'
                                    : 'seminarPanelEnter 0.32s cubic-bezier(0, 0, 0.2, 1) both'
                            }}
                        >
                            {activePanel.type === 'create' ? (
                                <CreateSeminarForm
                                    onClose={handleClosePanelAnimated}
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
                                    key={`${activePanel.meetingId || activePanel.id}-${activePanel.panelNonce || 0}`}
                                    meetingId={activePanel.type === 'view' ? activePanel.meetingId! : null}
                                    initialData={activePanel.initialData}
                                    openSwapOnLoad={!!activePanel.openSwapOnLoad}
                                    isCreating={false}
                                    onClose={handleClosePanelAnimated}
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
                                hideTasks
                            />
                        </div>
                    )}
                </div>
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

            {/* Timetable Detail Modal — full SeminarPanel in overlay */}
            {timetableModal && (
                <div
                    onClick={closeTimetableModal}
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 10000, padding: '20px',
                        animation: 'fadeIn 0.18s ease'
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#fff', borderRadius: '20px',
                            width: '100%', maxWidth: '860px', height: '88vh',
                            display: 'flex', flexDirection: 'column',
                            boxShadow: '0 40px 80px -12px rgba(0,0,0,0.3)',
                            overflow: 'hidden',
                            animation: 'slideUp 0.25s cubic-bezier(0.34,1.3,0.64,1)'
                        }}
                    >
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }} className="custom-scrollbar">
                            <SeminarPanel
                                key={`${timetableModal.seminarMeetingId}-${openSwapInTimetableModal ? 'swap' : 'detail'}`}
                                meetingId={timetableModal.seminarMeetingId}
                                initialData={timetableModal}
                                openSwapOnLoad={openSwapInTimetableModal}
                                isCreating={false}
                                onClose={closeTimetableModal}
                                onSaved={(shouldClose, message) => {
                                    fetchSeminars();
                                    if (message) showToast(message, 'success');
                                    if (shouldClose) closeTimetableModal();
                                }}
                                onTitleChange={() => {}}
                                usersMap={usersMap}
                                emailsMap={emailsMap}
                                projectsMap={projectsMap}
                            />
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes seminarPanelEnter { from { opacity: 0; transform: translateX(30px) scale(0.98); } to { opacity: 1; transform: translateX(0) scale(1); } }
                @keyframes seminarPanelExit { from { opacity: 1; transform: translateX(0) scale(1); } to { opacity: 0; transform: translateX(30px) scale(0.98); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </MainLayout>
    );
};

export default Seminars;
