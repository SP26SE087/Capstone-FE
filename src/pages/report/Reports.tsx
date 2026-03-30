import React, { useState, useEffect, useMemo } from 'react';
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
    Loader2
} from 'lucide-react';
import reportService, { Report } from '@/services/reportService';
import { projectService, userService } from '@/services';

// Internal Components
import ReportList from './components/ReportList';
import ReportPanel from './components/ReportPanel';

type TabType = 'my_reports' | 'all_reports' | 'my_assignee';

const Reports: React.FC = () => {
    const { user } = useAuth();
    
    // Layout State
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    
    // Data State
    const [activeTab, setActiveTab] = useState<TabType>('my_reports');
    const [searchQuery, setSearchQuery] = useState('');
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(false);
    const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    
    // Search Filters
    const [filterProjectId, setFilterProjectId] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [isSemantic, setIsSemantic] = useState<boolean>(false);
    const topK = 5;

    const isLabDirector = React.useMemo(() => {
        const role = Number(user.role);
        return role === 1 || role === 2;
    }, [user.role]);

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
                console.error("Failed to load metadata", e);
            }
        };
        fetchMetadata();
    }, []);

    useEffect(() => {
        fetchReports();
    }, [activeTab]);


    const fetchReports = async () => {
        setLoading(true);
        try {
            let data;
            if (activeTab === 'my_reports') {
                data = await reportService.getMyReports();
            } else if (activeTab === 'all_reports' && isLabDirector) {
                data = await reportService.getAllReports();
            } else if (activeTab === 'my_assignee') {
                data = await reportService.getAssignedReports();
            }
            setReports(Array.isArray(data) ? data : (data?.data || []));
        } catch (error) {
            console.error('Failed to fetch reports:', error);
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            fetchReports();
            return;
        }
        if (!isSemantic) return;

        setLoading(true);
        try {
            const req: any = { query: searchQuery, topK: topK };
            if (filterProjectId) req.projectId = filterProjectId;
            if (filterStatus !== '') req.status = Number(filterStatus);

            const data = await reportService.searchReports(req);
            setReports(Array.isArray(data) ? data : (data?.data || []));
        } catch (error) {
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    const displayReports = useMemo(() => {
        if (isSemantic && searchQuery.trim()) return reports;

        return reports.filter(report => {
            const query = searchQuery.toLowerCase();
            const matchesQuery = !query || 
                (report.title?.toLowerCase().includes(query)) ||
                (report.description?.toLowerCase().includes(query)) ||
                (report.goals?.toLowerCase().includes(query));
            
            const matchesProject = !filterProjectId || report.projectId === filterProjectId;
            const matchesStatus = filterStatus === '' || report.status === Number(filterStatus);

            return matchesQuery && matchesProject && matchesStatus;
        });
    }, [reports, searchQuery, filterProjectId, filterStatus, isSemantic]);

    const getStatusLabel = (status: number) => {
        switch (status) {
            case 0: return { label: 'Drafting', color: '#64748b', icon: <FileInput size={14} /> };
            case 1: return { label: 'Submitted', color: '#0ea5e9', icon: <Clock size={14} /> };
            case 2: return { label: 'Approved', color: '#10b981', icon: <CheckCircle size={14} /> };
            case 3: return { label: 'Revision', color: '#f59e0b', icon: <AlertTriangle size={14} /> };
            default: return { label: 'Unknown', color: '#94a3b8', icon: <AlertTriangle size={14} /> };
        }
    };

    const isSplit = !!selectedReportId || isAdding;

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container" style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>
                
                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)' }}>
                                <FileText size={24} />
                            </div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                Project Reports
                                <button 
                                    className="btn btn-primary" 
                                    onClick={() => setIsAdding(true)} 
                                    style={{ 
                                        display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, padding: '0.6rem 1.25rem', borderRadius: '12px', fontSize: '0.85rem',
                                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                                    }}
                                >
                                    <Plus size={18} /> Draft New Report
                                </button>
                            </h1>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>
                            Intelligent repository for team progress and research summaries.
                        </p>
                    </div>
                </div>

                {/* Search Toolbar */}
                <div style={{ 
                    padding: '0.75rem 1.5rem', borderRadius: '14px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem'
                }}>
                     <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text" placeholder="Search reports, goals, or descriptions..." className="form-input"
                                    style={{ paddingLeft: '40px', height: '44px', border: 'none', background: 'var(--surface-hover)', borderRadius: '12px', fontSize: '0.9rem' }}
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        if (isSemantic) setIsSemantic(false);
                                    }}
                                />
                            </div>
                            <button 
                                type="submit" onClick={() => setIsSemantic(true)}
                                className="btn btn-primary" style={{ height: '44px', padding: '0 1.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 600 }}
                            >
                                <Sparkles size={16} /> Semantic Search
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Briefcase size={14} color="var(--text-muted)" />
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Project:</span>
                                <select style={{ height: '32px', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-color)' }} value={filterProjectId} onChange={e => setFilterProjectId(e.target.value)}>
                                    <option value="">All Projects</option>
                                    {Object.entries(projectsMap).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Filter size={14} color="var(--text-muted)" />
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status:</span>
                                <select style={{ height: '32px', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-color)' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                    <option value="">Any Status</option>
                                    <option value="0">Drafting</option>
                                    <option value="1">Submitted</option>
                                    <option value="2">Approved</option>
                                    <option value="3">Revision Required</option>
                                </select>
                            </div>
                        </div>
                     </form>
                </div>

                <div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 380px)', minHeight: '500px' }}>
                    
                    {/* Left Column: List & Filters */}
                    <div style={{ 
                        flex: isSplit ? 4 : 10, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '1.5rem',
                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        width: isSplit ? '40%' : '100%',
                        overflow: 'hidden'
                    }}>

                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e2e8f0', overflowX: 'auto', whiteSpace: 'nowrap' }} className="custom-scrollbar">
                            {[
                                { id: 'my_reports', label: 'My Reports', icon: <FileText size={16} /> },
                                { id: 'all_reports', label: 'All Reports', icon: <LayoutGrid size={16} />, hidden: !isLabDirector },
                                { id: 'my_assignee', label: 'Review Requests', icon: <CheckCircle size={16} /> }
                            ].map(tab => !tab.hidden && (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    style={{ 
                                        padding: '12px 10px', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'none', cursor: 'pointer',
                                        color: activeTab === tab.id ? 'var(--primary-color)' : '#64748b',
                                        borderBottom: activeTab === tab.id ? '3px solid var(--primary-color)' : '3px solid transparent',
                                        fontWeight: activeTab === tab.id ? 800 : 500, transition: 'all 0.2s', fontSize: '0.85rem',
                                        flex: '0 0 auto', minWidth: '130px', justifyContent: 'center'
                                    }}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* List Content */}
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
                            {loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 className="animate-spin" size={32} /></div>
                            ) : displayReports.length > 0 ? (
                                <ReportList 
                                    reports={displayReports} 
                                    selectedId={selectedReportId} 
                                    onSelect={(r) => { setSelectedReportId(r.id); setIsAdding(false); }}
                                    projectsMap={projectsMap} 
                                    usersMap={usersMap}
                                    getStatusLabel={getStatusLabel}
                                    isSplit={isSplit}
                                />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                                    <Target size={48} style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>No Reports</h3>
                                    <p style={{ fontSize: '0.85rem' }}>Create a new entry.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Panel */}
                    <div style={{ 
                        flex: isSplit ? 6 : 0, 
                        opacity: isSplit ? 1 : 0,
                        pointerEvents: isSplit ? 'auto' : 'none',
                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        width: isSplit ? '60%' : '0',
                        overflow: 'hidden',
                        display: isSplit ? 'block' : 'none'
                    }}>
                        {isSplit && (
                            <ReportPanel 
                                reportId={selectedReportId}
                                isAdding={isAdding}
                                onClose={() => { setSelectedReportId(null); setIsAdding(false); }}
                                onSaved={() => fetchReports()}
                            />
                        )}
                    </div>

                </div>
            </div>
            
            <style>{`
                .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; font-weight: 700; height: 38px; padding: 0 16px; border-radius: 8px; cursor: pointer; display: flex; alignItems: center; gap: 8px; transition: all 0.2s; }
                .btn-secondary:hover { background: #e2e8f0; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </MainLayout>
    );
};

export default Reports;
