import React, { useEffect, useState, useMemo } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { paperSubmissionService } from '@/services/paperSubmissionService';
import { projectService } from '@/services/projectService';
import { ProjectRoleEnum } from '@/types/project';
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
    type ExternalUserCreateDto,
    type ExternalUserResponse,
} from '@/types/paperSubmission';
import { useToastStore } from '@/store/slices/toastSlice';
import ConfirmModal from '@/components/common/ConfirmModal';
import { validateSpecialChars } from '@/utils/validation';
import {
    Plus, Search, ExternalLink, X, Loader2, Trash2,
    Send, Edit2, Link as LinkIcon, FileText, CheckCircle2, XCircle,
    Clock, Filter, Target, Briefcase, BookOpen, FileCheck, RefreshCw, Gavel, Upload,
    Sparkles, Zap
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

type ExternalAuthorValidationErrors = {
    studentId: string;
    phoneNumber: string;
    orcid: string;
    googleScholarUrl: string;
    githubUrl: string;
};

const externalAuthorValidationDefaults: ExternalAuthorValidationErrors = {
    studentId: '',
    phoneNumber: '',
    orcid: '',
    googleScholarUrl: '',
    githubUrl: '',
};

const validateExternalAuthorField = (field: keyof ExternalAuthorValidationErrors, value: string): string => {
    switch (field) {
        case 'studentId':
            return value && !/^[A-Za-z]{2}\d{4}$/.test(value) ? 'Format: 2 letters + 4 digits (e.g. SE1234)' : '';
        case 'phoneNumber':
            return value && !/^(\+[1-9]\d{6,14}|0\d{9})$/.test(value) ? 'Invalid phone number format (e.g. 0912345678 or +84912345678)' : '';
        case 'orcid':
            return value && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(value) ? 'Format: xxxx-xxxx-xxxx-xxxx' : '';
        case 'googleScholarUrl':
            return value && !/^https?:\/\/(www\.)?scholar\.google\.[a-z.]+\//.test(value) ? 'Must be a valid Google Scholar URL' : '';
        case 'githubUrl':
            return value && !/^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+/.test(value) ? 'Must be a valid GitHub profile URL' : '';
        default:
            return '';
    }
};

const validateExternalAuthorProfileFields = (author: typeof blankEu): ExternalAuthorValidationErrors => {
    const studentId = (author.studentId || '').trim();
    const phoneNumber = (author.phoneNumber || '').trim();
    const orcid = (author.orcid || '').trim();
    const googleScholarUrl = (author.googleScholarUrl || '').trim();
    const githubUrl = (author.githubUrl || '').trim();

    return {
        studentId: validateExternalAuthorField('studentId', studentId),
        phoneNumber: validateExternalAuthorField('phoneNumber', phoneNumber),
        orcid: validateExternalAuthorField('orcid', orcid),
        googleScholarUrl: validateExternalAuthorField('googleScholarUrl', googleScholarUrl),
        githubUrl: validateExternalAuthorField('githubUrl', githubUrl),
    };
};

const hasExternalAuthorValidationErrors = (errors: ExternalAuthorValidationErrors): boolean =>
    Object.values(errors).some(Boolean);

const PaperSubmissions: React.FC = () => {
    const { user } = useAuth();
    const isDirector = user?.role === 'LabDirector' || user?.role === 'Lab Director';

    const { addToast } = useToastStore();
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => addToast(message, type);

    const [papers, setPapers] = useState<PaperSubmissionResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterProjectId, setFilterProjectId] = useState('');
    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize] = useState(50);
    const [totalCount, setTotalCount] = useState(0);

    // Semantic search
    const [semanticResults, setSemanticResults] = useState<PaperSubmissionResponse[] | null>(null);
    const [isSemanticLoading, setIsSemanticLoading] = useState(false);

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
    const [addDeadline, setAddDeadline] = useState('');
    const [addMembers, setAddMembers] = useState<PaperMemberRequest[]>([]);
    const [addExternalUsers, setAddExternalUsers] = useState<ExternalUserCreateDto[]>([]);
    const [addDocument, setAddDocument] = useState<File | null>(null);
    const [addLoading, setAddLoading] = useState(false);

    // External users management (view/edit panel)
    const [showAddExternalUser, setShowAddExternalUser] = useState(false);
    const blankExternalForm = { fullName: '', email: '', phoneNumber: '', studentId: '', orcid: '', googleScholarUrl: '', githubUrl: '' };
    const [externalUserNewForm, setExternalUserNewForm] = useState(blankExternalForm);
    const [externalUserSaving, setExternalUserSaving] = useState(false);
    const [editingExternalUserId, setEditingExternalUserId] = useState<string | null>(null);
    const [externalUserEditForm, setExternalUserEditForm] = useState(blankExternalForm);
    const [externalUserEditSaving, setExternalUserEditSaving] = useState(false);
    const [hoveredExternalUserId, setHoveredExternalUserId] = useState<string | null>(null);
    const [expandedAuthorId, setExpandedAuthorId] = useState<string | null>(null);
    const [viewingExternalUser, setViewingExternalUser] = useState<any | null>(null);
    const [currentUserMembership, setCurrentUserMembership] = useState<any | null>(null);

    // Edit form
    const [editData, setEditData] = useState<any>({});
    const [editDocument, setEditDocument] = useState<File | null>(null);
    const [editLoading, setEditLoading] = useState(false);
    const [editExternalUsers, setEditExternalUsers] = useState<any[]>([]);
    const [editDeletedExternalUserIds, setEditDeletedExternalUserIds] = useState<string[]>([]);
    const [editEuEditingKey, setEditEuEditingKey] = useState<string | null>(null);
    const [editEuEditForm, setEditEuEditForm] = useState(blankExternalForm);
    const [editEuShowAdd, setEditEuShowAdd] = useState(false);
    const [editEuDraft, setEditEuDraft] = useState(blankExternalForm);
    const [editEuHovered, setEditEuHovered] = useState<string | null>(null);
    const [editEuDraftErrors, setEditEuDraftErrors] = useState<ExternalAuthorValidationErrors>(externalAuthorValidationDefaults);
    const [editEuEditErrors, setEditEuEditErrors] = useState<ExternalAuthorValidationErrors>(externalAuthorValidationDefaults);

    // Action loading
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [submitReviewLoading, setSubmitReviewLoading] = useState(false);
    const [indexingLoading, setIndexingLoading] = useState(false);

    // Confirm modal
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        confirmText: string;
        variant: 'danger' | 'info' | 'success';
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', confirmText: 'Confirm', variant: 'info', onConfirm: () => {} });

    const openConfirm = (opts: { title: string; message: React.ReactNode; confirmText: string; variant: 'danger' | 'info' | 'success'; onConfirm: () => void }) => {
        setConfirmModal({ isOpen: true, ...opts });
    };
    const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));
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

    const handleSemanticSearch = async () => {
        if (!search.trim()) return;
        setIsSemanticLoading(true);
        try {
            const results = await paperSubmissionService.search({
                query: search,
                topK: 20,
                projectId: filterProjectId || null,
            });
            setSemanticResults(Array.isArray(results) ? results : []);
        } catch {
            showToast('Semantic search failed.', 'error');
        } finally {
            setIsSemanticLoading(false);
        }
    };

    const loadProjects = async () => {
        try {
            const data = await projectService.getAll();
            setProjects(data);
        } catch { /* silent */ }
    };

    const handleProjectChange = async (projectId: string, isEdit = false, updateMembers = true) => {
        if (projectId) {
            const me = await projectService.getCurrentMember(projectId);
            const role = me?.projectRole ?? me?.role ?? me?.projectRoleId;
            const roleName: string = (me?.roleName ?? me?.projectRoleName ?? '').toLowerCase();
            const isLeader = role === ProjectRoleEnum.Leader || roleName.includes('leader');
            if (!isLeader) {
                showToast('You are not the leader of this project. Only the project leader can submit papers.', 'error');
                return;
            }
        }
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

    const validateForm = (data: { title: string; conferenceName: string; paperUrl?: string; abstract?: string }) => {
        const errs: Record<string, string> = {};
        if (!data.title?.trim()) errs.title = 'Title is required';
        else if (validateSpecialChars(data.title)) errs.title = validateSpecialChars(data.title);
        if (!data.conferenceName?.trim()) errs.conferenceName = 'Conference / Journal name is required';
        else if (validateSpecialChars(data.conferenceName)) errs.conferenceName = validateSpecialChars(data.conferenceName);
        if (data.abstract?.trim() && validateSpecialChars(data.abstract)) errs.abstract = validateSpecialChars(data.abstract);
        if (data.paperUrl?.trim() && !data.paperUrl.match(/^https?:\/\/.+/)) {
            errs.paperUrl = 'Please enter a valid URL (http:// or https://)';
        }
        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleCreate = async () => {
        if (!validateForm({ title: addTitle, conferenceName: addConference, paperUrl: addPaperUrl, abstract: addAbstract })) return;
        const hasInvalidExternalAuthor = addExternalUsers.some(eu =>
            hasExternalAuthorValidationErrors(validateExternalAuthorProfileFields({
                ...blankEu,
                fullName: eu.fullName || '',
                email: eu.email || '',
                phoneNumber: eu.phoneNumber || '',
                studentId: eu.studentId || '',
                orcid: eu.orcid || '',
                googleScholarUrl: eu.googleScholarUrl || '',
                githubUrl: eu.githubUrl || '',
            }))
        );
        if (hasInvalidExternalAuthor) {
            showToast('Please correct external author information before creating paper.', 'error');
            return;
        }
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
                submissionDeadline: addDeadline ? new Date(addDeadline).toISOString() : null,
                document: addDocument,
                members: addMembers.map(m => ({ membershipId: m.membershipId, role: Number(m.role) })),
                externalUsers: addExternalUsers,
                createdByUserId: myMembershipId
            };
            const newPaper = await paperSubmissionService.create(payload);
            await loadPapers(1);
            showToast(`Paper "${newPaper.title}" created successfully!`, 'success');
            setAddTitle(''); setAddAbstract(''); setAddConference(''); setAddPaperUrl(''); setAddProjectId(''); setAddDeadline(''); setAddMembers([]); setAddDocument(null);
            setActivePanel(null);
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to create paper.', 'error');
        } finally {
            setAddLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedPaper) return;
        if (!validateForm({ title: editData.title || '', conferenceName: editData.conferenceName || '', paperUrl: editData.paperUrl, abstract: editData.abstract })) return;
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
                submissionDeadline: editData.submissionDeadline ? new Date(editData.submissionDeadline).toISOString() : null,
                document: editDocument,
                members: editData.members?.map((m: any) => ({ membershipId: m.membershipId, role: Number(m.role) })) || [],
                lastUpdatedByUserId: myMembershipId
            };
            const paperId = selectedPaper.paperSubmissionId;
            let updated = await paperSubmissionService.update(paperId, payload);

            // Sync external authors
            for (const id of editDeletedExternalUserIds) {
                try { await paperSubmissionService.deleteExternalUser(paperId, id); } catch { /* skip */ }
            }
            const newEus = editExternalUsers.filter(eu => !eu.externalUserId);
            if (newEus.length > 0) {
                await paperSubmissionService.addExternalUsers(paperId, newEus.map(eu => ({
                    fullName: eu.fullName, email: eu.email || null, phoneNumber: eu.phoneNumber || null,
                    studentId: eu.studentId || null, orcid: eu.orcid || null,
                    googleScholarUrl: eu.googleScholarUrl || null, githubUrl: eu.githubUrl || null, isActive: true,
                })));
            }
            const existingEus = editExternalUsers.filter(eu => eu.externalUserId);
            for (const eu of existingEus) {
                try {
                    await paperSubmissionService.updateExternalUser(paperId, eu.externalUserId, {
                        fullName: eu.fullName, email: eu.email || null, phoneNumber: eu.phoneNumber || null,
                        studentId: eu.studentId || null, orcid: eu.orcid || null,
                        googleScholarUrl: eu.googleScholarUrl || null, githubUrl: eu.githubUrl || null, isActive: eu.isActive ?? true,
                    });
                } catch { /* skip */ }
            }

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

    const handleSubmitForReview = () => {
        if (!selectedPaper) return;
        if (selectedPaper.status !== SubmissionStatus.Draft) {
            showToast('Only Draft papers can be submitted for internal review.', 'warning');
            return;
        }
        if (!selectedPaper.document) {
            showToast('Please upload a document before submitting for internal review.', 'warning');
            return;
        }
        openConfirm({
            title: 'Submit for Internal Review',
            message: 'This will submit the paper to the Lab Director for internal review. Are you sure?',
            confirmText: 'Submit',
            variant: 'info',
            onConfirm: async () => {
                closeConfirm();
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
            },
        });
    };

    const handleIndexing = async () => {
        if (!selectedPaper) return;
        setIndexingLoading(true);
        try {
            await paperSubmissionService.ensureEmbedding(selectedPaper.paperSubmissionId);
            showToast('AI Indexing started.', 'success');
        } catch {
            showToast('Indexing failed.', 'error');
        } finally {
            setIndexingLoading(false);
        }
    };

    const handleDirectorReview = (approve: boolean) => {
        if (!selectedPaper) return;
        openConfirm({
            title: approve ? 'Approve Paper' : 'Reject Paper',
            message: approve
                ? 'Are you sure you want to approve this paper? It will move to Approved status.'
                : 'Are you sure you want to reject this paper? The author will need to revise it.',
            confirmText: approve ? 'Approve' : 'Reject',
            variant: approve ? 'success' : 'danger',
            onConfirm: async () => {
                closeConfirm();
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
            },
        });
    };

    const handleMarkRevision = () => {
        if (!selectedPaper) return;
        openConfirm({
            title: 'Mark as Revision Required',
            message: 'This will move the paper to Revision Required status. The authors will need to revise it.',
            confirmText: 'Mark Revision',
            variant: 'info',
            onConfirm: async () => {
                closeConfirm();
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
            },
        });
    };

    const handleVenueDecision = () => {
        if (!selectedPaper) return;
        openConfirm({
            title: 'Record Decision',
            message: 'This will move the paper to Decision status, marking the process as complete.',
            confirmText: 'Record Decision',
            variant: 'success',
            onConfirm: async () => {
                closeConfirm();
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
            },
        });
    };

    const handleRejectRevision = () => {
        if (!selectedPaper) return;
        openConfirm({
            title: 'Reject Paper',
            message: 'Are you sure you want to reject this paper?',
            confirmText: 'Reject',
            variant: 'danger',
            onConfirm: async () => {
                closeConfirm();
                setActionLoading(selectedPaper.paperSubmissionId);
                try {
                    const updated = await paperSubmissionService.changeStatus(selectedPaper.paperSubmissionId, SubmissionStatus.Rejected);
                    setPapers(prev => prev.map(p => p.paperSubmissionId === updated.paperSubmissionId ? updated : p));
                    setSelectedPaper(updated);
                    showToast('Paper rejected.', 'error');
                } catch (err: any) {
                    showToast(err.response?.data?.message || 'Failed to reject paper.', 'error');
                } finally {
                    setActionLoading(null);
                }
            },
        });
    };

    const handleRevertToDraft = () => {
        if (!selectedPaper) return;
        openConfirm({
            title: 'Revert to Draft',
            message: 'This will move the paper back to Draft so it can be edited and resubmitted.',
            confirmText: 'Revert to Draft',
            variant: 'info',
            onConfirm: async () => {
                closeConfirm();
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
            },
        });
    };

    const openView = (paper: PaperSubmissionResponse) => {
        setSelectedPaper(paper);
        setActivePanel('view');
        setDeleteConfirmId(null);
        setShowPdfViewer(false);
        setViewerUrl(null);
        setCurrentUserMembership(null);
        if (paper.projectId) {
            membershipService.getProjectMembers(paper.projectId)
                .then(members => setProjectMembers(members))
                .catch(() => {});
            projectService.getCurrentMember(paper.projectId)
                .then(m => setCurrentUserMembership(m))
                .catch(() => setCurrentUserMembership(null));
        }
    };

    const openEdit = (paper: PaperSubmissionResponse) => {
        setSelectedPaper(paper);
        setEditData({ ...paper, submissionDeadline: paper.submissionDeadline ? paper.submissionDeadline.split('T')[0] : '' });
        setEditDocument(null);
        setFormErrors({});
        setEditExternalUsers((paper.externalUsers ?? []).map(eu => ({ ...eu })));
        setEditDeletedExternalUserIds([]);
        setEditEuEditingKey(null);
        setEditEuShowAdd(false);
        setEditEuDraft(blankExternalForm);
        if (paper.projectId) handleProjectChange(paper.projectId, true, false);
        setActivePanel('edit');
    };

    const openCreate = () => {
        setSelectedPaper(null);
        setAddTitle(''); setAddAbstract(''); setAddConference(''); setAddPaperUrl('');
        setAddProjectId(''); setAddDeadline(''); setAddMembers([]); setAddExternalUsers([]); setAddDocument(null); setFormErrors({});
        setActivePanel('create');
    };

    const closePanel = () => {
        setActivePanel(null);
        setSelectedPaper(null);
        setShowPdfViewer(false);
        setViewerUrl(null);
        setShowAddExternalUser(false);
        setEditingExternalUserId(null);
    };

    const handleAddExternalUsers = async () => {
        if (!selectedPaper || !externalUserNewForm.fullName.trim() || !externalUserNewForm.email.trim()) return;
        setExternalUserSaving(true);
        try {
            const added = await paperSubmissionService.addExternalUsers(
                selectedPaper.paperSubmissionId,
                [{
                    fullName: externalUserNewForm.fullName.trim(),
                    email: externalUserNewForm.email.trim() || null,
                    phoneNumber: externalUserNewForm.phoneNumber.trim() || null,
                    studentId: externalUserNewForm.studentId.trim() || null,
                    orcid: externalUserNewForm.orcid.trim() || null,
                    googleScholarUrl: externalUserNewForm.googleScholarUrl.trim() || null,
                    githubUrl: externalUserNewForm.githubUrl.trim() || null,
                    isActive: true,
                }]
            );
            const updated = { ...selectedPaper, externalUsers: [...(selectedPaper.externalUsers ?? []), ...added] };
            setSelectedPaper(updated);
            setPapers(prev => prev.map(p => p.paperSubmissionId === updated.paperSubmissionId ? updated : p));
            setExternalUserNewForm(blankExternalForm);
            setShowAddExternalUser(false);
            showToast('External author added.', 'success');
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to add external author.', 'error');
        } finally {
            setExternalUserSaving(false);
        }
    };

    const handleUpdateExternalUser = async (eu: ExternalUserResponse) => {
        if (!selectedPaper || !externalUserEditForm.email.trim()) return;
        setExternalUserEditSaving(true);
        try {
            const updated_eu = await paperSubmissionService.updateExternalUser(
                selectedPaper.paperSubmissionId,
                eu.externalUserId,
                {
                    fullName: externalUserEditForm.fullName.trim(),
                    email: externalUserEditForm.email.trim() || null,
                    phoneNumber: externalUserEditForm.phoneNumber.trim() || null,
                    studentId: externalUserEditForm.studentId.trim() || null,
                    orcid: externalUserEditForm.orcid.trim() || null,
                    googleScholarUrl: externalUserEditForm.googleScholarUrl.trim() || null,
                    githubUrl: externalUserEditForm.githubUrl.trim() || null,
                    isActive: eu.isActive,
                }
            );
            const updatedPaper = {
                ...selectedPaper,
                externalUsers: (selectedPaper.externalUsers ?? []).map(x => x.externalUserId === eu.externalUserId ? updated_eu : x)
            };
            setSelectedPaper(updatedPaper);
            setPapers(prev => prev.map(p => p.paperSubmissionId === updatedPaper.paperSubmissionId ? updatedPaper : p));
            setEditingExternalUserId(null);
            showToast('External author updated.', 'success');
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to update external author.', 'error');
        } finally {
            setExternalUserEditSaving(false);
        }
    };

    const handleDeleteExternalUser = async (externalUserId: string) => {
        if (!selectedPaper) return;
        setActionLoading(externalUserId);
        try {
            await paperSubmissionService.deleteExternalUser(selectedPaper.paperSubmissionId, externalUserId);
            const updatedPaper = {
                ...selectedPaper,
                externalUsers: (selectedPaper.externalUsers ?? []).filter(x => x.externalUserId !== externalUserId)
            };
            setSelectedPaper(updatedPaper);
            setPapers(prev => prev.map(p => p.paperSubmissionId === updatedPaper.paperSubmissionId ? updatedPaper : p));
            showToast('External author removed.', 'success');
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to remove external author.', 'error');
        } finally {
            setActionLoading(null);
        }
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

    const filtered = useMemo(() => {
        if (semanticResults !== null) return semanticResults;
        return papers.filter(p => {
            const q = search.toLowerCase();
            const matchQ = !q || p.title.toLowerCase().includes(q) || p.conferenceName.toLowerCase().includes(q);
            const matchS = !filterStatus || p.status === Number(filterStatus);
            const matchP = !filterProjectId || p.projectId === filterProjectId;
            return matchQ && matchS && matchP;
        });
    }, [papers, semanticResults, search, filterStatus, filterProjectId]);

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
                <ConfirmModal
                    isOpen={confirmModal.isOpen}
                    onClose={closeConfirm}
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmText={confirmModal.confirmText}
                    variant={confirmModal.variant}
                />

                {/* External Author Detail Modal */}
                {viewingExternalUser && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
                        onClick={() => setViewingExternalUser(null)}>
                        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px 28px 24px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: '16px' }}
                            onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '4px' }}>External Author</div>
                                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>{viewingExternalUser.fullName || '—'}</div>
                                </div>
                                <button onClick={() => setViewingExternalUser(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}>
                                    <X size={16} />
                                </button>
                            </div>
                            {/* Details */}
                            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
                                {[
                                    { label: 'Email', value: viewingExternalUser.email, icon: '✉' },
                                    { label: 'Phone', value: viewingExternalUser.phoneNumber, icon: '☎' },
                                    { label: 'Student ID', value: viewingExternalUser.studentId, icon: '🪪' },
                                    { label: 'ORCID', value: viewingExternalUser.orcid, icon: '🔬' },
                                ].map(({ label, value, icon }) => value ? (
                                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <span style={{ fontSize: '0.95rem', flexShrink: 0 }}>{icon}</span>
                                        <div>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{label}</div>
                                            <div style={{ fontSize: '0.83rem', color: '#334155', fontWeight: 600 }}>{value}</div>
                                        </div>
                                    </div>
                                ) : null)}
                                {viewingExternalUser.googleScholarUrl && (
                                    <a href={viewingExternalUser.googleScholarUrl} target="_blank" rel="noreferrer"
                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textDecoration: 'none' }}>
                                        <span style={{ fontSize: '0.95rem' }}>🎓</span>
                                        <div>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Google Scholar</div>
                                            <div style={{ fontSize: '0.83rem', color: 'var(--accent-color)', fontWeight: 600 }}>View profile ↗</div>
                                        </div>
                                    </a>
                                )}
                                {viewingExternalUser.githubUrl && (
                                    <a href={viewingExternalUser.githubUrl} target="_blank" rel="noreferrer"
                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textDecoration: 'none' }}>
                                        <span style={{ fontSize: '0.95rem' }}>💻</span>
                                        <div>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>GitHub</div>
                                            <div style={{ fontSize: '0.83rem', color: 'var(--accent-color)', fontWeight: 600 }}>View profile ↗</div>
                                        </div>
                                    </a>
                                )}
                                {!viewingExternalUser.email && !viewingExternalUser.phoneNumber && !viewingExternalUser.studentId && !viewingExternalUser.orcid && !viewingExternalUser.googleScholarUrl && !viewingExternalUser.githubUrl && (
                                    <p style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>No additional information available.</p>
                                )}
                            </div>
                        </div>
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
                                value={search} onChange={e => { setSearch(e.target.value); setSemanticResults(null); }}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSemanticSearch}
                            disabled={isSemanticLoading || !search.trim()}
                            style={{
                                height: '42px', padding: '0 1.1rem', borderRadius: '10px',
                                display: 'flex', alignItems: 'center', gap: '7px',
                                fontSize: '0.85rem', fontWeight: 700, border: 'none',
                                cursor: isSemanticLoading || !search.trim() ? 'not-allowed' : 'pointer',
                                background: semanticResults !== null ? 'var(--primary-color)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff', opacity: !search.trim() ? 0.5 : 1,
                                boxShadow: '0 4px 12px rgba(99,102,241,0.25)', whiteSpace: 'nowrap' as const,
                            }}
                        >
                            {isSemanticLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                            AI Search
                        </button>
                    </div>

                    {semanticResults !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', borderRadius: '10px', background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)', border: '1px solid #c7d2fe', marginBottom: '10px' }}>
                            <Zap size={14} color="#6366f1" />
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4f46e5' }}>
                                AI Search — {semanticResults.length} paper{semanticResults.length !== 1 ? 's' : ''} found
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
                            maxHeight: 'calc(100vh - 160px)', overflow: 'hidden'
                        }}>
                        <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">

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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <PaperFormFields
                                        data={{ title: addTitle, abstract: addAbstract, conferenceName: addConference, paperUrl: addPaperUrl, projectId: addProjectId, deadline: addDeadline, members: addMembers, document: addDocument }}
                                        onChange={(field, val) => {
                                            if (field === 'title') setAddTitle(val);
                                            else if (field === 'abstract') setAddAbstract(val);
                                            else if (field === 'conferenceName') setAddConference(val);
                                            else if (field === 'paperUrl') setAddPaperUrl(val);
                                            else if (field === 'deadline') setAddDeadline(val);
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

                                    {/* External Authors — tách riêng, không nằm trong form */}
                                    <CreateExternalAuthors
                                        externalUsers={addExternalUsers}
                                        onChange={setAddExternalUsers}
                                    />

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                                        <button onClick={closePanel} style={{ padding: '8px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Cancel</button>
                                        <button onClick={handleCreate} disabled={addLoading} className="btn btn-primary" style={{ padding: '8px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '0.82rem' }}>
                                            {addLoading ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : 'Create Paper'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── EDIT FORM ── */}
                            {activePanel === 'edit' && selectedPaper && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <PaperFormFields
                                        data={{
                                            title: editData.title || '', abstract: editData.abstract || '',
                                            conferenceName: editData.conferenceName || '', paperUrl: editData.paperUrl || '',
                                            projectId: editData.projectId || '', deadline: editData.submissionDeadline || '',
                                            members: editData.members || [], document: editDocument
                                        }}
                                        onChange={(field, val) => setEditData((p: any) => ({ ...p, [field === 'deadline' ? 'submissionDeadline' : field]: val }))}
                                        onDocumentChange={handleEditDocumentChange}
                                        onProjectChange={pid => handleProjectChange(pid, true)}
                                        onMembersChange={m => setEditData((p: any) => ({ ...p, members: m }))}
                                        projects={projects}
                                        projectMembers={projectMembers}
                                        membersLoading={membersLoading}
                                        formErrors={formErrors}
                                        hidePaperUrl={![SubmissionStatus.Approved, SubmissionStatus.Revision, SubmissionStatus.Decision].includes(selectedPaper.status)}
                                    />

                                    {/* External Authors — edit mode local staging */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <label style={fieldLabelStyle}>External Authors</label>
                                            {!editEuShowAdd && editEuEditingKey === null && (
                                                <button type="button" onClick={() => { setEditEuShowAdd(true); setEditEuDraftErrors(externalAuthorValidationDefaults); setEditEuDraft(blankExternalForm); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                                                    <Plus size={11} /> Add
                                                </button>
                                            )}
                                        </div>
                                        {editExternalUsers.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {editExternalUsers.map((eu, idx) => {
                                                    const key = eu.externalUserId || eu._key || String(idx);
                                                    return (
                                                        <div key={key}>
                                                            {editEuEditingKey === key ? (
                                                                <div style={{ padding: '10px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                                                        <input className="form-input" style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }} placeholder="Full name *" value={editEuEditForm.fullName} onChange={e => setEditEuEditForm(f => ({ ...f, fullName: e.target.value }))} />
                                                                        <input className="form-input" style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }} placeholder="Email *" value={editEuEditForm.email} onChange={e => setEditEuEditForm(f => ({ ...f, email: e.target.value }))} />
                                                                        <input className="form-input" style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${editEuEditErrors.phoneNumber ? '#ef4444' : '#e2e8f0'}`, fontSize: '0.8rem' }} placeholder="Phone number" value={editEuEditForm.phoneNumber} onChange={e => { const v = e.target.value; setEditEuEditForm(f => ({ ...f, phoneNumber: v })); setEditEuEditErrors(prev => ({ ...prev, phoneNumber: validateExternalAuthorField('phoneNumber', v.trim()) })); }} />
                                                                        <input className="form-input" style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${editEuEditErrors.studentId ? '#ef4444' : '#e2e8f0'}`, fontSize: '0.8rem' }} placeholder="Student ID" value={editEuEditForm.studentId} onChange={e => { const v = e.target.value; setEditEuEditForm(f => ({ ...f, studentId: v })); setEditEuEditErrors(prev => ({ ...prev, studentId: validateExternalAuthorField('studentId', v.trim()) })); }} />
                                                                        <input className="form-input" style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${editEuEditErrors.orcid ? '#ef4444' : '#e2e8f0'}`, fontSize: '0.8rem' }} placeholder="ORCID" value={editEuEditForm.orcid} onChange={e => { const v = e.target.value; setEditEuEditForm(f => ({ ...f, orcid: v })); setEditEuEditErrors(prev => ({ ...prev, orcid: validateExternalAuthorField('orcid', v.trim()) })); }} />
                                                                        <input className="form-input" style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${editEuEditErrors.googleScholarUrl ? '#ef4444' : '#e2e8f0'}`, fontSize: '0.8rem' }} placeholder="Google Scholar URL" value={editEuEditForm.googleScholarUrl} onChange={e => { const v = e.target.value; setEditEuEditForm(f => ({ ...f, googleScholarUrl: v })); setEditEuEditErrors(prev => ({ ...prev, googleScholarUrl: validateExternalAuthorField('googleScholarUrl', v.trim()) })); }} />
                                                                        <input className="form-input" style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${editEuEditErrors.githubUrl ? '#ef4444' : '#e2e8f0'}`, fontSize: '0.8rem', gridColumn: '1 / -1' }} placeholder="GitHub URL" value={editEuEditForm.githubUrl} onChange={e => { const v = e.target.value; setEditEuEditForm(f => ({ ...f, githubUrl: v })); setEditEuEditErrors(prev => ({ ...prev, githubUrl: validateExternalAuthorField('githubUrl', v.trim()) })); }} />
                                                                    </div>
                                                                    {hasExternalAuthorValidationErrors(editEuEditErrors) && (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                            {editEuEditErrors.studentId && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editEuEditErrors.studentId}</span>}
                                                                            {editEuEditErrors.phoneNumber && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editEuEditErrors.phoneNumber}</span>}
                                                                            {editEuEditErrors.orcid && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editEuEditErrors.orcid}</span>}
                                                                            {editEuEditErrors.googleScholarUrl && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editEuEditErrors.googleScholarUrl}</span>}
                                                                            {editEuEditErrors.githubUrl && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editEuEditErrors.githubUrl}</span>}
                                                                        </div>
                                                                    )}
                                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                                                        <button type="button" onClick={() => { setEditEuEditingKey(null); setEditEuEditErrors(externalAuthorValidationDefaults); }} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>Cancel</button>
                                                                        <button type="button" disabled={!editEuEditForm.fullName.trim() || !editEuEditForm.email.trim() || hasExternalAuthorValidationErrors(editEuEditErrors)} onClick={() => { setEditExternalUsers(prev => prev.map((x, i) => (eu.externalUserId ? x.externalUserId === eu.externalUserId : i === idx) ? { ...x, ...editEuEditForm } : x)); setEditEuEditingKey(null); setEditEuEditErrors(externalAuthorValidationDefaults); }} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Save</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>{eu.fullName || '—'}</div>
                                                                            {eu.email && <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>✉ {eu.email}</div>}
                                                                        </div>
                                                                        <button type="button" onClick={() => { setEditEuEditingKey(key); setEditEuEditForm({ fullName: eu.fullName ?? '', email: eu.email ?? '', phoneNumber: eu.phoneNumber ?? '', studentId: eu.studentId ?? '', orcid: eu.orcid ?? '', googleScholarUrl: eu.googleScholarUrl ?? '', githubUrl: eu.githubUrl ?? '' }); setEditEuEditErrors(externalAuthorValidationDefaults); setEditEuShowAdd(false); }} style={{ padding: '3px 7px', borderRadius: '5px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}><Edit2 size={11} /></button>
                                                                        <button type="button" onClick={() => { if (eu.externalUserId) setEditDeletedExternalUserIds(prev => [...prev, eu.externalUserId]); setEditExternalUsers(prev => prev.filter((_, i) => i !== idx)); }} style={{ padding: '3px 7px', borderRadius: '5px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}><Trash2 size={11} /></button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {editExternalUsers.length === 0 && !editEuShowAdd && (
                                            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>No external authors added.</p>
                                        )}
                                        {editEuShowAdd && (
                                            <div style={{ padding: '10px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                                    <input className="form-input" style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }} placeholder="Full name *" value={editEuDraft.fullName} onChange={e => setEditEuDraft(f => ({ ...f, fullName: e.target.value }))} />
                                                    <input className="form-input" style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }} placeholder="Email *" value={editEuDraft.email} onChange={e => setEditEuDraft(f => ({ ...f, email: e.target.value }))} />
                                                    <input className="form-input" style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${editEuDraftErrors.phoneNumber ? '#ef4444' : '#e2e8f0'}`, fontSize: '0.8rem' }} placeholder="Phone number" value={editEuDraft.phoneNumber} onChange={e => { const v = e.target.value; setEditEuDraft(f => ({ ...f, phoneNumber: v })); setEditEuDraftErrors(prev => ({ ...prev, phoneNumber: validateExternalAuthorField('phoneNumber', v.trim()) })); }} />
                                                    <input className="form-input" style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${editEuDraftErrors.studentId ? '#ef4444' : '#e2e8f0'}`, fontSize: '0.8rem' }} placeholder="Student ID" value={editEuDraft.studentId} onChange={e => { const v = e.target.value; setEditEuDraft(f => ({ ...f, studentId: v })); setEditEuDraftErrors(prev => ({ ...prev, studentId: validateExternalAuthorField('studentId', v.trim()) })); }} />
                                                    <input className="form-input" style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${editEuDraftErrors.orcid ? '#ef4444' : '#e2e8f0'}`, fontSize: '0.8rem' }} placeholder="ORCID" value={editEuDraft.orcid} onChange={e => { const v = e.target.value; setEditEuDraft(f => ({ ...f, orcid: v })); setEditEuDraftErrors(prev => ({ ...prev, orcid: validateExternalAuthorField('orcid', v.trim()) })); }} />
                                                    <input className="form-input" style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${editEuDraftErrors.googleScholarUrl ? '#ef4444' : '#e2e8f0'}`, fontSize: '0.8rem' }} placeholder="Google Scholar URL" value={editEuDraft.googleScholarUrl} onChange={e => { const v = e.target.value; setEditEuDraft(f => ({ ...f, googleScholarUrl: v })); setEditEuDraftErrors(prev => ({ ...prev, googleScholarUrl: validateExternalAuthorField('googleScholarUrl', v.trim()) })); }} />
                                                    <input className="form-input" style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${editEuDraftErrors.githubUrl ? '#ef4444' : '#e2e8f0'}`, fontSize: '0.8rem', gridColumn: '1 / -1' }} placeholder="GitHub URL" value={editEuDraft.githubUrl} onChange={e => { const v = e.target.value; setEditEuDraft(f => ({ ...f, githubUrl: v })); setEditEuDraftErrors(prev => ({ ...prev, githubUrl: validateExternalAuthorField('githubUrl', v.trim()) })); }} />
                                                </div>
                                                {hasExternalAuthorValidationErrors(editEuDraftErrors) && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                        {editEuDraftErrors.studentId && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editEuDraftErrors.studentId}</span>}
                                                        {editEuDraftErrors.phoneNumber && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editEuDraftErrors.phoneNumber}</span>}
                                                        {editEuDraftErrors.orcid && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editEuDraftErrors.orcid}</span>}
                                                        {editEuDraftErrors.googleScholarUrl && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editEuDraftErrors.googleScholarUrl}</span>}
                                                        {editEuDraftErrors.githubUrl && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editEuDraftErrors.githubUrl}</span>}
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                                    <button type="button" onClick={() => { setEditEuShowAdd(false); setEditEuDraft(blankExternalForm); setEditEuDraftErrors(externalAuthorValidationDefaults); }} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>Cancel</button>
                                                    <button type="button" disabled={!editEuDraft.fullName.trim() || !editEuDraft.email.trim() || hasExternalAuthorValidationErrors(editEuDraftErrors)} onClick={() => { const errs = validateExternalAuthorProfileFields(editEuDraft); setEditEuDraftErrors(errs); if (hasExternalAuthorValidationErrors(errs)) return; setEditExternalUsers(prev => [...prev, { ...editEuDraft, _key: Date.now().toString() }]); setEditEuDraft(blankExternalForm); setEditEuDraftErrors(externalAuthorValidationDefaults); setEditEuShowAdd(false); }} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Add Author</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

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
                                            { label: 'Deadline', value: selectedPaper.submissionDeadline ? new Date(selectedPaper.submissionDeadline).toLocaleDateString() : '—' },
                                            { label: 'Created', value: new Date(selectedPaper.createdAt).toLocaleDateString() },
                                        ].map(item => (
                                            <div key={item.label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '4px' }}>{item.label}</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{item.value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Creator / Last updater */}
                                    {(selectedPaper.creatorFullName || selectedPaper.lastUpdatedByFullName) && (
                                        <div style={{ display: 'grid', gridTemplateColumns: detailInfoGridColumns, gap: '12px' }}>
                                            {selectedPaper.creatorFullName && (
                                                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '4px' }}>Created By</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{selectedPaper.creatorFullName}</div>
                                                    {selectedPaper.creatorEmail && (
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{selectedPaper.creatorEmail}</div>
                                                    )}
                                                </div>
                                            )}
                                            {selectedPaper.lastUpdatedByFullName && (
                                                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '4px' }}>Last Updated By</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{selectedPaper.lastUpdatedByFullName}</div>
                                                    {selectedPaper.lastUpdatedByEmail && (
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{selectedPaper.lastUpdatedByEmail}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

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
                                            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
                                                {selectedPaper.members.map((m, i) => {
                                                    const pm = projectMembers.find((p: any) => (p.membershipId || p.memberId) === m.membershipId);
                                                    const name = getAuthorDisplayName(m);
                                                    const isExpanded = expandedAuthorId === m.membershipId;
                                                    return (
                                                        <div key={i}
                                                            onClick={() => setExpandedAuthorId(isExpanded ? null : m.membershipId)}
                                                            style={{ padding: '8px 10px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'background 0.15s' }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', flex: 1 }}>{name}</span>
                                                                <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{isExpanded ? '▲' : '▼'}</span>
                                                            </div>
                                                            {isExpanded && (
                                                                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                                                                    {(pm?.email) && <span style={{ fontSize: '0.72rem', color: '#64748b' }}>✉ {pm.email}</span>}
                                                                    {(pm?.phoneNumber) && <span style={{ fontSize: '0.72rem', color: '#64748b' }}>☎ {pm.phoneNumber}</span>}
                                                                    {(pm?.roleName || pm?.projectRoleName) && <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#e0f2fe', padding: '1px 7px', borderRadius: '10px' }}>{pm.roleName || pm.projectRoleName}</span>}
                                                                    {!pm?.email && !pm?.phoneNumber && <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>No additional info.</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* External Authors */}
                                    <div>
                                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '6px' }}>External Authors</div>
                                        {(selectedPaper.externalUsers ?? []).length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {(selectedPaper.externalUsers ?? []).map(eu => (
                                                    <div key={eu.externalUserId}
                                                        onClick={() => setViewingExternalUser(eu)}
                                                        style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>{eu.fullName || '—'}</div>
                                                            {eu.email && <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>✉ {eu.email}</div>}
                                                        </div>
                                                        <ExternalLink size={12} style={{ color: '#94a3b8', flexShrink: 0 }} />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>No external authors.</p>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {(() => {
                                        const canEdit = selectedPaper.editable;
                                        return (
                                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>

                                        {/* Draft: Edit + Submit for Internal Review + Delete */}
                                        {selectedPaper.status === SubmissionStatus.Draft && canEdit && (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                                                <button onClick={() => openEdit(selectedPaper)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                                                    <Edit2 size={14} /> Edit
                                                </button>
                                                <button onClick={handleSubmitForReview} disabled={submitReviewLoading}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#3b82f6', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                                                    {submitReviewLoading ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : <><Send size={14} /> Submit for Internal Review</>}
                                                </button>
                                                {deleteConfirmId === selectedPaper.paperSubmissionId ? (
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
                                                )}
                                            </div>
                                        )}

                                        {/* InternalReview: awaiting director — no leader actions */}
                                        {selectedPaper.status === SubmissionStatus.InternalReview && !isDirector && (
                                            <div style={{ padding: '10px 14px', borderRadius: '9px', background: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.82rem', fontWeight: 600, color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Clock size={13} /> Awaiting Lab Director review.
                                            </div>
                                        )}

                                        {/* Lab Director: approve/reject InternalReview */}
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

                                        {/* Approved → Record Decision / Mark Revision */}
                                        {selectedPaper.status === SubmissionStatus.Approved && canEdit && (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                                                <button onClick={handleVenueDecision} disabled={!!actionLoading}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: 'none', background: '#8b5cf6', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', boxShadow: '0 2px 8px rgba(139,92,246,0.25)' }}>
                                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Gavel size={14} />} Record Decision
                                                </button>
                                                <button onClick={handleMarkRevision} disabled={!!actionLoading}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: '1px solid #fed7aa', background: '#fff7ed', color: '#ea580c', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Mark Revision
                                                </button>
                                            </div>
                                        )}

                                        {/* Revision: Edit + Record Decision + Reject */}
                                        {selectedPaper.status === SubmissionStatus.Revision && canEdit && (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                                                <button onClick={() => openEdit(selectedPaper)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                                                    <Edit2 size={14} /> Edit
                                                </button>
                                                <button onClick={handleVenueDecision} disabled={!!actionLoading}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: 'none', background: '#8b5cf6', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', boxShadow: '0 2px 8px rgba(139,92,246,0.25)' }}>
                                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Gavel size={14} />} Record Decision
                                                </button>
                                                <button onClick={handleRejectRevision} disabled={!!actionLoading}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: '1px solid #fecaca', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject
                                                </button>
                                            </div>
                                        )}

                                        {/* Decision: final status */}
                                        {selectedPaper.status === SubmissionStatus.Decision && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '9px', background: STATUS_BG[SubmissionStatus.Decision], border: `1px solid ${STATUS_COLOR[SubmissionStatus.Decision]}33` }}>
                                                <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: STATUS_COLOR[SubmissionStatus.Decision] }}>Decision recorded.</span>
                                            </div>
                                        )}

                                        {/* Rejected → Revert to Draft */}
                                        {selectedPaper.status === SubmissionStatus.Rejected && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '9px', background: '#fef2f2', border: '1px solid #fecaca' }}>
                                                <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: '#dc2626' }}>Paper rejected.</span>
                                                {canEdit && (
                                                <button onClick={handleRevertToDraft} disabled={!!actionLoading}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}>
                                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Revert to Draft
                                                </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                        );
                                    })()}

                                </div>
                            )}
                        </div>
                        {activePanel === 'view' && selectedPaper && (
                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', justifyContent: 'flex-start', flexShrink: 0 }}>
                                <button onClick={handleIndexing} disabled={indexingLoading}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                                    <RefreshCw size={14} className={indexingLoading ? 'animate-spin' : ''} /> Insert to Semantic Search
                                </button>
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
    data: { title: string; abstract: string; conferenceName: string; paperUrl: string; projectId: string; deadline?: string; members: PaperMemberRequest[]; document?: File | null };
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={fieldLabelStyle}>Submission Deadline</label>
            <input type="date" className="form-input" style={fieldInputStyle}
                value={data.deadline || ''}
                onChange={e => onChange('deadline', e.target.value)} />
        </div>
        {extraField}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={fieldLabelStyle}>Abstract</label>
            <textarea className="form-input" style={{ ...fieldInputStyle, resize: 'vertical' as const, ...(formErrors.abstract ? { borderColor: '#ef4444' } : {}) }} rows={4}
                value={data.abstract} onChange={e => onChange('abstract', e.target.value)} placeholder="Brief description of the paper..." />
            {formErrors.abstract && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{formErrors.abstract}</span>}
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
                                            {pm?.fullName || 'Member'}
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

// ─── CreateExternalAuthors ─────────────────────────────────────────────────────
const blankEu = { fullName: '', email: '', phoneNumber: '', studentId: '', orcid: '', googleScholarUrl: '', githubUrl: '' };

interface CreateExternalAuthorsProps {
    externalUsers: ExternalUserCreateDto[];
    onChange: (users: ExternalUserCreateDto[]) => void;
}

const CreateExternalAuthors: React.FC<CreateExternalAuthorsProps> = ({ externalUsers, onChange }) => {
    const [draft, setDraft] = React.useState(blankEu);
    const [showForm, setShowForm] = React.useState(false);
    const [editIdx, setEditIdx] = React.useState<number | null>(null);
    const [editDraft, setEditDraft] = React.useState(blankEu);
    const [draftErrors, setDraftErrors] = React.useState<ExternalAuthorValidationErrors>(externalAuthorValidationDefaults);
    const [editErrors, setEditErrors] = React.useState<ExternalAuthorValidationErrors>(externalAuthorValidationDefaults);

    const hasDraftValidationErrors = hasExternalAuthorValidationErrors(validateExternalAuthorProfileFields(draft));
    const hasEditValidationErrors = hasExternalAuthorValidationErrors(validateExternalAuthorProfileFields(editDraft));

    const addAuthor = () => {
        if (!draft.fullName.trim() || !draft.email.trim()) return;
        const nextErrors = validateExternalAuthorProfileFields(draft);
        setDraftErrors(nextErrors);
        if (hasExternalAuthorValidationErrors(nextErrors)) return;
        onChange([...externalUsers, { ...draft, fullName: draft.fullName.trim(), email: draft.email.trim() || null, phoneNumber: draft.phoneNumber.trim() || null, studentId: draft.studentId.trim() || null, orcid: draft.orcid.trim() || null, googleScholarUrl: draft.googleScholarUrl.trim() || null, githubUrl: draft.githubUrl.trim() || null, isActive: true }]);
        setDraft(blankEu);
        setDraftErrors(externalAuthorValidationDefaults);
        setShowForm(false);
    };

    const saveEdit = () => {
        if (editIdx === null || !editDraft.fullName.trim() || !editDraft.email.trim()) return;
        const nextErrors = validateExternalAuthorProfileFields(editDraft);
        setEditErrors(nextErrors);
        if (hasExternalAuthorValidationErrors(nextErrors)) return;
        onChange(externalUsers.map((eu, i) => i === editIdx ? { ...editDraft, fullName: editDraft.fullName.trim(), email: editDraft.email.trim() || null, phoneNumber: editDraft.phoneNumber.trim() || null, studentId: editDraft.studentId.trim() || null, orcid: editDraft.orcid.trim() || null, googleScholarUrl: editDraft.googleScholarUrl.trim() || null, githubUrl: editDraft.githubUrl.trim() || null, isActive: true } : eu));
        setEditIdx(null);
        setEditErrors(externalAuthorValidationDefaults);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={fieldLabelStyle}>External Authors</label>
                {!showForm && editIdx === null && (
                    <button type="button" onClick={() => setShowForm(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                        <Plus size={11} /> Add
                    </button>
                )}
            </div>

            {/* Existing list */}
            {externalUsers.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {externalUsers.map((eu, idx) => (
                        <div key={idx}>
                            {editIdx === idx ? (
                                <div style={{ padding: '10px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                        <input className="form-input" style={{ ...fieldInputStyle }} placeholder="Full name *" value={editDraft.fullName} onChange={e => setEditDraft(d => ({ ...d, fullName: e.target.value }))} />
                                        <input className="form-input" style={{ ...fieldInputStyle }} placeholder="Email *" value={editDraft.email} onChange={e => setEditDraft(d => ({ ...d, email: e.target.value }))} />
                                        <input className="form-input" style={{ ...fieldInputStyle, borderColor: editErrors.phoneNumber ? '#ef4444' : '#e2e8f0' }} placeholder="Phone number" value={editDraft.phoneNumber} onChange={e => { const value = e.target.value; setEditDraft(d => ({ ...d, phoneNumber: value })); setEditErrors(prev => ({ ...prev, phoneNumber: validateExternalAuthorField('phoneNumber', value.trim()) })); }} />
                                        <input className="form-input" style={{ ...fieldInputStyle, borderColor: editErrors.studentId ? '#ef4444' : '#e2e8f0' }} placeholder="Student ID" value={editDraft.studentId} onChange={e => { const value = e.target.value; setEditDraft(d => ({ ...d, studentId: value })); setEditErrors(prev => ({ ...prev, studentId: validateExternalAuthorField('studentId', value.trim()) })); }} />
                                        <input className="form-input" style={{ ...fieldInputStyle, borderColor: editErrors.orcid ? '#ef4444' : '#e2e8f0' }} placeholder="ORCID" value={editDraft.orcid} onChange={e => { const value = e.target.value; setEditDraft(d => ({ ...d, orcid: value })); setEditErrors(prev => ({ ...prev, orcid: validateExternalAuthorField('orcid', value.trim()) })); }} />
                                        <input className="form-input" style={{ ...fieldInputStyle, borderColor: editErrors.googleScholarUrl ? '#ef4444' : '#e2e8f0' }} placeholder="Google Scholar URL" value={editDraft.googleScholarUrl} onChange={e => { const value = e.target.value; setEditDraft(d => ({ ...d, googleScholarUrl: value })); setEditErrors(prev => ({ ...prev, googleScholarUrl: validateExternalAuthorField('googleScholarUrl', value.trim()) })); }} />
                                        <input className="form-input" style={{ ...fieldInputStyle, gridColumn: '1 / -1', borderColor: editErrors.githubUrl ? '#ef4444' : '#e2e8f0' } as React.CSSProperties} placeholder="GitHub URL" value={editDraft.githubUrl} onChange={e => { const value = e.target.value; setEditDraft(d => ({ ...d, githubUrl: value })); setEditErrors(prev => ({ ...prev, githubUrl: validateExternalAuthorField('githubUrl', value.trim()) })); }} />
                                    </div>
                                    {(editErrors.phoneNumber || editErrors.studentId || editErrors.orcid || editErrors.googleScholarUrl || editErrors.githubUrl) && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            {editErrors.studentId && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editErrors.studentId}</span>}
                                            {editErrors.phoneNumber && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editErrors.phoneNumber}</span>}
                                            {editErrors.orcid && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editErrors.orcid}</span>}
                                            {editErrors.googleScholarUrl && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editErrors.googleScholarUrl}</span>}
                                            {editErrors.githubUrl && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{editErrors.githubUrl}</span>}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                        <button type="button" onClick={() => { setEditIdx(null); setEditErrors(externalAuthorValidationDefaults); }} style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', fontSize: '0.78rem', fontWeight: 700 }}>Cancel</button>
                                        <button type="button" onClick={saveEdit} disabled={!editDraft.fullName.trim() || !editDraft.email.trim() || hasEditValidationErrors} style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>Save</button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>{eu.fullName}</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', marginTop: '3px' }}>
                                            {eu.email && <span style={{ fontSize: '0.71rem', color: '#64748b' }}>✉ {eu.email}</span>}
                                            {eu.phoneNumber && <span style={{ fontSize: '0.71rem', color: '#64748b' }}>☎ {eu.phoneNumber}</span>}
                                            {eu.studentId && <span style={{ fontSize: '0.71rem', color: '#64748b' }}>ID: {eu.studentId}</span>}
                                            {eu.orcid && <span style={{ fontSize: '0.71rem', color: '#64748b' }}>ORCID: {eu.orcid}</span>}
                                            {eu.googleScholarUrl && <span style={{ fontSize: '0.71rem', color: '#64748b' }}>Google Scholar</span>}
                                            {eu.githubUrl && <span style={{ fontSize: '0.71rem', color: '#64748b' }}>GitHub</span>}
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => { setEditIdx(idx); setEditDraft({ fullName: eu.fullName ?? '', email: eu.email ?? '', phoneNumber: eu.phoneNumber ?? '', studentId: eu.studentId ?? '', orcid: eu.orcid ?? '', googleScholarUrl: eu.googleScholarUrl ?? '', githubUrl: eu.githubUrl ?? '' }); setEditErrors(externalAuthorValidationDefaults); setShowForm(false); }}
                                        style={{ padding: '3px 7px', borderRadius: '5px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}><Edit2 size={11} /></button>
                                    <button type="button" onClick={() => onChange(externalUsers.filter((_, i) => i !== idx))}
                                        style={{ padding: '3px 7px', borderRadius: '5px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}><Trash2 size={11} /></button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Add new form */}
            {showForm && (
                <div style={{ padding: '10px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <input className="form-input" style={{ ...fieldInputStyle }} placeholder="Full name *" value={draft.fullName} onChange={e => setDraft(d => ({ ...d, fullName: e.target.value }))} />
                        <input className="form-input" style={{ ...fieldInputStyle }} placeholder="Email *" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} />
                        <input className="form-input" style={{ ...fieldInputStyle, borderColor: draftErrors.phoneNumber ? '#ef4444' : '#e2e8f0' }} placeholder="Phone number" value={draft.phoneNumber} onChange={e => { const value = e.target.value; setDraft(d => ({ ...d, phoneNumber: value })); setDraftErrors(prev => ({ ...prev, phoneNumber: validateExternalAuthorField('phoneNumber', value.trim()) })); }} />
                        <input className="form-input" style={{ ...fieldInputStyle, borderColor: draftErrors.studentId ? '#ef4444' : '#e2e8f0' }} placeholder="Student ID" value={draft.studentId} onChange={e => { const value = e.target.value; setDraft(d => ({ ...d, studentId: value })); setDraftErrors(prev => ({ ...prev, studentId: validateExternalAuthorField('studentId', value.trim()) })); }} />
                        <input className="form-input" style={{ ...fieldInputStyle, borderColor: draftErrors.orcid ? '#ef4444' : '#e2e8f0' }} placeholder="ORCID" value={draft.orcid} onChange={e => { const value = e.target.value; setDraft(d => ({ ...d, orcid: value })); setDraftErrors(prev => ({ ...prev, orcid: validateExternalAuthorField('orcid', value.trim()) })); }} />
                        <input className="form-input" style={{ ...fieldInputStyle, borderColor: draftErrors.googleScholarUrl ? '#ef4444' : '#e2e8f0' }} placeholder="Google Scholar URL" value={draft.googleScholarUrl} onChange={e => { const value = e.target.value; setDraft(d => ({ ...d, googleScholarUrl: value })); setDraftErrors(prev => ({ ...prev, googleScholarUrl: validateExternalAuthorField('googleScholarUrl', value.trim()) })); }} />
                        <input className="form-input" style={{ ...fieldInputStyle, gridColumn: '1 / -1', borderColor: draftErrors.githubUrl ? '#ef4444' : '#e2e8f0' } as React.CSSProperties} placeholder="GitHub URL" value={draft.githubUrl} onChange={e => { const value = e.target.value; setDraft(d => ({ ...d, githubUrl: value })); setDraftErrors(prev => ({ ...prev, githubUrl: validateExternalAuthorField('githubUrl', value.trim()) })); }} />
                    </div>
                    {(draftErrors.phoneNumber || draftErrors.studentId || draftErrors.orcid || draftErrors.googleScholarUrl || draftErrors.githubUrl) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {draftErrors.studentId && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{draftErrors.studentId}</span>}
                            {draftErrors.phoneNumber && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{draftErrors.phoneNumber}</span>}
                            {draftErrors.orcid && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{draftErrors.orcid}</span>}
                            {draftErrors.googleScholarUrl && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{draftErrors.googleScholarUrl}</span>}
                            {draftErrors.githubUrl && <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>{draftErrors.githubUrl}</span>}
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button type="button" onClick={() => { setShowForm(false); setDraft(blankEu); setDraftErrors(externalAuthorValidationDefaults); }} style={{ padding: '5px 12px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', fontSize: '0.78rem', fontWeight: 700 }}>Cancel</button>
                        <button type="button" onClick={addAuthor} disabled={!draft.fullName.trim() || !draft.email.trim() || hasDraftValidationErrors} style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>Add Author</button>
                    </div>
                </div>
            )}

            {externalUsers.length === 0 && !showForm && (
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>No external authors added.</p>
            )}
        </div>
    );
};

export default PaperSubmissions;
