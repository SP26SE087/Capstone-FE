import React, { useEffect, useState } from 'react';
import MainLayout from '@/layout/MainLayout';
import { paperSubmissionService } from '@/services/paperSubmissionService';
import { projectService } from '@/services/projectService';
import { membershipService } from '@/services/membershipService';
import {
    SubmissionStatus,
    SubmissionStatusLabel,
    PaperRoleEnum,
    PaperRoleLabel,
    type PaperSubmissionResponse,
    type CreatePaperRequest,
    type UpdatePaperRequest,
    type PaperMemberRequest,
} from '@/types/paperSubmission';
import {
    Plus,
    Search,
    ExternalLink,
    X,
    Loader2,
    AlertTriangle,
    Trash2,
    Send,
    Edit2,
    Link as LinkIcon,
    FileText
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
    const [_error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

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

    // Detail / Edit panel (Inline)
    const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);
    const [editingPaperId, setEditingPaperId] = useState<string | null>(null);
    const [editData, setEditData] = useState<any>({});
    const [editLoading, setEditLoading] = useState(false);
    const [_editError, setEditError] = useState<string | null>(null);

    // Delete & Submit
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [_deleteLoading, setDeleteLoading] = useState(false);
    const [submitReviewLoading, setSubmitReviewLoading] = useState<string | null>(null);

    // Submission Venue Modal
    const [showVenueModal, setShowVenueModal] = useState<string | null>(null); 
    const [venueUrl, setVenueUrl] = useState('');
    const [venueLoading, setVenueLoading] = useState(false);

    useEffect(() => {
        loadPapers();
        loadProjects();
    }, []);

    const loadPapers = async (page = pageIndex, size = pageSize) => {
        try {
            setLoading(true);
            setError(null);
            const data = await paperSubmissionService.getAll({ pageIndex: page, pageSize: size });

            // If current page empty but still has data, go back one page to keep view filled
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
            const totalPg = data.totalPages ?? Math.ceil((data.totalCount ?? 0) / ((data.pageSize ?? size) || 1));
            setTotalPages(totalPg);
        } catch (err: any) {
            console.error('Error loading papers:', err);
            setError(!err.response ? 'Cannot connect to Paper Submission server.' : 'Failed to load papers list.');
            setPapers([]);
            setTotalCount(0);
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

    const handleProjectChange = async (projectId: string, isEdit = false, updateMembers = true) => {
        if (isEdit) {
            setEditData((prev: any) => ({ ...prev, projectId, members: updateMembers ? [] : prev.members }));
        } else {
            setAddProjectId(projectId);
            if (updateMembers) setAddMembers([]);
        }

        if (projectId) {
            setMembersLoading(true);
            try {
                const members = await membershipService.getProjectMembers(projectId);
                setProjectMembers(members);
            } catch (err) {
                console.error('Failed to load project members:', err);
            } finally {
                setMembersLoading(false);
            }
        } else {
            setProjectMembers([]);
        }
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

        setAddError(null);
        setAddSuccess(null);
        setAddLoading(true);

        try {
            let myMembershipId: string | undefined;
            if (addProjectId) {
                const me = await projectService.getCurrentMember(addProjectId);
                myMembershipId = me?.membershipId;
            }

            const payload: CreatePaperRequest = {
                projectId: addProjectId || null,
                title: addTitle,
                abstract: addAbstract,
                conferenceName: addConference,
                paperUrl: addPaperUrl,
                submissionDeadline: null,
                members: addMembers.map(m => ({ membershipId: m.membershipId, role: Number(m.role) })),
                // @ts-ignore
                createdByMembershipId: myMembershipId || null
            };
            const newPaper = await paperSubmissionService.create(payload);
            await loadPapers(1, pageSize); // refresh to include newest and update totals
            setAddTitle(''); setAddAbstract(''); setAddConference(''); setAddPaperUrl(''); setAddProjectId(''); setAddMembers([]);
            setAddSuccess(`Paper "${newPaper.title}" created successfully!`);
            setTimeout(() => { setAddSuccess(null); setShowAddForm(false); }, 2000);
        } catch (err: any) {
            setAddError(err.response?.data?.message || 'Failed to create paper.');
        } finally {
            setAddLoading(false);
        }
    };

    const handleUpdatePaper = async () => {
        if (!editingPaperId) return;
        if (!validateForm({ title: editData.title || '', conferenceName: editData.conferenceName || '', paperUrl: editData.paperUrl })) return;

        setEditError(null);
        setEditLoading(true);
        try {
            let myMembershipId: string | undefined;
            if (editData.projectId) {
                const me = await projectService.getCurrentMember(editData.projectId);
                myMembershipId = me?.membershipId;
            }

            const payload: UpdatePaperRequest = {
                projectId: editData.projectId || null,
                title: editData.title || '',
                abstract: editData.abstract || '',
                paperUrl: editData.paperUrl || '',
                conferenceName: editData.conferenceName || '',
                submissionDeadline: editData.submissionDeadline ? editData.submissionDeadline : null,
                members: editData.members?.map((m: any) => ({ membershipId: m.membershipId, role: Number(m.role) })) || [],
                // @ts-ignore
                lastUpdatedByMembershipId: myMembershipId || null
            };
            const updated = await paperSubmissionService.update(editingPaperId, payload);
            setPapers((prev) => prev.map((p) => (p.paperSubmissionId === updated.paperSubmissionId ? updated : p)));
            setEditingPaperId(null);
        } catch (err: any) {
            setEditError(err.response?.data?.message || 'Failed to update paper.');
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setDeleteLoading(true);
        try {
            await paperSubmissionService.delete(id);
            await loadPapers(pageIndex, pageSize);
            setDeleteConfirmId(null);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete paper.');
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
            setShowVenueModal(null); setVenueUrl('');
        } catch (err: any) {
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
            ...paper,
            submissionDeadline: paper.submissionDeadline ? paper.submissionDeadline.split('T')[0] : ''
        });
        setEditError(null);
        if (paper.projectId) handleProjectChange(paper.projectId, true, false);
    };

    const filtered = papers.filter(
        (p) =>
            p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.conferenceName.toLowerCase().includes(search.toLowerCase()),
    );

    const handlePageChange = (nextPage: number) => {
        if (nextPage < 1 || (totalPages && nextPage > totalPages)) return;
        loadPapers(nextPage, pageSize);
    };

    const handlePageSizeChange = (size: number) => {
        loadPapers(1, size);
    };

    const showingFrom = totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1;
    const showingTo = totalCount === 0 ? 0 : Math.min(totalCount, showingFrom + papers.length - 1);

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
                                Paper Submission
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

                {showAddForm && (
                <div className="um-add-form card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 700 }}>Create New Paper</h3>
                    {addError && <div className="um-alert um-alert-error"><AlertTriangle size={16} /> {addError}</div>}
                    {addSuccess && <div className="um-alert um-alert-success">✓ {addSuccess}</div>}
                    <form onSubmit={handleCreatePaper} className="um-form-grid">
                        <div className="um-form-field" style={{ gridColumn: '1 / -1' }}>
                            <label>Title <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input type="text" placeholder="Paper title..." value={addTitle} onChange={(e) => setAddTitle(e.target.value)} disabled={addLoading} className={`form-input ${formErrors.title ? 'error' : ''}`} />
                            {formErrors.title && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{formErrors.title}</span>}
                        </div>
                        <div className="um-form-field">
                            <label>Conference / Journal <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input type="text" placeholder="e.g. IEEE ICSE 2026..." value={addConference} onChange={(e) => setAddConference(e.target.value)} disabled={addLoading} className={`form-input ${formErrors.conferenceName ? 'error' : ''}`} />
                            {formErrors.conferenceName && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{formErrors.conferenceName}</span>}
                        </div>
                        <div className="um-form-field">
                            <label>Project</label>
                            <select value={addProjectId} onChange={(e) => handleProjectChange(e.target.value)} disabled={addLoading} className="form-input">
                                <option value="">{projects.length > 0 ? 'Select a project' : 'No project available'}</option>
                                {projects.map((proj: any) => <option key={proj.projectId || proj.id} value={proj.projectId || proj.id}>{proj.projectName || proj.name || proj.title}</option>)}
                            </select>
                        </div>
                        <div className="um-form-field" style={{ gridColumn: '1 / -1' }}>
                            <label>Authors / Members</label>
                            {!addProjectId ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Select a project first.</p> : membersLoading ? <div style={{ fontSize: '0.85rem' }}><Loader2 size={14} className="animate-spin" /> Loading members...</div> : (
                                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', background: 'var(--bg-secondary)' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                                        {addMembers.map((m, idx) => {
                                            const pm = projectMembers.find(p => p.memberId === m.membershipId);
                                                return <div key={idx} style={{ background: 'white', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {pm?.fullName || 'User'} ({PaperRoleLabel[m.role as PaperRoleEnum]})
                                                <button type="button" onClick={() => setAddMembers(prev => prev.filter((_, i) => i !== idx))} style={{ color: 'var(--danger)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={14} /></button>
                                            </div>
                                        })}
                                    </div>
                                    <select className="form-input" onChange={(e) => {
                                        const mid = e.target.value; if (!mid || addMembers.some(am => am.membershipId === mid)) return;
                                        setAddMembers([...addMembers, { membershipId: mid, role: PaperRoleEnum.CoAuthor }]); e.target.value = '';
                                    }}>
                                        <option value="">+ Add Author...</option>
                                        {projectMembers.filter(pm => !addMembers.some(am => am.membershipId === pm.memberId)).map(pm => <option key={pm.memberId} value={pm.memberId}>{pm.fullName}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="um-form-field" style={{ gridColumn: '1 / -1' }}>
                            <label>Paper URL</label>
                            <input type="url" placeholder="https://..." value={addPaperUrl} onChange={(e) => setAddPaperUrl(e.target.value)} className={`form-input ${formErrors.paperUrl ? 'error' : ''}`} />
                        </div>
                        <div className="um-form-field" style={{ gridColumn: '1 / -1' }}>
                            <label>Abstract</label>
                            <textarea placeholder="..." value={addAbstract} onChange={(e) => setAddAbstract(e.target.value)} className="form-input" rows={3} />
                        </div>
                        <div className="um-form-actions" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={addLoading}>{addLoading ? 'Creating...' : 'Create Paper'}</button>
                        </div>
                    </form>
                </div>
                )}

                <div style={{ marginBottom: '1.5rem' }}>
                    <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input type="text" placeholder="Search title or conference..." value={search} onChange={(e) => setSearch(e.target.value)} className="form-input" style={{ paddingLeft: '40px' }} />
                        </div>
                    </div>
                    {search && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>Found {filtered.length} result(s) for "{search}"</div>}
                </div>

                {loading ? <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 className="animate-spin" size={40} /></div> : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No papers found.</div>
                ) : (
                    <>
                        <div className="um-table-wrapper card" style={{ padding: 0 }}>
                            <table className="um-table">
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', paddingLeft: '1.5rem' }}>Title & Conference</th>
                                        <th style={{ textAlign: 'left' }}>Project</th>
                                        <th style={{ textAlign: 'left' }}>Status</th>
                                        <th style={{ width: '150px', textAlign: 'center' }}>Actions</th>
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
                                                <tr className={`um-row ${isExpanded ? 'um-row-expanded' : ''}`} onClick={() => toggleRow(paper.paperSubmissionId)}>
                                                    <td style={{ paddingLeft: '1.5rem' }}>
                                                        <div style={{ fontWeight: 600 }}>{paper.title}</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{paper.conferenceName}</div>
                                                    </td>
                                                    <td><span style={{ fontSize: '0.85rem' }}>{getProjectName(paper.projectId)}</span></td>
                                                    <td>
                                                        <span className="badge" style={{ color: statusColor[paper.status], background: `${statusColor[paper.status]}18` }}>
                                                            {SubmissionStatusLabel[paper.status]}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                            {paper.status === SubmissionStatus.Approved && <button onClick={() => { setShowVenueModal(paper.paperSubmissionId); setVenueUrl(paper.paperUrl); }} className="btn btn-ghost" style={{ color: '#8b5cf6' }}><ExternalLink size={18} /></button>}
                                                            {(paper.status === SubmissionStatus.Draft || paper.status === SubmissionStatus.Revision) && <button onClick={e => handleSubmitForReview(paper.paperSubmissionId, e)} className="btn btn-ghost" style={{ color: '#3b82f6' }}>{isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button>}
                                                            {(paper.status === SubmissionStatus.Draft || paper.status === SubmissionStatus.Revision) && <button onClick={e => startEditing(paper, e)} className="btn btn-ghost" style={{ color: 'var(--accent-color)' }}><Edit2 size={18} /></button>}
                                                            {paper.status === SubmissionStatus.Draft && <button onClick={() => setDeleteConfirmId(isDeleting ? null : paper.paperSubmissionId)} className="btn btn-ghost" style={{ color: 'var(--danger)' }}><Trash2 size={18} /></button>}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isDeleting && (
                                                    <tr className="um-confirm-row"><td colSpan={4}><div className="um-confirm-bar" style={{ display: 'flex', gap: '1rem', padding: '10px 1.5rem', background: '#ef444408', borderLeft: '3px solid #ef4444' }}>
                                                        <span style={{ flex: 1 }}>Delete this paper? <strong>{paper.title}</strong></span>
                                                        <button className="btn btn-secondary" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                                                        <button className="btn btn-primary" style={{ background: 'var(--danger)' }} onClick={() => handleDelete(paper.paperSubmissionId)}>Confirm</button>
                                                    </div></td></tr>
                                                )}
                                                {isExpanded && (
                                                    <tr className="um-detail-row"><td colSpan={4} style={{ padding: 0 }}><div className="um-detail-panel" style={{ padding: '1.5rem', background: 'var(--bg-secondary)' }}>
                                                        {isEditing ? (
                                                            <div className="um-edit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                                <div className="um-form-field" style={{ gridColumn: '1 / -1' }}><label>Title *</label><input className="form-input" value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} /></div>
                                                                <div className="um-form-field"><label>Conference *</label><input className="form-input" value={editData.conferenceName} onChange={e => setEditData({...editData, conferenceName: e.target.value})} /></div>
                                                                <div className="um-form-field"><label>Project</label><select className="form-input" value={editData.projectId || ''} onChange={e => handleProjectChange(e.target.value, true)}>
                                                                    <option value="">{projects.length > 0 ? '-- Select a project --' : '-- No project available --'}</option>
                                                                    {projects.map((proj: any) => <option key={proj.projectId || proj.id} value={proj.projectId || proj.id}>{proj.projectName || proj.name || proj.title}</option>)}
                                                                </select></div>
                                                                <div className="um-form-field" style={{ gridColumn: '1 / -1' }}><label>Authors</label>
                                                                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', background: 'var(--bg-secondary)' }}>
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                                                                                    {/* @ts-ignore */}
                                                                                    {editData.members?.map((m: any, idx: number) => {
                                                                                        const pm = projectMembers.find((p: any) => p.memberId === m.membershipId);
                                                                                        return <div key={idx} style={{ background: 'white', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                            {pm?.fullName || 'User'} ({PaperRoleLabel[m.role as PaperRoleEnum]})
                                                                                            <button type="button" onClick={() => setEditData({ ...editData, members: editData.members?.filter((_: any, i: number) => i !== idx) })} style={{ color: 'var(--danger)', border: 'none', background: 'none', cursor: 'pointer' }}><X size={14} /></button>
                                                                                        </div>
                                                                                    })}
                                                                        </div>
                                                                        <select className="form-input" onChange={(e) => {
                                                                            const mid = e.target.value; if (!mid || editData.members?.some((am: any) => am.membershipId === mid)) return;
                                                                            setEditData({ ...editData, members: [...(editData.members || []), { membershipId: mid, role: PaperRoleEnum.CoAuthor }] }); e.target.value = '';
                                                                        }}>
                                                                            <option value="">+ Add Author...</option>
                                                                            {projectMembers.filter(pm => !editData.members?.some((am: any) => am.membershipId === pm.memberId)).map(pm => <option key={pm.memberId} value={pm.memberId}>{pm.fullName}</option>)}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                                <div className="um-form-field" style={{ gridColumn: '1 / -1' }}><label>URL</label>
                                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                                        <input className="form-input" style={{ flex: 1 }} value={editData.paperUrl} onChange={e => setEditData({...editData, paperUrl: e.target.value})} />
                                                                        {editData.paperUrl && (
                                                                            <a href={editData.paperUrl} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: '8px', border: '1px solid var(--border-color)' }}>
                                                                                <ExternalLink size={18} />
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="um-form-field" style={{ gridColumn: '1 / -1' }}><label>Abstract</label><textarea className="form-input" rows={4} value={editData.abstract} onChange={e => setEditData({...editData, abstract: e.target.value})} /></div>
                                                                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                                    <button className="btn btn-secondary" onClick={() => setEditingPaperId(null)}>Cancel</button>
                                                                    <button className="btn btn-primary" onClick={handleUpdatePaper}>{editLoading ? 'Saving...' : 'Save'}</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <h3 style={{ margin: 0 }}>{paper.title}</h3>
                                                                </div>
                                                                <div className="um-detail-grid">
                                                                    <div className="um-detail-item"><span className="um-detail-label">Status</span><span>{SubmissionStatusLabel[paper.status]}</span></div>
                                                                    <div className="um-detail-item"><span className="um-detail-label">Conference</span><span>{paper.conferenceName}</span></div>
                                                                    <div className="um-detail-item"><span className="um-detail-label">Project</span><span>{getProjectName(paper.projectId)}</span></div>
                                                                    <div className="um-detail-item" style={{ gridColumn: '1 / -1' }}><span className="um-detail-label">URL</span>
                                                                        {paper.paperUrl ? (
                                                                            <div style={{ marginTop: '4px' }}>
                                                                                <a href={paper.paperUrl} target="_blank" rel="noreferrer" 
                                                                                   style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'white', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                                                                                   onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                                                                                   onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                                                                >
                                                                                    <LinkIcon size={16} />
                                                                                    <span style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paper.paperUrl}</span>
                                                                                </a>
                                                                            </div>
                                                                        ) : <span style={{ color: 'var(--text-muted)' }}>N/A</span>}
                                                                    </div>
                                                                </div>
                                                                <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Abstract</h4>
                                                                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{paper.abstract || 'No abstract.'}</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div></td></tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {!loading && totalCount > 0 && (
                            <div className="card" style={{ marginTop: '1rem', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Hiển thị {showingFrom}-{showingTo} / {totalCount}
                                    {search ? ` · Lọc trong trang: ${filtered.length}/${papers.length}` : ''}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Page size</span>
                                        <select className="form-input" style={{ width: '90px' }} value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))}>
                                            {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <button className="btn btn-secondary" disabled={pageIndex <= 1 || loading || totalPages <= 0} onClick={() => handlePageChange(pageIndex - 1)}>Prev</button>
                                        <span style={{ minWidth: '120px', textAlign: 'center', fontSize: '0.9rem' }}>Page {pageIndex} / {Math.max(totalPages, 1)}</span>
                                        <button className="btn btn-secondary" disabled={loading || totalPages <= 0 || pageIndex >= totalPages} onClick={() => handlePageChange(pageIndex + 1)}>Next</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {showVenueModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h3>Submit to Venue</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Provide the final submission URL.</p>
                        <div className="um-form-field">
                            <label>Final URL *</label>
                            <input type="url" value={venueUrl} onChange={e => setVenueUrl(e.target.value)} className="form-input" disabled={venueLoading} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button className="btn btn-secondary" onClick={() => setShowVenueModal(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmitVenue} disabled={venueLoading || !venueUrl.trim()}>{venueLoading ? 'Loading...' : 'Submit'}</button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default PaperSubmissions;
