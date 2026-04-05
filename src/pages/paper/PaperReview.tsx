import React, { useEffect, useState } from 'react';
import MainLayout from '@/layout/MainLayout';
import { paperSubmissionService } from '@/services/paperSubmissionService';
import { projectService } from '@/services/projectService';
import { membershipService } from '@/services/membershipService';
import {
    SubmissionStatus,
    PaperRoleEnum,
    PaperRoleLabel,
    type PaperSubmissionResponse,
} from '@/types/paperSubmission';
import {
    FileSearch, CheckCircle2, XCircle, Loader2, AlertTriangle,
    FileText, Link as LinkIcon, Clock, Eye, Send, ChevronDown, ChevronRight, Repeat, Gavel, Download, Search
} from 'lucide-react';

const getStatusConfig = (status: SubmissionStatus) => {
    switch (status) {
        case SubmissionStatus.Draft:
            return { color: '#64748b', bg: '#f1f5f9', icon: <Clock size={14} />, label: 'Draft' };
        case SubmissionStatus.InternalReview:
            return { color: '#d97706', bg: '#fef3c7', icon: <Eye size={14} />, label: 'Internal Review' };
        case SubmissionStatus.Approved:
            return { color: '#16a34a', bg: '#dcfce7', icon: <CheckCircle2 size={14} />, label: 'Approved' };
        case SubmissionStatus.Submitted:
            return { color: '#2563eb', bg: '#dbeafe', icon: <Send size={14} />, label: 'Submitted' };
        case SubmissionStatus.Revision:
            return { color: '#8b5cf6', bg: '#ede9fe', icon: <Repeat size={14} />, label: 'Revision' };
        case SubmissionStatus.Decision:
            return { color: '#0f766e', bg: '#ccfbf1', icon: <Gavel size={14} />, label: 'Decision' };
        case SubmissionStatus.Rejected:
            return { color: '#dc2626', bg: '#fee2e2', icon: <XCircle size={14} />, label: 'Rejected' };
        default:
            return { color: '#64748b', bg: '#f1f5f9', icon: <Clock size={14} />, label: 'Unknown' };
    }
};

type FilterTab = 'all' | 'pending' | string;

const PaperReview: React.FC = () => {
    const [papers, setPapers] = useState<PaperSubmissionResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [search, setSearch] = useState('');
    const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [projectMembers, setProjectMembers] = useState<any[]>([]);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => { loadPapers(); loadProjects(); }, []);

    const loadPapers = async () => {
        try {
            setLoading(true); setError(null);
            const data = await paperSubmissionService.getAll();
            setPapers(data.items);
        } catch (err: any) {
            setError(!err.response ? 'Cannot connect to Paper Submission server. Please ensure the Backend is running.' : 'Failed to load papers. Please try again.');
            setPapers([]);
        } finally { setLoading(false); }
    };

    const loadProjects = async () => {
        try { const data = await projectService.getAll(); setProjects(data); } catch { console.error('Error loading projects'); }
    };

    const handleApprove = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setActionLoading(id);
        try {
            const updated = await paperSubmissionService.directorReview(id, true);
            setPapers(prev => prev.map(p => p.paperSubmissionId === id ? updated : p));
        } catch (err: any) { alert(err.response?.data?.message || 'Failed to approve paper.'); }
        finally { setActionLoading(null); }
    };

    const handleReject = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setActionLoading(id);
        try {
            const updated = await paperSubmissionService.directorReview(id, false);
            setPapers(prev => prev.map(p => p.paperSubmissionId === id ? updated : p));
        } catch (err: any) { alert(err.response?.data?.message || 'Failed to reject paper.'); }
        finally { setActionLoading(null); }
    };

    const pendingCount = papers.filter(p => p.status === SubmissionStatus.InternalReview).length;
    const approvedCount = papers.filter(p => p.status === SubmissionStatus.Approved).length;
    const submittedCount = papers.filter(p => p.status === SubmissionStatus.Submitted).length;
    const revisionCount = papers.filter(p => p.status === SubmissionStatus.Revision).length;
    const decisionCount = papers.filter(p => p.status === SubmissionStatus.Decision).length;
    const rejectedCount = papers.filter(p => p.status === SubmissionStatus.Rejected).length;

    const filteredPapers = papers.filter((p) => {
        // Status filter
        if (activeTab === 'pending' && p.status !== SubmissionStatus.InternalReview) return false;
        if (activeTab !== 'all' && activeTab !== 'pending' && p.status.toString() !== activeTab) return false;
        // Search filter
        if (search.trim()) {
            const q = search.toLowerCase();
            if (!p.title.toLowerCase().includes(q) && !p.conferenceName.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const getProjectName = (id?: string | null) => {
        if (!id) return 'N/A';
        const p = projects.find((x) => x.projectId === id || x.id === id);
        return p ? (p.projectName || p.name || p.title) : 'Unknown Project';
    };

    const toggleRow = (paperId: string) => {
        if (expandedPaperId === paperId) {
            setExpandedPaperId(null);
        } else {
            setExpandedPaperId(paperId);
            // Auto-load project members so author names display correctly
            const paper = papers.find(p => p.paperSubmissionId === paperId);
            if (paper?.projectId) {
                membershipService.getProjectMembers(paper.projectId)
                    .then(members => setProjectMembers(members))
                    .catch(() => {});
            }
        }
    };

    // Stats - same order/colors as researcher page (without Drafts)
    const statWidgets = [
        { label: 'Total Papers', value: papers.length, icon: <FileText size={20} />, color: 'var(--accent-color)', bg: 'var(--accent-bg)' },
        { label: 'In Review', value: pendingCount, icon: <Eye size={20} />, color: '#d97706', bg: '#fef3c7' },
        { label: 'Approved', value: approvedCount, icon: <CheckCircle2 size={20} />, color: '#16a34a', bg: '#dcfce7' },
        { label: 'Submitted', value: submittedCount, icon: <Send size={20} />, color: '#2563eb', bg: '#dbeafe' },
        { label: 'Revision', value: revisionCount, icon: <Repeat size={20} />, color: '#8b5cf6', bg: '#ede9fe' },
        { label: 'Decision', value: decisionCount, icon: <Gavel size={20} />, color: '#0f766e', bg: '#ccfbf1' },
        { label: 'Rejected', value: rejectedCount, icon: <XCircle size={20} />, color: '#dc2626', bg: '#fee2e2' },
    ];

    return (
        <MainLayout>
            <div className="page-container">
                {/* Page Header */}
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>Paper Review</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Review and manage paper submissions from researchers.</p>
                    </div>
                </div>

                {/* Stat Widgets */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '0.75rem', marginBottom: '2rem'
                }}>
                    {statWidgets.map((stat, index) => (
                        <div key={index} className="card" style={{ 
                            opacity: loading ? 0.7 : 1, padding: '1rem', 
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            borderRadius: '12px', transition: 'all 0.2s'
                        }}>
                            <div style={{ 
                                background: stat.bg, color: stat.color, 
                                padding: '8px', borderRadius: '10px', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {stat.icon}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>{stat.label}</p>
                                <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{loading ? '...' : stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Search & Filter Toolbar */}
                <div style={{
                    display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center',
                    background: 'var(--surface-color)', padding: '1rem', borderRadius: '16px',
                    border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)'
                }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text" placeholder="Search by title or conference..."
                            value={search} onChange={(e) => setSearch(e.target.value)}
                            className="form-input"
                            style={{ paddingLeft: '44px', height: '44px', border: 'none', background: 'var(--surface-hover)', borderRadius: '10px', fontSize: '0.95rem', width: '100%' }}
                        />
                    </div>
                    <select
                        value={activeTab}
                        onChange={(e) => setActiveTab(e.target.value)}
                        className="form-input"
                        style={{ 
                            height: '44px', width: '200px', borderRadius: '10px', 
                            background: 'var(--surface-hover)', border: 'none',
                            fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                            color: 'var(--text-primary)', padding: '0 12px'
                        }}
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending Review</option>
                        <option value={SubmissionStatus.Draft.toString()}>Draft</option>
                        <option value={SubmissionStatus.InternalReview.toString()}>In Review</option>
                        <option value={SubmissionStatus.Approved.toString()}>Approved</option>
                        <option value={SubmissionStatus.Submitted.toString()}>Submitted</option>
                        <option value={SubmissionStatus.Revision.toString()}>Revision</option>
                        <option value={SubmissionStatus.Decision.toString()}>Decision</option>
                        <option value={SubmissionStatus.Rejected.toString()}>Rejected</option>
                    </select>
                </div>

                {/* Content */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column', gap: '1rem' }}>
                        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary-color)' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>Loading papers...</p>
                    </div>
                ) : error ? (
                    <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
                        <AlertTriangle size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.8 }} />
                        <p>{error}</p>
                        <button className="btn btn-primary" onClick={loadPapers} style={{ marginTop: '1rem' }}>Retry</button>
                    </div>
                ) : filteredPapers.length === 0 ? (
                    <div className="empty-state card" style={{ padding: '4rem 2rem', borderStyle: 'dashed', textAlign: 'center' }}>
                        <FileSearch size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <h2 style={{ margin: '0 0 0.5rem' }}>{activeTab === 'pending' ? 'All Caught Up!' : 'No Papers Yet'}</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>{activeTab === 'pending' ? 'No papers are currently pending review. Great job!' : 'No papers have been submitted yet.'}</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {filteredPapers.map((paper) => {
                            const isExpanded = expandedPaperId === paper.paperSubmissionId;
                            const isActing = actionLoading === paper.paperSubmissionId;
                            const statusConfig = getStatusConfig(paper.status);

                            return (
                                <div key={paper.paperSubmissionId} className="card" style={{
                                    padding: 0, overflow: 'hidden',
                                    borderLeft: paper.status === SubmissionStatus.InternalReview ? '4px solid #d97706' : '4px solid transparent',
                                    border: isExpanded ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                                    borderLeftWidth: paper.status === SubmissionStatus.InternalReview ? '4px' : '1px',
                                    borderLeftColor: paper.status === SubmissionStatus.InternalReview ? '#d97706' : (isExpanded ? 'var(--accent-color)' : 'var(--border-color)'),
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}>
                                    {/* Paper Row Header */}
                                    <div
                                        onClick={() => toggleRow(paper.paperSubmissionId)}
                                        style={{
                                            display: 'flex', alignItems: 'center', padding: '1rem 1.25rem',
                                            cursor: 'pointer', transition: 'background 0.15s', gap: '1rem'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        {/* Expand icon */}
                                        <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </div>

                                        {/* Paper icon */}
                                        <div style={{ padding: '8px', background: statusConfig.bg, borderRadius: '10px', color: statusConfig.color, flexShrink: 0 }}>
                                            <FileText size={18} />
                                        </div>

                                        {/* Title & Conference */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paper.title}</p>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {paper.conferenceName} · {getProjectName(paper.projectId)}
                                            </p>
                                        </div>

                                        {/* Status Badge */}
                                        <span className="badge" style={{
                                            background: statusConfig.bg, color: statusConfig.color,
                                            gap: '6px', padding: '5px 12px', borderRadius: '8px',
                                            fontWeight: 600, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', flexShrink: 0
                                        }}>
                                            {statusConfig.icon}
                                            {statusConfig.label}
                                        </span>

                                        {/* Quick view button */}
                                        <div style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                            <button
                                                className="btn btn-ghost"
                                                style={{ color: 'var(--accent-color)', padding: '6px' }}
                                                onClick={(e) => { e.stopPropagation(); toggleRow(paper.paperSubmissionId); }}
                                                title="View Details"
                                            >
                                                {isExpanded ? <FileText size={18} /> : <FileSearch size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Detail */}
                                    {isExpanded && (
                                        <div style={{ borderTop: '1px solid var(--border-color)', padding: '1.5rem', background: 'var(--background-color)' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {/* Title */}
                                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{paper.title}</h3>

                                                {/* Info grid */}
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                                    <div style={{ background: 'var(--surface-color)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.5px' }}>Status</div>
                                                        <span className="badge" style={{ background: statusConfig.bg, color: statusConfig.color, gap: '6px', display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '6px', fontWeight: 600, fontSize: '0.8rem' }}>
                                                            {statusConfig.icon} {statusConfig.label}
                                                        </span>
                                                    </div>
                                                    <div style={{ background: 'var(--surface-color)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.5px' }}>Conference</div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{paper.conferenceName || 'N/A'}</div>
                                                    </div>

                                                    <div style={{ background: 'var(--surface-color)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.5px' }}>Project</div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{getProjectName(paper.projectId)}</div>
                                                    </div>
                                                </div>

                                                {/* Files & URLs */}
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                                                    {/* Document */}
                                                    <div style={{ background: 'var(--surface-color)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>Evidence / Document</div>
                                                        {paper.document ? (
                                                            <a href={import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}${paper.document}` : paper.document} download
                                                                style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 500, fontSize: '0.9rem' }}>
                                                                <div style={{ background: 'var(--accent-bg)', padding: '8px', borderRadius: '8px' }}><FileText size={18} /></div>
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{(() => { const raw = paper.document.split('/').pop() || 'Download Document'; const parts = raw.split('_'); return parts.length > 1 ? parts.slice(1).join('_') : raw; })()}</span>
                                                                <Download size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
                                                            </a>
                                                        ) : <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No document uploaded</span>}
                                                    </div>

                                                    {/* Paper URL (only if exists) */}
                                                    {paper.paperUrl && (
                                                        <div style={{ background: 'var(--surface-color)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>Paper URL (Venue)</div>
                                                            <a href={paper.paperUrl} target="_blank" rel="noreferrer"
                                                                style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 500, fontSize: '0.9rem' }}>
                                                                <div style={{ background: '#dbeafe', padding: '8px', borderRadius: '8px', color: '#2563eb' }}><LinkIcon size={18} /></div>
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{paper.paperUrl}</span>
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Authors */}
                                                {paper.members && paper.members.length > 0 && (
                                                    <div style={{ background: 'var(--surface-color)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                                        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', fontWeight: 700 }}>Authors ({paper.members.length})</h4>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                            {paper.members.map((m, idx) => (
                                                                <div key={idx} style={{
                                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                                    background: 'var(--background-color)', padding: '6px 12px',
                                                                    borderRadius: '8px', border: '1px solid var(--border-color)',
                                                                    fontSize: '0.85rem'
                                                                }}>
                                                                    <span style={{ fontWeight: 600 }}>{(() => { const pm = projectMembers.find((p: any) => (p.membershipId || p.memberId) === m.membershipId); return pm?.fullName || m.membershipId.substring(0, 8); })()}</span>
                                                                    <span className="badge" style={{
                                                                        fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px',
                                                                        background: 'var(--accent-bg)', color: 'var(--accent-color)', fontWeight: 600
                                                                    }}>
                                                                        {PaperRoleLabel[m.role as PaperRoleEnum] || 'Member'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Abstract */}
                                                <div style={{ background: 'var(--surface-color)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', fontWeight: 700 }}>Abstract</h4>
                                                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{paper.abstract || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>No abstract provided.</span>}</div>
                                                </div>

                                                {/* Review Actions */}
                                                {paper.status === SubmissionStatus.InternalReview && (
                                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                                        <button
                                                            onClick={() => handleApprove(paper.paperSubmissionId)}
                                                            disabled={isActing}
                                                            className="btn"
                                                            style={{
                                                                border: 'none', background: '#16a34a', color: 'white', borderRadius: '10px',
                                                                padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                                                fontSize: '0.88rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s',
                                                                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
                                                            }}
                                                            onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 4px 8px rgba(22, 163, 74, 0.3)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                                            onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 2px 4px rgba(22, 163, 74, 0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                                        >
                                                            {isActing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(paper.paperSubmissionId)}
                                                            disabled={isActing}
                                                            className="btn"
                                                            style={{
                                                                background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px',
                                                                padding: '10px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                                                fontSize: '0.88rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s'
                                                            }}
                                                            onMouseOver={(e) => e.currentTarget.style.background = '#fecaca'}
                                                            onMouseOut={(e) => e.currentTarget.style.background = '#fee2e2'}
                                                        >
                                                            <XCircle size={18} /> Reject
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default PaperReview;
