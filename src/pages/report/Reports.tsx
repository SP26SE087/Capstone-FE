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
    Edit3,
    ChevronRight,
    Zap,
    RotateCcw
} from 'lucide-react';
import reportService, { Report } from '@/services/reportService';
import { projectService, userService } from '@/services';
import { useToastStore } from '@/store/slices/toastSlice';

// Internal Components
import ReportList from './components/ReportList';
import ReportPanel from './components/ReportPanel';

type TabType = 'my_reports' | 'all_reports' | 'my_assignee';

const Reports: React.FC = () => {
    const { user } = useAuth();

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

    // Semantic Search State
    const [semanticResults, setSemanticResults] = useState<Report[] | null>(null);
    const [isSemanticLoading, setIsSemanticLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Multi-tab State
    interface ReportTab {
        id: string;
        type: 'create' | 'update';
        reportId?: string;
        title: string;
        isAuthor?: boolean;
    }
    const [openTabs, setOpenTabs] = useState<ReportTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
    const [isUpdateDropdownOpen, setIsUpdateDropdownOpen] = useState(false);
    const createDropdownRef = React.useRef<HTMLDivElement>(null);
    const updateDropdownRef = React.useRef<HTMLDivElement>(null);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
                setIsCreateDropdownOpen(false);
            }
            if (updateDropdownRef.current && !updateDropdownRef.current.contains(event.target as Node)) {
                setIsUpdateDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { addToast } = useToastStore();
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => addToast(message, type);

    const activeTabObj = openTabs.find(t => t.id === activeTabId);

    const isLabDirector = React.useMemo(() => {
        if (!user) return false;
        const role = Number(user.role);
        return role === 1 || role === 2;
    }, [user?.role]);

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

    // Set default tab to all_reports for Lab Director
    useEffect(() => {
        if (isLabDirector) {
            setActiveTab('all_reports');
        }
    }, [isLabDirector]);

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

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchReports();
        } finally {
            setRefreshing(false);
        }
    };

    const handleAddCreateTab = () => {
        const createTabs = openTabs.filter(t => t.type === 'create');
        if (createTabs.length >= 5) {
            alert("Maximum 5 'Create' tabs allowed.");
            return;
        }
        if (openTabs.length >= 10) {
            alert("Maximum 10 total tabs allowed.");
            return;
        }
        const newId = `create-${Date.now()}`;
        const newTab: ReportTab = { id: newId, type: 'create', title: 'New Report' };
        setOpenTabs([...openTabs, newTab]);
        setActiveTabId(newId);
    };

    const handleOpenUpdateTab = (report: Report) => {
        const existing = openTabs.find(t => t.reportId === report.id);
        if (existing) {
            setActiveTabId(existing.id);
            return;
        }

        const updateTabs = openTabs.filter(t => t.type === 'update');
        if (updateTabs.length >= 5) {
            alert("Maximum 5 'Update' tabs allowed. Please close some to open more.");
            return;
        }
        if (openTabs.length >= 10) {
            alert("Maximum 10 total tabs allowed.");
            return;
        }

        const newId = `update-${report.id}`;
        const newTab: ReportTab = { 
            id: newId, 
            type: 'update', 
            reportId: report.id, 
            title: report.title || 'Untitled',
            isAuthor: activeTab === 'my_reports'
        };
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

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSemanticResults(null);
    };

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

    const getStatusLabel = (status: number) => {
        switch (status) {
            case 0: return { label: 'Drafting', color: '#64748b', icon: <FileInput size={14} /> };
            case 1: return { label: 'Submitted', color: '#0ea5e9', icon: <Clock size={14} /> };
            case 2: return { label: 'Approved', color: '#10b981', icon: <CheckCircle size={14} /> };
            case 3: return { label: 'Revision', color: '#ef4444', icon: <AlertTriangle size={14} /> };
            default: return { label: 'Draft', color: '#64748b', icon: <FileInput size={14} /> };
        }
    };

    const getSmartStatus = (report: Report) => {
        const base = getStatusLabel(report.status);
        if (report.status === 0) return base; // Draft remains Draft

        const reviewList = (report as any).assignees || (report as any).Assignees || [];
        if (reviewList.length === 0) return base;

        const total = reviewList.length;
        const approved = reviewList.filter((r: any) => r.status === 2).length;
        const rejected = reviewList.filter((r: any) => r.status === 3).length;

        if (rejected > 0) {
            return { label: `Revision (${rejected} Rejected)`, color: '#ef4444', icon: <AlertTriangle size={14} /> };
        }
        if (approved === total) {
            return { label: 'Fully Approved', color: '#10b981', icon: <CheckCircle size={14} /> };
        }
        if (approved > 0) {
            return { label: `Reviewing (${approved}/${total} Approved)`, color: '#6366f1', icon: <Clock size={14} /> };
        }

        return base;
    };

    const displayReports = useMemo(() => {
        if (semanticResults !== null) return semanticResults;

        if (!reports) return [];

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
    }, [reports, semanticResults, searchQuery, filterProjectId, filterStatus]);

    return (
        <MainLayout role={user?.role} userName={user?.name}>
            <div className="page-container" style={{ padding: '1rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>

                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)' }}>
                                <FileText size={24} />
                            </div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>Project Reports</h1>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>
                            Intelligent repository for team progress and research summaries.
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        style={{ padding: '6px 12px', border: '1px solid #e2e8f0', background: 'white', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                        <RotateCcw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        Refresh
                    </button>
                </div>

                {/* Search Toolbar */}
                <div style={{
                    padding: '0.625rem 1.25rem', borderRadius: '14px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', marginBottom: '1rem'
                }}>
                    <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text" placeholder="Search reports, goals, or descriptions..." className="form-input"
                                    style={{ paddingLeft: '40px', height: '44px', border: 'none', background: 'var(--surface-hover)', borderRadius: '12px', fontSize: '0.9rem' }}
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); setSemanticResults(null); }}
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-secondary" style={{ height: '44px', padding: '0 1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 600 }}
                            >
                                <Search size={16} /> Search
                            </button>
                            <button
                                type="button"
                                onClick={handleSemanticSearch}
                                disabled={isSemanticLoading || !searchQuery.trim()}
                                style={{
                                    height: '44px', padding: '0 1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px',
                                    fontSize: '0.9rem', fontWeight: 600, cursor: isSemanticLoading || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                                    background: semanticResults !== null ? 'var(--primary-color)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: '#fff', border: 'none', opacity: !searchQuery.trim() ? 0.5 : 1,
                                    boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
                                }}
                            >
                                {isSemanticLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                AI Search
                            </button>
                        </div>

                        {semanticResults !== null && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', borderRadius: '10px', background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)', border: '1px solid #c7d2fe' }}>
                                <Zap size={14} color="#6366f1" />
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4f46e5' }}>
                                    AI Search results — {semanticResults.length} report{semanticResults.length !== 1 ? 's' : ''} found
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

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Briefcase size={14} color="var(--text-muted)" />
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Project:</span>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Filter size={14} color="var(--text-muted)" />
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status:</span>
                                <AppSelect
                                    size="sm"
                                    value={filterStatus}
                                    onChange={setFilterStatus}
                                    options={[
                                        { value: '', label: 'Any Status' },
                                        { value: '0', label: 'Drafting' },
                                        { value: '1', label: 'Submitted' },
                                        { value: '2', label: 'Approved' },
                                        { value: '3', label: 'Revision Required' },
                                    ]}
                                />
                            </div>
                        </div>
                    </form>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem', gap: '2rem' }}>
                    {/* Left: Tabs */}
                    <div style={{ flex: 1, borderBottom: '1px solid #e2e8f0', overflowX: 'auto', whiteSpace: 'nowrap' }} className="custom-scrollbar">
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {[
                                { id: 'my_reports', label: 'My Reports', icon: <FileText size={16} />, hidden: isLabDirector },
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
                    </div>
                    {/* Right: Actions */}
                    {!isLabDirector && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', paddingBottom: '4px', gap: '10px' }}>
                            {/* Create Dropdown */}
                            {openTabs.length > 0 && (
                                <div style={{ position: 'relative' }} ref={createDropdownRef}>
                                    <button
                                        onClick={() => { setIsCreateDropdownOpen(!isCreateDropdownOpen); setIsUpdateDropdownOpen(false); }}
                                        style={{
                                        height: '38px', padding: '0 14px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, border: '1px solid #e2e8f0',
                                            background: openTabs.some(t => t.id === activeTabId && t.type === 'create') ? 'var(--primary-color)' : '#fff',
                                            color: openTabs.some(t => t.id === activeTabId && t.type === 'create') ? '#fff' : '#64748b',
                                            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s',
                                            boxShadow: isCreateDropdownOpen ? '0 0 0 2px var(--primary-color)22' : 'none', whiteSpace: 'nowrap'
                                        }}
                                    >
                                        <Plus size={14} /> New Report ({openTabs.filter(t => t.type === 'create').length}/5) <ChevronRight size={14} style={{ transform: isCreateDropdownOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                    </button>
                                    {isCreateDropdownOpen && (
                                        <div style={{ position: 'absolute', top: '110%', right: 0, width: '250px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 200, padding: '8px' }}>
                                            {openTabs.filter(t => t.type === 'create').length === 0 ? (
                                                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>No new reports open.</div>
                                            ) : openTabs.filter(t => t.type === 'create').map(tab => (
                                                <div
                                                    key={tab.id}
                                                    onClick={() => { setActiveTabId(tab.id); setIsCreateDropdownOpen(false); }}
                                                    style={{ padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: activeTabId === tab.id ? '#f1f5f9' : 'transparent', marginBottom: '2px' }}
                                                >
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: activeTabId === tab.id ? 'var(--primary-color)' : '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {tab.title}
                                                    </div>
                                                    <X size={14} onClick={(e) => handleCloseTab(tab.id, e)} style={{ color: '#94a3b8' }} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Update Dropdown */}
                            {openTabs.length > 0 && (
                                <div style={{ position: 'relative' }} ref={updateDropdownRef}>
                                    <button
                                        onClick={() => { setIsUpdateDropdownOpen(!isUpdateDropdownOpen); setIsCreateDropdownOpen(false); }}
                                        style={{
                                        height: '38px', padding: '0 14px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, border: '1px solid #e2e8f0',
                                            background: openTabs.some(t => t.id === activeTabId && t.type === 'update') ? 'var(--primary-color)' : '#fff',
                                            color: openTabs.some(t => t.id === activeTabId && t.type === 'update') ? '#fff' : '#64748b',
                                            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s',
                                            boxShadow: isUpdateDropdownOpen ? '0 0 0 2px var(--primary-color)22' : 'none', whiteSpace: 'nowrap'
                                        }}
                                    >
                                        <Edit3 size={14} /> View/Edit ({openTabs.filter(t => t.type === 'update').length}/5) <ChevronRight size={14} style={{ transform: isUpdateDropdownOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                    </button>
                                    {isUpdateDropdownOpen && (
                                        <div style={{ position: 'absolute', top: '110%', right: 0, width: '250px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 200, padding: '8px' }}>
                                            {openTabs.filter(t => t.type === 'update').length === 0 ? (
                                                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>No active reports being viewed.</div>
                                            ) : openTabs.filter(t => t.type === 'update').map(tab => (
                                                <div
                                                    key={tab.id}
                                                    onClick={() => { setActiveTabId(tab.id); setIsUpdateDropdownOpen(false); }}
                                                    style={{ padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: activeTabId === tab.id ? '#f1f5f9' : 'transparent', marginBottom: '2px' }}
                                                >
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: activeTabId === tab.id ? 'var(--primary-color)' : '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {tab.title}
                                                    </div>
                                                    <X size={14} onClick={(e) => handleCloseTab(tab.id, e)} style={{ color: '#94a3b8' }} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <button
                                className="btn btn-primary"
                                onClick={handleAddCreateTab}
                                style={{
                                    height: '38px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, padding: '0 18px', borderRadius: '10px', fontSize: '0.85rem',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)', whiteSpace: 'nowrap'
                                }}
                            >
                                <Plus size={18} /> New Report
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 175px)', minHeight: '620px', marginTop: '0.25rem' }}>

                    {/* Left Column: List content */}
                    <div style={{
                        flex: openTabs.length > 0 ? 4 : 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        width: openTabs.length > 0 ? '40%' : '100%',
                        overflow: 'hidden'
                    }}>
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
                            {loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Loader2 className="animate-spin" size={32} /></div>
                            ) : displayReports.length > 0 ? (
                                <ReportList
                                    reports={displayReports}
                                    selectedId={activeTabObj?.reportId || null}
                                    onSelect={(r) => handleOpenUpdateTab(r)}
                                    projectsMap={projectsMap}
                                    usersMap={usersMap}
                                    getStatusLabel={getSmartStatus}
                                    isSplit={openTabs.length > 0}
                                />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                                    <Target size={48} style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>No Reports</h3>
                                    <p style={{ fontSize: '0.85rem' }}>There may be no reports available, or the server may be busy. Please wait a moment or contact technical support.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Multi-tab Dropdown System & Panel content */}
                    <div style={{
                        flex: openTabs.length > 0 ? 6 : 0,
                        opacity: openTabs.length > 0 ? 1 : 0,
                        pointerEvents: openTabs.length > 0 ? 'auto' : 'none',
                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        width: openTabs.length > 0 ? '60%' : '0',
                        overflow: 'hidden',
                        display: openTabs.length > 0 ? 'flex' : 'none',
                        flexDirection: 'column',
                    }}>
                        {/* Mounted Panels (one for each tab, to preserve state) */}
                        {openTabs.map(tab => (
                            <div key={tab.id} style={{ display: activeTabId === tab.id ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflowY: 'auto', position: 'relative' }} className="custom-scrollbar">
                                    <ReportPanel
                                        reportId={tab.type === 'update' ? tab.reportId! : null}
                                        isAdding={tab.type === 'create'}
                                        isAuthorFallback={tab.isAuthor}
                                        onClose={() => handleCloseTab(tab.id)}
                                        onSaved={(shouldClose: boolean = false, message?: string, newReportId?: string) => {
                                            fetchReports();
                                            if (message) showToast(message, 'success');
                                            
                                            if (tab.type === 'create' && newReportId) {
                                                const updatedId = `update-${newReportId}`;
                                                setOpenTabs(prev => prev.map(t => t.id === tab.id ? { 
                                                    ...t, 
                                                    id: updatedId, 
                                                    type: 'update', 
                                                    reportId: newReportId,
                                                    title: t.title || 'Report Saved'
                                                } : t));
                                                setActiveTabId(updatedId);
                                            } else if (shouldClose) {
                                                handleCloseTab(tab.id);
                                            }
                                        }}
                                        onTitleChange={(title) => handleTitleChange(tab.id, title)}
                                    />
                            </div>
                        ))}
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
