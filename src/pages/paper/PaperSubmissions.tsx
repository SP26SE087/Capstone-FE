import React, { useEffect, useState } from 'react';
import MainLayout from '@/layout/MainLayout';
import { paperSubmissionService } from '@/services/paperSubmissionService';
import { projectService } from '@/services/projectService';
import { membershipService } from '@/services/membershipService';
import { useToastStore } from '@/store/slices/toastSlice';
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
    XCircle, RotateCcw, ChevronDown, ChevronRight, Eye, Repeat, Gavel
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

const PaperSubmissions: React.FC = () => {
    const [papers, setPapers] = useState<PaperSubmissionResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [_error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const addToast = useToastStore(state => state.addToast);

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
    const [addDocumentFile, setAddDocumentFile] = useState<File | null>(null);
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
            try {
                const members = await membershipService.getProjectMembers(projectId);
                setProjectMembers(members);
                // Auto-add current user as FirstAuthor when selecting/changing project
                if (updateMembers) {
                    const me = await projectService.getCurrentMember(projectId);
                    const myId = me?.membershipId || me?.memberId;
                    if (myId) {
                        if (isEdit) {
                            setEditData((prev: any) => ({ ...prev, members: [{ membershipId: myId, role: PaperRoleEnum.FirstAuthor }] }));
                        } else {
                            setAddMembers([{ membershipId: myId, role: PaperRoleEnum.FirstAuthor }]);
                        }
                    }
                }
            }
            catch (err) { console.error('Failed to load project members:', err); }
            finally { setMembersLoading(false); }
        } else { setProjectMembers([]); }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (isEdit) {
            setEditData((prev: any) => ({ ...prev, documentFile: file }));
        } else {
            setAddDocumentFile(file);
        }
    };

    const validateForm = (data: { title: string, conferenceName: string, hasDocument: boolean, abstract?: string }) => {
        const errs: Record<string, string> = {};
        if (!data.title?.trim()) errs.title = 'Title is required';
        if (!data.conferenceName?.trim()) errs.conferenceName = 'Conference/Journal name is required';
        if (!data.hasDocument) errs.document = 'A .doc or .docx file is required';
        if (!data.abstract?.trim()) errs.abstract = 'Abstract is required';
        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleCreatePaper = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm({ title: addTitle, conferenceName: addConference, hasDocument: !!addDocumentFile, abstract: addAbstract })) return;
        setAddError(null); setAddSuccess(null); setAddLoading(true);
        try {
            let myMembershipId: string | undefined;
            if (addProjectId) { const me = await projectService.getCurrentMember(addProjectId); myMembershipId = me?.membershipId; }
            const payload: CreatePaperRequest = {
                projectId: addProjectId || null, title: addTitle, abstract: addAbstract,
                conferenceName: addConference, paperUrl: '', submissionDeadline: null,
                members: addMembers.map(m => ({ membershipId: m.membershipId, role: Number(m.role) })),
                // @ts-ignore
                createdByMembershipId: myMembershipId || null
            };
            const newPaper = await paperSubmissionService.create(payload, addDocumentFile || undefined);
            await loadPapers(1, pageSize);
            setAddTitle(''); setAddAbstract(''); setAddConference(''); setAddDocumentFile(null); setAddProjectId(''); setAddMembers([]);
            setAddSuccess(`Paper "${newPaper.title}" created successfully!`);
            addToast('Draft created successfully!', 'success');
            setTimeout(() => { setAddSuccess(null); setShowAddForm(false); }, 2000);
        } catch (err: any) { setAddError(err.response?.data?.message || 'Failed to create paper.'); }
        finally { setAddLoading(false); }
    };

    const handleUpdatePaper = async () => {
        if (!editingPaperId) return;
        if (!validateForm({ title: editData.title || '', conferenceName: editData.conferenceName || '', hasDocument: !!editData.document || !!editData.documentFile, abstract: editData.abstract || '' })) return;
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
            const updated = await paperSubmissionService.update(editingPaperId, payload, editData.documentFile || undefined);
            setPapers((prev) => prev.map((p) => (p.paperSubmissionId === updated.paperSubmissionId ? updated : p)));
            setEditingPaperId(null);
        } catch (err: any) { setEditError(err.response?.data?.message || 'Failed to update paper.'); }
        finally { setEditLoading(false); }
    };

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this paper?')) return;
        setDeleteLoading(true);
        try { 
            await paperSubmissionService.delete(id); 
            await loadPapers(pageIndex, pageSize); 
            addToast('Paper deleted successfully!', 'success');
        }
        catch (err: any) { alert(err.response?.data?.message || 'Failed to delete paper.'); }
        finally { setDeleteLoading(false); }
    };

    const handleSubmitForReview = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSubmitReviewLoading(id);
        try {
            const updated = await paperSubmissionService.submitForReview(id);
            setPapers((prev) => prev.map((p) => (p.paperSubmissionId === id ? updated : p)));
            addToast('Submitted successfully!', 'success');
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

    const handleChangeStatus = async (id: string, newStatus: SubmissionStatus, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setRevertLoading(id);
        try {
            const updated = await paperSubmissionService.changeStatus(id, newStatus);
            setPapers((prev) => prev.map((p) => (p.paperSubmissionId === id ? updated : p)));
            addToast(`Status updated successfully!`, 'success');
        } catch (err: any) { alert(err.response?.data?.message || 'Failed to update status.'); }
        finally { setRevertLoading(null); }
    };

    const handleSubmitVenue = async () => {
        if (!showVenueModal) return;
        setVenueLoading(true);
        try {
            const paper = papers.find(p => p.paperSubmissionId === showVenueModal);
            let targetStatus = undefined;
            
            // If already submitted or in revision, resubmitting moves it to Revision
            if (paper?.status === SubmissionStatus.Submitted || paper?.status === SubmissionStatus.Revision) {
                targetStatus = SubmissionStatus.Revision;
            }

            const updated = await paperSubmissionService.submitToVenue(showVenueModal, venueUrl, targetStatus);
            setPapers((prev) => prev.map((p) => (p.paperSubmissionId === updated.paperSubmissionId ? updated : p)));
            setShowVenueModal(null); setVenueUrl('');
            addToast('Submitted successfully!', 'success');
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

    const startEditing = async (paper: PaperSubmissionResponse, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setExpandedPaperId(paper.paperSubmissionId);
        setEditingPaperId(paper.paperSubmissionId);
        
        // Identify current user and set as FirstAuthor
        let members = paper.members?.map(m => ({ membershipId: m.membershipId, role: m.role })) || [];
        if (paper.projectId) {
            try {
                const me = await projectService.getCurrentMember(paper.projectId);
                const myId = me?.membershipId || me?.memberId;
                console.log('[Paper Edit] getCurrentMember:', me, 'myId:', myId);
                console.log('[Paper Edit] paper.members:', members);
                if (myId) {
                    const existingIdx = members.findIndex(m => m.membershipId === myId);
                    if (existingIdx >= 0) {
                        // Current user exists in members - set as FirstAuthor and move to front
                        members[existingIdx] = { ...members[existingIdx], role: PaperRoleEnum.FirstAuthor };
                        const [creator] = members.splice(existingIdx, 1);
                        members.unshift(creator);
                    } else {
                        // Current user not in members - add as FirstAuthor at front
                        members.unshift({ membershipId: myId, role: PaperRoleEnum.FirstAuthor });
                    }
                    // Ensure all other members are CoAuthor
                    members = members.map((m, i) => i === 0 ? m : { ...m, role: PaperRoleEnum.CoAuthor });
                }
            } catch (err) { console.error('[Paper Edit] getCurrentMember failed:', err); }
        }
        
        setEditData({ ...paper, members, submissionDeadline: paper.submissionDeadline ? paper.submissionDeadline.split('T')[0] : '', documentFile: null });
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
        { label: 'Total Papers', value: totalCount, icon: <FileText size={18} />, color: 'var(--accent-color)', bg: 'var(--accent-bg)' },
        { label: 'Drafts', value: papers.filter(p => p.status === SubmissionStatus.Draft).length, icon: <Clock size={18} />, color: '#64748b', bg: '#f1f5f9' },
        { label: 'In Review', value: papers.filter(p => p.status === SubmissionStatus.InternalReview).length, icon: <Eye size={18} />, color: '#d97706', bg: '#fef3c7' },
        { label: 'Approved', value: papers.filter(p => p.status === SubmissionStatus.Approved).length, icon: <CheckCircle2 size={18} />, color: '#16a34a', bg: '#dcfce7' },
        { label: 'Submitted', value: papers.filter(p => p.status === SubmissionStatus.Submitted).length, icon: <Send size={18} />, color: '#2563eb', bg: '#dbeafe' },
        { label: 'Revision', value: papers.filter(p => p.status === SubmissionStatus.Revision).length, icon: <Repeat size={18} />, color: '#8b5cf6', bg: '#ede9fe' },
        { label: 'Decision', value: papers.filter(p => p.status === SubmissionStatus.Decision).length, icon: <Gavel size={18} />, color: '#0f766e', bg: '#ccfbf1' },
        { label: 'Rejected', value: papers.filter(p => p.status === SubmissionStatus.Rejected).length, icon: <XCircle size={18} />, color: '#dc2626', bg: '#fee2e2' },
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
                    display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
                    gap: '0.75rem', marginBottom: '2rem'
                }}>
                    {statWidgets.map((stat, index) => (
                        <div key={index} className="card" style={{ 
                            opacity: loading ? 0.7 : 1, padding: '1rem', 
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            borderRadius: '12px', transition: 'all 0.2s',
                            border: '1px solid var(--border-color)',
                            background: '#ffffff'
                        }}>
                            <div style={{ 
                                background: stat.bg, color: stat.color, 
                                padding: '8px', borderRadius: '10px', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {stat.icon}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stat.label}</p>
                                <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{loading ? '...' : stat.value}</p>
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
                                                const isCreator = m.role === PaperRoleEnum.FirstAuthor;
                                                return <div key={idx} style={{ background: isCreator ? '#fffbeb' : 'white', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${isCreator ? '#f59e0b' : 'var(--border-color)'}`, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {pm?.fullName || 'User'} <span style={{ color: isCreator ? '#d97706' : '#64748b', fontWeight: 600, fontSize: '0.75rem' }}>({PaperRoleLabel[m.role as PaperRoleEnum]})</span>
                                                    {!isCreator && (
                                                        <button type="button" onClick={() => setAddMembers(prev => prev.filter((_, i) => i !== idx))} style={{ color: '#dc2626', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
                                                    )}
                                                </div>
                                            })}
                                        </div>
                                        <select className="form-input" onChange={(e) => {
                                            const mid = e.target.value; if (!mid || addMembers.some(am => am.membershipId === mid)) return;
                                            setAddMembers([...addMembers, { membershipId: mid, role: PaperRoleEnum.CoAuthor }]); e.target.value = '';
                                        }}>
                                            <option value="">+ Add Co-Author...</option>
                                            {projectMembers.map(pm => ({ ...pm, _mid: pm.membershipId || pm.memberId })).filter(pm => pm._mid && !addMembers.some(am => am.membershipId === pm._mid)).map(pm => <option key={pm._mid} value={pm._mid}>{pm.fullName}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Paper Document (.doc, .docx) *</label>
                                <div style={{ 
                                    border: `2px dashed ${formErrors.document ? '#dc2626' : 'var(--border-color)'}`, 
                                    borderRadius: '12px', 
                                    padding: '1.5rem', 
                                    textAlign: 'center',
                                    background: 'var(--surface-color)',
                                    transition: 'all 0.2s',
                                    position: 'relative'
                                }}>
                                    {!addDocumentFile ? (
                                        <>
                                            <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
                                                <FileText size={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
                                                <p style={{ margin: 0, fontSize: '0.9rem' }}>Click or drag to add .doc or .docx (Max 200MB)</p>
                                            </div>
                                            <input 
                                                type="file" 
                                                accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                                                onChange={(e) => handleFileChange(e, false)} 
                                                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
                                            />
                                        </>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                            <div style={{ background: 'var(--accent-bg)', color: 'var(--accent-color)', padding: '10px', borderRadius: '10px' }}>
                                                <FileText size={24} />
                                            </div>
                                            <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                                                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addDocumentFile.name}</p>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ready to upload</p>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => setAddDocumentFile(null)}
                                                className="btn btn-ghost" 
                                                style={{ color: '#dc2626', padding: '6px' }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {formErrors.document && <span style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{formErrors.document}</span>}
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Abstract <span style={{ color: '#dc2626' }}>*</span></label>
                                <textarea placeholder="Provide a brief summary of your research..." value={addAbstract} onChange={(e) => setAddAbstract(e.target.value)} className="form-input" rows={3} style={formErrors.abstract ? { borderColor: '#dc2626' } : {}} />
                                {formErrors.abstract && <span style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{formErrors.abstract}</span>}
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
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="form-input"
                        style={{ 
                            height: '44px', width: '180px', borderRadius: '10px', 
                            background: 'var(--surface-hover)', border: 'none',
                            fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                            color: 'var(--text-primary)', padding: '0 12px'
                        }}
                    >
                        <option value="all">All Status</option>
                        <option value={SubmissionStatus.Draft.toString()}>Draft</option>
                        <option value={SubmissionStatus.InternalReview.toString()}>In Review</option>
                        <option value={SubmissionStatus.Approved.toString()}>Approved</option>
                        <option value={SubmissionStatus.Submitted.toString()}>Submitted</option>
                        <option value={SubmissionStatus.Revision.toString()}>Revision</option>
                        <option value={SubmissionStatus.Decision.toString()}>Decision</option>
                        <option value={SubmissionStatus.Rejected.toString()}>Rejected</option>
                    </select>
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
                                                {/* Revisions & Decision Actions */}
                                                {(paper.status === SubmissionStatus.Submitted || paper.status === SubmissionStatus.Revision) && (
                                                    <>
                                                        <button 
                                                            onClick={() => { setShowVenueModal(paper.paperSubmissionId); setVenueUrl(paper.paperUrl); }} 
                                                            className="btn btn-ghost" 
                                                            title="Resubmit / Update URL" 
                                                            style={{ color: '#8b5cf6', padding: '6px' }}
                                                        >
                                                            <RotateCcw size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={e => handleChangeStatus(paper.paperSubmissionId, SubmissionStatus.Decision, e)} 
                                                            className="btn btn-ghost" 
                                                            title="Final Decision" 
                                                            style={{ color: '#0f766e', padding: '6px' }}
                                                        >
                                                            {isReverting ? <Loader2 size={16} className="animate-spin" /> : <Gavel size={18} />}
                                                        </button>
                                                    </>
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
                                                    <button onClick={(e) => handleDelete(paper.paperSubmissionId, e)} className="btn btn-ghost" title="Delete" style={{ color: '#dc2626', padding: '6px' }}>
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

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
                                                                        const isCreator = m.role === PaperRoleEnum.FirstAuthor;
                                                                        return <div key={idx} style={{ background: isCreator ? '#fffbeb' : 'white', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${isCreator ? '#f59e0b' : 'var(--border-color)'}`, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            {pm?.fullName || 'User'} <span style={{ color: isCreator ? '#d97706' : '#64748b', fontWeight: 600, fontSize: '0.75rem' }}>({PaperRoleLabel[m.role as PaperRoleEnum]})</span>
                                                                            {!isCreator && (
                                                                                <button type="button" onClick={() => setEditData({ ...editData, members: editData.members?.filter((_: any, i: number) => i !== idx) })} style={{ color: '#dc2626', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
                                                                            )}
                                                                        </div>
                                                                    })}
                                                                </div>
                                                                <select className="form-input" onChange={(e) => {
                                                                    const mid = e.target.value; if (!mid || editData.members?.some((am: any) => am.membershipId === mid)) return;
                                                                    setEditData({ ...editData, members: [...(editData.members || []), { membershipId: mid, role: PaperRoleEnum.CoAuthor }] }); e.target.value = '';
                                                                }}>
                                                                    <option value="">+ Add Co-Author...</option>
                                                                    {projectMembers.map(pm => ({ ...pm, _mid: pm.membershipId || pm.memberId })).filter(pm => pm._mid && !editData.members?.some((am: any) => am.membershipId === pm._mid)).map(pm => <option key={pm._mid} value={pm._mid}>{pm.fullName}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div style={{ gridColumn: '1 / -1' }}>
                                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Paper Document (.doc, .docx) *</label>
                                                            <div style={{ 
                                                                border: '2px dashed var(--border-color)', 
                                                                borderRadius: '12px', 
                                                                padding: '1.25rem', 
                                                                textAlign: 'center',
                                                                background: 'var(--surface-color)',
                                                                position: 'relative'
                                                            }}>
                                                                {!editData.document && !editData.documentFile ? (
                                                                    <>
                                                                        <div style={{ color: 'var(--text-muted)' }}>
                                                                            <FileText size={24} style={{ opacity: 0.5, marginBottom: '4px' }} />
                                                                            <p style={{ margin: 0, fontSize: '0.85rem' }}>Upload new version (Max 200MB)</p>
                                                                        </div>
                                                                        <input 
                                                                            type="file" 
                                                                            accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                                                                            onChange={(e) => handleFileChange(e, true)} 
                                                                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
                                                                        />
                                                                    </>
                                                                ) : (
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                                                        <div style={{ background: 'var(--accent-bg)', color: 'var(--accent-color)', padding: '8px', borderRadius: '8px' }}>
                                                                            <FileText size={20} />
                                                                        </div>
                                                                        <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                                                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editData.documentFile?.name || (editData.document ? editData.document.split('/').pop() : 'File attached')}</p>
                                                                        </div>
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => setEditData((prev: any) => ({ ...prev, document: '', documentFile: null }))}
                                                                            className="btn btn-ghost" 
                                                                            style={{ color: '#dc2626', padding: '4px' }}
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div style={{ gridColumn: '1 / -1' }}>
                                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Abstract <span style={{ color: '#dc2626' }}>*</span></label>
                                                            <textarea className="form-input" rows={4} value={editData.abstract} onChange={e => setEditData({...editData, abstract: e.target.value})} style={formErrors.abstract ? { borderColor: '#dc2626' } : {}} />
                                                            {formErrors.abstract && <span style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{formErrors.abstract}</span>}
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
