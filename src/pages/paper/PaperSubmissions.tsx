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
    type CreatePaperRequest,
    type UpdatePaperRequest,
    type PaperMemberRequest,
} from '@/types/paperSubmission';
import {
    Plus, Search, ExternalLink, X, Loader2, AlertTriangle, Trash2,
    Send, Edit2, Link as LinkIcon, FileText, Clock, CheckCircle2,
    XCircle, RotateCcw, ChevronDown, ChevronRight, Eye
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
        case SubmissionStatus.Rejected:
            return { color: '#dc2626', bg: '#fee2e2', icon: <XCircle size={14} />, label: 'Rejected' };
        default:
            return { color: '#64748b', bg: '#f1f5f9', icon: <Clock size={14} />, label: 'Unknown' };
    }
};

const PaperSubmissions: React.FC = () => {
    const [papers, setPapers] = useState<PaperSubmissionResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [_error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Pagination
    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // Form states
    const [showAddForm, setShowAddForm] = useState(false);
    const [addTitle, setAddTitle] = useState('');
    const [addAbstract, setAddAbstract] = useState('');
    const [addConference, setAddConference] = useState('');
    const [addPaperUrl, setAddPaperUrl] = useState('');
    const [addProjectId, setAddProjectId] = useState('');
    const [addMembers, setAddMembers] = useState<PaperMemberRequest[]>([]);
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const [addSuccess, setAddSuccess] = useState<string | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Related Data
    const [projects, setProjects] = useState<any[]>([]);
    const [projectMembers, setProjectMembers] = useState<any[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);

    // Detail / Edit panel
    const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);
    const [editingPaperId, setEditingPaperId] = useState<string | null>(null);
    const [editData, setEditData] = useState<any>({});
    const [editLoading, setEditLoading] = useState(false);
    const [_editError, setEditError] = useState<string | null>(null);

    // Delete & Submit
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [_deleteLoading, setDeleteLoading] = useState(false);
    const [submitReviewLoading, setSubmitReviewLoading] = useState<string | null>(null);
    const [revertLoading, setRevertLoading] = useState<string | null>(null);

    // Submission Venue Modal
    const [showVenueModal, setShowVenueModal] = useState<string | null>(null);
    const [venueUrl, setVenueUrl] = useState('');
    const [venueLoading, setVenueLoading] = useState(false);

    useEffect(() => { loadPapers(); loadProjects(); }, []);

    const loadPapers = async (page = pageIndex, size = pageSize) => {
        try {
            setLoading(true); setError(null);
            const data = await paperSubmissionService.getAll({ pageIndex: page, pageSize: size });
            if (page > 1 && (data.items?.length ?? 0) === 0 && (data.totalCount ?? 0) > 0) {
                const prevPage = page - 1;
                setPageIndex(prevPage);
                await loadPapers(prevPage, size);
                return;
            }
            setPapers(data.items || []);
            setTotalCount(data.totalCount ?? 0);
            setPageIndex(data.pageIndex ?? page);
            setPageSize(data.pageSize ?? size);
            setTotalPages(data.totalPages ?? Math.ceil((data.totalCount ?? 0) / ((data.pageSize ?? size) || 1)));
        } catch (err: any) {
            setError(!err.response ? 'Cannot connect to Paper Submission server.' : 'Failed to load papers list.');
            setPapers([]); setTotalCount(0);
        } finally { setLoading(false); }
    };

    const loadProjects = async () => {
        try { const data = await projectService.getAll(); setProjects(data); } catch { console.error('Error loading projects'); }
    };

    const handleProjectChange = async (projectId: string, isEdit = false, updateMembers = true) => {
        if (isEdit) {
            setEditData((prev: any) => ({ ...prev, projectId, members: updateMembers ? [] : prev.members }));
        } else {
            setAddProjectId(projectId);
            if (updateMembers) setAddMembers([]);
        }
        if (projectId) {
            setMembersLoading(true);
            try { const members = await membershipService.getProjectMembers(projectId); setProjectMembers(members); }
            catch (err) { console.error('Failed to load project members:', err); }
            finally { setMembersLoading(false); }
        } else { setProjectMembers([]); }
    };

    const validateForm = (data: { title: string, conferenceName: string, paperUrl?: string }) => {
        const errs: Record<string, string> = {};
        if (!data.title?.trim()) errs.title = 'Title is required';
        if (!data.conferenceName?.trim()) errs.conferenceName = 'Conference/Journal name is required';
        if (data.paperUrl && data.paperUrl.trim() && !data.paperUrl.match(/^https?:\/\/.+/)) {
            errs.paperUrl = 'Please enter a valid URL (starting with http:// or https://)';
        }
        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleCreatePaper = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm({ title: addTitle, conferenceName: addConference, paperUrl: addPaperUrl })) return;
        setAddError(null); setAddSuccess(null); setAddLoading(true);
        try {
            let myMembershipId: string | undefined;
            if (addProjectId) { const me = await projectService.getCurrentMember(addProjectId); myMembershipId = me?.membershipId; }
            const payload: CreatePaperRequest = {
                projectId: addProjectId || null, title: addTitle, abstract: addAbstract,
                conferenceName: addConference, paperUrl: addPaperUrl, submissionDeadline: null,
                members: addMembers.map(m => ({ membershipId: m.membershipId, role: Number(m.role) })),
                // @ts-ignore
                createdByMembershipId: myMembershipId || null
            };
            const newPaper = await paperSubmissionService.create(payload);
            await loadPapers(1, pageSize);
            setAddTitle(''); setAddAbstract(''); setAddConference(''); setAddPaperUrl(''); setAddProjectId(''); setAddMembers([]);
            setAddSuccess(`Paper "${newPaper.title}" created successfully!`);
            setTimeout(() => { setAddSuccess(null); setShowAddForm(false); }, 2000);
        } catch (err: any) { setAddError(err.response?.data?.message || 'Failed to create paper.'); }
        finally { setAddLoading(false); }
    };

    const handleUpdatePaper = async () => {
        if (!editingPaperId) return;
        if (!validateForm({ title: editData.title || '', conferenceName: editData.conferenceName || '', paperUrl: editData.paperUrl })) return;
        setEditError(null); setEditLoading(true);
        try {
            let myMembershipId: string | undefined;
            if (editData.projectId) { const me = await projectService.getCurrentMember(editData.projectId); myMembershipId = me?.membershipId; }
            const payload: UpdatePaperRequest = {
                projectId: editData.projectId || null, title: editData.title || '', abstract: editData.abstract || '',
                paperUrl: editData.paperUrl || '', conferenceName: editData.conferenceName || '',
                submissionDeadline: editData.submissionDeadline ? editData.submissionDeadline : null,
                members: editData.members?.map((m: any) => ({ membershipId: m.membershipId, role: Number(m.role) })) || [],
                // @ts-ignore
                lastUpdatedByMembershipId: myMembershipId || null
            };
            const updated = await paperSubmissionService.update(editingPaperId, payload);
            setPapers((prev) => prev.map((p) => (p.paperSubmissionId === updated.paperSubmissionId ? updated : p)));
            setEditingPaperId(null);
        } catch (err: any) { setEditError(err.response?.data?.message || 'Failed to update paper.'); }
        finally { setEditLoading(false); }
    };

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setDeleteLoading(true);
        try { await paperSubmissionService.delete(id); await loadPapers(pageIndex, pageSize); setDeleteConfirmId(null); }
        catch (err: any) { alert(err.response?.data?.message || 'Failed to delete paper.'); }
        finally { setDeleteLoading(false); }
    };

    const handleSubmitForReview = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSubmitReviewLoading(id);
        try {
            const updated = await paperSubmissionService.submitForReview(id);
            setPapers((prev) => prev.map((p) => (p.paperSubmissionId === id ? updated : p)));
        } catch (err: any) { alert(err.response?.data?.message || 'Failed to submit for review.'); }
        finally { setSubmitReviewLoading(null); }
    };

    const handleRevertToDraft = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setRevertLoading(id);
        try {
            const updated = await paperSubmissionService.changeStatus(id, SubmissionStatus.Draft);
            setPapers((prev) => prev.map((p) => (p.paperSubmissionId === id ? updated : p)));
        } catch (err: any) { alert(err.response?.data?.message || 'Failed to revert to draft.'); }
        finally { setRevertLoading(null); }
    };

    const handleSubmitVenue = async () => {
        if (!showVenueModal) return;
        setVenueLoading(true);
        try {
            const updated = await paperSubmissionService.submitToVenue(showVenueModal, venueUrl);
            setPapers((prev) => prev.map((p) => (p.paperSubmissionId === updated.paperSubmissionId ? updated : p)));
            setShowVenueModal(null); setVenueUrl('');
        } catch (err: any) { alert(err.response?.data?.message || 'Failed to process submission.'); }
        finally { setVenueLoading(false); }
    };

    const toggleRow = (paperId: string) => {
        if (expandedPaperId === paperId) { setExpandedPaperId(null); setEditingPaperId(null); }
        else {
            setExpandedPaperId(paperId); setEditingPaperId(null); setEditError(null);
            // Auto-load project members so author names display correctly
            const paper = papers.find(p => p.paperSubmissionId === paperId);
            if (paper?.projectId) {
                membershipService.getProjectMembers(paper.projectId)
                    .then(members => setProjectMembers(members))
                    .catch(() => {});
            }
        }
    };

    const startEditing = (paper: PaperSubmissionResponse, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setExpandedPaperId(paper.paperSubmissionId);
        setEditingPaperId(paper.paperSubmissionId);
        setEditData({ ...paper, submissionDeadline: paper.submissionDeadline ? paper.submissionDeadline.split('T')[0] : '' });
        setEditError(null);
        if (paper.projectId) handleProjectChange(paper.projectId, true, false);
    };

    const filtered = papers.filter((p) => {
        const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.conferenceName.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'all' || p.status.toString() === statusFilter;
        return matchSearch && matchStatus;
    });

    const handlePageChange = (nextPage: number) => {
        if (nextPage < 1 || (totalPages && nextPage > totalPages)) return;
        loadPapers(nextPage, pageSize);
    };

    const handlePageSizeChange = (size: number) => { loadPapers(1, size); };

    const showingFrom = totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1;
    const showingTo = totalCount === 0 ? 0 : Math.min(totalCount, showingFrom + papers.length - 1);

    const getProjectName = (id?: string | null) => {
        if (!id) return 'N/A';
        const p = projects.find((x) => x.projectId === id || x.id === id);
        return p ? (p.projectName || p.name || p.title) : 'Unknown Project';
    };

    // Stats
    const statWidgets = [
        { label: 'Total Papers', value: totalCount, icon: <FileText size={20} />, color: 'var(--accent-color)', bg: 'var(--accent-bg)' },
        { label: 'Drafts', value: papers.filter(p => p.status === SubmissionStatus.Draft).length, icon: <Clock size={20} />, color: '#64748b', bg: '#f1f5f9' },
        { label: 'In Review', value: papers.filter(p => p.status === SubmissionStatus.InternalReview).length, icon: <Eye size={20} />, color: '#d97706', bg: '#fef3c7' },
        { label: 'Approved', value: papers.filter(p => p.status === SubmissionStatus.Approved).length, icon: <CheckCircle2 size={20} />, color: '#16a34a', bg: '#dcfce7' },
        { label: 'Rejected', value: papers.filter(p => p.status === SubmissionStatus.Rejected).length, icon: <XCircle size={20} />, color: '#dc2626', bg: '#fee2e2' },
    ];

    return (
        <MainLayout>
            <div className="page-container">
                {/* Page Header */}
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>Paper Submissions</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Manage your scientific paper submissions and track their progress.</p>
                    </div>
                    <button
                        className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 700 }}
                        onClick={() => { setShowAddForm(!showAddForm); setAddError(null); setAddSuccess(null); }}
                    >
                        {showAddForm ? <><X size={18} /> Close</> : <><Plus size={18} /> New Paper</>}
                    </button>
                </div>

                {/* Stat Widgets */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '1rem', marginBottom: '2rem'
                }}>
                    {statWidgets.map((stat, index) => (
                        <div key={index} className="card stat-widget" style={{ opacity: loading ? 0.7 : 1 }}>
                            <div className="stat-widget-icon" style={{ background: stat.bg, color: stat.color }}>
                                {stat.icon}
                            </div>
                            <div>
                                <p className="stat-widget-label">{stat.label}</p>
                                <p className="stat-widget-value">{loading ? '...' : stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Create Form */}
                {showAddForm && (
                    <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem', border: '1px solid var(--accent-color)', borderRadius: '16px' }}>
                        <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 700 }}>Create New Paper</h3>
                        {addError && <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}><AlertTriangle size={16} /> {addError}</div>}
                        {addSuccess && <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: '#dcfce7', color: '#16a34a', marginBottom: '1rem', fontSize: '0.9rem' }}>✓ {addSuccess}</div>}
                        <form onSubmit={handleCreatePaper} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Title <span style={{ color: '#dc2626' }}>*</span></label>
                                <input type="text" placeholder="Paper title..." value={addTitle} onChange={(e) => setAddTitle(e.target.value)} disabled={addLoading} className={`form-input ${formErrors.title ? 'error' : ''}`} />
                                {formErrors.title && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{formErrors.title}</span>}
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Conference / Journal <span style={{ color: '#dc2626' }}>*</span></label>
                                <input type="text" placeholder="e.g. IEEE ICSE 2026..." value={addConference} onChange={(e) => setAddConference(e.target.value)} disabled={addLoading} className={`form-input ${formErrors.conferenceName ? 'error' : ''}`} />
                                {formErrors.conferenceName && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{formErrors.conferenceName}</span>}
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Project</label>
                                <select value={addProjectId} onChange={(e) => handleProjectChange(e.target.value)} disabled={addLoading} className="form-input">
                                    <option value="">{projects.length > 0 ? 'Select a project' : 'No project available'}</option>
                                    {projects.map((proj: any) => <option key={proj.projectId || proj.id} value={proj.projectId || proj.id}>{proj.projectName || proj.name || proj.title}</option>)}
                                </select>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Authors / Members</label>
                                {!addProjectId ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Select a project first.</p> : membersLoading ? <div style={{ fontSize: '0.85rem' }}><Loader2 size={14} className="animate-spin" /> Loading members...</div> : (
                                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px', background: 'var(--surface-hover)' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: addMembers.length > 0 ? '10px' : 0 }}>
                                            {addMembers.map((m, idx) => {
                                                const pm = projectMembers.find(p => (p.membershipId || p.memberId) === m.membershipId);
                                                return <div key={idx} style={{ background: 'white', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {pm?.fullName || 'User'} ({PaperRoleLabel[m.role as PaperRoleEnum]})
                                                    <button type="button" onClick={() => setAddMembers(prev => prev.filter((_, i) => i !== idx))} style={{ color: '#dc2626', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
                                                </div>
                                            })}
                                        </div>
                                        <select className="form-input" onChange={(e) => {
                                            const mid = e.target.value; if (!mid || addMembers.some(am => am.membershipId === mid)) return;
                                            setAddMembers([...addMembers, { membershipId: mid, role: PaperRoleEnum.CoAuthor }]); e.target.value = '';
                                        }}>
                                            <option value="">+ Add Author...</option>
                                            {projectMembers.map(pm => ({ ...pm, _mid: pm.membershipId || pm.memberId })).filter(pm => pm._mid && !addMembers.some(am => am.membershipId === pm._mid)).map(pm => <option key={pm._mid} value={pm._mid}>{pm.fullName}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Paper URL</label>
                                <input type="url" placeholder="https://..." value={addPaperUrl} onChange={(e) => setAddPaperUrl(e.target.value)} className={`form-input ${formErrors.paperUrl ? 'error' : ''}`} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Abstract</label>
                                <textarea placeholder="..." value={addAbstract} onChange={(e) => setAddAbstract(e.target.value)} className="form-input" rows={3} />
                            </div>
                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={addLoading}>{addLoading ? 'Creating...' : 'Create Paper'}</button>
                            </div>
                        </form>
                    </div>
                )}

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
                            style={{ paddingLeft: '44px', height: '44px', border: 'none', background: 'var(--surface-hover)', borderRadius: '10px', fontSize: '0.95rem' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {[
                            { value: 'all', label: 'All' },
                            { value: SubmissionStatus.Draft.toString(), label: 'Draft' },
                            { value: SubmissionStatus.InternalReview.toString(), label: 'In Review' },
                            { value: SubmissionStatus.Approved.toString(), label: 'Approved' },
                            { value: SubmissionStatus.Rejected.toString(), label: 'Rejected' },
                        ].map(f => (
                            <button
                                key={f.value}
                                onClick={() => setStatusFilter(f.value)}
                                className={`filter-chip ${statusFilter === f.value ? 'active' : ''}`}
                                style={{ height: '44px', padding: '0 1.25rem', borderRadius: '10px' }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Paper List */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary-color)' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state card" style={{ padding: '4rem 2rem', borderStyle: 'dashed', textAlign: 'center' }}>
                        <FileText size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                        <h2 style={{ margin: '0 0 0.5rem' }}>No Papers Found</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            {search || statusFilter !== 'all' ? 'No papers match your current filters.' : 'Start by creating your first paper submission.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {filtered.map((paper) => {
                                const isExpanded = expandedPaperId === paper.paperSubmissionId;
                                const isEditing = editingPaperId === paper.paperSubmissionId;
                                const isDeleting = deleteConfirmId === paper.paperSubmissionId;
                                const isSubmitting = submitReviewLoading === paper.paperSubmissionId;
                                const isReverting = revertLoading === paper.paperSubmissionId;
                                const statusConfig = getStatusConfig(paper.status);

                                return (
                                    <div key={paper.paperSubmissionId} className="card" style={{
                                        padding: 0, overflow: 'hidden',
                                        border: isExpanded ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
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
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{paper.conferenceName} · {getProjectName(paper.projectId)}</p>
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

                                            {/* Actions */}
                                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                                {/* Fix & Resubmit for Rejected papers */}
                                                {paper.status === SubmissionStatus.Rejected && (
                                                    <button
                                                        onClick={e => handleRevertToDraft(paper.paperSubmissionId, e)}
                                                        className="btn btn-ghost"
                                                        title="Fix & Resubmit"
                                                        style={{ color: '#d97706', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}
                                                    >
                                                        {isReverting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                                        <span>Fix & Resubmit</span>
                                                    </button>
                                                )}
                                                {/* Submit to Venue for Approved */}
                                                {paper.status === SubmissionStatus.Approved && (
                                                    <button onClick={() => { setShowVenueModal(paper.paperSubmissionId); setVenueUrl(paper.paperUrl); }} className="btn btn-ghost" title="Submit to Venue" style={{ color: '#7c3aed', padding: '6px' }}>
                                                        <ExternalLink size={18} />
                                                    </button>
                                                )}
                                                {/* Submit for Review */}
                                                {paper.status === SubmissionStatus.Draft && (
                                                    <button onClick={e => handleSubmitForReview(paper.paperSubmissionId, e)} className="btn btn-ghost" title="Submit for Review" style={{ color: '#2563eb', padding: '6px' }}>
                                                        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                                    </button>
                                                )}
                                                {/* Edit */}
                                                {paper.status === SubmissionStatus.Draft && (
                                                    <button onClick={e => startEditing(paper, e)} className="btn btn-ghost" title="Edit" style={{ color: 'var(--accent-color)', padding: '6px' }}>
                                                        <Edit2 size={18} />
                                                    </button>
                                                )}
                                                {/* Delete */}
                                                {(paper.status === SubmissionStatus.Draft || paper.status === SubmissionStatus.Rejected) && (
                                                    <button onClick={() => setDeleteConfirmId(isDeleting ? null : paper.paperSubmissionId)} className="btn btn-ghost" title="Delete" style={{ color: '#dc2626', padding: '6px' }}>
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Delete Confirmation */}
                                        {isDeleting && (
                                            <div style={{ display: 'flex', gap: '1rem', padding: '10px 1.5rem', background: '#fef2f2', borderTop: '1px solid #fecaca', alignItems: 'center' }}>
                                                <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                                                <span style={{ flex: 1, fontSize: '0.9rem' }}>Delete <strong>{paper.title}</strong>?</span>
                                                <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.85rem' }} onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                                                <button className="btn" style={{ background: '#dc2626', color: 'white', padding: '4px 12px', fontSize: '0.85rem', border: 'none', borderRadius: '6px' }} onClick={() => handleDelete(paper.paperSubmissionId)}>Confirm Delete</button>
                                            </div>
                                        )}

                                        {/* Expanded Detail / Edit Panel */}
                                        {isExpanded && (
                                            <div style={{ borderTop: '1px solid var(--border-color)', padding: '1.5rem', background: 'var(--background-color)' }}>
                                                {isEditing ? (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                        <div style={{ gridColumn: '1 / -1' }}>
                                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Title *</label>
                                                            <input className="form-input" value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} />
                                                        </div>
                                                        <div>
                                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Conference *</label>
                                                            <input className="form-input" value={editData.conferenceName} onChange={e => setEditData({...editData, conferenceName: e.target.value})} />
                                                        </div>
                                                        <div>
                                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Project</label>
                                                            <select className="form-input" value={editData.projectId || ''} onChange={e => handleProjectChange(e.target.value, true)}>
                                                                <option value="">{projects.length > 0 ? '-- Select a project --' : '-- No project available --'}</option>
                                                                {projects.map((proj: any) => <option key={proj.projectId || proj.id} value={proj.projectId || proj.id}>{proj.projectName || proj.name || proj.title}</option>)}
                                                            </select>
                                                        </div>
                                                        <div style={{ gridColumn: '1 / -1' }}>
                                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Authors</label>
                                                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px', background: 'var(--surface-hover)' }}>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: editData.members?.length > 0 ? '10px' : 0 }}>
                                                                    {/* @ts-ignore */}
                                                                    {editData.members?.map((m: any, idx: number) => {
                                                                        const pm = projectMembers.find((p: any) => (p.membershipId || p.memberId) === m.membershipId);
                                                                        return <div key={idx} style={{ background: 'white', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            {pm?.fullName || 'User'} ({PaperRoleLabel[m.role as PaperRoleEnum]})
                                                                            <button type="button" onClick={() => setEditData({ ...editData, members: editData.members?.filter((_: any, i: number) => i !== idx) })} style={{ color: '#dc2626', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
                                                                        </div>
                                                                    })}
                                                                </div>
                                                                <select className="form-input" onChange={(e) => {
                                                                    const mid = e.target.value; if (!mid || editData.members?.some((am: any) => am.membershipId === mid)) return;
                                                                    setEditData({ ...editData, members: [...(editData.members || []), { membershipId: mid, role: PaperRoleEnum.CoAuthor }] }); e.target.value = '';
                                                                }}>
                                                                    <option value="">+ Add Author...</option>
                                                                    {projectMembers.map(pm => ({ ...pm, _mid: pm.membershipId || pm.memberId })).filter(pm => pm._mid && !editData.members?.some((am: any) => am.membershipId === pm._mid)).map(pm => <option key={pm._mid} value={pm._mid}>{pm.fullName}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div style={{ gridColumn: '1 / -1' }}>
                                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Paper URL</label>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <input className="form-input" style={{ flex: 1 }} value={editData.paperUrl} onChange={e => setEditData({...editData, paperUrl: e.target.value})} />
                                                                {editData.paperUrl && <a href={editData.paperUrl} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '8px' }}><ExternalLink size={18} /></a>}
                                                            </div>
                                                        </div>
                                                        <div style={{ gridColumn: '1 / -1' }}>
                                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Abstract</label>
                                                            <textarea className="form-input" rows={4} value={editData.abstract} onChange={e => setEditData({...editData, abstract: e.target.value})} />
                                                        </div>
                                                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                            <button className="btn btn-secondary" onClick={() => setEditingPaperId(null)}>Cancel</button>
                                                            <button className="btn btn-primary" onClick={handleUpdatePaper}>{editLoading ? 'Saving...' : 'Save Changes'}</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                        {/* Title row */}
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
                                                                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{paper.conferenceName}</div>
                                                            </div>
                                                            <div style={{ background: 'var(--surface-color)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.5px' }}>Project</div>
                                                                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{getProjectName(paper.projectId)}</div>
                                                            </div>
                                                        </div>

                                                        {/* Paper URL */}
                                                        {paper.paperUrl && (
                                                            <div>
                                                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.5px' }}>Paper URL</div>
                                                                <a href={paper.paperUrl} target="_blank" rel="noreferrer"
                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--surface-color)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s' }}
                                                                    onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                                                                    onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                                                >
                                                                    <LinkIcon size={16} />
                                                                    <span style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paper.paperUrl}</span>
                                                                </a>
                                                            </div>
                                                        )}

                                                        {/* Authors */}
                                                        {paper.members && paper.members.length > 0 && (
                                                            <div style={{ background: 'var(--surface-color)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                                                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', fontWeight: 700 }}>Authors ({paper.members.length})</h4>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                                    {paper.members.map((m, idx) => {
                                                                        const pm = projectMembers.find((p: any) => (p.membershipId || p.memberId) === m.membershipId);
                                                                        return (
                                                                            <div key={idx} style={{
                                                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                                                background: 'var(--background-color)', padding: '6px 12px',
                                                                                borderRadius: '8px', border: '1px solid var(--border-color)',
                                                                                fontSize: '0.85rem'
                                                                            }}>
                                                                                <span style={{ fontWeight: 600 }}>{pm?.fullName || m.membershipId.substring(0, 8)}</span>
                                                                                <span className="badge" style={{
                                                                                    fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px',
                                                                                    background: 'var(--accent-bg)', color: 'var(--accent-color)', fontWeight: 600
                                                                                }}>
                                                                                    {PaperRoleLabel[m.role as PaperRoleEnum] || 'Member'}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Abstract */}
                                                        <div style={{ background: 'var(--surface-color)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                                            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', fontWeight: 700 }}>Abstract</h4>
                                                            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.6 }}>{paper.abstract || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>No abstract provided.</span>}</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {!loading && totalCount > 0 && (
                            <div className="card" style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                                    Showing {showingFrom}–{showingTo} of {totalCount}
                                    {search ? ` · Filtered: ${filtered.length}/${papers.length}` : ''}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Page size</span>
                                        <select className="form-input" style={{ width: '80px' }} value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))}>
                                            {[10, 20, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <button className="btn btn-secondary" disabled={pageIndex <= 1 || loading} onClick={() => handlePageChange(pageIndex - 1)} style={{ padding: '4px 12px', fontSize: '0.85rem' }}>Prev</button>
                                        <span style={{ minWidth: '100px', textAlign: 'center', fontSize: '0.88rem' }}>Page {pageIndex} / {Math.max(totalPages, 1)}</span>
                                        <button className="btn btn-secondary" disabled={loading || pageIndex >= totalPages} onClick={() => handlePageChange(pageIndex + 1)} style={{ padding: '4px 12px', fontSize: '0.85rem' }}>Next</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Venue Modal */}
            {showVenueModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderRadius: '16px' }}>
                        <h3 style={{ margin: 0
                        }}>Submit to Venue</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>Provide the final submission URL for the venue.</p>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Final URL *</label>
                            <input type="url" value={venueUrl} onChange={e => setVenueUrl(e.target.value)} className="form-input" disabled={venueLoading} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button className="btn btn-secondary" onClick={() => setShowVenueModal(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmitVenue} disabled={venueLoading || !venueUrl.trim()}>{venueLoading ? 'Submitting...' : 'Submit'}</button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default PaperSubmissions;
