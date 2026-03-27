import React, { useEffect, useState } from 'react';
import MainLayout from '@/layout/MainLayout';
import { paperSubmissionService } from '@/services/paperSubmissionService';
import { projectService } from '@/services/projectService';
import {
    SubmissionStatus,
    SubmissionStatusLabel,
    type PaperSubmissionResponse,
    type CreatePaperRequest,
    type UpdatePaperRequest,
} from '@/types/paperSubmission';
import {
    FileText,
    Plus,
    Search,
    Calendar,
    ExternalLink,
    X,
    Loader2,
    AlertTriangle,
    Trash2,
    Send,
    BookOpen,
    Link as LinkIcon,
    Edit2,
    Save
} from 'lucide-react';

const statusColor: Record<SubmissionStatus, string> = {
    [SubmissionStatus.Draft]: 'var(--text-secondary)',
    [SubmissionStatus.InternalReview]: '#e6a817',
    [SubmissionStatus.Approved]: '#22c55e',
    [SubmissionStatus.Submitted]: '#3b82f6',
    [SubmissionStatus.Revision]: '#f97316',
    [SubmissionStatus.Decision]: '#8b5cf6',
    [SubmissionStatus.Rejected]: '#ef4444',
};

const PaperSubmissions: React.FC = () => {
    const [papers, setPapers] = useState<PaperSubmissionResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    // Create form
    const [showAddForm, setShowAddForm] = useState(false);
    const [addTitle, setAddTitle] = useState('');
    const [addAbstract, setAddAbstract] = useState('');
    const [addConference, setAddConference] = useState('');
    const [addPaperUrl, setAddPaperUrl] = useState('');
    const [addDeadline, setAddDeadline] = useState('');
    const [addProjectId, setAddProjectId] = useState('');
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const [addSuccess, setAddSuccess] = useState<string | null>(null);

    // Projects for dropdown
    const [projects, setProjects] = useState<any[]>([]);

    // Detail / Edit panel (Inline)
    const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);
    const [editingPaperId, setEditingPaperId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<PaperSubmissionResponse>>({});
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // Delete
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Submit for review
    const [submitReviewLoading, setSubmitReviewLoading] = useState<string | null>(null);

    // Submit Venue Modal (Keep as modal since it's a specific prompt, not general edit)
    const [showVenueModal, setShowVenueModal] = useState<string | null>(null); // paperId
    const [venueUrl, setVenueUrl] = useState('');
    const [venueLoading, setVenueLoading] = useState(false);

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
            console.error('Error loading papers:', err);
            if (!err.response) {
                setError('Cannot connect to Paper Submission server. Please ensure the Backend is running.');
            } else {
                setError('Failed to load papers list. Please try again.');
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

    const handleCreatePaper = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError(null);
        setAddSuccess(null);
        setAddLoading(true);

        try {
            const payload: CreatePaperRequest = {
                projectId: addProjectId || null,
                title: addTitle,
                abstract: addAbstract,
                conferenceName: addConference,
                paperUrl: addPaperUrl,
                submissionDeadline: new Date(addDeadline).toISOString(),
                members: [],
            };
            const newPaper = await paperSubmissionService.create(payload);
            setPapers((prev) => [newPaper, ...prev]);
            setAddTitle('');
            setAddAbstract('');
            setAddConference('');
            setAddPaperUrl('');
            setAddDeadline('');
            setAddProjectId('');
            setAddSuccess(`Paper "${newPaper.title}" created successfully!`);
            setTimeout(() => { setAddSuccess(null); setShowAddForm(false); }, 2000);
        } catch (err: any) {
            const data = err.response?.data;
            let msg = 'Failed to create paper. Please try again.';
            if (data?.message) msg = data.message;
            else if (typeof data === 'string') msg = data;
            else if (!err.response) msg = 'Cannot connect to server. Please ensure the Backend is running.';
            else if (err.response?.status === 400) msg = 'Bad Request: Please check your input fields.';
            setAddError(msg);
        } finally {
            setAddLoading(false);
        }
    };

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setDeleteLoading(true);
        try {
            await paperSubmissionService.delete(id);
            setPapers((prev) => prev.filter((p) => p.paperSubmissionId !== id));
            setDeleteConfirmId(null);
            if (expandedPaperId === id) setExpandedPaperId(null);
            if (editingPaperId === id) setEditingPaperId(null);
        } catch (err: any) {
            console.error('Failed to delete paper:', err);
            alert(err.response?.data?.message || 'Failed to delete paper.');
            setDeleteConfirmId(null);
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleSubmitForReview = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSubmitReviewLoading(id);
        try {
            const updated = await paperSubmissionService.submitForReview(id);
            setPapers((prev) => prev.map((p) => (p.paperSubmissionId === id ? updated : p)));
        } catch (err: any) {
            console.error('Failed to submit for review:', err);
            alert(err.response?.data?.message || 'Failed to submit for review.');
        } finally {
            setSubmitReviewLoading(null);
        }
    };

    const handleSubmitVenue = async () => {
        if (!showVenueModal) return;
        setVenueLoading(true);
        try {
            const updated = await paperSubmissionService.submitToVenue(showVenueModal, venueUrl);
            setPapers((prev) => prev.map((p) => (p.paperSubmissionId === updated.paperSubmissionId ? updated : p)));
            setShowVenueModal(null);
            setVenueUrl('');
        } catch (err: any) {
            console.error('Failed to submit to venue:', err);
            alert(err.response?.data?.message || 'Failed to process submission.');
        } finally {
            setVenueLoading(false);
        }
    };

    const toggleRow = (paperId: string) => {
        if (expandedPaperId === paperId) {
            setExpandedPaperId(null);
            setEditingPaperId(null);
        } else {
            setExpandedPaperId(paperId);
            setEditingPaperId(null);
            setEditError(null);
        }
    };

    const startEditing = (paper: PaperSubmissionResponse, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setExpandedPaperId(paper.paperSubmissionId);
        setEditingPaperId(paper.paperSubmissionId);
        setEditData({
            title: paper.title,
            abstract: paper.abstract,
            conferenceName: paper.conferenceName,
            paperUrl: paper.paperUrl,
            submissionDeadline: paper.submissionDeadline.split('T')[0],
        });
        setEditError(null);
    };

    const cancelEditing = () => {
        setEditingPaperId(null);
        setEditError(null);
    };

    const handleUpdatePaper = async () => {
        if (!editingPaperId) return;
        setEditError(null);
        setEditLoading(true);
        try {
            const payload: UpdatePaperRequest = {
                title: editData.title || '',
                abstract: editData.abstract || '',
                paperUrl: editData.paperUrl || '',
                conferenceName: editData.conferenceName || '',
                submissionDeadline: editData.submissionDeadline ? new Date(editData.submissionDeadline).toISOString() : new Date().toISOString(),
                members: [],
            };
            const updated = await paperSubmissionService.update(editingPaperId, payload);
            setPapers((prev) => prev.map((p) => (p.paperSubmissionId === updated.paperSubmissionId ? updated : p)));
            setEditingPaperId(null);
        } catch (err: any) {
            console.error('Failed to update paper:', err);
            setEditError(err.response?.data?.message || 'Failed to update paper.');
        } finally {
            setEditLoading(false);
        }
    };

    const filtered = papers.filter(
        (p) =>
            p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.conferenceName.toLowerCase().includes(search.toLowerCase()),
    );

    const getProjectName = (id?: string | null) => {
        if (!id) return 'N/A';
        const p = projects.find((x) => x.projectId === id || x.id === id);
        return p ? (p.projectName || p.name || p.title) : 'Unknown Project';
    };

    return (
        <MainLayout>
            <div className="page-container">
                <div className="page-header" style={{ marginBottom: '2.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div>
                            <h1 style={{ marginBottom: '4px' }}>
                                <FileText size={28} style={{ marginRight: '0.75rem', verticalAlign: 'middle', color: 'var(--primary-color)' }} />
                                Papers
                            </h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                Manage your scientific paper submissions
                            </p>
                        </div>
                        <button
                            className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 700 }}
                            onClick={() => { setShowAddForm(!showAddForm); setAddError(null); setAddSuccess(null); }}
                        >
                            {showAddForm ? <><X size={18} /> Close</> : <><Plus size={18} /> New Paper</>}
                        </button>
                    </div>
                </div>

                {/* Inline Add Form */}
                {showAddForm && (
                    <div className="um-add-form card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                        <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Plus size={18} style={{ color: 'var(--accent-color)' }} /> Create New Paper
                        </h3>

                        {addError && (
                            <div className="um-alert um-alert-error">
                                <AlertTriangle size={16} /> {addError}
                            </div>
                        )}
                        {addSuccess && (
                            <div className="um-alert um-alert-success">
                                ✓ {addSuccess}
                            </div>
                        )}

                        <form onSubmit={handleCreatePaper} className="um-form-grid">
                            <div className="um-form-field">
                                <label><FileText size={14} /> Title *</label>
                                <input required type="text" placeholder="Paper title..." value={addTitle} onChange={(e) => setAddTitle(e.target.value)} disabled={addLoading} className="form-input" />
                            </div>
                            <div className="um-form-field">
                                <label><BookOpen size={14} /> Conference / Journal *</label>
                                <input required type="text" placeholder="e.g. IEEE ICSE 2026..." value={addConference} onChange={(e) => setAddConference(e.target.value)} disabled={addLoading} className="form-input" />
                            </div>
                            <div className="um-form-field">
                                <label><Calendar size={14} /> Submission Deadline *</label>
                                <input required type="date" value={addDeadline} onChange={(e) => setAddDeadline(e.target.value)} disabled={addLoading} className="form-input" />
                            </div>
                            <div className="um-form-field">
                                <label>Project</label>
                                <select value={addProjectId} onChange={(e) => setAddProjectId(e.target.value)} disabled={addLoading} className="form-input">
                                    <option value="">-- No linked project --</option>
                                    {projects.map((proj: any) => (
                                        <option key={proj.projectId || proj.id} value={proj.projectId || proj.id}>
                                            {proj.projectName || proj.name || proj.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="um-form-field" style={{ gridColumn: '1 / -1' }}>
                                <label><LinkIcon size={14} /> Paper URL</label>
                                <input type="url" placeholder="https://drive.google.com/..." value={addPaperUrl} onChange={(e) => setAddPaperUrl(e.target.value)} disabled={addLoading} className="form-input" />
                            </div>
                            <div className="um-form-field" style={{ gridColumn: '1 / -1' }}>
                                <label>Abstract</label>
                                <textarea placeholder="Brief summary of the paper..." value={addAbstract} onChange={(e) => setAddAbstract(e.target.value)} disabled={addLoading} className="form-input" rows={3} style={{ resize: 'vertical' }} />
                            </div>
                            <div className="um-form-actions" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)} disabled={addLoading}>Cancel</button>
                                <button type="submit" disabled={addLoading} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {addLoading && <Loader2 size={16} className="animate-spin" />}
                                    {addLoading ? 'Creating...' : 'Create Paper'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Search */}
                <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input type="text" placeholder="Search by title or conference..." value={search} onChange={(e) => setSearch(e.target.value)} className="form-input" style={{ paddingLeft: '40px' }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {filtered.length} paper{filtered.length !== 1 ? 's' : ''}
                    </span>
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
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        <FileText size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>{search ? `No results for "${search}"` : 'No papers yet. Click "New Paper" to get started.'}</p>
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
                                    <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((paper) => {
                                    const isExpanded = expandedPaperId === paper.paperSubmissionId;
                                    const isEditing = editingPaperId === paper.paperSubmissionId;
                                    const isDeleting = deleteConfirmId === paper.paperSubmissionId;
                                    const isSubmitting = submitReviewLoading === paper.paperSubmissionId;

                                    return (
                                        <React.Fragment key={paper.paperSubmissionId}>
                                            <tr
                                                className={`um-row ${isExpanded ? 'um-row-expanded' : ''}`}
                                                onClick={() => toggleRow(paper.paperSubmissionId)}
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
                                                        {paper.status === SubmissionStatus.Approved && (
                                                            <button
                                                                title="Submit to Venue"
                                                                onClick={(e) => { e.stopPropagation(); setShowVenueModal(paper.paperSubmissionId); setVenueUrl(paper.paperUrl); }}
                                                                className="btn btn-ghost"
                                                                style={{ color: '#8b5cf6', padding: '4px 8px' }}
                                                            >
                                                                <ExternalLink size={15} />
                                                            </button>
                                                        )}
                                                        {(paper.status === SubmissionStatus.Draft || paper.status === SubmissionStatus.Revision) && (
                                                            <button
                                                                title="Submit for Internal Review"
                                                                onClick={(e) => handleSubmitForReview(paper.paperSubmissionId, e)}
                                                                disabled={isSubmitting}
                                                                className="btn btn-ghost"
                                                                style={{ color: '#3b82f6', padding: '4px 8px' }}
                                                            >
                                                                {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                                                            </button>
                                                        )}
                                                        <button
                                                            className="btn btn-ghost"
                                                            style={{ color: 'var(--accent-color)', padding: '4px 8px' }}
                                                            onClick={(e) => startEditing(paper, e)}
                                                            title="Edit Details"
                                                        >
                                                            <Edit2 size={15} />
                                                        </button>
                                                        {paper.status === SubmissionStatus.Draft && (
                                                            <button
                                                                className="btn btn-ghost"
                                                                style={{ color: 'var(--danger)', padding: '4px 8px' }}
                                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(isDeleting ? null : paper.paperSubmissionId); }}
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Delete Confirmation Row */}
                                            {isDeleting && (
                                                <tr className="um-confirm-row">
                                                    <td colSpan={5}>
                                                        <div className="um-confirm-bar" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#ef444408', borderLeft: '3px solid #ef4444', padding: '10px 16px' }}>
                                                            <AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                                                            <span style={{ fontSize: '0.85rem' }}>Delete <strong>{paper.title}</strong>? This action cannot be undone.</span>
                                                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                                <button
                                                                    className="btn btn-secondary"
                                                                    style={{ padding: '4px 14px', fontSize: '0.8rem' }}
                                                                    onClick={() => setDeleteConfirmId(null)}
                                                                    disabled={deleteLoading}
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    className="btn"
                                                                    style={{ padding: '4px 14px', fontSize: '0.8rem', background: 'var(--danger)', color: 'white', border: 'none' }}
                                                                    onClick={(e) => handleDelete(paper.paperSubmissionId, e)}
                                                                    disabled={deleteLoading}
                                                                >
                                                                    {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Confirm
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}

                                            {/* Expandable Detail/Edit Row */}
                                            {isExpanded && (
                                                <tr className="um-detail-row">
                                                    <td colSpan={5} style={{ padding: 0 }}>
                                                        <div className="um-detail-panel" style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                                                            {isEditing ? (
                                                                /* ---- EDIT MODE ---- */
                                                                <div className="um-edit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                                                    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                                                        <Edit2 size={16} style={{ color: 'var(--accent-color)' }} /> 
                                                                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Edit Paper Details</h3>
                                                                    </div>
                                                                    {editError && (
                                                                        <div className="um-alert um-alert-error" style={{ gridColumn: '1 / -1' }}>
                                                                            <AlertTriangle size={16} /> {editError}
                                                                        </div>
                                                                    )}
                                                                    <div className="um-form-field" style={{ gridColumn: '1 / -1' }}>
                                                                        <label>Title *</label>
                                                                        <input type="text" className="form-input" value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} disabled={editLoading}/>
                                                                    </div>
                                                                    <div className="um-form-field">
                                                                        <label>Conference / Journal *</label>
                                                                        <input type="text" className="form-input" value={editData.conferenceName} onChange={e => setEditData({...editData, conferenceName: e.target.value})} disabled={editLoading}/>
                                                                    </div>
                                                                    <div className="um-form-field">
                                                                        <label>Submission Deadline *</label>
                                                                        <input type="date" className="form-input" value={editData.submissionDeadline} onChange={e => setEditData({...editData, submissionDeadline: e.target.value})} disabled={editLoading}/>
                                                                    </div>
                                                                    <div className="um-form-field" style={{ gridColumn: '1 / -1' }}>
                                                                        <label>Paper URL</label>
                                                                        <input type="url" className="form-input" value={editData.paperUrl} onChange={e => setEditData({...editData, paperUrl: e.target.value})} disabled={editLoading}/>
                                                                    </div>
                                                                    <div className="um-form-field" style={{ gridColumn: '1 / -1' }}>
                                                                        <label>Abstract</label>
                                                                        <textarea className="form-input" rows={5} value={editData.abstract} onChange={e => setEditData({...editData, abstract: e.target.value})} disabled={editLoading}/>
                                                                    </div>
                                                                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                                                                        <button type="button" className="btn btn-secondary" onClick={cancelEditing} disabled={editLoading} style={{ padding: '6px 18px' }}>
                                                                            Cancel
                                                                        </button>
                                                                        <button type="button" className="btn btn-primary" onClick={handleUpdatePaper} disabled={editLoading || !editData.title} style={{ padding: '6px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            {editLoading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                /* ---- VIEW MODE ---- */
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: 'var(--text-primary)' }}>{paper.title}</h3>
                                                                        {(paper.status === SubmissionStatus.Draft || paper.status === SubmissionStatus.Revision) && (
                                                                            <button className="btn btn-outline" onClick={(e) => startEditing(paper, e)} style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
                                                                                <Edit2 size={14} /> Edit
                                                                            </button>
                                                                        )}
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
                                                                </div>
                                                            )}
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

            {/* Submit to Venue Modal (Kept as modal since it asks for 1 input before an external system transitions) */}
            {showVenueModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}><ExternalLink size={18} color="#8b5cf6" /> Submit to Venue Output</h3>
                            <button onClick={() => setShowVenueModal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        </div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                            Provide the final URL (Overleaf, ArXiv, Journal portal) where this paper has been submitted.
                        </p>
                        <div className="um-form-field">
                            <label>Final Paper / Action URL *</label>
                            <input type="url" placeholder="https://..." value={venueUrl} onChange={e => setVenueUrl(e.target.value)} className="form-input" disabled={venueLoading} autoFocus />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                            <button className="btn btn-secondary" onClick={() => setShowVenueModal(null)} disabled={venueLoading}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmitVenue} disabled={venueLoading || !venueUrl.trim()} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#8b5cf6', borderColor: '#8b5cf6' }}>
                                {venueLoading && <Loader2 size={16} className="animate-spin" />} Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default PaperSubmissions;
