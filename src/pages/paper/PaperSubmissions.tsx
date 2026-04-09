import React, { useEffect, useState, useMemo } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
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
import Toast, { ToastType } from '@/components/common/Toast';
import {
    Plus, Search, ExternalLink, X, Loader2, Trash2,
    Send, Edit2, Link as LinkIcon, FileText, CheckCircle2, XCircle,
    Clock, Filter, Target, Briefcase, BookOpen, FileCheck, RefreshCw, Gavel, Upload
} from 'lucide-react';

const STATUS_COLOR: Record<SubmissionStatus, string> = {
    [SubmissionStatus.Draft]: '#94a3b8',
    [SubmissionStatus.InternalReview]: '#f59e0b',
    [SubmissionStatus.Approved]: '#22c55e',
    [SubmissionStatus.Submitted]: '#3b82f6',
    [SubmissionStatus.Revision]: '#f97316',
    [SubmissionStatus.Decision]: '#8b5cf6',
    [SubmissionStatus.Rejected]: '#ef4444',
};

const STATUS_BG: Record<SubmissionStatus, string> = {
    [SubmissionStatus.Draft]: '#f8fafc',
    [SubmissionStatus.InternalReview]: '#fffbeb',
    [SubmissionStatus.Approved]: '#f0fdf4',
    [SubmissionStatus.Submitted]: '#eff6ff',
    [SubmissionStatus.Revision]: '#fff7ed',
    [SubmissionStatus.Decision]: '#f5f3ff',
    [SubmissionStatus.Rejected]: '#fef2f2',
};

const isPdfFile = (file: File | null): boolean => {
    if (!file) return false;
    const name = file.name?.toLowerCase() || '';
    const type = file.type?.toLowerCase() || '';
    return name.endsWith('.pdf') || type === 'application/pdf';
};

const PaperSubmissions: React.FC = () => {
    const { user } = useAuth();
    const isDirector = user?.role === 'LabDirector' || user?.role === 'Lab Director';

    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const showToast = (message: string, type: ToastType = 'info') => setToast({ message, type });

    const [papers, setPapers] = useState<PaperSubmissionResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterProjectId, setFilterProjectId] = useState('');
    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize] = useState(50);
    const [totalCount, setTotalCount] = useState(0);

    const [projects, setProjects] = useState<any[]>([]);
    const [projectMembers, setProjectMembers] = useState<any[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);

    // Panel state
    const [activePanel, setActivePanel] = useState<'create' | 'view' | 'edit' | null>(null);
    const [selectedPaper, setSelectedPaper] = useState<PaperSubmissionResponse | null>(null);

    // Create form
    const [addTitle, setAddTitle] = useState('');
    const [addAbstract, setAddAbstract] = useState('');
    const [addConference, setAddConference] = useState('');
    const [addPaperUrl, setAddPaperUrl] = useState('');
    const [addProjectId, setAddProjectId] = useState('');
    const [addMembers, setAddMembers] = useState<PaperMemberRequest[]>([]);
    const [addDocument, setAddDocument] = useState<File | null>(null);
    const [addLoading, setAddLoading] = useState(false);

    // Edit form
    const [editData, setEditData] = useState<any>({});
    const [editDocument, setEditDocument] = useState<File | null>(null);
    const [editLoading, setEditLoading] = useState(false);

    // Action loading
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [submitReviewLoading, setSubmitReviewLoading] = useState(false);
    const [venueLoading, setVenueLoading] = useState(false);
    const [showVenueInput, setShowVenueInput] = useState(false);
    const [venueUrl, setVenueUrl] = useState('');
    const [showPdfViewer, setShowPdfViewer] = useState(false);
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [viewerKind, setViewerKind] = useState<'pdf' | 'office' | 'link'>('pdf');

    const openPdfViewer = (url: string) => {
        const cleanUrl = url.split('#')[0].split('?')[0];
        const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';
        const officeExts = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
        const pdfExts = ['pdf'];

        let nextViewerKind: 'pdf' | 'office' | 'link' = 'link';
        let nextViewerUrl = url;

        if (officeExts.includes(ext)) {
            nextViewerKind = 'office';
            nextViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        } else if (pdfExts.includes(ext)) {
            nextViewerKind = 'pdf';
            nextViewerUrl = url.replace('/raw/upload/', '/raw/upload/fl_attachment:false/');
        }

        setViewerKind(nextViewerKind);
        setViewerUrl(nextViewerUrl);
        setShowPdfViewer(true);
    };

    const closePdfViewer = () => {
        setShowPdfViewer(false);
        setViewerUrl(null);
    };

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const handleAddDocumentChange = (file: File | null) => {
        if (isPdfFile(file)) {
            showToast('PDF upload is currently disabled. Please upload DOC, DOCX, TXT, PPT, or PPTX.', 'error');
            setAddDocument(null);
            return;
        }
        setAddDocument(file);
    };

    const handleEditDocumentChange = (file: File | null) => {
        if (isPdfFile(file)) {
            showToast('PDF upload is currently disabled. Please upload DOC, DOCX, TXT, PPT, or PPTX.', 'error');
            setEditDocument(null);
            return;
        }
        setEditDocument(file);
    };

    useEffect(() => {
        loadPapers();
        loadProjects();
    }, []);

    useEffect(() => {
        if (activePanel !== 'view') return;
        if (!selectedPaper?.projectId) return;

        membershipService.getProjectMembers(selectedPaper.projectId)
            .then(members => setProjectMembers(members))
            .catch(() => {});
    }, [activePanel, selectedPaper?.projectId]);

    const loadPapers = async (page = pageIndex) => {
        try {
            setLoading(true);
            const data = await paperSubmissionService.getAll({ pageIndex: page, pageSize });
            setPapers(data.items || []);
            setTotalCount(data.totalCount ?? 0);
            setPageIndex(data.pageIndex ?? page);
        } catch (err: any) {
            showToast(!err.response ? 'Cannot connect to Paper Submission server.' : 'Failed to load papers.', 'error');
            setPapers([]);
        } finally {
            setLoading(false);
        }
    };

    const loadProjects = async () => {
        try {
            const data = await projectService.getAll();
            setProjects(data);
        } catch { /* silent */ }
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
            } catch { /* silent */ } finally {
                setMembersLoading(false);
            }
        } else {
            setProjectMembers([]);
        }
    };

    const validateForm = (data: { projectId?: string | null; title: string; conferenceName: string; paperUrl?: string }) => {
        const errs: Record<string, string> = {};
        if (!data.projectId || String(data.projectId).trim() === '') errs.projectId = 'Project is required';
        if (!data.title?.trim()) errs.title = 'Title is required';
        if (!data.conferenceName?.trim()) errs.conferenceName = 'Conference / Journal name is required';
        if (data.paperUrl?.trim() && !data.paperUrl.match(/^https?:\/\/.+/)) {
            errs.paperUrl = 'Please enter a valid URL (http:// or https://)';
        }
        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm({ projectId: addProjectId, title: addTitle, conferenceName: addConference, paperUrl: addPaperUrl })) return;
        if (isPdfFile(addDocument)) {
            showToast('PDF upload is currently disabled.', 'error');
            return;
        }
        setAddLoading(true);
        try {
            let myMembershipId: string | null = null;
            if (addProjectId) {
                const me = await projectService.getCurrentMember(addProjectId);
                myMembershipId = me?.membershipId || me?.memberId || me?.id || null;
                console.log('[Paper] getCurrentMember response:', me);
            }
            const payload: CreatePaperRequest = {
                projectId: addProjectId || null,
                title: addTitle, abstract: addAbstract,
                conferenceName: addConference, paperUrl: addPaperUrl,
                document: addDocument,
                members: addMembers.map(m => ({ membershipId: m.membershipId, role: Number(m.role) })),
                createdByMembershipId: myMembershipId
            };
            const newPaper = await paperSubmissionService.create(payload);
            await loadPapers(1);
            showToast(`Paper "${newPaper.title}" created successfully!`, 'success');
            setAddTitle(''); setAddAbstract(''); setAddConference(''); setAddPaperUrl(''); setAddProjectId(''); setAddMembers([]); setAddDocument(null);
            setActivePanel(null);
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to create paper.', 'error');
        } finally {
            setAddLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedPaper) return;
        if (!validateForm({ projectId: editData.projectId, title: editData.title || '', conferenceName: editData.conferenceName || '', paperUrl: editData.paperUrl })) return;
        if (isPdfFile(editDocument)) {
            showToast('PDF upload is currently disabled.', 'error');
            return;
        }
        setEditLoading(true);
        try {
            let myMembershipId: string | null = null;
            if (editData.projectId) {
                const me = await projectService.getCurrentMember(editData.projectId);
                myMembershipId = me?.membershipId || me?.memberId || me?.id || null;
                console.log('[Paper] getCurrentMember response:', me);
            }
            const payload: UpdatePaperRequest = {
                projectId: editData.projectId || null, title: editData.title || '',
                abstract: editData.abstract || '', paperUrl: editData.paperUrl || '',
                conferenceName: editData.conferenceName || '',
                document: editDocument,
                members: editData.members?.map((m: any) => ({ membershipId: m.membershipId, role: Number(m.role) })) || [],
                lastUpdatedByMembershipId: myMembershipId
            };
            const updated = await paperSubmissionService.update(selectedPaper.paperSubmissionId, payload);
            setPapers(prev => prev.map(p => p.paperSubmissionId === updated.paperSubmissionId ? updated : p));
            setSelectedPaper(updated);
            setActivePanel('view');
            showToast('Paper updated successfully!', 'success');
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to update paper.', 'error');
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        setActionLoading(id);
        try {
            await paperSubmissionService.delete(id);
            await loadPapers(pageIndex);
            showToast('Paper deleted.', 'success');
            setDeleteConfirmId(null);
            setActivePanel(null); setSelectedPaper(null);
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to delete paper.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSubmitForReview = async () => {
        if (!selectedPaper) return;
        if (selectedPaper.status !== SubmissionStatus.Draft) {
            showToast('Only Draft papers can be submitted for internal review.', 'warning');
            return;
        }
        setSubmitReviewLoading(true);
        try {
            const updated = await paperSubmissionService.submitForReview(selectedPaper.paperSubmissionId);
            setPapers(prev => prev.map(p => p.paperSubmissionId === updated.paperSubmissionId ? updated : p));
            setSelectedPaper(updated);
            showToast('Submitted for internal review!', 'success');
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to submit for review.', 'error');
        } finally {
            setSubmitReviewLoading(false);
        }
    };

    const handleDirectorReview = async (approve: boolean) => {
        if (!selectedPaper) return;
        setActionLoading(selectedPaper.paperSubmissionId);
        try {
            const updated = await paperSubmissionService.directorReview(selectedPaper.paperSubmissionId, approve);
            setPapers(prev => prev.map(p => p.paperSubmissionId === updated.paperSubmissionId ? updated : p));
            setSelectedPaper(updated);
            showToast(approve ? 'Paper approved!' : 'Paper rejected.', approve ? 'success' : 'error');
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Action failed.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSubmitVenue = async () => {
        if (!selectedPaper || !venueUrl.trim()) return;
        setVenueLoading(true);
        try {
            const updated = await paperSubmissionService.submitToVenue(selectedPaper.paperSubmissionId, venueUrl);
            setPapers(prev => prev.map(p => p.paperSubmissionId === updated.paperSubmissionId ? updated : p));
            setSelectedPaper(updated);
            setShowVenueInput(false); setVenueUrl('');
            showToast('Paper submitted successfully!', 'success');
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to submit paper.', 'error');
        } finally {
            setVenueLoading(false);
        }
    };

    const handleMarkRevision = async () => {
        if (!selectedPaper) return;
        setActionLoading(selectedPaper.paperSubmissionId);
        try {
            const updated = await paperSubmissionService.markRevision(selectedPaper.paperSubmissionId);
            setPapers(prev => prev.map(p => p.paperSubmissionId === updated.paperSubmissionId ? updated : p));
            setSelectedPaper(updated);
            showToast('Marked as revision required.', 'info');
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to mark revision.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleVenueDecision = async () => {
        if (!selectedPaper) return;
        setActionLoading(selectedPaper.paperSubmissionId);
        try {
            const updated = await paperSubmissionService.venueDecision(selectedPaper.paperSubmissionId);
            setPapers(prev => prev.map(p => p.paperSubmissionId === updated.paperSubmissionId ? updated : p));
            setSelectedPaper(updated);
            showToast('Decision recorded.', 'success');
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to record decision.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRevertToDraft = async () => {
        if (!selectedPaper) return;
        setActionLoading(selectedPaper.paperSubmissionId);
        try {
            const updated = await paperSubmissionService.changeStatus(selectedPaper.paperSubmissionId, SubmissionStatus.Draft);
            setPapers(prev => prev.map(p => p.paperSubmissionId === updated.paperSubmissionId ? updated : p));
            setSelectedPaper(updated);
            showToast('Paper reverted to Draft.', 'success');
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to revert to draft.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const openView = (paper: PaperSubmissionResponse) => {
        setSelectedPaper(paper);
        setActivePanel('view');
        setDeleteConfirmId(null);
        setShowVenueInput(false);
        setShowPdfViewer(false);
        setViewerUrl(null);
        if (paper.projectId) {
            membershipService.getProjectMembers(paper.projectId)
                .then(members => setProjectMembers(members))
                .catch(() => {});
        }
    };

    const openEdit = (paper: PaperSubmissionResponse) => {
        setSelectedPaper(paper);
        setEditData({ ...paper });
        setEditDocument(null);
        setFormErrors({});
        if (paper.projectId) handleProjectChange(paper.projectId, true, false);
        setActivePanel('edit');
    };

    const openCreate = () => {
        setSelectedPaper(null);
        setAddTitle(''); setAddAbstract(''); setAddConference(''); setAddPaperUrl('');
        setAddProjectId(''); setAddMembers([]); setAddDocument(null); setFormErrors({});
        setActivePanel('create');
    };

    const closePanel = () => {
        setActivePanel(null);
        setSelectedPaper(null);
        setShowPdfViewer(false);
        setViewerUrl(null);
    };

    const getProjectName = (id?: string | null) => {
        if (!id) return '—';
        const p = projects.find(x => x.projectId === id || x.id === id);
        return p ? (p.projectName || p.name || p.title) : 'Unknown Project';
    };

    const getAuthorDisplayName = (member: any) => {
        const memberId = member?.membershipId || member?.memberId || member?.id;
        const fromProjectMember = projectMembers.find((pm: any) => {
            const pmId = pm?.membershipId || pm?.memberId || pm?.id;
            if (!pmId || !memberId) return false;
            return String(pmId).toLowerCase() === String(memberId).toLowerCase();
        });

        // Keep the same priority as PaperReview: resolved project member name first.
        if (fromProjectMember?.fullName) return fromProjectMember.fullName;

        return (
            member?.fullName ||
            member?.memberName ||
            member?.userName ||
            (memberId ? String(memberId).slice(0, 8) : 'Member')
        );
    };

    const filtered = useMemo(() => papers.filter(p => {
        const q = search.toLowerCase();
        const matchQ = !q || p.title.toLowerCase().includes(q) || p.conferenceName.toLowerCase().includes(q);
        const matchS = !filterStatus || p.status === Number(filterStatus);
        const matchP = !filterProjectId || p.projectId === filterProjectId;
        return matchQ && matchS && matchP;
    }), [papers, search, filterStatus, filterProjectId]);

    // Stats
    const draftCount = papers.filter(p => p.status === SubmissionStatus.Draft).length;
    const reviewCount = papers.filter(p => p.status === SubmissionStatus.InternalReview).length;
    const approvedCount = papers.filter(p => p.status === SubmissionStatus.Approved).length;
    const submittedCount = papers.filter(p => p.status === SubmissionStatus.Submitted).length;

    const isSplit = !!activePanel;
    const isTriple = isSplit && showPdfViewer;
    const isReadingMode = activePanel === 'view' && showPdfViewer;
    const detailInfoGridColumns = isReadingMode ? '1fr' : '1fr 1fr';

    return (
        <MainLayout role={user?.role} userName={user?.name}>
            <div className="page-container" style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>
                {toast && (
                    <div style={{
                        position: 'fixed',
                        right: '24px',
                        top: '92px',
                        zIndex: 1200,
                        pointerEvents: 'auto'
                    }}>
                        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                    </div>
                )}

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: 'var(--primary-color)', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 8px 16px rgba(30,41,59,0.15)'
                            }}>
                                <BookOpen size={22} />
                            </div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
                                Paper Submissions
                            </h1>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>
                            {isDirector
                                ? 'Review and manage scientific paper submissions across all projects.'
                                : 'Track and manage your scientific paper submissions.'}
                        </p>
                    </div>
                </div>

                {/* Stats Board */}
                <div style={{
                    background: 'white', padding: '1.25rem 1.5rem', borderRadius: '20px',
                    border: '1px solid #e2e8f0', display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginBottom: '1.5rem'
                }}>
                    {[
                        { label: 'Draft', count: draftCount, color: '#94a3b8', bg: '#f8fafc', icon: <FileText size={14} /> },
                        { label: 'In Review', count: reviewCount, color: '#f59e0b', bg: '#fffbeb', icon: <Clock size={14} /> },
                        { label: 'Approved', count: approvedCount, color: '#22c55e', bg: '#f0fdf4', icon: <CheckCircle2 size={14} /> },
                        { label: 'Submitted', count: submittedCount, color: '#3b82f6', bg: '#eff6ff', icon: <FileCheck size={14} /> },
                    ].map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.5rem' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${s.color}22` }}>
                                {s.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{s.count}</div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Search + Filter Bar */}
                <div style={{
                    padding: '0.75rem 1.5rem', borderRadius: '14px', background: '#fff',
                    border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', marginBottom: '1.5rem'
                }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text" placeholder="Search title or conference..."
                                className="form-input"
                                style={{ paddingLeft: '40px', height: '42px', border: 'none', background: '#f8fafc', borderRadius: '10px', fontSize: '0.88rem' }}
                                value={search} onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '20px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Filter size={14} color="#94a3b8" />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const }}>Status:</span>
                            <select style={{ height: '32px', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-color)' }}
                                value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                <option value="">All Statuses</option>
                                {Object.entries(SubmissionStatusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Briefcase size={14} color="#94a3b8" />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const }}>Project:</span>
                            <select style={{ height: '32px', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-color)' }}
                                value={filterProjectId} onChange={e => setFilterProjectId(e.target.value)}>
                                <option value="">All Projects</option>
                                {projects.map((p: any) => <option key={p.projectId || p.id} value={p.projectId || p.id}>{p.projectName || p.name || p.title}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tabs + Action button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1, borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {[
                                { id: 'all', label: `All Papers (${totalCount})`, icon: <BookOpen size={16} /> },
                                { id: 'review', label: `Pending Review (${reviewCount})`, icon: <Clock size={16} /> },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilterStatus(tab.id === 'review' ? String(SubmissionStatus.InternalReview) : '')}
                                    style={{
                                        padding: '12px 10px', display: 'flex', alignItems: 'center', gap: '8px',
                                        border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem',
                                        color: (tab.id === 'review' ? filterStatus === String(SubmissionStatus.InternalReview) : filterStatus === '') ? 'var(--accent-color)' : '#64748b',
                                        borderBottom: (tab.id === 'review' ? filterStatus === String(SubmissionStatus.InternalReview) : filterStatus === '') ? '3px solid var(--accent-color)' : '3px solid transparent',
                                        fontWeight: (tab.id === 'review' ? filterStatus === String(SubmissionStatus.InternalReview) : filterStatus === '') ? 800 : 500,
                                        transition: 'all 0.2s', flex: '0 0 auto', justifyContent: 'center'
                                    }}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ marginLeft: '1rem', paddingBottom: '2px' }}>
                        <button
                            onClick={openCreate}
                            className="btn btn-primary"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                fontWeight: 700, padding: '10px 20px', borderRadius: '12px',
                                fontSize: '0.85rem', height: '42px',
                                boxShadow: '0 4px 12px rgba(232,114,12,0.2)', whiteSpace: 'nowrap' as const,
                            }}
                        >
                            <Plus size={18} /> New Paper
                        </button>
                    </div>
                </div>

                {/* Main content — list + panel */}
                <div style={{ display: 'flex', gap: isReadingMode ? '1rem' : '1.5rem', minHeight: isReadingMode ? '700px' : '560px' }}>
                    {/* List */}
                    {!isReadingMode && (<div style={{
                        flex: isSplit ? (isTriple ? 2 : 3) : 10, minWidth: 0,
                        display: 'flex', flexDirection: 'column',
                        transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden'
                    }}>
                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                                <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-color)' }} />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                                <Target size={48} style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>No papers found</h3>
                                <p style={{ fontSize: '0.85rem' }}>Create your first paper submission to get started.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {filtered.map(paper => {
                                    const color = STATUS_COLOR[paper.status];
                                    const bg = STATUS_BG[paper.status];
                                    const isActive = selectedPaper?.paperSubmissionId === paper.paperSubmissionId;
                                    return (
                                        <div
                                            key={paper.paperSubmissionId}
                                            onClick={() => openView(paper)}
                                            style={{
                                                background: isActive ? '#f8fafc' : '#fff',
                                                border: isActive ? `1.5px solid var(--accent-color)` : '1px solid #e2e8f0',
                                                borderRadius: '14px', padding: '14px 16px',
                                                cursor: 'pointer', transition: 'all 0.2s',
                                                borderLeft: `4px solid ${isActive ? 'var(--accent-color)' : color}`,
                                            }}
                                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        fontSize: isSplit ? '0.85rem' : '0.92rem',
                                                        fontWeight: 700, color: '#1e293b',
                                                        overflow: 'hidden', textOverflow: 'ellipsis',
                                                        whiteSpace: isSplit ? 'nowrap' : 'normal'
                                                    }}>
                                                        {paper.title}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '3px', fontWeight: 500 }}>
                                                        {paper.conferenceName}
                                                    </div>
                                                    {!isSplit && (
                                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                                                            {getProjectName(paper.projectId)}
                                                        </div>
                                                    )}
                                                </div>
                                                <span style={{
                                                    fontSize: '0.65rem', fontWeight: 800, padding: '3px 9px',
                                                    borderRadius: '20px', background: bg, color, flexShrink: 0,
                                                    border: `1px solid ${color}33`
                                                }}>
                                                    {SubmissionStatusLabel[paper.status]}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>)}

                    {/* Detail / Create / Edit Panel */}
                    {activePanel && (
                        <div style={{
                            flex: isReadingMode ? 2.8 : 4, minWidth: 0,
                            background: '#fff', borderRadius: '16px',
                            border: '1px solid #e2e8f0', padding: '1.5rem',
                            display: 'flex', flexDirection: 'column',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                            transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
                            maxHeight: 'calc(100vh - 240px)', overflowY: 'auto'
                        }} className="custom-scrollbar">

                            {/* Panel Header */}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '10px',
                                        background: activePanel === 'create' ? 'var(--accent-color)' : 'var(--primary-color)',
                                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {activePanel === 'create' ? <Plus size={16} /> : <BookOpen size={16} />}
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                                            {activePanel === 'create' ? 'New Paper' : activePanel === 'edit' ? 'Edit Paper' : (selectedPaper?.title || 'Paper Details')}
                                        </h3>
                                        {activePanel === 'view' && selectedPaper && (
                                            <span style={{
                                                fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px',
                                                background: STATUS_BG[selectedPaper.status],
                                                color: STATUS_COLOR[selectedPaper.status]
                                            }}>
                                                {SubmissionStatusLabel[selectedPaper.status]}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={closePanel}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        width: '32px', height: '32px', borderRadius: '8px',
                                        border: '1px solid #e2e8f0', background: '#fff', color: '#94a3b8',
                                        cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
                                    }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLButtonElement).style.color = '#475569'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            {/* ── CREATE FORM ── */}
                            {activePanel === 'create' && (
                                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <PaperFormFields
                                        data={{ title: addTitle, abstract: addAbstract, conferenceName: addConference, paperUrl: addPaperUrl, projectId: addProjectId, members: addMembers, document: addDocument }}
                                        onChange={(field, val) => {
                                            if (field === 'title') setAddTitle(val);
                                            else if (field === 'abstract') setAddAbstract(val);
                                            else if (field === 'conferenceName') setAddConference(val);
                                            else if (field === 'paperUrl') setAddPaperUrl(val);
                                        }}
                                        onDocumentChange={handleAddDocumentChange}
                                        onProjectChange={pid => handleProjectChange(pid)}
                                        onMembersChange={setAddMembers}
                                        projects={projects}
                                        projectMembers={projectMembers}
                                        membersLoading={membersLoading}
                                        formErrors={formErrors}
                                        hidePaperUrl
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                                        <button type="button" onClick={closePanel} style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Cancel</button>
                                        <button type="submit" disabled={addLoading} className="btn btn-primary" style={{ padding: '8px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '0.82rem' }}>
                                            {addLoading ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : 'Create Paper'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* ── EDIT FORM ── */}
                            {activePanel === 'edit' && selectedPaper && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <PaperFormFields
                                        data={{
                                            title: editData.title || '', abstract: editData.abstract || '',
                                            conferenceName: editData.conferenceName || '', paperUrl: editData.paperUrl || '',
                                            projectId: editData.projectId || '',
                                            members: editData.members || [], document: editDocument
                                        }}
                                        onChange={(field, val) => setEditData((p: any) => ({ ...p, [field]: val }))}
                                        onDocumentChange={handleEditDocumentChange}
                                        onProjectChange={pid => handleProjectChange(pid, true)}
                                        onMembersChange={m => setEditData((p: any) => ({ ...p, members: m }))}
                                        projects={projects}
                                        projectMembers={projectMembers}
                                        membersLoading={membersLoading}
                                        formErrors={formErrors}
                                        hidePaperUrl={![SubmissionStatus.Approved, SubmissionStatus.Revision, SubmissionStatus.Decision].includes(selectedPaper.status)}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                                        <button onClick={() => setActivePanel('view')} style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Cancel</button>
                                        <button onClick={handleUpdate} disabled={editLoading} className="btn btn-primary" style={{ padding: '8px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '0.82rem' }}>
                                            {editLoading ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── VIEW DETAIL ── */}
                            {activePanel === 'view' && selectedPaper && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* Info grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: detailInfoGridColumns, gap: '12px' }}>
                                        {[
                                            { label: 'Conference / Journal', value: selectedPaper.conferenceName },
                                            { label: 'Project', value: getProjectName(selectedPaper.projectId) },
                                            { label: 'Created', value: new Date(selectedPaper.createdAt).toLocaleDateString() },
                                        ].map(item => (
                                            <div key={item.label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '4px' }}>{item.label}</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{item.value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Paper URL */}
                                    {selectedPaper.paperUrl && [SubmissionStatus.Approved, SubmissionStatus.Revision, SubmissionStatus.Decision].includes(selectedPaper.status) && (
                                        <div>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '6px' }}>Paper URL</div>
                                            <a href={selectedPaper.paperUrl} target="_blank" rel="noreferrer"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 14px', borderRadius: '9px', border: '1px solid #e2e8f0', background: '#f8fafc', color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.2s', maxWidth: '100%' }}
                                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                                                onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                                            >
                                                <LinkIcon size={14} />
                                                <span style={{ maxWidth: isReadingMode ? '100%' : '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isReadingMode ? 'normal' : 'nowrap', wordBreak: 'break-word' }}>{selectedPaper.paperUrl}</span>
                                                <ExternalLink size={12} />
                                            </a>
                                        </div>
                                    )}

                                    {/* Document */}
                                    {selectedPaper.document && (
                                        <div>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '6px' }}>Document</div>
                                            <button
                                                onClick={() => openPdfViewer(selectedPaper.document!)}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 14px', borderRadius: '9px', border: '1px solid #dbeafe', background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                                            >
                                                <FileText size={14} /> View Document
                                            </button>
                                        </div>
                                    )}

                                    {/* Abstract */}
                                    <div>
                                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '6px' }}>Abstract</div>
                                        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#334155', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                                            {selectedPaper.abstract || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No abstract provided.</span>}
                                        </div>
                                    </div>

                                    {/* Members */}
                                    {selectedPaper.members && selectedPaper.members.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '6px' }}>Authors</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                                                {selectedPaper.members.map((m, i) => (
                                                    <span key={i} style={{ padding: '4px 10px', borderRadius: '20px', background: '#f1f5f9', fontSize: '0.75rem', fontWeight: 600, color: '#475569', border: '1px solid #e2e8f0' }}>
                                                        {getAuthorDisplayName(m)} · {PaperRoleLabel[m.role]}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>

                                        {/* Draft / Revision: Edit (+ Submit for Review only in Draft) (+ Decision for Revision) */}
                                        {(selectedPaper.status === SubmissionStatus.Draft || selectedPaper.status === SubmissionStatus.Revision) && (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                                                <button onClick={() => openEdit(selectedPaper)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                                                    <Edit2 size={14} /> Edit
                                                </button>
                                                {selectedPaper.status === SubmissionStatus.Draft && (
                                                    <button onClick={handleSubmitForReview} disabled={submitReviewLoading}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#3b82f6', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                                                        {submitReviewLoading ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : <><Send size={14} /> Submit for Internal Review</>}
                                                    </button>
                                                )}
                                                {selectedPaper.status === SubmissionStatus.Revision && (
                                                    <button onClick={handleVenueDecision} disabled={!!actionLoading}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: 'none', background: '#8b5cf6', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', boxShadow: '0 2px 8px rgba(139,92,246,0.25)' }}>
                                                        {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Gavel size={14} />} Record Decision
                                                    </button>
                                                )}
                                                {selectedPaper.status === SubmissionStatus.Draft && (
                                                    deleteConfirmId === selectedPaper.paperSubmissionId ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '9px', background: '#fef2f2', border: '1px solid #fecaca', width: '100%' }}>
                                                            <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, color: '#dc2626' }}>Delete this paper?</span>
                                                            <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>Cancel</button>
                                                            <button onClick={() => handleDelete(selectedPaper.paperSubmissionId)} disabled={!!actionLoading}
                                                                style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                                                                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : 'Delete'}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => setDeleteConfirmId(selectedPaper.paperSubmissionId)}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                                                            <Trash2 size={14} /> Delete
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        )}

                                        {/* Approved → Submit paper to journal/conference */}
                                        {selectedPaper.status === SubmissionStatus.Approved && (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                                                {showVenueInput ? (
                                                    <>
                                                        <input type="url" value={venueUrl} onChange={e => setVenueUrl(e.target.value)}
                                                            placeholder="Submission URL..." className="form-input"
                                                            style={{ flex: 1, height: '38px', fontSize: '0.85rem' }} />
                                                        <button onClick={handleSubmitVenue} disabled={venueLoading || !venueUrl.trim()}
                                                            style={{ padding: '8px 14px', borderRadius: '9px', border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' as const }}>
                                                            {venueLoading ? <Loader2 size={14} className="animate-spin" /> : 'Confirm'}
                                                        </button>
                                                        <button onClick={() => setShowVenueInput(false)} style={{ padding: '8px', borderRadius: '9px', border: '1px solid #e2e8f0', background: '#fff', color: '#94a3b8', cursor: 'pointer' }}><X size={14} /></button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => { setShowVenueInput(true); setVenueUrl(selectedPaper.paperUrl || ''); }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '9px', border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', boxShadow: '0 2px 8px rgba(22,163,74,0.2)' }}>
                                                        <ExternalLink size={14} /> Submit Paper
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Submitted → Revision or Decision */}
                                        {selectedPaper.status === SubmissionStatus.Submitted && (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                                                <button onClick={handleMarkRevision} disabled={!!actionLoading}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: '1px solid #fed7aa', background: '#fff7ed', color: '#c2410c', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Revision Required
                                                </button>
                                                <button onClick={handleVenueDecision} disabled={!!actionLoading}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: 'none', background: '#8b5cf6', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', boxShadow: '0 2px 8px rgba(139,92,246,0.25)' }}>
                                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Gavel size={14} />} Record Decision
                                                </button>
                                            </div>
                                        )}

                                        {/* Decision: final */}
                                        {selectedPaper.status === SubmissionStatus.Decision && (
                                            <div style={{ padding: '10px 14px', borderRadius: '9px', background: '#f5f3ff', border: '1px solid #ddd6fe', fontSize: '0.82rem', fontWeight: 600, color: '#7c3aed' }}>
                                                Final decision recorded. No further actions available.
                                            </div>
                                        )}

                                        {/* Rejected: revert to Draft */}
                                        {selectedPaper.status === SubmissionStatus.Rejected && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '9px', background: '#fef2f2', border: '1px solid #fecaca' }}>
                                                <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: '#dc2626' }}>Rejected by Lab Director.</span>
                                                <button onClick={handleRevertToDraft} disabled={!!actionLoading}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}>
                                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Revert to Draft
                                                </button>
                                            </div>
                                        )}

                                        {/* Lab Director: approve/reject InternalReview only */}
                                        {isDirector && selectedPaper.status === SubmissionStatus.InternalReview && (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const, padding: '12px 14px', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fde68a' }}>
                                                <div style={{ flex: 1, fontSize: '0.78rem', fontWeight: 600, color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Clock size={13} /> Awaiting director review
                                                </div>
                                                <button onClick={() => handleDirectorReview(true)} disabled={!!actionLoading}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', boxShadow: '0 2px 6px rgba(22,163,74,0.25)' }}>
                                                    {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Approve
                                                </button>
                                                <button onClick={() => handleDirectorReview(false)} disabled={!!actionLoading}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                                                    <XCircle size={13} /> Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Document Viewer Inline Panel */}
                    {showPdfViewer && (
                        <div style={{
                            flex: isReadingMode ? 8 : 5, minWidth: 0,
                            background: '#fff', borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            display: 'flex', flexDirection: 'column',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                            maxHeight: 'calc(100vh - 240px)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
                                    <FileText size={15} style={{ color: '#2563eb' }} /> Document Viewer
                                </div>
                                <button onClick={closePdfViewer} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                                    <X size={16} />
                                </button>
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
                                {viewerUrl && viewerKind === 'pdf' ? (
                                    <div style={{ width: '100%', height: '100%', background: '#f8fafc' }}>
                                        <iframe
                                            src={`${viewerUrl}#toolbar=0&navpanes=0`}
                                            style={{ width: '100%', height: '100%', border: 'none' }}
                                            title="PDF Viewer"
                                        />
                                    </div>
                                ) : viewerUrl && viewerKind === 'office' ? (
                                    <iframe
                                        src={viewerUrl}
                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                        title="Document Viewer"
                                    />
                                ) : viewerUrl ? (
                                    <div style={{ padding: '16px' }}>
                                        <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '0.85rem' }}>
                                            Inline preview is not available for this file type.
                                        </p>
                                        <a
                                            href={viewerUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ color: 'var(--accent-color)', fontWeight: 700, textDecoration: 'none' }}
                                        >
                                            Open in new tab
                                        </a>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {!loading && totalCount > pageSize && (
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button className="btn btn-secondary" disabled={pageIndex <= 1 || loading} onClick={() => loadPapers(pageIndex - 1)} style={{ fontSize: '0.82rem' }}>← Prev</button>
                        <span style={{ padding: '8px 16px', fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Page {pageIndex}</span>
                        <button className="btn btn-secondary" disabled={loading || papers.length < pageSize} onClick={() => loadPapers(pageIndex + 1)} style={{ fontSize: '0.82rem' }}>Next →</button>
                    </div>
                )}
            </div>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.animate-spin{animation:spin 1s linear infinite}`}</style>
        </MainLayout>
    );
};

// ─── Shared field styles ───────────────────────────────────────────────────────
const fieldLabelStyle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' };
const fieldInputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '9px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' };

interface PaperFormFieldsProps {
    data: { title: string; abstract: string; conferenceName: string; paperUrl: string; projectId: string; members: PaperMemberRequest[]; document?: File | null };
    onChange: (field: string, val: string) => void;
    onProjectChange: (pid: string) => void;
    onMembersChange: (m: PaperMemberRequest[]) => void;
    onDocumentChange: (f: File | null) => void;
    projects: any[];
    projectMembers: any[];
    membersLoading: boolean;
    formErrors: Record<string, string>;
    extraField?: React.ReactNode;
    hidePaperUrl?: boolean;
}

const PaperFormFields: React.FC<PaperFormFieldsProps> = ({
    data, onChange, onProjectChange, onMembersChange, onDocumentChange,
    projects, projectMembers, membersLoading, formErrors, extraField, hidePaperUrl
}) => (
    <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={fieldLabelStyle}>Title <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="form-input" style={{ ...fieldInputStyle, borderColor: formErrors.title ? '#ef4444' : '#e2e8f0' }}
                value={data.title} onChange={e => onChange('title', e.target.value)} placeholder="Paper title..." />
            {formErrors.title && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{formErrors.title}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={fieldLabelStyle}>Conference / Journal <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-input" style={{ ...fieldInputStyle, borderColor: formErrors.conferenceName ? '#ef4444' : '#e2e8f0' }}
                    value={data.conferenceName} onChange={e => onChange('conferenceName', e.target.value)} placeholder="e.g. IEEE ICSE 2026..." />
                {formErrors.conferenceName && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{formErrors.conferenceName}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={fieldLabelStyle}>Project</label>
                <select className="form-input" style={fieldInputStyle} value={data.projectId} onChange={e => onProjectChange(e.target.value)}>
                    <option value="">{projects.length > 0 ? 'Select project...' : 'No projects'}</option>
                    {projects.map((p: any) => <option key={p.projectId || p.id} value={p.projectId || p.id}>{p.projectName || p.name || p.title}</option>)}
                </select>
            </div>
        </div>
        {!hidePaperUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={fieldLabelStyle}>Paper URL</label>
                <input className="form-input" style={{ ...fieldInputStyle, borderColor: formErrors.paperUrl ? '#ef4444' : '#e2e8f0' }}
                    type="url" value={data.paperUrl} onChange={e => onChange('paperUrl', e.target.value)} placeholder="https://..." />
                {formErrors.paperUrl && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{formErrors.paperUrl}</span>}
            </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={fieldLabelStyle}>Document <span style={{ color: '#94a3b8', fontWeight: 500, textTransform: 'none' }}>(DOC, DOCX, TXT, PPT, PPTX)</span></label>
            <label style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '9px', border: '1.5px dashed #cbd5e1',
                background: data.document ? '#f0fdf4' : '#f8fafc',
                cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.82rem', fontWeight: 600,
                color: data.document ? '#15803d' : '#64748b'
            }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-color)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
            >
                <Upload size={15} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {data.document ? data.document.name : 'Click to upload or drag a file here'}
                </span>
                {data.document && (
                    <button
                        type="button"
                        onClick={e => { e.preventDefault(); e.stopPropagation(); onDocumentChange(null); }}
                        style={{ color: '#94a3b8', border: 'none', background: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0 }}
                    >
                        <X size={14} />
                    </button>
                )}
                <input
                    type="file"
                    accept=".doc,.docx,.txt,.ppt,.pptx"
                    style={{ display: 'none' }}
                    onChange={e => onDocumentChange(e.target.files?.[0] ?? null)}
                />
            </label>
        </div>
        {extraField}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={fieldLabelStyle}>Abstract</label>
            <textarea className="form-input" style={{ ...fieldInputStyle, resize: 'vertical' as const }} rows={4}
                value={data.abstract} onChange={e => onChange('abstract', e.target.value)} placeholder="Brief description of the paper..." />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={fieldLabelStyle}>Authors / Members</label>
            {!data.projectId
                ? <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>Select a project first to add authors.</p>
                : membersLoading
                    ? <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}><Loader2 size={14} className="animate-spin" /> Loading members...</div>
                    : (
                        <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '9px', padding: '10px', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px', marginBottom: '8px' }}>
                                {data.members.map((m, idx) => {
                                    const pm = projectMembers.find((p: any) => (p.membershipId || p.memberId) === m.membershipId);
                                    return (
                                        <span key={idx} style={{ background: '#fff', padding: '4px 10px', borderRadius: '20px', border: '1px solid #e2e8f0', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {pm?.fullName || 'Member'} · {PaperRoleLabel[m.role as PaperRoleEnum]}
                                            <button type="button" onClick={() => onMembersChange(data.members.filter((_, i) => i !== idx))} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}><X size={12} /></button>
                                        </span>
                                    );
                                })}
                            </div>
                            <select className="form-input" style={{ ...fieldInputStyle, background: '#fff' }} onChange={e => {
                                const mid = e.target.value;
                                if (!mid || data.members.some(am => am.membershipId === mid)) return;
                                onMembersChange([...data.members, { membershipId: mid, role: PaperRoleEnum.CoAuthor }]);
                                e.target.value = '';
                            }}>
                                <option value="">+ Add author...</option>
                                {projectMembers
                                    .map((pm: any) => ({ ...pm, _mid: pm.membershipId || pm.memberId }))
                                    .filter((pm: any) => pm._mid && !data.members.some(am => am.membershipId === pm._mid))
                                    .map((pm: any) => <option key={pm._mid} value={pm._mid}>{pm.fullName}</option>)}
                            </select>
                        </div>
                    )
            }
        </div>
    </>
);

export default PaperSubmissions;
