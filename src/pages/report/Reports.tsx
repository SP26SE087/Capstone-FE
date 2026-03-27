import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, CheckCircle, Clock, AlertTriangle, FileInput, Plus, Sparkles } from 'lucide-react';
import reportService, { Report } from '@/services/reportService';
import { projectService, userService, milestoneService } from '@/services';
import { SystemRoleEnum } from '@/types/enums';

type TabType = 'my_reports' | 'all_reports' | 'my_assignee';

const Reports: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('my_reports');
    const [searchQuery, setSearchQuery] = useState('');
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(false);
    const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    
    // Search Filters
    const [filterProjectId, setFilterProjectId] = useState<string>('');
    const [filterMilestoneId, setFilterMilestoneId] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const topK = 5;
    const [milestones, setMilestones] = useState<any[]>([]);
    const [isSemantic, setIsSemantic] = useState<boolean>(false);

    // Flexible role check (supports "1", 1, "Admin", etc.)
    const isLabDirector = useMemo(() => {
        const role = user?.role;
        if (!role) return false;
        
        const roleNum = Number(role);
        if (!isNaN(roleNum)) {
            return roleNum === SystemRoleEnum.Admin || roleNum === SystemRoleEnum.LabDirector;
        }
        
        // String fallbacks for safety
        const roleStr = String(role).toLowerCase();
        return roleStr === 'admin' || roleStr === 'lab director' || roleStr === 'labdirector';
    }, [user?.role]);

    useEffect(() => {
        if (isLabDirector) {
            setActiveTab('my_assignee');
        } else {
            setActiveTab('my_reports');
        }
    }, [isLabDirector]);

    useEffect(() => {
        fetchReports();
    }, [activeTab]);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [projects, users] = await Promise.all([
                    projectService.getAll(),
                    userService.getAll()
                ]);
                const pMap: Record<string, string> = {};
                if (projects) projects.forEach((p: any) => pMap[p.id] = (p.name || p.projectName || p.title));
                setProjectsMap(pMap);
                
                const uMap: Record<string, string> = {};
                if (users) {
                    users.forEach((u: any) => {
                        const id = u.id || u.userId || u.Id;
                        if (id) uMap[id] = u.fullName || u.username || u.name || u.Email;
                    });
                }
                setUsersMap(uMap);
            } catch (e) {
                console.error("Failed to load metadata", e);
            }
        };
        fetchMetadata();
    }, []);

    useEffect(() => {
        const fetchFilteredMilestones = async () => {
            if (filterProjectId) {
                try {
                    const data = await milestoneService.getByProject(filterProjectId);
                    setMilestones(data || []);
                } catch (e) {
                    console.error("Failed to load milestones", e);
                    setMilestones([]);
                }
            } else {
                setMilestones([]);
            }
            setFilterMilestoneId(''); // Reset milestone when project changes
        };
        fetchFilteredMilestones();
    }, [filterProjectId]);

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
            
            // Ensure data is an array
            setReports(Array.isArray(data) ? data : (data?.data || []));
        } catch (error) {
            console.error('Failed to fetch reports:', error);
            setReports([]); // handle robustly
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // If query is empty, just reset to original list
        if (!searchQuery.trim()) {
            fetchReports();
            return;
        }

        // If NOT semantic, we don't need to call API (UI handles local filter)
        if (!isSemantic) return;

        setLoading(true);
        try {
            // Semantic AI Search Request
            const req: any = {
                query: searchQuery,
                topK: topK,
            };

            if (filterProjectId) req.projectId = filterProjectId;
            if (filterMilestoneId) req.milestoneId = filterMilestoneId;
            if (filterStatus !== '') req.status = Number(filterStatus);

            const data = await reportService.searchReports(req);
            setReports(Array.isArray(data) ? data : (data?.data || []));
        } catch (error) {
            console.error('Search error:', error);
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    // Client-side filtering for "Normal Search"
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
            const matchesMilestone = !filterMilestoneId || report.milestoneId === filterMilestoneId;

            return matchesQuery && matchesProject && matchesStatus && matchesMilestone;
        });
    }, [reports, searchQuery, filterProjectId, filterStatus, filterMilestoneId, isSemantic]);

    const getStatusLabel = (status: number) => {
        switch (status) {
            case 0: return { label: 'Draft', color: 'var(--text-secondary)', icon: <FileInput size={14} /> };
            case 1: return { label: 'Submitted', color: 'var(--info-color)', icon: <Clock size={14} /> };
            case 2: return { label: 'Approved', color: 'var(--success-color)', icon: <CheckCircle size={14} /> };
            case 3: return { label: 'Needs Revision', color: 'var(--warning-color)', icon: <AlertTriangle size={14} /> };
            default: return { label: 'Unknown', color: 'gray', icon: <FileText size={14} /> };
        }
    };

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">
                {/* Page Header */}
                <div className="page-header" style={{ marginBottom: '2.5rem' }}>
                    <div>
                        <h1>Reports Workspace</h1>
                        <p>View, search, and manage cross-project reports.</p>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                    <div className="tabs" style={{ display: 'flex', gap: '0.2rem' }}>
                        {!isLabDirector && (
                            <button 
                                onClick={() => setActiveTab('my_reports')}
                                style={{ 
                                    border: 'none', 
                                    borderBottom: activeTab === 'my_reports' ? '3px solid var(--primary-color)' : '3px solid transparent', 
                                    padding: '0.75rem 1.25rem', 
                                    background: 'transparent', 
                                    cursor: 'pointer', 
                                    fontWeight: activeTab === 'my_reports' ? 600 : 500,
                                    color: activeTab === 'my_reports' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                    transition: 'all 0.2s',
                                    fontSize: '0.95rem'
                                }}
                            >
                                My Reports
                            </button>
                        )}
                        <button 
                            onClick={() => setActiveTab('my_assignee')}
                            style={{ 
                                border: 'none', 
                                borderBottom: activeTab === 'my_assignee' ? '3px solid var(--primary-color)' : '3px solid transparent', 
                                padding: '0.75rem 1.25rem', 
                                background: 'transparent', 
                                cursor: 'pointer', 
                                fontWeight: activeTab === 'my_assignee' ? 600 : 500,
                                color: activeTab === 'my_assignee' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                transition: 'all 0.2s',
                                fontSize: '0.95rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            My Assignees
                        </button>
                        {isLabDirector && (
                            <button 
                                onClick={() => setActiveTab('all_reports')}
                                style={{ 
                                    border: 'none', 
                                    borderBottom: activeTab === 'all_reports' ? '3px solid var(--primary-color)' : '3px solid transparent', 
                                    padding: '0.75rem 1.25rem', 
                                    background: 'transparent', 
                                    cursor: 'pointer', 
                                    fontWeight: activeTab === 'all_reports' ? 600 : 500,
                                    color: activeTab === 'all_reports' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                    transition: 'all 0.2s',
                                    fontSize: '0.95rem'
                                }}
                            >
                                All Reports
                            </button>
                        )}
                    </div>

                    {!isLabDirector && (
                        <button 
                            className="btn btn-primary" 
                            onClick={() => navigate('/reports/new')} 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                fontWeight: 600,
                                marginBottom: '8px' // Slightly up to center with tab text if needed
                            }}
                        >
                            <Plus size={18} />
                            Create Report
                        </button>
                    )}
                </div>

                {/* Search & Filter Bar - Redesigned for better UX */}
                <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '16px', boxShadow: 'var(--shadow-md)', border: 'none', background: 'white' }}>
                    <form onSubmit={handleSearch}>
                        {/* Primary Search Area */}
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder={isSemantic ? "Describe the research topic or findings you want to find..." : "Search by report title, goals, or core content..."}
                                    className="form-input"
                                    style={{ 
                                        paddingLeft: '48px', width: '100%', height: '54px', fontSize: '1.05rem', borderRadius: '14px', 
                                        border: isSemantic ? '2px solid #0ea5e9' : '1px solid var(--border-color)', 
                                        backgroundColor: '#f8fafc',
                                        transition: 'all 0.3s ease',
                                        boxShadow: isSemantic ? '0 0 20px rgba(14, 165, 233, 0.1)' : 'none'
                                    }}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {/* Mode Toggle Swapper */}
                            <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', height: '54px' }}>
                                <button 
                                    type="button"
                                    onClick={() => setIsSemantic(false)}
                                    style={{ 
                                        flex: 1, border: 'none', borderRadius: '8px', padding: '0 16px', cursor: 'pointer',
                                        background: !isSemantic ? 'white' : 'transparent',
                                        color: !isSemantic ? 'var(--primary-color)' : 'var(--text-secondary)',
                                        fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px',
                                        boxShadow: !isSemantic ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s'
                                    }}
                                >
                                    <Search size={16} /> Basic
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setIsSemantic(true)}
                                    style={{ 
                                        flex: 1, border: 'none', borderRadius: '8px', padding: '0 16px', cursor: 'pointer',
                                        background: isSemantic ? 'var(--primary-color)' : 'transparent',
                                        color: isSemantic ? 'white' : 'var(--text-secondary)',
                                        fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px',
                                        boxShadow: isSemantic ? '0 4px 12px rgba(30, 41, 59, 0.2)' : 'none', transition: 'all 0.2s'
                                    }}
                                >
                                    <Sparkles size={16} /> AI Search
                                </button>
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ height: '54px', width: '120px', borderRadius: '14px', fontSize: '1rem' }}>
                                Find
                            </button>
                        </div>

                        {/* Filters Row */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-end' }}>
                            <div style={{ flex: '1 1 200px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Project</label>
                                <select 
                                    className="form-input" 
                                    style={{ height: '42px', width: '100%', borderRadius: '10px' }}
                                    value={filterProjectId}
                                    onChange={(e) => setFilterProjectId(e.target.value)}
                                >
                                    <option value="">All Projects</option>
                                    {Object.entries(projectsMap).map(([id, name]) => (
                                        <option key={id} value={id}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ flex: '1 1 200px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Milestone</label>
                                <select 
                                    className="form-input" 
                                    style={{ height: '42px', width: '100%', borderRadius: '10px' }}
                                    value={filterMilestoneId}
                                    onChange={(e) => setFilterMilestoneId(e.target.value)}
                                    disabled={!filterProjectId}
                                >
                                    <option value="">{filterProjectId ? 'All Milestones' : 'Select Project'}</option>
                                    {milestones.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ flex: '1 1 150px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Status</label>
                                <select 
                                    className="form-input" 
                                    style={{ height: '42px', width: '100%', borderRadius: '10px' }}
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                >
                                    <option value="">All Status</option>
                                    <option value="0">Draft</option>
                                    <option value="1">Submitted</option>
                                    <option value="2">Approved</option>
                                    <option value="3">Rejected</option>
                                </select>
                            </div>


                        </div>
                    </form>
                </div>

                {/* Reports List */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                        <div className="spinner" style={{ margin: '0 auto 1.5rem', width: '40px', height: '40px', borderWidth: '3px', borderTopColor: 'var(--primary-color)' }}></div>
                        Synchronizing research reports...
                    </div>
                ) : displayReports.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {displayReports.map((report) => {
                            const statusInfo = getStatusLabel(report.status ?? (report as any).Status ?? 0);
                            return (
                                <div key={report.id} onClick={() => navigate(`/reports/${report.id}`)} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', transition: 'box-shadow 0.2s, transform 0.2s', cursor: 'pointer', borderLeft: `4px solid ${statusInfo.color}` }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.06)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                {report.title || (report as any).Title || 'Untitled Report'}
                                            </h3>
                                            <div style={{ display: 'flex', gap: '15px', fontSize: '0.85rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                                {(() => {
                                                    const pId = report.projectId || (report as any).ProjectId;
                                                    return pId ? (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-color)' }}></span>
                                                            Project: <strong style={{ color: 'var(--text-primary)' }}>{projectsMap[pId] || 'Unknown'}</strong>
                                                        </span>
                                                    ) : null;
                                                })()}
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--info-color)' }}></span>
                                                    Assignees: <strong style={{ color: 'var(--text-primary)' }}>
                                                        {(() => {
                                                            // Support multiple property name variations (PascalCase, camelCase, members)
                                                            const r = report as any;
                                                            const members = r.assignees || r.Assignees || r.members || r.Members;
                                                            const ids = r.assigneeIds || r.AssigneeIds || r.memberIds || r.MemberIds;
                                                            
                                                            if (members && Array.isArray(members) && members.length > 0) {
                                                                const getName = (a: any) => a.fullName || a.FullName || a.name || a.Name || a.email || a.Email || 'User';
                                                                return members.length > 2 
                                                                    ? members.slice(0, 2).map(getName).join(', ') + ', ...'
                                                                    : members.map(getName).join(', ');
                                                            }
                                                            
                                                            if (ids && Array.isArray(ids) && ids.length > 0) {
                                                                return ids.length > 2
                                                                    ? ids.slice(0, 2).map((id: string) => usersMap[id] || 'User').join(', ') + ', ...'
                                                                    : ids.map((id: string) => usersMap[id] || 'User').join(', ');
                                                            }
                                                            
                                                            return 'None';
                                                        })()}
                                                    </strong>
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {(() => {
                                                // Support various casing from API (hasEmbedding, HasEmbedding, etc.)
                                                const isIndexed = report.hasEmbedding === true || (report as any).HasEmbedding === true;
                                                
                                                return (
                                                    <div 
                                                        style={{ 
                                                            display: 'inline-flex', 
                                                            alignItems: 'center', 
                                                            gap: '6px', 
                                                            padding: '4px 10px', 
                                                            borderRadius: '6px', 
                                                            backgroundColor: isIndexed ? '#f0f9ff' : '#f8fafc', 
                                                            color: isIndexed ? '#0369a1' : '#64748b', 
                                                            fontSize: '0.75rem', 
                                                            fontWeight: 700,
                                                            border: `1px solid ${isIndexed ? '#bae6fd' : '#e2e8f0'}`,
                                                            boxShadow: isIndexed ? '0 0 8px rgba(14, 165, 233, 0.2)' : 'none'
                                                        }}
                                                        title={isIndexed ? "This report has been indexed for AI semantic search" : "This report is not yet indexed"}
                                                    >
                                                        <span style={{ 
                                                            width: '8px', 
                                                            height: '8px', 
                                                            borderRadius: '50%', 
                                                            backgroundColor: isIndexed ? '#0ea5e9' : '#cbd5e1',
                                                            boxShadow: isIndexed ? '0 0 6px #0ea5e9' : 'none',
                                                            display: 'inline-block'
                                                        }}></span>
                                                        {isIndexed ? 'KNOWLEDGE BASE' : 'PENDING INDEX'}
                                                    </div>
                                                );
                                            })()}
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', backgroundColor: `${statusInfo.color}15`, color: statusInfo.color, fontSize: '0.8rem', fontWeight: 600 }}>
                                                {statusInfo.icon}
                                                {statusInfo.label}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
                                        {report.description || (report as any).Description || report.goals || (report as any).Goals || 'No summary available for this report.'}
                                    </p>

                                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        <span>Submitted: {report.submitedAt ? new Date(report.submitedAt).toLocaleDateString() : 'N/A'}</span>
                                        <span>Updated: {report.updateAt ? new Date(report.updateAt).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="empty-state" style={{ padding: '5rem 2rem' }}>
                        <div className="empty-state-icon" style={{ background: 'var(--primary-color)', color: 'white', opacity: 0.9 }}>
                            <FileText size={36} />
                        </div>
                        <h2 style={{ fontSize: '1.4rem', marginTop: '1.5rem' }}>No research data available</h2>
                        <p style={{ maxWidth: '400px', margin: '0.5rem auto 0' }}>
                            Adjust your filters or try describing your search in more detail to find relevant research records.
                        </p>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default Reports;
