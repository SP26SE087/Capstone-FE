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
    FileText, Link as LinkIcon, Clock, Eye, Send, Repeat, Gavel, Search, X
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
    const [selectedPaper, setSelectedPaper] = useState<PaperSubmissionResponse | null>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [projectMembers, setProjectMembers] = useState<any[]>([]);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showReviewViewer, setShowReviewViewer] = useState(false);
    const [reviewViewerUrl, setReviewViewerUrl] = useState<string | null>(null);
    const [reviewViewerKind, setReviewViewerKind] = useState<'pdf' | 'office' | 'link'>('pdf');

    useEffect(() => { loadPapers(); loadProjects(); }, []);

    const loadPapers = async () => {
        try {
            setLoading(true); setError(null);
            const data = await paperSubmissionService.getAll();
            setPapers(data.items);
        } catch (err: any) {
            console.error('Error loading papers for review:', err);
            if (!err.response) {
                setError('Cannot connect to Paper Submission server. Please ensure the Backend is running.');
            } else {
                setError(err.message || 'Failed to load papers.');
            }
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

    const isSplit = !!selectedPaper;
    const isReadingMode = !!selectedPaper && showReviewViewer;

    const getProjectName = (id?: string | null) => {
        if (!id) return 'N/A';
        const p = projects.find((x) => x.projectId === id || x.id === id);
        return p ? (p.projectName || p.name || p.title) : 'Unknown Project';
    };

    const openPaperDetail = (paper: PaperSubmissionResponse) => {
        setSelectedPaper(paper);
        if (paper?.projectId) {
            membershipService.getProjectMembers(paper.projectId)
                .then(members => setProjectMembers(members))
                .catch(() => {});
        }
    };

    const closePaperDetail = () => {
        setSelectedPaper(null);
        closeReviewDocument();
    };

    const openReviewDocument = (_paper: PaperSubmissionResponse, url: string) => {
        const cleanUrl = url.split('#')[0].split('?')[0];
        const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';
        const officeExts = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];

        let nextViewerKind: 'pdf' | 'office' | 'link' = 'link';
        let nextViewerUrl = url;

        if (officeExts.includes(ext)) {
            nextViewerKind = 'office';
            nextViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        } else if (ext === 'pdf') {
            nextViewerKind = 'pdf';
            nextViewerUrl = url.replace('/raw/upload/', '/raw/upload/fl_attachment:false/');
        }

        setReviewViewerKind(nextViewerKind);
        setReviewViewerUrl(nextViewerUrl);
        setShowReviewViewer(true);
    };

    const closeReviewDocument = () => {
        setShowReviewViewer(false);
        setReviewViewerUrl(null);
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
            <div className="page-container" style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>
                {/* Page Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: 'var(--primary-color)', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 8px 16px rgba(30,41,59,0.15)'
                            }}>
                                <FileSearch size={22} />
                            </div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
                                Paper Review
                            </h1>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>
                            Review and manage scientific paper submissions across all projects.
                        </p>
                    </div>
                </div>

                {/* Stat Widgets */}
                <div style={{
                    background: 'white', padding: '1.25rem 1.5rem', borderRadius: '20px',
                    border: '1px solid #e2e8f0', display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.85rem',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginBottom: '1.5rem'
                }}>
                    {statWidgets.map((stat, index) => (
                        <div key={index} style={{
                            opacity: loading ? 0.7 : 1,
                            padding: '0.65rem',
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
                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>{stat.label}</p>
                                <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>{loading ? '...' : stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Search & Filter Toolbar */}
                <div style={{
                    display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center',
                    background: '#fff', padding: '0.9rem 1.2rem', borderRadius: '14px',
                    border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text" placeholder="Search by title or conference..."
                            value={search} onChange={(e) => setSearch(e.target.value)}
                            className="form-input"
                            style={{ paddingLeft: '44px', height: '44px', border: 'none', background: '#f8fafc', borderRadius: '10px', fontSize: '0.92rem', width: '100%' }}
                        />
                    </div>
                    <select
                        value={activeTab}
                        onChange={(e) => setActiveTab(e.target.value)}
                        className="form-input"
                        style={{ 
                            height: '44px', width: '200px', borderRadius: '10px', 
                            background: '#f8fafc', border: 'none',
                            fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                            color: '#1e293b', padding: '0 12px'
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
                    <div style={{ display: 'flex', gap: isReadingMode ? '1rem' : '1.5rem', minHeight: isReadingMode ? '700px' : '560px' }}>
                        {!isReadingMode && (
                        <div style={{ flex: isSplit ? 3 : 10, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {filteredPapers.map((paper) => {
                                const statusConfig = getStatusConfig(paper.status);
                                const isActive = selectedPaper?.paperSubmissionId === paper.paperSubmissionId;

                                return (
                                    <div
                                        key={paper.paperSubmissionId}
                                        onClick={() => openPaperDetail(paper)}
                                        style={{
                                            background: isActive ? '#f8fafc' : '#fff',
                                            border: isActive ? '1.5px solid var(--accent-color)' : '1px solid #e2e8f0',
                                            borderRadius: '14px',
                                            borderLeft: `4px solid ${isActive ? 'var(--accent-color)' : statusConfig.color}`,
                                            padding: '14px 16px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {paper.title}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '3px', fontWeight: 500 }}>
                                                    {paper.conferenceName} · {getProjectName(paper.projectId)}
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: '0.65rem', fontWeight: 800, padding: '3px 9px',
                                                borderRadius: '20px', background: statusConfig.bg, color: statusConfig.color,
                                                flexShrink: 0, border: `1px solid ${statusConfig.color}33`
                                            }}>
                                                {statusConfig.label}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        )}

                        {selectedPaper && (
                            <div style={{
                                flex: isReadingMode ? 2.8 : 4,
                                minWidth: 0,
                                background: '#fff',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                padding: '1.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                                maxHeight: 'calc(100vh - 260px)',
                                overflowY: 'auto'
                            }} className="custom-scrollbar">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--primary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FileSearch size={16} />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{selectedPaper.title || 'Paper Details'}</h3>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: getStatusConfig(selectedPaper.status).bg, color: getStatusConfig(selectedPaper.status).color }}>
                                                {getStatusConfig(selectedPaper.status).label}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={closePaperDetail}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#94a3b8', cursor: 'pointer', transition: 'all 0.2s' }}
                                    >
                                        <X size={15} />
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {[
                                            { label: 'Conference / Journal', value: selectedPaper.conferenceName || 'N/A' },
                                            { label: 'Project', value: getProjectName(selectedPaper.projectId) },
                                            { label: 'Status', value: getStatusConfig(selectedPaper.status).label },
                                            { label: 'Created', value: new Date(selectedPaper.createdAt).toLocaleDateString() },
                                        ].map(item => (
                                            <div key={item.label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>{item.label}</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{item.value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {selectedPaper.document && (
                                        <div>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>Document</div>
                                            <button
                                                type="button"
                                                onClick={() => openReviewDocument(selectedPaper, selectedPaper.document!)}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 14px', borderRadius: '9px', border: '1px solid #dbeafe', background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                                            >
                                                <FileText size={14} /> View Document
                                            </button>
                                        </div>
                                    )}

                                    {selectedPaper.paperUrl && (
                                        <div>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>Paper URL</div>
                                            <a href={selectedPaper.paperUrl} target="_blank" rel="noreferrer"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 14px', borderRadius: '9px', border: '1px solid #e2e8f0', background: '#f8fafc', color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600, maxWidth: '100%' }}>
                                                <LinkIcon size={14} />
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedPaper.paperUrl}</span>
                                            </a>
                                        </div>
                                    )}

                                    {selectedPaper.members && selectedPaper.members.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>Authors</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {selectedPaper.members.map((m, idx) => (
                                                    <span key={idx} style={{ padding: '4px 10px', borderRadius: '20px', background: '#f1f5f9', fontSize: '0.75rem', fontWeight: 600, color: '#475569', border: '1px solid #e2e8f0' }}>
                                                        {(() => {
                                                            const pm = projectMembers.find((p: any) => (p.membershipId || p.memberId) === m.membershipId);
                                                            const name = pm?.fullName || m.membershipId.substring(0, 8);
                                                            return `${name} · ${PaperRoleLabel[m.role as PaperRoleEnum] || 'Member'}`;
                                                        })()}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>Abstract</div>
                                        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#334155', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                                            {selectedPaper.abstract || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No abstract provided.</span>}
                                        </div>
                                    </div>

                                    {selectedPaper.status === SubmissionStatus.InternalReview && (
                                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                                            <button
                                                onClick={() => handleApprove(selectedPaper.paperSubmissionId)}
                                                disabled={actionLoading === selectedPaper.paperSubmissionId}
                                                className="btn"
                                                style={{
                                                    border: 'none', background: '#16a34a', color: 'white', borderRadius: '10px',
                                                    padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                                    fontSize: '0.88rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s',
                                                    boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
                                                }}
                                            >
                                                {actionLoading === selectedPaper.paperSubmissionId ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(selectedPaper.paperSubmissionId)}
                                                disabled={actionLoading === selectedPaper.paperSubmissionId}
                                                className="btn"
                                                style={{
                                                    background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px',
                                                    padding: '10px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                                    fontSize: '0.88rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s'
                                                }}
                                            >
                                                <XCircle size={18} /> Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {showReviewViewer && reviewViewerUrl && (
                            <div style={{
                                flex: isReadingMode ? 8 : 5,
                                minWidth: 0,
                                background: '#fff',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                                maxHeight: 'calc(100vh - 260px)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
                                        <FileText size={15} style={{ color: '#2563eb' }} /> Document Viewer
                                    </div>
                                    <button onClick={closeReviewDocument} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                                        <X size={16} />
                                    </button>
                                </div>
                                <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
                                    {reviewViewerKind === 'pdf' ? (
                                        <iframe
                                            src={`${reviewViewerUrl}#toolbar=0&navpanes=0`}
                                            style={{ width: '100%', height: '100%', border: 'none' }}
                                            title="Review PDF Viewer"
                                        />
                                    ) : reviewViewerKind === 'office' ? (
                                        <iframe
                                            src={reviewViewerUrl}
                                            style={{ width: '100%', height: '100%', border: 'none' }}
                                            title="Review Document Viewer"
                                        />
                                    ) : (
                                        <div style={{ padding: '1rem' }}>
                                            <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#64748b' }}>Inline preview is not available for this file type.</p>
                                            <a href={reviewViewerUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', fontWeight: 700, textDecoration: 'none' }}>Open in new tab</a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default PaperReview;
