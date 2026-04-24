import React, { useState, useEffect, useMemo } from 'react';
import {
    Search,
    FileText,
    CheckCircle,
    Clock,
    AlertTriangle,
    FileInput,
    Filter,
    Target,
    Loader2,
    RotateCcw,
    User
} from 'lucide-react';
import reportService, { Report } from '@/services/reportService';
import { userService } from '@/services/userService';
import { useToastStore } from '@/store/slices/toastSlice';
import AppSelect from '@/components/common/AppSelect';
import ReportPanel from '@/pages/report/components/ReportPanel';

interface DetailsReportsProps {
    projectId: string;
}

const DetailsReports: React.FC<DetailsReportsProps> = ({ projectId }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});

    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

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

    useEffect(() => {
        fetchReports();
    }, [projectId]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchReports();
        } finally {
            setRefreshing(false);
        }
    };

    const handleSelectReport = (report: Report) => {
        setSelectedReportId(report.id);
        setIsPanelOpen(true);
    };

    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setSelectedReportId(null);
    };

    const getStatusLabel = (status: number) => {
        switch (status) {
            case 0: return { label: 'Drafting', color: '#64748b', icon: <FileInput size={13} /> };
            case 1: return { label: 'Submitted', color: '#0ea5e9', icon: <Clock size={13} /> };
            case 2: return { label: 'Approved', color: '#10b981', icon: <CheckCircle size={13} /> };
            case 3: return { label: 'Revision', color: '#ef4444', icon: <AlertTriangle size={13} /> };
            default: return { label: 'Draft', color: '#64748b', icon: <FileInput size={13} /> };
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

    const displayReports = useMemo(() => {
        return reports.filter(report => {
            const query = searchQuery.toLowerCase();
            const matchesQuery = !query ||
                (report.title?.toLowerCase().includes(query)) ||
                (report.description?.toLowerCase().includes(query)) ||
                (report.goals?.toLowerCase().includes(query));
            const matchesStatus = filterStatus === '' || report.status === Number(filterStatus);
            return matchesQuery && matchesStatus;
        });
    }, [reports, searchQuery, filterStatus]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex', gap: '10px', alignItems: 'center',
                padding: '0.75rem 1rem', borderRadius: '12px',
                background: 'var(--surface-color)', border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)'
            }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search reports, goals, or descriptions..."
                        className="form-input"
                        style={{ paddingLeft: '36px', height: '40px', border: 'none', background: 'var(--surface-hover)', borderRadius: '10px', fontSize: '0.875rem' }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Status filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Filter size={13} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Status:</span>
                    <AppSelect
                        size="sm"
                        value={filterStatus}
                        onChange={setFilterStatus}
                        options={[
                            { value: '', label: 'Any' },
                            { value: '0', label: 'Drafting' },
                            { value: '1', label: 'Submitted' },
                            { value: '2', label: 'Approved' },
                            { value: '3', label: 'Revision' },
                        ]}
                    />
                </div>

                {/* Refresh */}
                <button
                    onClick={handleRefresh}
                    disabled={refreshing || loading}
                    style={{
                        height: '38px', padding: '0 12px', border: '1px solid #e2e8f0', background: 'white',
                        borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                        opacity: refreshing || loading ? 0.6 : 1
                    }}
                >
                    <RotateCcw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    Refresh
                </button>
            </div>

            {/* Count */}
            {!loading && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {displayReports.length} report{displayReports.length !== 1 ? 's' : ''}
                    {reports.length !== displayReports.length ? ` (filtered from ${reports.length})` : ''}
                </div>
            )}

            {/* Content */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                {/* List */}
                <div style={{
                    flex: isPanelOpen ? 4 : 10,
                    transition: 'flex 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    minWidth: 0,
                    maxHeight: 'calc(100vh - 320px)',
                    overflowY: 'auto'
                }} className="custom-scrollbar">
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                            <Loader2 className="animate-spin" size={28} color="var(--primary-color)" />
                        </div>
                    ) : displayReports.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                            <Target size={44} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>No Reports Found</h3>
                            <p style={{ fontSize: '0.85rem' }}>
                                {reports.length === 0
                                    ? 'No reports have been submitted for this project yet.'
                                    : 'No reports match your current filters.'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {displayReports.map(report => {
                                const statusInfo = getSmartStatus(report);
                                const isSelected = selectedReportId === report.id;

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
                                            display: 'flex',
                                            flexDirection: 'column',
                                            transition: 'all 0.2s ease',
                                            boxShadow: isSelected
                                                ? '0 6px 20px -4px rgba(99,102,241,0.15)'
                                                : '0 2px 6px -1px rgba(0,0,0,0.04)',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {isSelected && (
                                            <div style={{
                                                position: 'absolute', top: 0, left: 0,
                                                width: '3px', height: '100%',
                                                background: 'var(--primary-color)'
                                            }} />
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h3 style={{
                                                    margin: 0, marginBottom: '4px',
                                                    fontSize: isPanelOpen ? '0.875rem' : '0.95rem',
                                                    color: isSelected ? 'var(--primary-color)' : '#1e293b',
                                                    fontWeight: 600,
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                }}>
                                                    {report.title || 'Untitled Report'}
                                                </h3>
                                                <div style={{
                                                    display: 'flex', gap: '12px', flexWrap: 'wrap',
                                                    fontSize: '0.75rem', color: '#64748b'
                                                }}>
                                                    {(() => {
                                                        const author = (report as any).userName || (report as any).UserName ||
                                                            usersMap[report.userId] || null;
                                                        return author ? (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                <User size={12} />
                                                                <span style={{ fontWeight: 500, color: '#334155' }}>{author}</span>
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                    {report.submitedAt && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Clock size={12} />
                                                            {new Date(report.submitedAt).toLocaleDateString('vi-VN', {
                                                                day: '2-digit', month: '2-digit', year: 'numeric'
                                                            })}
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
                                                fontSize: '0.68rem', fontWeight: 600,
                                                border: `1px solid ${statusInfo.color}25`,
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {statusInfo.icon}
                                                {statusInfo.label.toUpperCase()}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Detail Panel */}
                {isPanelOpen && selectedReportId && (
                    <div style={{
                        flex: 6,
                        minWidth: 0,
                        maxHeight: 'calc(100vh - 180px)',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column'
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
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default DetailsReports;
