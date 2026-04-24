import React, { useState, useEffect, useMemo } from 'react';
import {
    Search,
    CheckCircle,
    Clock,
    AlertTriangle,
    FileInput,
    Target,
    Loader2,
    RotateCcw,
    User,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import reportService, { Report } from '@/services/reportService';
import { userService } from '@/services/userService';
import { useToastStore } from '@/store/slices/toastSlice';
import AppSelect from '@/components/common/AppSelect';
import ReportPanel from '@/pages/report/components/ReportPanel';

interface DetailsReportsProps {
    projectId: string;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const DetailsReports: React.FC<DetailsReportsProps> = ({ projectId }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});

    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Calendar navigation
    const [calYear, setCalYear] = useState(() => new Date().getFullYear());
    const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

    // Calendar: selected day
    const [selectedCalDay, setSelectedCalDay] = useState<number | null>(null);

    // Selected report panel state
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const { addToast } = useToastStore();
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') =>
        addToast(message, type);

    const fetchReports = async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const data = await reportService.getByProject(projectId);
            setReports(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch project reports:', error);
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const uData = await userService.getAll();
                const uMap: Record<string, string> = {};
                (uData || []).forEach((u: any) => {
                    uMap[u.userId || u.id] = u.fullName || u.name || u.email || '';
                });
                setUsersMap(uMap);
            } catch (e) {
                console.error('Failed to load users', e);
            }
        };
        fetchUsers();
    }, []);

    useEffect(() => { fetchReports(); }, [projectId]);

    // Auto-select today when calendar is on current month
    useEffect(() => {
        const now = new Date();
        if (calYear === now.getFullYear() && calMonth === now.getMonth()) {
            setSelectedCalDay(now.getDate());
        }
    }, [reports, calYear, calMonth]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try { await fetchReports(); } finally { setRefreshing(false); }
    };

    const handleSelectReport = (report: Report) => {
        setSelectedReportId(report.id);
        setIsPanelOpen(true);
    };

    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setSelectedReportId(null);
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

    const getStatusLabel = (status: number) => {
        switch (status) {
            case 0: return { label: 'Drafting',   color: '#64748b', icon: <FileInput size={13} /> };
            case 1: return { label: 'Submitted',  color: '#0ea5e9', icon: <Clock size={13} /> };
            case 2: return { label: 'Approved',   color: '#10b981', icon: <CheckCircle size={13} /> };
            case 3: return { label: 'Revision',   color: '#ef4444', icon: <AlertTriangle size={13} /> };
            default: return { label: 'Draft',     color: '#64748b', icon: <FileInput size={13} /> };
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

    const displayReports = useMemo(() => reports.filter(report => {
        const query = searchQuery.toLowerCase();
        const matchesQuery = !query ||
            (report.title?.toLowerCase().includes(query)) ||
            (report.description?.toLowerCase().includes(query)) ||
            (report.goals?.toLowerCase().includes(query));
        const matchesStatus = filterStatus === '' || report.status === Number(filterStatus);
        return matchesQuery && matchesStatus;
    }), [reports, searchQuery, filterStatus]);

    // Calendar: map day â†’ reports for current month
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

    // Build grid cells for the calendar
    const calendarCells = useMemo(() => {
        const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // Mon=0
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

    // â”€â”€â”€ Render list card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const renderCard = (report: Report) => {
        const statusInfo = getSmartStatus(report);
        const isSelected = selectedReportId === report.id;
        const author = (report as any).userName || (report as any).UserName || usersMap[report.userId] || null;

        return (
            <div
                key={report.id}
                onClick={() => handleSelectReport(report)}
                style={{
                    padding: isPanelOpen ? '0.65rem 0.85rem' : '0.85rem 1.1rem',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid var(--primary-color)' : '1px solid #e2e8f0',
                    backgroundColor: isSelected ? '#f8fafc' : 'white',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 6px 20px -4px rgba(99,102,241,0.15)' : '0 2px 6px -1px rgba(0,0,0,0.04)',
                    position: 'relative', overflow: 'hidden'
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
                            {report.submitedAt ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0ea5e9', fontWeight: 600 }}>
                                    <Clock size={11} />
                                    Submitted: {fmtDate(report.submitedAt)}
                                </span>
                            ) : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontStyle: 'italic' }}>
                                    <Clock size={11} />
                                    Not submitted yet
                                </span>
                            )}
                        </div>
                        {!isPanelOpen && (report.description || report.goals) && (
                            <p style={{
                                margin: '6px 0 0', fontSize: '0.8rem', color: '#475569',
                                display: '-webkit-box', WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.55
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
                        whiteSpace: 'nowrap'
                    }}>
                        {statusInfo.icon}
                        {statusInfo.label.toUpperCase()}
                    </div>
                </div>
            </div>
        );
    };

    // â”€â”€â”€ Render calendar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const renderCalendar = () => (
        <div>
            {/* Month nav */}
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

            {/* Grid */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f1f5f9' }}>
                    {DAY_NAMES.map(d => (
                        <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {d}
                        </div>
                    ))}
                </div>
                {/* Cells */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                    {calendarCells.map((day, idx) => {
                        if (!day) return <div key={idx} style={{ minHeight: '72px', borderRight: (idx + 1) % 7 !== 0 ? '1px solid #f8fafc' : 'none', borderBottom: '1px solid #f8fafc', background: '#fafafa' }} />;

                        const isToday = day === todayD && calYear === todayY && calMonth === todayM;
                        const dayReports = calendarMap.get(day) || [];

                        return (
                            <div
                                key={idx}
                                style={{
                                    minHeight: '64px', padding: '6px',
                                    borderRight: (idx + 1) % 7 !== 0 ? '1px solid #f1f5f9' : 'none',
                                    borderBottom: '1px solid #f1f5f9',
                                    background: selectedCalDay === day ? '#eff6ff' : dayReports.length > 0 ? '#f8faff' : 'white',
                                    outline: selectedCalDay === day ? '2px solid var(--primary-color)' : 'none',
                                    outlineOffset: '-2px',
                                    transition: 'background 0.12s',
                                    cursor: 'pointer',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                }}
                                onClick={() => setSelectedCalDay(day)}
                                onMouseEnter={e => { e.currentTarget.style.background = selectedCalDay === day ? '#eff6ff' : '#f0f4ff'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = selectedCalDay === day ? '#eff6ff' : dayReports.length > 0 ? '#f8faff' : 'white'; }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* â”€â”€ Top bar: view tabs + search/filter/refresh â”€â”€ */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>

                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                    <input
                        type="text"
                        placeholder="Search reports..."
                        className="form-input"
                        style={{ paddingLeft: '32px', height: '38px', border: '1px solid #e2e8f0', borderRadius: '9px', fontSize: '0.82rem', background: '#fff' }}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Status filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Status</span>
                    <AppSelect
                        size="sm"
                        value={filterStatus}
                        onChange={setFilterStatus}
                        options={[
                            { value: '', label: 'All' },
                            { value: '0', label: 'Drafting' },
                            { value: '1', label: 'Submitted' },
                            { value: '2', label: 'Approved' },
                            { value: '3', label: 'Revision' },
                        ]}
                    />
                </div>

                {/* Count badge */}
                {!loading && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {displayReports.length} report{displayReports.length !== 1 ? 's' : ''}
                        {reports.length !== displayReports.length ? ` / ${reports.length}` : ''}
                    </span>
                )}

                {/* Refresh */}
                <button
                    onClick={handleRefresh}
                    disabled={refreshing || loading}
                    style={{
                        height: '38px', padding: '0 12px', border: '1px solid #e2e8f0', background: 'white',
                        borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                        opacity: refreshing || loading ? 0.6 : 1, flexShrink: 0,
                    }}
                >
                    <RotateCcw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    Refresh
                </button>
            </div>

            {/* â”€â”€ Main content â”€â”€ */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

                {/* Left: Calendar */}
                <div style={{
                    flex: 5,
                    transition: 'flex 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    minWidth: 0,
                    maxHeight: 'calc(100vh - 220px)',
                    overflowY: 'auto',
                }} className="custom-scrollbar">
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                            <Loader2 className="animate-spin" size={28} color="var(--primary-color)" />
                        </div>
                    ) : (
                        renderCalendar()
                    )}
                </div>

                {/* Right: Calendar day list */}
                {selectedCalDay !== null && !isPanelOpen && (() => {
                    const dayReports = calendarMap.get(selectedCalDay) || [];
                    return (
                        <div style={{
                            flex: 5, minWidth: 0, minHeight: 0,
                            maxHeight: 'calc(100vh - 220px)',
                            display: 'flex', flexDirection: 'column', gap: '10px',
                        }}>
                            {/* Header */}
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
                            {/* Cards */}
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

                {/* Right: Detail Panel */}
                {isPanelOpen && selectedReportId && (
                    <div style={{
                        flex: 5,
                        minWidth: 0,
                        maxHeight: 'calc(100vh - 100px)',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                    }} className="custom-scrollbar">
                        <ReportPanel
                            reportId={selectedReportId}
                            isAdding={false}
                            onClose={handleClosePanel}
                            onSaved={(_shouldClose, message) => {
                                if (message) showToast(message, 'success');
                                fetchReports();
                            }}
                        />
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default DetailsReports;
