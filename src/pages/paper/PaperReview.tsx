import React, { useEffect, useState } from 'react';
import MainLayout from '@/layout/MainLayout';
import { paperSubmissionService } from '@/services/paperSubmissionService';
import { projectService } from '@/services/projectService';
import {
    SubmissionStatus,
    SubmissionStatusLabel,
    type PaperSubmissionResponse,
} from '@/types/paperSubmission';
import { FileSearch, CheckCircle2, XCircle, Loader2, AlertTriangle, FileText, Link as LinkIcon } from 'lucide-react';

const statusColor: Record<SubmissionStatus, string> = {
    [SubmissionStatus.Draft]: 'var(--text-secondary)',
    [SubmissionStatus.InternalReview]: '#e6a817',
    [SubmissionStatus.Approved]: '#22c55e',
    [SubmissionStatus.Submitted]: '#3b82f6',
    [SubmissionStatus.Revision]: '#f97316',
    [SubmissionStatus.Decision]: '#8b5cf6',
    [SubmissionStatus.Rejected]: '#ef4444',
};

type FilterTab = 'pending' | 'all';

const PaperReview: React.FC = () => {
    const [papers, setPapers] = useState<PaperSubmissionResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<FilterTab>('pending');
    
    // Expandable row state
    const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);

    const [projects, setProjects] = useState<any[]>([]);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        loadPapers();
        loadProjects();
    }, []);

    const loadPapers = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await paperSubmissionService.getAll();
            setPapers(data);
        } catch (err: any) {
            console.error('Error loading papers for review:', err);
            if (!err.response) {
                setError('Cannot connect to Paper Submission server. Please ensure the Backend is running.');
            } else {
                setError('Failed to load papers. Please try again.');
            }
            setPapers([]);
        } finally {
            setLoading(false);
        }
    };

    const loadProjects = async () => {
        try {
            const data = await projectService.getAll();
            setProjects(data);
        } catch {
            console.error('Error loading projects');
        }
    };

    const handleApprove = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setActionLoading(id);
        try {
            const updated = await paperSubmissionService.directorReview(id, true);
            setPapers(prev => prev.map(p => p.paperSubmissionId === id ? updated : p));
        } catch (err: any) {
            console.error('Failed to approve paper:', err);
            alert(err.response?.data?.message || 'Failed to approve paper.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setActionLoading(id);
        try {
            const updated = await paperSubmissionService.directorReview(id, false);
            setPapers(prev => prev.map(p => p.paperSubmissionId === id ? updated : p));
        } catch (err: any) {
            console.error('Failed to reject paper:', err);
            alert(err.response?.data?.message || 'Failed to reject paper.');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredPapers =
        activeTab === 'pending'
            ? papers.filter((p) => p.status === SubmissionStatus.InternalReview)
            : papers;

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
        }
    };

    return (
        <MainLayout>
            <div className="page-container">
                <div className="page-header" style={{ marginBottom: '2.5rem' }}>
                    <div>
                        <h1 style={{ marginBottom: '4px' }}>
                            <FileSearch size={28} style={{ marginRight: '0.75rem', verticalAlign: 'middle', color: 'var(--primary-color)' }} />
                            Paper Review
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                            Review and manage paper submissions from researchers
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    {(['pending', 'all'] as FilterTab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '0.6rem 1.25rem',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                fontFamily: 'inherit',
                                background: activeTab === tab ? 'var(--accent-color)' : 'var(--bg-secondary)',
                                color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                                transition: 'all 0.2s',
                            }}
                        >
                            {tab === 'pending' ? `Pending Review (${papers.filter((p) => p.status === SubmissionStatus.InternalReview).length})` : `All Papers (${papers.length})`}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column', gap: '1rem' }}>
                        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary-color)' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>Loading papers...</p>
                    </div>
                ) : error ? (
                    <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
                        <AlertTriangle size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.8 }} />
                        <p>{error}</p>
                        <button className="btn btn-primary" onClick={loadPapers} style={{ marginTop: '1rem' }}>Retry</button>
                    </div>
                ) : filteredPapers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        <FileSearch size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>{activeTab === 'pending' ? 'No papers pending review! Great job.' : 'No papers submitted yet.'}</p>
                    </div>
                ) : (
                    <div className="um-table-wrapper card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table className="um-table">
                            <thead>
                                <tr>
                                    <th>Title & Conference</th>
                                    <th>Project</th>
                                    <th>Deadline</th>
                                    <th>Status</th>
                                    <th style={{ width: '140px', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPapers.map((paper) => {
                                    const isExpanded = expandedPaperId === paper.paperSubmissionId;
                                    const isActing = actionLoading === paper.paperSubmissionId;

                                    return (
                                        <React.Fragment key={paper.paperSubmissionId}>
                                            <tr
                                                className={`um-row ${isExpanded ? 'um-row-expanded' : ''}`}
                                                onClick={() => toggleRow(paper.paperSubmissionId)}
                                                style={{
                                                    borderLeft: paper.status === SubmissionStatus.InternalReview ? '4px solid #e6a817' : '4px solid transparent'
                                                }}
                                            >
                                                <td>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{paper.title}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                        {paper.conferenceName}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                        {getProjectName(paper.projectId)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                        {new Date(paper.submissionDeadline).toLocaleDateString()}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span
                                                        className="badge"
                                                        style={{
                                                            color: statusColor[paper.status] || 'var(--text-secondary)',
                                                            background: `${statusColor[paper.status] || 'gray'}18`,
                                                        }}
                                                    >
                                                        {SubmissionStatusLabel[paper.status] || 'N/A'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                        {paper.status === SubmissionStatus.InternalReview ? (
                                                            <>
                                                                <button
                                                                    title="Approve Paper"
                                                                    onClick={(e) => handleApprove(paper.paperSubmissionId, e)}
                                                                    disabled={isActing}
                                                                    className="btn"
                                                                    style={{ 
                                                                        background: '#dcfce7', 
                                                                        color: '#16a34a', 
                                                                        border: '1px solid #bbf7d0',
                                                                        padding: '6px', 
                                                                        borderRadius: '6px',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        transition: 'all 0.2s',
                                                                    }}
                                                                    onMouseOver={(e) => (e.currentTarget.style.background = '#bbf7d0')}
                                                                    onMouseOut={(e) => (e.currentTarget.style.background = '#dcfce7')}
                                                                >
                                                                    {isActing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                                                </button>
                                                                <button
                                                                    title="Revision Required (Reject)"
                                                                    onClick={(e) => handleReject(paper.paperSubmissionId, e)}
                                                                    disabled={isActing}
                                                                    className="btn"
                                                                    style={{ 
                                                                        background: '#fee2e2', 
                                                                        color: '#ef4444', 
                                                                        border: '1px solid #fecaca',
                                                                        padding: '6px', 
                                                                        borderRadius: '6px',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        transition: 'all 0.2s',
                                                                    }}
                                                                    onMouseOver={(e) => (e.currentTarget.style.background = '#fecaca')}
                                                                    onMouseOut={(e) => (e.currentTarget.style.background = '#fee2e2')}
                                                                >
                                                                    <XCircle size={16} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                className="btn btn-ghost"
                                                                style={{ color: 'var(--accent-color)', padding: '4px 8px' }}
                                                                onClick={(e) => { e.stopPropagation(); toggleRow(paper.paperSubmissionId); }}
                                                                title="View Details"
                                                            >
                                                                <FileText size={15} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expandable Detail Row */}
                                            {isExpanded && (
                                                <tr className="um-detail-row">
                                                    <td colSpan={5} style={{ padding: 0 }}>
                                                        <div className="um-detail-panel" style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                                                            {/* ---- VIEW MODE ---- */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                                <div>
                                                                    <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: 'var(--text-primary)' }}>{paper.title}</h3>
                                                                </div>
                                                                <div className="um-detail-grid">
                                                                    <div className="um-detail-item">
                                                                        <span className="um-detail-label">Status</span>
                                                                        <span className="badge" style={{ color: statusColor[paper.status], background: `${statusColor[paper.status]}18` }}>{SubmissionStatusLabel[paper.status]}</span>
                                                                    </div>
                                                                    <div className="um-detail-item">
                                                                        <span className="um-detail-label">Conference</span>
                                                                        <span>{paper.conferenceName || 'N/A'}</span>
                                                                    </div>
                                                                    <div className="um-detail-item">
                                                                        <span className="um-detail-label">Deadline</span>
                                                                        <span>{new Date(paper.submissionDeadline).toLocaleDateString()}</span>
                                                                    </div>
                                                                    <div className="um-detail-item">
                                                                        <span className="um-detail-label">Project</span>
                                                                        <span>{getProjectName(paper.projectId)}</span>
                                                                    </div>
                                                                    <div className="um-detail-item" style={{ gridColumn: '1 / -1' }}>
                                                                        <span className="um-detail-label">Paper URL</span>
                                                                        {paper.paperUrl ? (
                                                                            <a href={paper.paperUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-color)' }}><LinkIcon size={14}/> {paper.paperUrl}</a>
                                                                        ) : (
                                                                            <span style={{ color: 'var(--text-muted)' }}>No link provided</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', lineHeight: '1.5', marginTop: '0.5rem', border: '1px solid var(--border-color)' }}>
                                                                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>Abstract</h4>
                                                                    <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{paper.abstract || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>No abstract provided.</span>}</div>
                                                                </div>
                                                                
                                                                {/* Review Actions inside Detail View */}
                                                                {paper.status === SubmissionStatus.InternalReview && (
                                                                    <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem', justifyContent: 'flex-end', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
                                                                        <button
                                                                            onClick={() => handleReject(paper.paperSubmissionId)}
                                                                            disabled={isActing}
                                                                            className="btn"
                                                                            style={{ 
                                                                                background: '#fee2e2', 
                                                                                color: '#dc2626', 
                                                                                border: '1px solid #fecaca', 
                                                                                borderRadius: '8px', 
                                                                                padding: '8px 16px', 
                                                                                cursor: 'pointer', 
                                                                                display: 'flex', 
                                                                                alignItems: 'center', 
                                                                                gap: '8px', 
                                                                                fontSize: '0.85rem', 
                                                                                fontWeight: 600, 
                                                                                fontFamily: 'inherit',
                                                                                transition: 'all 0.2s',
                                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                                            }}
                                                                            onMouseOver={(e) => (e.currentTarget.style.background = '#fecaca')}
                                                                            onMouseOut={(e) => (e.currentTarget.style.background = '#fee2e2')}
                                                                        >
                                                                            <XCircle size={18} /> Revision Required
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleApprove(paper.paperSubmissionId)}
                                                                            disabled={isActing}
                                                                            className="btn"
                                                                            style={{ 
                                                                                border: 'none', 
                                                                                background: '#16a34a', 
                                                                                color: 'white', 
                                                                                borderRadius: '8px', 
                                                                                padding: '8px 18px', 
                                                                                cursor: 'pointer', 
                                                                                display: 'flex', 
                                                                                alignItems: 'center', 
                                                                                gap: '8px', 
                                                                                fontSize: '0.85rem', 
                                                                                fontWeight: 600, 
                                                                                fontFamily: 'inherit',
                                                                                transition: 'all 0.2s',
                                                                                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
                                                                            }}
                                                                            onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 4px 6px rgba(22, 163, 74, 0.3)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                                                            onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 2px 4px rgba(22, 163, 74, 0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                                                        >
                                                                            {isActing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Approve Paper
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default PaperReview;
