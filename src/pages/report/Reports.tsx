import React, { useState, useEffect, useMemo } from 'react';
import AppSelect from '@/components/common/AppSelect';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import {
    Search,
    FileText,
    CheckCircle,
    Clock,
    AlertTriangle,
    FileInput,
    Plus,
    Sparkles,
    Briefcase,
    Filter,
    LayoutGrid,
    Target,
    Loader2,
    X,
    Zap,
    RotateCcw,
    User,
    CalendarDays,
} from 'lucide-react';
import {
    BookingStyleMonthGrid,
    BookingStyleMonthNav,
    BookingStyleMonthGridEvent,
    sameDay,
} from '@/components/common/BookingStyleMonthCalendar';
import reportService, { Report } from '@/services/reportService';
import { projectService, userService } from '@/services';
import { useToastStore } from '@/store/slices/toastSlice';
import ReportPanel from './components/ReportPanel';

type TabType = 'my_reports' | 'all_reports' | 'my_assignee';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const Reports: React.FC = () => {
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<TabType>('my_reports');
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    const [usersList, setUsersList] = useState<{ id: string; name: string }[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterProjectId, setFilterProjectId] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterMemberId, setFilterMemberId] = useState('');

    const [semanticResults, setSemanticResults] = useState<Report[] | null>(null);
    const [isSemanticLoading, setIsSemanticLoading] = useState(false);

    const [calYear, setCalYear] = useState(() => new Date().getFullYear());
    const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
    const [selectedCalDay, setSelectedCalDay] = useState<number | null>(null);

    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const { addToast } = useToastStore();
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') =>
        addToast(message, type);

    const isLabDirector = useMemo(() => {
        if (!user) return false;
        return Number(user.role) === 1 || Number(user.role) === 2;
    }, [user?.role]);

    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const [pData, uData] = await Promise.all([
                    projectService.getAll(),
                    userService.getAll(),
                ]);
                const pMap: Record<string, string> = {};
                (pData || []).forEach((p: any) => { pMap[p.projectId] = p.projectName || p.name || 'Untitled'; });
                setProjectsMap(pMap);

                const uMap: Record<string, string> = {};
                const uList: { id: string; name: string }[] = [];
                (uData || []).forEach((u: any) => {
                    const id = u.userId || u.id;
                    const name = u.fullName || u.name || u.email || id;
                    uMap[id] = name;
                    uList.push({ id, name });
                });
                setUsersMap(uMap);
                setUsersList(uList);
            } catch (e) {
                console.error('Failed to load metadata', e);
            }
        };
        fetchMeta();
    }, []);

    useEffect(() => {
        if (isLabDirector) setActiveTab('all_reports');
    }, [isLabDirector]);

    useEffect(() => { fetchReports(); }, [activeTab]);

    useEffect(() => {
        const now = new Date();
        if (calYear === now.getFullYear() && calMonth === now.getMonth()) {
            setSelectedCalDay(now.getDate());
        }
    }, [reports, calYear, calMonth]);

    // Keep selected day valid when switching months
    useEffect(() => {
        if (selectedCalDay === null) return;
        const maxDay = new Date(calYear, calMonth + 1, 0).getDate();
        if (selectedCalDay > maxDay) setSelectedCalDay(maxDay);
    }, [calYear, calMonth, selectedCalDay]);

    const fetchReports = async () => {
        setLoading(true);
        setSemanticResults(null);
        try {
            let data: any;
            if (activeTab === 'my_reports') data = await reportService.getMyReports();
            else if (activeTab === 'all_reports' && isLabDirector) data = await reportService.getAllReports();
            else if (activeTab === 'my_assignee') data = await reportService.getAssignedReports();
            setReports(Array.isArray(data) ? data : (data?.data || []));
        } catch {
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try { await fetchReports(); } finally { setRefreshing(false); }
    };

    const openReport = (report: Report) => {
        setIsAdding(false);
        setSelectedReportId(report.id);
        setIsPanelOpen(true);
    };

    const openCreate = () => {
        setIsAdding(true);
        setSelectedReportId(null);
        setIsPanelOpen(true);
    };

    const closePanel = () => {
        setIsPanelOpen(false);
        setSelectedReportId(null);
        setIsAdding(false);
    };

    const getStatusLabel = (status: number) => {
        switch (status) {
            case 0: return { label: 'Drafting',  color: '#64748b', icon: <FileInput size={13} /> };
            case 1: return { label: 'Submitted', color: '#0ea5e9', icon: <Clock size={13} /> };
            case 2: return { label: 'Approved',  color: '#10b981', icon: <CheckCircle size={13} /> };
            case 3: return { label: 'Revision',  color: '#ef4444', icon: <AlertTriangle size={13} /> };
            default: return { label: 'Draft',    color: '#64748b', icon: <FileInput size={13} /> };
        }
    };

    const getSmartStatus = (report: Report) => {
        const base = getStatusLabel(report.status);
        if (report.status === 0) return base;
        const reviewList = (report as any).assignees || (report as any).Assignees || [];
        if (reviewList.length === 0) return base;
        const total = reviewList.length;
        const approved = reviewList.filter((r: any) => r.status === 2).length;
        const rejected = reviewList.filter((r: any) => r.status === 3).length;
        if (rejected > 0) return { label: `Revision (${rejected} Rejected)`, color: '#ef4444', icon: <AlertTriangle size={13} /> };
        if (approved === total) return { label: 'Fully Approved', color: '#10b981', icon: <CheckCircle size={13} /> };
        if (approved > 0) return { label: `Reviewing (${approved}/${total})`, color: '#6366f1', icon: <Clock size={13} /> };
        return base;
    };

    const getReportDate = (report: Report): Date | null => {
        const raw = report.submitedAt || (report as any).updatedAt || (report as any).createdAt;
        if (!raw) return null;
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
    };

    const fmtDate = (s: string) =>
        new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const handleSemanticSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSemanticLoading(true);
        try {
            const results = await reportService.searchReports({
                query: searchQuery,
                topK: 20,
                projectId: filterProjectId || undefined,
                status: filterStatus !== '' ? Number(filterStatus) : undefined,
            });
            setSemanticResults(Array.isArray(results) ? results : (results?.data || []));
        } catch {
            showToast('Semantic search failed.', 'error');
        } finally {
            setIsSemanticLoading(false);
        }
    };

    const displayReports = useMemo(() => {
        if (semanticResults !== null) return semanticResults;
        return reports.filter(report => {
            const q = searchQuery.toLowerCase();
            const matchesQuery = !q ||
                report.title?.toLowerCase().includes(q) ||
                report.description?.toLowerCase().includes(q) ||
                report.goals?.toLowerCase().includes(q);
            const matchesProject = !filterProjectId || report.projectId === filterProjectId;
            const matchesStatus = filterStatus === '' || report.status === Number(filterStatus);
            const matchesMember = !filterMemberId || report.userId === filterMemberId;
            return matchesQuery && matchesProject && matchesStatus && matchesMember;
        });
    }, [reports, semanticResults, searchQuery, filterProjectId, filterStatus, filterMemberId]);

    const calendarMap = useMemo(() => {
        const map = new Map<number, Report[]>();
        for (const r of displayReports) {
            const d = getReportDate(r);
            if (!d || d.getFullYear() !== calYear || d.getMonth() !== calMonth) continue;
            const day = d.getDate();
            if (!map.has(day)) map.set(day, []);
            map.get(day)!.push(r);
        }
        return map;
    }, [displayReports, calYear, calMonth]);

    const monthReportCount = useMemo(() => {
        let total = 0;
        calendarMap.forEach(arr => { total += arr.length; });
        return total;
    }, [calendarMap]);

    const reportById = useMemo(() => {
        return new Map(displayReports.map(r => [r.id, r] as const));
    }, [displayReports]);

    const calendarEvents: BookingStyleMonthGridEvent[] = useMemo(() => {
        const events: BookingStyleMonthGridEvent[] = [];
        for (const r of displayReports) {
            const d = getReportDate(r);
            if (!d || d.getFullYear() !== calYear || d.getMonth() !== calMonth) continue;
            events.push({
                id: r.id,
                title: r.title || 'Untitled Report',
                startTime: d.toISOString(),
                endTime: null,
                color: getSmartStatus(r).color,
                meta: { reportId: r.id },
            });
        }
        return events;
    }, [displayReports, calYear, calMonth]);

    const selectedCalDate = useMemo(() => {
        if (selectedCalDay === null) return null;
        const d = new Date(calYear, calMonth, selectedCalDay);
        d.setHours(0, 0, 0, 0);
        return d;
    }, [calYear, calMonth, selectedCalDay]);

    const selectedDayReports = useMemo(() => {
        if (selectedCalDay === null) return [] as Report[];
        return calendarMap.get(selectedCalDay) || [];
    }, [calendarMap, selectedCalDay]);

    const renderCard = (report: Report, compact: boolean = false) => {
        const statusInfo = getSmartStatus(report);
        const isSelected = selectedReportId === report.id;
        const author = (report as any).userName || (report as any).UserName || usersMap[report.userId] || null;
        const projectName = projectsMap[report.projectId] || null;

        return (
            <div
                key={report.id}
                onClick={() => openReport(report)}
                onMouseEnter={(e) => {
                    if (compact) e.currentTarget.style.background = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                    if (compact) e.currentTarget.style.background = '#fff';
                }}
                style={{
                    padding: compact ? '10px 12px' : (isPanelOpen ? '0.65rem 0.85rem' : '0.85rem 1.1rem'),
                    borderRadius: compact ? 8 : '10px',
                    border: compact
                        ? '1px solid #e2e8f0'
                        : (isSelected ? '2px solid var(--primary-color)' : '1px solid #e2e8f0'),
                    backgroundColor: compact ? '#fff' : (isSelected ? '#f8fafc' : 'white'),
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    transition: 'all 0.15s',
                    boxShadow: compact
                        ? 'none'
                        : (isSelected ? '0 6px 20px -4px rgba(99,102,241,0.15)' : '0 2px 6px -1px rgba(0,0,0,0.04)'),
                    position: 'relative', overflow: 'hidden',
                    borderLeft: compact ? `4px solid ${statusInfo.color}` : undefined,
                }}
            >
                {isSelected && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: 'var(--primary-color)' }} />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{
                            margin: 0, marginBottom: '5px',
                            fontSize: isPanelOpen ? '0.875rem' : '0.95rem',
                            color: isSelected ? 'var(--primary-color)' : '#1e293b',
                            fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                            {report.title || 'Untitled Report'}
                        </h3>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '0.72rem', color: '#64748b', alignItems: 'center' }}>
                            {author && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <User size={11} />
                                    <span style={{ fontWeight: 600, color: '#334155' }}>{author}</span>
                                </span>
                            )}
                            {projectName && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Briefcase size={11} />
                                    <span style={{ fontWeight: 500, color: '#475569' }}>{projectName}</span>
                                </span>
                            )}
                            {report.submitedAt ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0ea5e9', fontWeight: 600 }}>
                                    <Clock size={11} />
                                    {fmtDate(report.submitedAt)}
                                </span>
                            ) : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontStyle: 'italic' }}>
                                    <Clock size={11} />Not submitted
                                </span>
                            )}
                        </div>
                        {!isPanelOpen && (report.description || report.goals) && (
                            <p style={{
                                margin: '6px 0 0', fontSize: '0.8rem', color: '#475569',
                                display: '-webkit-box', WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.55,
                            }}>
                                {report.description || report.goals}
                            </p>
                        )}
                    </div>
                    <div style={{
                        flexShrink: 0,
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '3px 9px', borderRadius: '7px',
                        backgroundColor: isSelected ? 'white' : `${statusInfo.color}12`,
                        color: statusInfo.color,
                        fontSize: '0.68rem', fontWeight: 700,
                        border: `1px solid ${statusInfo.color}25`,
                        whiteSpace: 'nowrap',
                    }}>
                        {statusInfo.icon}
                        {statusInfo.label.toUpperCase()}
                    </div>
                </div>
            </div>
        );
    };

    const renderCalendar = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#E8720C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Calendar</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>
                        ({monthReportCount} report{monthReportCount !== 1 ? 's' : ''})
                    </div>
                </div>

                <BookingStyleMonthNav
                    year={calYear}
                    month={calMonth}
                    setMonth={setCalMonth}
                    setYear={setCalYear}
                />
            </div>

            <BookingStyleMonthGrid
                year={calYear}
                month={calMonth}
                events={calendarEvents}
                selectedDate={selectedCalDay !== null ? new Date(calYear, calMonth, selectedCalDay) : null}
                onSelectDate={(d) => {
                    if (d.getFullYear() !== calYear || d.getMonth() !== calMonth) return;
                    setSelectedCalDay(d.getDate());
                    setIsPanelOpen(false);
                    setSelectedReportId(null);
                    setIsAdding(false);
                }}
                onEventClick={(evt) => {
                    const report = reportById.get(evt.id);
                    if (report) openReport(report);
                }}
                minWidth={600}
            />
        </div>
    );

    return (
        <MainLayout role={user?.role} userName={user?.name}>
            <div className="page-container" style={{ padding: '1rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(99,102,241,0.2)' }}>
                                <FileText size={22} />
                            </div>
                            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>Project Reports</h1>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>
                            Intelligent repository for team progress and research summaries.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing || loading}
                            style={{ height: '38px', padding: '0 14px', border: '1px solid #e2e8f0', background: 'white', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', opacity: refreshing || loading ? 0.6 : 1 }}
                        >
                            <RotateCcw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                            Refresh
                        </button>
                        {!isLabDirector && (
                            <button
                                className="btn btn-primary"
                                onClick={openCreate}
                                style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, padding: '0 18px', borderRadius: '10px', fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(99,102,241,0.2)', whiteSpace: 'nowrap' }}
                            >
                                <Plus size={16} /> New Report
                            </button>
                        )}
                    </div>
                </div>

                {/* Filters toolbar */}
                <div style={{
                    padding: '0.75rem 1rem', borderRadius: '14px', background: 'var(--surface-color)',
                    border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', marginBottom: '1rem',
                    display: 'flex', flexDirection: 'column', gap: '10px',
                }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search reports, goals, or descriptions..."
                                className="form-input"
                                style={{ paddingLeft: '36px', height: '40px', border: 'none', background: 'var(--surface-hover)', borderRadius: '10px', fontSize: '0.875rem' }}
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setSemanticResults(null); }}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setSemanticResults(null); } }}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSemanticSearch}
                            disabled={isSemanticLoading || !searchQuery.trim()}
                            style={{
                                height: '40px', padding: '0 1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '7px',
                                fontSize: '0.85rem', fontWeight: 700, cursor: isSemanticLoading || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                                background: semanticResults !== null ? 'var(--primary-color)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff', border: 'none', opacity: !searchQuery.trim() ? 0.5 : 1,
                                boxShadow: '0 4px 12px rgba(99,102,241,0.25)', whiteSpace: 'nowrap',
                            }}
                        >
                            {isSemanticLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                            AI Search
                        </button>
                    </div>

                    {semanticResults !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 12px', borderRadius: '10px', background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)', border: '1px solid #c7d2fe' }}>
                            <Zap size={14} color="#6366f1" />
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4f46e5' }}>
                                AI Search — {semanticResults.length} result{semanticResults.length !== 1 ? 's' : ''}
                            </span>
                            <button
                                onClick={() => setSemanticResults(null)}
                                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: '6px' }}
                            >
                                <X size={12} /> Clear
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Briefcase size={13} color="var(--text-muted)" />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Project</span>
                            <AppSelect
                                size="sm"
                                value={filterProjectId}
                                onChange={setFilterProjectId}
                                options={[
                                    { value: '', label: 'All Projects' },
                                    ...Object.entries(projectsMap).map(([id, name]) => ({ value: id, label: name as string })),
                                ]}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Filter size={13} color="var(--text-muted)" />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</span>
                            <AppSelect
                                size="sm"
                                value={filterStatus}
                                onChange={setFilterStatus}
                                options={[
                                    { value: '', label: 'Any Status' },
                                    { value: '0', label: 'Drafting' },
                                    { value: '1', label: 'Submitted' },
                                    { value: '2', label: 'Approved' },
                                    { value: '3', label: 'Revision' },
                                ]}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <User size={13} color="var(--text-muted)" />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Member</span>
                            <AppSelect
                                size="sm"
                                value={filterMemberId}
                                onChange={setFilterMemberId}
                                options={[
                                    { value: '', label: 'All Members' },
                                    ...usersList.map(u => ({ value: u.id, label: u.name })),
                                ]}
                            />
                        </div>
                        {!loading && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                                {displayReports.length} report{displayReports.length !== 1 ? 's' : ''}
                                {reports.length !== displayReports.length ? ` / ${reports.length}` : ''}
                            </span>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {[
                            { id: 'my_reports',  label: 'My Reports',      icon: <FileText size={15} />,   hidden: isLabDirector },
                            { id: 'all_reports', label: 'All Reports',     icon: <LayoutGrid size={15} />, hidden: !isLabDirector },
                            { id: 'my_assignee', label: 'Review Requests', icon: <CheckCircle size={15} />, hidden: false },
                        ].map(tab => !tab.hidden && (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                style={{
                                    padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '7px',
                                    border: 'none', background: 'none', cursor: 'pointer',
                                    color: activeTab === tab.id ? 'var(--primary-color)' : '#64748b',
                                    borderBottom: activeTab === tab.id ? '3px solid var(--primary-color)' : '3px solid transparent',
                                    fontWeight: activeTab === tab.id ? 800 : 500,
                                    transition: 'all 0.2s', fontSize: '0.85rem',
                                }}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main: Calendar + Day list / Panel */}
                <div
                    style={{
                        display: 'flex',
                        gap: 14,
                        alignItems: 'stretch',
                        height: 'calc(100vh - 310px)',
                        minHeight: '700px',
                    }}
                >

                    {/* Left: Calendar */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', flex: 1 }}>
                                <Loader2 className="animate-spin" size={28} color="var(--primary-color)" />
                            </div>
                        ) : renderCalendar()}
                    </div>

                    {/* Right: Sidebar (day list) or Report Panel */}
                    <div
                        style={
                            isPanelOpen
                                ? { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }
                                : { width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }
                        }
                    >
                        {loading ? (
                            <div className="bk-card" style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Loader2 className="animate-spin" size={24} color="var(--primary-color)" />
                            </div>
                        ) : isPanelOpen && (isAdding || selectedReportId) ? (
                            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                                <ReportPanel
                                    reportId={isAdding ? null : selectedReportId}
                                    isAdding={isAdding}
                                    isAuthorFallback={activeTab === 'my_reports'}
                                    onClose={closePanel}
                                    onSaved={(_shouldClose, message, newReportId) => {
                                        if (message) showToast(message, 'success');
                                        fetchReports();
                                        if (isAdding && newReportId) {
                                            setIsAdding(false);
                                            setSelectedReportId(newReportId);
                                        } else if (_shouldClose) {
                                            closePanel();
                                        }
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="bk-card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: '#E8720C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        {selectedCalDate
                                            ? (sameDay(selectedCalDate, new Date()) ? 'Today' : 'Selected day')
                                            : 'Pick a day'
                                        }
                                    </div>
                                    <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2, letterSpacing: '-0.01em' }}>
                                        {selectedCalDate
                                            ? selectedCalDate.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                                            : 'Select a date'
                                        }
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                        {selectedCalDate
                                            ? `${selectedDayReports.length} report${selectedDayReports.length !== 1 ? 's' : ''}`
                                            : 'Click any date on the calendar'
                                        }
                                    </div>
                                </div>

                                <div className="bk-scroll" style={{ overflow: 'auto', flex: 1 }}>
                                    <div style={{ padding: '14px 16px 10px' }}>
                                        <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                                            Reports
                                        </div>

                                        {selectedCalDay === null ? (
                                            <div style={{ textAlign: 'center', padding: '18px 6px', color: '#94a3b8' }}>
                                                <Target size={34} style={{ opacity: 0.25, marginBottom: 10 }} />
                                                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Select a day to view reports</div>
                                                <div style={{ fontSize: 11, marginTop: 4 }}>Use the month grid on the left</div>
                                            </div>
                                        ) : selectedDayReports.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '18px 6px', color: '#94a3b8' }}>
                                                <CalendarDays size={34} style={{ opacity: 0.25, marginBottom: 10 }} />
                                                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>No reports on this day</div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {selectedDayReports.map(r => renderCard(r, true))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </MainLayout>
    );
};

export default Reports;
