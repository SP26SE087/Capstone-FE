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
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import reportService, { Report } from '@/services/reportService';
import { projectService, userService } from '@/services';
import { useToastStore } from '@/store/slices/toastSlice';
import ReportPanel from './components/ReportPanel';

type TabType = 'my_reports' | 'all_reports' | 'my_assignee';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

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

    const prevMonth = () => {
        setSelectedCalDay(null);
        if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
        else setCalMonth(m => m - 1);
    };
    const nextMonth = () => {
        setSelectedCalDay(null);
        if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
        else setCalMonth(m => m + 1);
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
        new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

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

    const calendarCells = useMemo(() => {
        const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const cells: (number | null)[] = [];
        for (let i = 0; i < firstDow; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }, [calYear, calMonth]);

    const todayY = new Date().getFullYear();
    const todayM = new Date().getMonth();
    const todayD = new Date().getDate();

    const renderCard = (report: Report) => {
        const statusInfo = getSmartStatus(report);
        const isSelected = selectedReportId === report.id;
        const author = (report as any).userName || (report as any).UserName || usersMap[report.userId] || null;
        const projectName = projectsMap[report.projectId] || null;

        return (
            <div
                key={report.id}
                onClick={() => openReport(report)}
                style={{
                    padding: isPanelOpen ? '0.65rem 0.85rem' : '0.85rem 1.1rem',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid var(--primary-color)' : '1px solid #e2e8f0',
                    backgroundColor: isSelected ? '#f8fafc' : 'white',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 6px 20px -4px rgba(99,102,241,0.15)' : '0 2px 6px -1px rgba(0,0,0,0.04)',
                    position: 'relative', overflow: 'hidden',
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
        <div>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '12px', padding: '8px 12px',
                background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0',
            }}>
                <button onClick={prevMonth} style={{ border: 'none', background: '#f1f5f9', borderRadius: '7px', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                    <ChevronLeft size={15} />
                </button>
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>
                    {MONTH_NAMES[calMonth]} {calYear}
                    <span style={{ marginLeft: '8px', fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8' }}>
                        ({[...calendarMap.values()].reduce((s, arr) => s + arr.length, 0)} report{[...calendarMap.values()].reduce((s, arr) => s + arr.length, 0) !== 1 ? 's' : ''})
                    </span>
                </span>
                <button onClick={nextMonth} style={{ border: 'none', background: '#f1f5f9', borderRadius: '7px', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                    <ChevronRight size={15} />
                </button>
            </div>
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f1f5f9' }}>
                    {DAY_NAMES.map(d => (
                        <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {d}
                        </div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                    {calendarCells.map((day, idx) => {
                        if (!day) return (
                            <div key={idx} style={{ minHeight: '72px', borderRight: (idx + 1) % 7 !== 0 ? '1px solid #f8fafc' : 'none', borderBottom: '1px solid #f8fafc', background: '#fafafa' }} />
                        );
                        const isToday = day === todayD && calYear === todayY && calMonth === todayM;
                        const dayReports = calendarMap.get(day) || [];
                        return (
                            <div
                                key={idx}
                                onClick={() => { setSelectedCalDay(day); setIsPanelOpen(false); setSelectedReportId(null); setIsAdding(false); }}
                                onMouseEnter={e => { e.currentTarget.style.background = selectedCalDay === day ? '#eff6ff' : '#f0f4ff'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = selectedCalDay === day ? '#eff6ff' : dayReports.length > 0 ? '#f8faff' : 'white'; }}
                                style={{
                                    minHeight: '64px', padding: '6px',
                                    borderRight: (idx + 1) % 7 !== 0 ? '1px solid #f1f5f9' : 'none',
                                    borderBottom: '1px solid #f1f5f9',
                                    background: selectedCalDay === day ? '#eff6ff' : dayReports.length > 0 ? '#f8faff' : 'white',
                                    outline: selectedCalDay === day ? '2px solid var(--primary-color)' : 'none',
                                    outlineOffset: '-2px',
                                    transition: 'background 0.12s', cursor: 'pointer',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                }}
                            >
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    fontSize: '0.82rem', fontWeight: isToday ? 800 : (dayReports.length > 0 ? 700 : 400),
                                    background: isToday ? 'var(--primary-color)' : 'transparent',
                                    color: isToday ? '#fff' : dayReports.length > 0 ? '#1e293b' : '#94a3b8',
                                }}>
                                    {day}
                                </span>
                                {dayReports.length > 0 && (
                                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center', justifyContent: 'center' }}>
                                        {dayReports.slice(0, 3).map((r, i) => {
                                            const sc = getSmartStatus(r);
                                            return <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: sc.color, flexShrink: 0 }} />;
                                        })}
                                        {dayReports.length > 3 && <span style={{ fontSize: '0.55rem', color: '#94a3b8', fontWeight: 700 }}>+{dayReports.length - 3}</span>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
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
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

                    {/* Left: Calendar */}
                    <div style={{ flex: 5, minWidth: 0, maxHeight: 'calc(100vh - 310px)', overflowY: 'auto' }} className="custom-scrollbar">
                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                                <Loader2 className="animate-spin" size={28} color="var(--primary-color)" />
                            </div>
                        ) : renderCalendar()}
                    </div>

                    {/* Right: Day list */}
                    {selectedCalDay !== null && !isPanelOpen && (() => {
                        const dayReports = calendarMap.get(selectedCalDay) || [];
                        return (
                            <div style={{ flex: 5, minWidth: 0, maxHeight: 'calc(100vh - 310px)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '10px 14px', flexShrink: 0,
                                    background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0',
                                }}>
                                    <div style={{ width: '3px', height: '18px', borderRadius: '2px', background: 'var(--primary-color)', flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>
                                        {selectedCalDay} {MONTH_NAMES[calMonth]} {calYear}
                                    </span>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#ede9fe', color: '#7c3aed', padding: '2px 8px', borderRadius: '20px' }}>
                                        {dayReports.length} report{dayReports.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }} className="custom-scrollbar">
                                    {dayReports.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                                            <CalendarDays size={36} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                            <p style={{ fontSize: '0.82rem' }}>No reports on this day</p>
                                        </div>
                                    ) : dayReports.map(r => renderCard(r))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Right: Report Panel */}
                    {isPanelOpen && (isAdding || selectedReportId) && (
                        <div style={{ flex: 5, minWidth: 0, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }} className="custom-scrollbar">
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
                    )}

                    {/* Empty state */}
                    {selectedCalDay === null && !isPanelOpen && !loading && (
                        <div style={{ flex: 5, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '320px', background: 'white', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                                <Target size={40} style={{ opacity: 0.25, marginBottom: '12px' }} />
                                <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>Select a day to view reports</p>
                                <p style={{ fontSize: '0.75rem', margin: '4px 0 0' }}>Click any date on the calendar</p>
                            </div>
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

export default Reports;
