import React, { useState, useEffect, useCallback } from 'react';
import AppSelect from '@/components/common/AppSelect';
import { validateSpecialChars } from '@/utils/validation';
import {
    Search, X, User, Calendar, Loader2, Play, Send,
    Upload, Paperclip, Target, ChevronDown, Check, RotateCw, CheckCircle2, Pencil, Save, Edit3, Download
} from 'lucide-react';
import { Task, TaskStatus, Priority, Milestone, MilestoneStatus, Project, ProjectRoleEnum } from '@/types';
import { milestoneService, taskService } from '@/services';
import ConfirmModal from '@/components/common/ConfirmModal';
import { getStatusColor } from './DetailsTasks';

// ── Evidence helpers ──
const getEvidenceExtension = (fileName?: string, fileUrl?: string): string => {
    const fromName = fileName?.split('.').pop()?.toLowerCase();
    if (fromName) return fromName;
    try {
        const pathname = new URL(fileUrl || '').pathname;
        return pathname.split('.').pop()?.toLowerCase() || '';
    } catch {
        return '';
    }
};

const getInlineCloudinaryRawUrl = (rawUrl?: string): string => {
    if (!rawUrl) return '';
    if (!rawUrl.includes('res.cloudinary.com')) return rawUrl;
    if (!rawUrl.includes('/raw/upload/')) return rawUrl;
    if (rawUrl.includes('fl_attachment:false')) return rawUrl;
    return rawUrl.replace('/raw/upload/', '/raw/upload/fl_attachment:false/');
};

const resolveEvidenceViewer = (evidence?: { fileName?: string; fileUrl?: string } | null) => {
    if (!evidence?.fileUrl) return { mode: 'none' as const, url: '' };
    const ext = getEvidenceExtension(evidence.fileName, evidence.fileUrl);
    const normalizedUrl = getInlineCloudinaryRawUrl(evidence.fileUrl);
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
    if (imageExts.includes(ext)) return { mode: 'image' as const, url: normalizedUrl };
    if (ext === 'pdf') return { mode: 'pdf' as const, url: normalizedUrl };
    if (officeExts.includes(ext)) {
        return { mode: 'office' as const, url: `https://docs.google.com/viewer?url=${encodeURIComponent(normalizedUrl)}&embedded=true` };
    }
    return { mode: 'none' as const, url: normalizedUrl };
};

const ALLOWED_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv',
    '.zip', '.rar', '.7z',
    '.mp4', '.mov', '.avi', '.mkv',
    '.pdf',
]);
const ALLOWED_ACCEPT = Array.from(ALLOWED_EXTENSIONS).join(',');

export interface TaskDetailPanelProps {
    selectedTaskId: string | null;
    project: Project;
    projectMembers: any[];
    milestones: Milestone[];
    canManageTasks: boolean;
    isArchived: boolean;
    isSpecialRole: boolean;
    formatProjectDate: (date: string | Date | undefined, fallback?: string) => string;
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    refreshTasks: () => void;
    onPersonalRefresh: () => void;
    viewContext: 'personal' | 'all';
}

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
    selectedTaskId,
    project,
    projectMembers,
    milestones,
    isSpecialRole,
    isArchived,
    formatProjectDate,
    showToast,
    refreshTasks,
    onPersonalRefresh,
    viewContext,
}) => {
    // ── Task detail loading ──
    const [selectedTaskDetail, setSelectedTaskDetail] = useState<Task | null>(null);
    const [selectedTaskMilestone, setSelectedTaskMilestone] = useState<Milestone | null>(null);

    // ── Edit form ──
    const [isEditMode, setIsEditMode] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '', description: '', priority: Priority.Medium as number,
        startDate: '', dueDate: '', milestoneId: '', memberId: '', supportMemberIds: [] as string[]
    });
    const [editError, setEditError] = useState<string | null>(null);
    const [editSaving, setEditSaving] = useState(false);

    // ── Dropdowns ──
    const [openCollabDropdownId, setOpenCollabDropdownId] = useState<string | null>(null);
    const [openAssigneeDropdownId, setOpenAssigneeDropdownId] = useState<string | null>(null);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');

    // ── Evidence ──
    const [evidenceFiles, setEvidenceFiles] = useState<{ [taskId: string]: File[] }>({});
    const [uploadedEvidences, setUploadedEvidences] = useState<{ [taskId: string]: any[] }>({});
    const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
    const [previewEvidence, setPreviewEvidence] = useState<any>(null);
    const [fileInputKey, setFileInputKey] = useState(0);

    // ── Actions / modals ──
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [pendingSubmitTaskId, setPendingSubmitTaskId] = useState<string | null>(null);
    const [pendingApproveTaskId, setPendingApproveTaskId] = useState<string | null>(null);
    const [pendingAdjustTaskId, setPendingAdjustTaskId] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<{ taskId: string; evidenceId: number } | null>(null);
    const [errorMessages, setErrorMessages] = useState<{ [taskId: string]: string | null }>({});
    const [successMessages, setSuccessMessages] = useState<{ [taskId: string]: string | null }>({});

    // ── Close dropdowns on outside click ──
    const closeAllDropdowns = () => {
        setOpenCollabDropdownId(null);
        setOpenAssigneeDropdownId(null);
        setMemberSearchQuery('');
    };

    useEffect(() => {
        const anyOpen = openCollabDropdownId !== null || openAssigneeDropdownId !== null;
        if (!anyOpen) return;
        const handler = (e: MouseEvent | TouchEvent) => {
            const target = e.target as HTMLElement;
            if (target && target.closest('[data-dropdown-list]')) return;
            closeAllDropdowns();
        };
        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, [openCollabDropdownId, openAssigneeDropdownId]);

    // ── Reset on task change ──
    useEffect(() => {
        setIsEditMode(false);
        setEditError(null);
        setSelectedTaskDetail(null);
        setSelectedTaskMilestone(null);
    }, [selectedTaskId]);

    // ── Load task detail ──
    const loadSelectedTaskDetail = useCallback(async (taskId: string) => {
        if (!taskId) { setSelectedTaskDetail(null); setSelectedTaskMilestone(null); return null; }
        try {
            const detail = await taskService.getById(taskId);
            setSelectedTaskDetail(detail);
            return detail;
        } catch {
            setSelectedTaskDetail(null);
            setSelectedTaskMilestone(null);
            return null;
        }
    }, []);

    useEffect(() => { void loadSelectedTaskDetail(selectedTaskId || ''); }, [selectedTaskId, loadSelectedTaskDetail]);

    // ── Load evidences ──
    const fetchEvidences = useCallback(async (taskId: string) => {
        try {
            const evidences = await taskService.getEvidences(taskId);
            setUploadedEvidences(prev => ({ ...prev, [taskId]: evidences }));
            if (evidences.length > 0 && !previewEvidence && isEvidenceModalOpen) setPreviewEvidence(evidences[0]);
        } catch {
            // silently ignore
        }
    }, [isEvidenceModalOpen, previewEvidence]);

    useEffect(() => { if (selectedTaskId) fetchEvidences(selectedTaskId); }, [selectedTaskId, fetchEvidences]);

    // ── Helpers ──
    const normalizeId = (value: any): string => value === undefined || value === null ? '' : String(value);

    const toDateInput = (value: any): string => {
        if (!value) return '';
        if (typeof value === 'string' && value.includes('T')) return value.split('T')[0];
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
    };

    const resolveMilestone = (rawId: any): Milestone | undefined => {
        const target = normalizeId(rawId).toLowerCase();
        if (!target) return undefined;
        return milestones.find((m: any) => {
            const ids = [m.milestoneId, m.id, m.ID, m.name, m.milestoneName].map(v => normalizeId(v).toLowerCase()).filter(Boolean);
            return ids.includes(target);
        });
    };

    const getMilestoneOptionId = (milestone: any): string =>
        normalizeId(milestone?.milestoneId || milestone?.id || milestone?.ID || milestone?.milestoneID);

    const findMemberId = (rawIdOrEmail: any): string => {
        const target = normalizeId(rawIdOrEmail).toLowerCase();
        if (!target) return '';
        const matched = projectMembers.find((m: any) => {
            const ids = [m.membershipId, m.memberId, m.email, m.userId, m.id, m.fullName, m.userName, m.name, m.memberEmail].map(v => normalizeId(v).toLowerCase()).filter(Boolean);
            return ids.includes(target);
        });
        if (matched) {
            const guid = matched.membershipId || matched.memberId || matched.userId || (matched.id?.length > 20 ? matched.id : '');
            return normalizeId(guid);
        }
        return target.length > 20 ? target : '';
    };

    const getMemberOptionId = (member: any): string => {
        const guid = member?.membershipId || member?.memberId || member?.userId || (member?.id?.length > 20 ? member.id : '');
        return normalizeId(guid);
    };

    const getTaskCollaboratorEntries = (task: any) => {
        const rawCollaborators = task?.members || task?.supportMembers || task?.collaborators || task?.supportMemberIds || task?.collaboratorIds || [];
        const rows = Array.isArray(rawCollaborators) ? rawCollaborators : [];
        return rows.map((item: any) => {
            const matchedMember = typeof item === 'object'
                ? item
                : projectMembers.find(pm => getMemberOptionId(pm) === normalizeId(item));
            const id = getMemberOptionId(matchedMember) || normalizeId(item);
            const fullName = matchedMember?.fullName || matchedMember?.userName || matchedMember?.name || matchedMember?.email || (typeof item === 'string' ? item : 'Member');
            return { id, fullName, email: matchedMember?.email || '' };
        }).filter((item: any) => !!item.id || !!item.fullName);
    };

    // ── Active task (prefer fetched detail) ──
    const activeTask = selectedTaskDetail;

    // ── Load milestone for active task ──
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!activeTask) { setSelectedTaskMilestone(null); return; }
            const rawMilestoneId =
                (activeTask as any)?.milestoneId || (activeTask as any)?.milestoneID ||
                (activeTask as any)?.milestone_id || (activeTask as any)?.milestone?.milestoneId ||
                (activeTask as any)?.milestone?.id || (activeTask as any)?.milestone?.name ||
                (activeTask as any)?.milestoneName ||
                (typeof (activeTask as any)?.milestone === 'string' ? (activeTask as any).milestone : '') || '';
            const local = resolveMilestone(rawMilestoneId);
            if (local) { setSelectedTaskMilestone(local); return; }
            if (!rawMilestoneId) { setSelectedTaskMilestone(null); return; }
            try {
                const fetched = await milestoneService.getById(String(rawMilestoneId));
                if (!cancelled) setSelectedTaskMilestone(fetched);
            } catch {
                if (!cancelled) setSelectedTaskMilestone(null);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [activeTask, milestones]);

    // ── Date validation ──
    const today = toDateInput(new Date());
    const selectedEditMilestone = resolveMilestone(editForm.milestoneId);
    const editMilestoneStart = toDateInput(selectedEditMilestone?.startDate);
    const editMilestoneEnd = toDateInput(selectedEditMilestone?.dueDate);

    const originalStart = toDateInput(activeTask?.startDate);
    const originalDue = toDateInput(activeTask?.dueDate);
    const rawActiveMilestoneId =
        (activeTask as any)?.milestoneId || (activeTask as any)?.milestoneID ||
        (activeTask as any)?.milestone_id || (activeTask as any)?.milestone?.milestoneId ||
        (activeTask as any)?.milestone?.id || (activeTask as any)?.milestone?.name ||
        (activeTask as any)?.milestoneName ||
        (typeof (activeTask as any)?.milestone === 'string' ? (activeTask as any).milestone : '') || '';
    const originalMilestoneId = getMilestoneOptionId(resolveMilestone(rawActiveMilestoneId)) || '';

    const isStartDirty = editForm.startDate !== originalStart;
    const isDueDirty = editForm.dueDate !== originalDue;
    const isMilestoneDirty = editForm.milestoneId !== originalMilestoneId;

    const rawActiveAssignee =
        (activeTask as any)?.member?.fullName || (activeTask as any)?.member?.userName ||
        (activeTask as any)?.member?.name || (activeTask as any)?.member?.email ||
        (activeTask as any)?.assignee?.email || (activeTask as any)?.memberEmail ||
        (activeTask as any)?.assigneeEmail || (activeTask as any)?.memberId ||
        (activeTask as any)?.assigneeId || (activeTask as any)?.assigneeName || '';
    const originalMemberId = findMemberId(rawActiveAssignee);
    const isMemberDirty = editForm.memberId !== originalMemberId;

    const invalidEditStartInPast = !!editForm.startDate && editForm.startDate < today;
    const invalidEditDueInPast = !!editForm.dueDate && editForm.dueDate < today;
    const invalidEditStartAfterDue = !!editForm.startDate && !!editForm.dueDate && editForm.startDate > editForm.dueDate;
    const invalidEditStartBeforeMilestone = !!selectedEditMilestone && !!editForm.startDate && !!editMilestoneStart && editForm.startDate < editMilestoneStart;
    const invalidEditDueAfterMilestone = !!selectedEditMilestone && !!editForm.dueDate && !!editMilestoneEnd && editForm.dueDate > editMilestoneEnd;

    const editStartDateHasError = invalidEditStartInPast || invalidEditStartAfterDue || invalidEditStartBeforeMilestone;
    const editDueDateHasError = invalidEditDueInPast || invalidEditStartAfterDue || invalidEditDueAfterMilestone;
    const editMilestoneHasError = invalidEditStartBeforeMilestone || invalidEditDueAfterMilestone;

    // ── Refresh helper ──
    const refreshSelectedTaskViews = useCallback(async (taskId: string) => {
        await Promise.all([loadSelectedTaskDetail(taskId), fetchEvidences(taskId)]);
        refreshTasks();
        if (viewContext === 'personal') onPersonalRefresh();
    }, [fetchEvidences, loadSelectedTaskDetail, onPersonalRefresh, refreshTasks, viewContext]);

    // ── Handlers ──
    const handleFileChange = (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const newFiles = Array.from(e.target.files);
        const currentFiles = evidenceFiles[taskId] || [];
        const MAX_SIZE = 10 * 1024 * 1024;
        const MAX_FILES = 5;
        const invalidFiles = newFiles.filter(f => { const ext = '.' + (f.name.split('.').pop() || '').toLowerCase(); return !ALLOWED_EXTENSIONS.has(ext); });
        if (invalidFiles.length > 0) {
            showToast(`File type not allowed: ${invalidFiles.map(f => f.name).join(', ')}. Accepted: images, documents, text, archives, videos.`, 'error');
            e.target.value = ''; return;
        }
        const alreadyUploadedCount = (uploadedEvidences[taskId] || []).length;
        if (currentFiles.length + newFiles.length + alreadyUploadedCount > MAX_FILES) {
            showToast(`Maximum ${MAX_FILES} files allowed. You already have ${alreadyUploadedCount} uploaded and ${currentFiles.length} pending.`, 'warning');
            e.target.value = ''; return;
        }
        const largeFiles = newFiles.filter(f => f.size > MAX_SIZE);
        if (largeFiles.length > 0) {
            showToast(`Files exceed 10MB limit: ${largeFiles.map(f => f.name).join(', ')}`, 'error');
            e.target.value = ''; return;
        }
        setEvidenceFiles(prev => ({ ...prev, [taskId]: [...currentFiles, ...newFiles] }));
    };

    const removeFile = (taskId: string, index: number) => {
        setEvidenceFiles(prev => ({ ...prev, [taskId]: (prev[taskId] || []).filter((_: any, i: number) => i !== index) }));
    };

    const handleDeleteEvidence = (taskId: string, evidenceId: number) => setPendingDelete({ taskId, evidenceId });

    const confirmDeleteEvidence = async () => {
        if (!pendingDelete) return;
        const { taskId, evidenceId } = pendingDelete;
        try {
            await taskService.deleteEvidence(taskId, evidenceId);
            await fetchEvidences(taskId);
            setFileInputKey(k => k + 1);
            if (previewEvidence?.id === evidenceId) setPreviewEvidence(null);
        } catch (error: any) {
            showToast(error.message || 'Failed to delete file.', 'error');
        } finally {
            setPendingDelete(null);
        }
    };

    const handleUploadEvidence = async (taskId: string) => {
        setPendingSubmitTaskId(null);
        const drafts = evidenceFiles[taskId] || [];
        if (drafts.length === 0) { showToast('Please select at least 1 file first.', 'warning'); return; }
        setErrorMessages(prev => ({ ...prev, [taskId]: null }));
        setSuccessMessages(prev => ({ ...prev, [taskId]: null }));
        setSubmittingId(taskId);
        try {
            await taskService.uploadEvidences(taskId, drafts);
            setEvidenceFiles(prev => { const next = { ...prev }; delete next[taskId]; return next; });
            await refreshSelectedTaskViews(taskId);
            showToast('Evidence uploaded successfully.', 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to upload evidence.', 'error');
        } finally {
            setSubmittingId(null);
        }
    };

    const handleSubmitForReview = async (taskId: string) => {
        const uploadedCount = (uploadedEvidences[taskId] || []).length;
        if (uploadedCount === 0) { showToast('Please upload evidence before submitting for review.', 'warning'); return; }
        setErrorMessages(prev => ({ ...prev, [taskId]: null }));
        setSuccessMessages(prev => ({ ...prev, [taskId]: null }));
        setSubmittingId(taskId);
        try {
            await taskService.updateStatus(taskId, TaskStatus.Submitted);
            await refreshSelectedTaskViews(taskId);
            showToast('Task submitted for review successfully.', 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to submit.', 'error');
        } finally {
            setSubmittingId(null);
        }
    };

    const handleApproveTask = async (taskId: string) => {
        setSubmittingId(taskId);
        try {
            await taskService.updateStatus(taskId, TaskStatus.Completed);
            await refreshSelectedTaskViews(taskId);
        } catch (error: any) {
            showToast(error.message || 'Failed to approve task.', 'error');
        } finally {
            setSubmittingId(null);
        }
    };

    const handleRequestAdjusting = async (taskId: string) => {
        setSubmittingId(taskId);
        try {
            await taskService.updateStatus(taskId, TaskStatus.Adjusting);
            await refreshSelectedTaskViews(taskId);
        } catch (error: any) {
            showToast(error.message || 'Failed to request adjusting.', 'error');
        } finally {
            setSubmittingId(null);
        }
    };

    const handleStartTask = async (taskId: string) => {
        const task = activeTask;
        if (task?.milestoneId) {
            const milestone = milestones.find(m => m.milestoneId === task.milestoneId);
            if (milestone && milestone.status !== MilestoneStatus.InProgress) {
                const statusLabels: Record<number, string> = {
                    [MilestoneStatus.NotStarted]: 'has not started yet',
                    [MilestoneStatus.Completed]: 'is already completed',
                    [MilestoneStatus.OnHold]: 'is on hold',
                    [MilestoneStatus.Cancelled]: 'has been cancelled',
                };
                const label = statusLabels[milestone.status] ?? 'is not active';
                setErrorMessages(prev => ({ ...prev, [taskId]: `Cannot start task: milestone "${milestone.name}" ${label}.` }));
                return;
            }
        }
        setSubmittingId(taskId);
        try {
            await taskService.updateStatus(taskId, TaskStatus.InProgress);
            await refreshSelectedTaskViews(taskId);
        } catch (error: any) {
            setErrorMessages(prev => ({ ...prev, [taskId]: error.message || 'Failed to start task.' }));
        } finally {
            setSubmittingId(null);
        }
    };

    const handleEditSave = async () => {
        if (!activeTask) return;
        const tId = activeTask.taskId || (activeTask as any).id;
        if (!editForm.name.trim()) { setEditError('Task name is required.'); return; }
        const nameSpecialErr = validateSpecialChars(editForm.name);
        if (nameSpecialErr) { setEditError(`Task name: ${nameSpecialErr}`); return; }
        const descSpecialErr = validateSpecialChars(editForm.description);
        if (descSpecialErr) { setEditError(`Description: ${descSpecialErr}`); return; }
        if (editStartDateHasError || editDueDateHasError || editMilestoneHasError) {
            setEditError('Please fix the highlighted errors (dates cannot be in the past, and must be within the milestone range).');
            return;
        }
        setEditError(null);
        setEditSaving(true);
        const updatePayload: any = {
            name: editForm.name,
            description: editForm.description,
            priority: editForm.priority,
            status: activeTask.status,
            milestoneId: editForm.milestoneId || null,
            supportMembers: Array.isArray(editForm.supportMemberIds) ? editForm.supportMemberIds : [],
            projectId: (activeTask as any).projectId || project.projectId || (project as any).id,
        };
        updatePayload.memberId = editForm.memberId || null;
        updatePayload.startDate = editForm.startDate ? new Date(editForm.startDate).toISOString() : null;
        updatePayload.dueDate = editForm.dueDate ? new Date(editForm.dueDate).toISOString() : null;
        try {
            await taskService.update(tId, updatePayload);
            await refreshSelectedTaskViews(tId);
            setIsEditMode(false);
            refreshTasks();
            if (viewContext === 'personal') onPersonalRefresh();
            showToast('Task updated successfully.', 'success');
        } catch (err: any) {
            setEditError(err.message || 'Failed to save changes.');
        } finally {
            setEditSaving(false);
        }
    };

    // ── Styles ──
    const labelStyle = {
        fontSize: '0.75rem', fontWeight: 500, color: '#475569',
        textTransform: 'uppercase', marginBottom: '4px',
        display: 'block', letterSpacing: '0.025em'
    } as const;

    const inputStyle = {
        width: '100%', padding: '0.65rem 0.8rem', borderRadius: '10px',
        border: '1.5px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 400,
        background: 'white', outline: 'none', color: '#1e293b', transition: 'all 0.2s'
    } as const;

    // ── Empty state ──
    if (!selectedTaskId || !activeTask) {
        return (
            <>
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                    <Target size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Select a task to review</div>
                </div>
            </>
        );
    }

    const taskId = activeTask.taskId || (activeTask as any).id;

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
                {/* Header row with title/status and edit toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', position: 'relative' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
                            {isEditMode ? editForm.name || '(untitled)' : activeTask.name}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {(() => {
                                const s = getStatusColor(activeTask.status);
                                return <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '5px', background: s.bg, color: s.text, textTransform: 'uppercase' }}>{s.label}</span>;
                            })()}
                            {!isEditMode && (() => {
                                const p = parseInt(activeTask.priority?.toString() || '1');
                                const labels = ['Low', 'Medium', 'High', 'Critical'];
                                const colors = ['#f1f5f9', '#eff6ff', '#fff7ed', '#fef2f2'];
                                const texts = ['#64748b', '#3b82f6', '#f97316', '#ef4444'];
                                return <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '5px', background: colors[p - 1], color: texts[p - 1], textTransform: 'uppercase' }}>{labels[p - 1]} Priority</span>;
                            })()}
                        </div>
                    </div>
                    {isSpecialRole && !isArchived && !isEditMode && activeTask.status === TaskStatus.Todo && (
                        <button
                            onClick={() => {
                                const rawMilestoneId =
                                    (activeTask as any).milestoneId || (activeTask as any).milestoneID ||
                                    (activeTask as any).milestone_id || (activeTask as any).milestone?.milestoneId ||
                                    (activeTask as any).milestone?.id || (activeTask as any).milestone?.name ||
                                    (activeTask as any).milestoneName ||
                                    (typeof (activeTask as any).milestone === 'string' ? (activeTask as any).milestone : '') || '';
                                const normalizedMilestoneId = getMilestoneOptionId(resolveMilestone(rawMilestoneId)) || '';
                                const rawAssignee =
                                    (activeTask as any).member?.fullName || (activeTask as any).member?.userName ||
                                    (activeTask as any).member?.name || (activeTask as any).member?.email ||
                                    (activeTask as any).assignee?.email || (activeTask as any).memberEmail ||
                                    (activeTask as any).assigneeEmail || (activeTask as any).memberId ||
                                    (activeTask as any).assigneeId || (activeTask as any).assigneeName ||
                                    (activeTask as any).assignedToName || '';
                                const normalizedAssigneeId = findMemberId(rawAssignee);
                                const collaboratorRows =
                                    (activeTask as any).members || (activeTask as any).supportMembers ||
                                    (activeTask as any).collaborators || (activeTask as any).supportMemberIds ||
                                    (activeTask as any).collaboratorIds || (activeTask as any).collaboratorNames || [];
                                const normalizedCollaboratorIds = Array.from(new Set(
                                    (Array.isArray(collaboratorRows) ? collaboratorRows : []).map((item: any) => {
                                        const idToFind = item?.email || item?.memberEmail || item?.userId || item?.memberId || item?.membershipId || item?.id || (typeof item === 'string' ? item : '');
                                        return findMemberId(idToFind);
                                    }).filter((id: string) => !!id && id !== normalizedAssigneeId)
                                ));
                                setEditForm({
                                    name: activeTask.name || '',
                                    description: activeTask.description || '',
                                    priority: activeTask.priority || Priority.Medium,
                                    startDate: toDateInput(activeTask.startDate),
                                    dueDate: toDateInput(activeTask.dueDate),
                                    milestoneId: normalizedMilestoneId,
                                    memberId: normalizedAssigneeId,
                                    supportMemberIds: normalizedCollaboratorIds as string[],
                                });
                                setEditError(null);
                                setIsEditMode(true);
                            }}
                            style={{
                                background: 'none', border: '1.5px solid #e2e8f0',
                                borderRadius: '8px', padding: '5px 10px',
                                cursor: 'pointer', color: '#64748b',
                                display: 'flex', alignItems: 'center', gap: '5px',
                                fontSize: '0.72rem', fontWeight: 600,
                                transition: 'all 0.15s', flexShrink: 0,
                            }}
                            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary-color)'; e.currentTarget.style.color = 'var(--primary-color)'; }}
                            onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                        >
                            <Pencil size={13} /> Edit
                        </button>
                    )}
                    {isSpecialRole && isEditMode && (
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button onClick={() => { setIsEditMode(false); setEditError(null); }}
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}>
                                Cancel
                            </button>
                            <button onClick={handleEditSave} disabled={editSaving}
                                style={{ background: 'var(--primary-color)', border: 'none', borderRadius: '8px', padding: '5px 10px', cursor: editSaving ? 'not-allowed' : 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: 700, opacity: editSaving ? 0.7 : 1 }}>
                                {editSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                {editSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Inline Edit Form */}
                {isEditMode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        {editError && (
                            <div style={{ color: '#ef4444', fontSize: '0.72rem', fontWeight: 700, padding: '8px 12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                                {editError}
                            </div>
                        )}
                        <div>
                            <label style={{ ...labelStyle, marginBottom: '4px' }}>Task Name <span style={{ color: '#ef4444' }}>*</span></label>
                            <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Task name" />
                        </div>
                        <div>
                            <label style={{ ...labelStyle, marginBottom: '4px' }}>Description</label>
                            <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minHeight: '72px', resize: 'vertical', fontFamily: 'inherit' }} placeholder="Description" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                                <label style={{ ...labelStyle, marginBottom: '4px' }}>Priority</label>
                                <AppSelect
                                    value={String(editForm.priority)}
                                    onChange={val => setEditForm(f => ({ ...f, priority: parseInt(val) }))}
                                    options={[
                                        { value: String(Priority.Low), label: 'Low' },
                                        { value: String(Priority.Medium), label: 'Medium' },
                                        { value: String(Priority.High), label: 'High' },
                                        { value: String(Priority.Critical), label: 'Critical' },
                                    ]}
                                />
                            </div>
                            <div>
                                <label style={{ ...labelStyle, marginBottom: '4px' }}>Milestone</label>
                                <AppSelect
                                    value={editForm.milestoneId}
                                    onChange={val => setEditForm(f => ({ ...f, milestoneId: val }))}
                                    placeholder="No Milestone"
                                    options={[
                                        { value: '', label: 'No Milestone' },
                                        ...milestones.filter(m => m.status !== MilestoneStatus.Cancelled).map(m => ({
                                            value: getMilestoneOptionId(m),
                                            label: m.name,
                                        })),
                                    ]}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            {(() => {
                                const minD = (editMilestoneStart && editMilestoneStart > today) ? editMilestoneStart : today;
                                const maxD = editMilestoneEnd || '';
                                return (
                                    <>
                                        <div>
                                            <label style={{ ...labelStyle, marginBottom: '4px' }}>Start Date</label>
                                            <input type="date" value={editForm.startDate} min={minD} max={editForm.dueDate || maxD}
                                                onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))}
                                                style={{ ...inputStyle, border: editStartDateHasError ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0' }} />
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, marginBottom: '4px' }}>Due Date</label>
                                            <input type="date" value={editForm.dueDate} min={editForm.startDate || minD} max={maxD}
                                                onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))}
                                                style={{ ...inputStyle, border: editDueDateHasError ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0' }} />
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Assignee dropdown */}
                        <div>
                            <label style={{ ...labelStyle, marginBottom: '4px' }}>Assignee</label>
                            {(() => {
                                const assigneeKey = '__edit_assignee__';
                                const isOpen = openAssigneeDropdownId === assigneeKey;
                                const eligible = projectMembers.filter(m => m.projectRole !== 1);
                                const selectedMember = eligible.find(m => getMemberOptionId(m) === editForm.memberId);
                                const filteredMembers = eligible.filter(m => {
                                    if (!memberSearchQuery) return true;
                                    const q = memberSearchQuery.toLowerCase();
                                    return (m.fullName || m.userName || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
                                });
                                return (
                                    <div style={{ position: 'relative' }}>
                                        <button type="button"
                                            onClick={() => { setOpenAssigneeDropdownId(isOpen ? null : assigneeKey); setMemberSearchQuery(''); }}
                                            style={{ ...inputStyle, padding: '0.5rem 0.8rem', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'white', border: isOpen ? '1.5px solid var(--primary-color)' : '1.5px solid #e2e8f0', boxShadow: isOpen ? '0 0 0 3px rgba(var(--primary-rgb), 0.1)' : 'none' }}>
                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: selectedMember ? 'var(--accent-bg)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                                                {selectedMember?.avatarUrl || selectedMember?.AvatarUrl
                                                    ? <img src={selectedMember.avatarUrl || selectedMember.AvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    : <User size={12} style={{ color: selectedMember ? 'var(--primary-color)' : '#94a3b8' }} />}
                                            </div>
                                            <span style={{ flex: 1, color: selectedMember ? '#1e293b' : '#94a3b8', fontWeight: selectedMember ? 600 : 400, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {selectedMember ? (selectedMember.fullName || selectedMember.userName) : 'Unassigned'}
                                            </span>
                                            <ChevronDown size={14} style={{ flexShrink: 0, color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                        </button>
                                        {isOpen && (
                                            <>
                                                <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setOpenAssigneeDropdownId(null)} />
                                                <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, width: '100%', zIndex: 9999, background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 -8px 30px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} data-dropdown-list>
                                                    <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <div style={{ position: 'relative' }}>
                                                            <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                            <input autoFocus type="text" placeholder="Search members..." value={memberSearchQuery} onChange={e => setMemberSearchQuery(e.target.value)}
                                                                style={{ width: '100%', padding: '6px 10px 6px 30px', fontSize: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', background: '#f8fafc' }} />
                                                        </div>
                                                    </div>
                                                    <div className="custom-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
                                                        <div onClick={() => { setEditForm(f => ({ ...f, memberId: '' })); setOpenAssigneeDropdownId(null); }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', cursor: 'pointer', borderRadius: '6px', background: !editForm.memberId ? '#f1f5f9' : 'transparent', transition: 'background 0.15s' }}>
                                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1' }}>
                                                                <User size={14} color="#94a3b8" />
                                                            </div>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b', fontStyle: 'italic' }}>Unassigned</div>
                                                            {!editForm.memberId && <Check size={14} style={{ marginLeft: 'auto', color: 'var(--primary-color)' }} />}
                                                        </div>
                                                        {filteredMembers.length === 0
                                                            ? <div style={{ padding: '20px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>No members found</div>
                                                            : filteredMembers.map(m => {
                                                                const mId = getMemberOptionId(m);
                                                                const isSelected = editForm.memberId === mId;
                                                                const initials = (m.fullName || m.userName || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                                                                return (
                                                                    <div key={mId}
                                                                        onClick={() => { setEditForm(f => ({ ...f, memberId: mId, supportMemberIds: f.supportMemberIds.filter(id => id !== mId) })); setOpenAssigneeDropdownId(null); }}
                                                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', cursor: 'pointer', borderRadius: '6px', background: isSelected ? '#f1f5f9' : 'transparent', transition: 'background 0.15s' }}>
                                                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                                                                            {m.avatarUrl || m.AvatarUrl
                                                                                ? <img src={m.avatarUrl || m.AvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                : <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary-color)' }}>{initials}</span>}
                                                                        </div>
                                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isSelected ? 'var(--primary-color)' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.fullName || m.userName}</div>
                                                                            <div style={{ fontSize: '0.62rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
                                                                        </div>
                                                                        {isSelected && <Check size={14} style={{ color: 'var(--primary-color)' }} />}
                                                                    </div>
                                                                );
                                                            })
                                                        }
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Collaborators dropdown */}
                        <div>
                            <label style={{ ...labelStyle, marginBottom: '4px' }}>Collaborators</label>
                            {(() => {
                                const collabKey = '__edit__';
                                const isOpen = openCollabDropdownId === collabKey;
                                const selectedIds = editForm.supportMemberIds || [];
                                const eligible = projectMembers.filter(m => getMemberOptionId(m) !== editForm.memberId);
                                const filteredMembers = eligible.filter(m => {
                                    if (!memberSearchQuery) return true;
                                    const q = memberSearchQuery.toLowerCase();
                                    return (m.fullName || m.userName || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
                                });
                                const selectedMembers = projectMembers.filter(m => selectedIds.includes(getMemberOptionId(m)));
                                return (
                                    <div style={{ position: 'relative' }}>
                                        <button type="button"
                                            onClick={() => { setOpenCollabDropdownId(isOpen ? null : collabKey); setMemberSearchQuery(''); }}
                                            style={{ ...inputStyle, padding: '0.5rem 0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'white', border: isOpen ? '1.5px solid var(--primary-color)' : '1.5px solid #e2e8f0', boxShadow: isOpen ? '0 0 0 3px rgba(var(--primary-rgb), 0.1)' : 'none' }}>
                                            {selectedMembers.length > 0 ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                                        {selectedMembers.slice(0, 3).map((m, idx) => (
                                                            <div key={getMemberOptionId(m)} style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'white', border: '1.5px solid white', marginLeft: idx > 0 ? '-10px' : 0, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 3 - idx }}>
                                                                {m.avatarUrl || m.AvatarUrl
                                                                    ? <img src={m.avatarUrl || m.AvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    : <div style={{ width: '100%', height: '100%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--primary-color)' }}>{(m.fullName || m.userName || '?')[0].toUpperCase()}</div>}
                                                            </div>
                                                        ))}
                                                        {selectedMembers.length > 3 && (
                                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f1f5f9', border: '1.5px solid white', marginLeft: '-10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, color: '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 0 }}>+{selectedMembers.length - 3}</div>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedMembers.length} member(s)</span>
                                                </div>
                                            ) : (
                                                <span style={{ flex: 1, color: '#94a3b8', fontSize: '0.85rem' }}>Select collaborators</span>
                                            )}
                                            <ChevronDown size={14} style={{ flexShrink: 0, color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                        </button>
                                        {isOpen && (
                                            <>
                                                <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setOpenCollabDropdownId(null)} />
                                                <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, width: '100%', zIndex: 9999, background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 -8px 30px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} data-dropdown-list>
                                                    <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <div style={{ position: 'relative' }}>
                                                            <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                            <input autoFocus type="text" placeholder="Search members..." value={memberSearchQuery} onChange={e => setMemberSearchQuery(e.target.value)}
                                                                style={{ width: '100%', padding: '6px 10px 6px 30px', fontSize: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', background: '#f8fafc' }} />
                                                        </div>
                                                    </div>
                                                    <div className="custom-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
                                                        {filteredMembers.length === 0
                                                            ? <div style={{ padding: '20px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>No members found</div>
                                                            : filteredMembers.map(m => {
                                                                const mId = getMemberOptionId(m);
                                                                const isSelected = selectedIds.includes(mId);
                                                                const initials = (m.fullName || m.userName || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                                                                return (
                                                                    <div key={mId}
                                                                        onClick={() => setEditForm(f => ({ ...f, supportMemberIds: isSelected ? f.supportMemberIds.filter(id => id !== mId) : [...f.supportMemberIds, mId] }))}
                                                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', cursor: 'pointer', borderRadius: '6px', background: isSelected ? '#f1f5f9' : 'transparent', transition: 'background 0.15s' }}>
                                                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                                                                            {m.avatarUrl || m.AvatarUrl
                                                                                ? <img src={m.avatarUrl || m.AvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                : <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary-color)' }}>{initials}</span>}
                                                                        </div>
                                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isSelected ? 'var(--primary-color)' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.fullName || m.userName}</div>
                                                                            <div style={{ fontSize: '0.62rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
                                                                        </div>
                                                                        {isSelected && <Check size={14} style={{ color: 'var(--primary-color)' }} />}
                                                                    </div>
                                                                );
                                                            })
                                                        }
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {/* View mode: assignee + collaborators */}
                {!isEditMode && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                        <div>
                            <label style={{ ...labelStyle, marginBottom: '4px' }}>Timeline</label>
                            <div style={{ fontSize: '0.75rem', color: '#1e293b', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '0.65rem' }}>Start Date</span>
                                <span>{formatProjectDate(activeTask.startDate || undefined)}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '0.65rem', marginTop: '6px' }}>Due Date</span>
                                <span>{formatProjectDate(activeTask.dueDate || undefined)}</span>
                            </div>
                        </div>
                        <div>
                            <label style={{ ...labelStyle, marginBottom: '4px' }}>Milestone</label>
                            {(() => {
                                const m = resolveMilestone(
                                    (activeTask as any).milestoneId || (activeTask as any).milestoneID ||
                                    (activeTask as any).milestone_id || (activeTask as any).milestone?.milestoneId ||
                                    (activeTask as any).milestone?.id || (activeTask as any).milestone?.name
                                ) || selectedTaskMilestone;
                                return <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{m ? m.name : 'No Milestone'}</div>;
                            })()}
                        </div>
                    </div>
                )}

                {!isEditMode && (
                    <div>
                        <label style={labelStyle}>Assignee</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '28px', height: '28px', background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <User size={14} color="#64748b" />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                                        {(activeTask as any).member?.fullName || (activeTask as any).member?.userName || (activeTask as any).member?.name || (activeTask as any).assigneeName || (activeTask as any).assignedToName || 'Unassigned'}
                                    </div>
                                    {((activeTask as any).member?.email || (activeTask as any).assigneeEmail || (activeTask as any).memberEmail) && (
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '1px' }}>
                                            {(activeTask as any).member?.email || (activeTask as any).assigneeEmail || (activeTask as any).memberEmail}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {(() => {
                                const collabs = getTaskCollaboratorEntries(activeTask);
                                if (collabs.length === 0) return (
                                    <div style={{ marginTop: '0.25rem' }}>
                                        <label style={labelStyle}>Collaborators (0)</label>
                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>No collaborators</div>
                                    </div>
                                );
                                return (
                                    <div style={{ marginTop: '0.25rem' }}>
                                        <label style={labelStyle}>Collaborators ({collabs.length})</label>
                                        <div style={{ ...inputStyle, background: 'white', padding: '8px 10px', maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }} className="custom-scrollbar">
                                            {collabs.map((collab: any) => (
                                                <div key={collab.id || collab.fullName} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '24px', height: '24px', background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <User size={12} color="#64748b" />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b' }}>{collab.fullName}</div>
                                                        {collab.email && <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{collab.email}</div>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {!isEditMode && (
                    <div>
                        <label style={labelStyle}>Task Description</label>
                        <div style={{ fontSize: '0.85rem', color: '#445469', lineHeight: 1.6, background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>{activeTask.description || 'No description provided.'}</div>
                    </div>
                )}

                {!isEditMode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Evidence Section */}
                        {(() => {
                            const canUpload = [TaskStatus.Todo, TaskStatus.InProgress, TaskStatus.Adjusting, TaskStatus.Missed].includes(activeTask.status) &&
                                ((activeTask as any).isAssignee === true || viewContext === 'personal');
                            const drafts = evidenceFiles[taskId] || [];
                            const uploaded = uploadedEvidences[taskId] || [];
                            const hasRecords = uploaded.length > 0 || drafts.length > 0;
                            if (!canUpload && !hasRecords) return null;
                            return (
                                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Evidence Management</span>
                                            {canUpload && (uploaded.length + drafts.length === 0) && (
                                                <div title="Upload at least 1 evidence" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', cursor: 'help' }} />
                                            )}
                                        </div>
                                        <button onClick={() => { setIsEvidenceModalOpen(true); if (uploaded.length > 0) setPreviewEvidence(uploaded[0]); }}
                                            style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Search size={12} /> View Detail
                                        </button>
                                    </div>
                                    {canUpload && (
                                        <div style={{ position: 'relative', padding: '1rem', border: '1.5px dashed #cbd5e1', borderRadius: '12px', textAlign: 'center', background: (drafts.length + uploaded.length) >= 5 ? '#f8fafc' : 'white', transition: 'all 0.2s', opacity: ((submittingId === taskId) || (drafts.length + uploaded.length) >= 5) ? 0.6 : 1, pointerEvents: ((submittingId === taskId) || (drafts.length + uploaded.length) >= 5) ? 'none' : 'auto' }}>
                                            <input key={fileInputKey} type="file" multiple accept={ALLOWED_ACCEPT} disabled={(submittingId === taskId) || (drafts.length + uploaded.length) >= 5}
                                                onChange={e => handleFileChange(taskId, e)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                                            <Upload size={18} style={{ color: '#94a3b8', marginBottom: '4px' }} />
                                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>
                                                {(drafts.length + uploaded.length) >= 5 ? 'FILE LIMIT REACHED (MAX 5)' : 'Click or drag to add files (Max 10MB)'}
                                            </div>
                                        </div>
                                    )}
                                    {hasRecords && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: (submittingId === taskId) ? 0.8 : 1 }}>
                                            <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: (drafts.length + uploaded.length) >= 3 ? 'auto' : 'visible', paddingRight: '2px' }}>
                                                {uploaded.map((ev: any) => (
                                                    <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'white', borderRadius: '8px', fontSize: '0.65rem', border: '1px solid #e2e8f0' }}>
                                                        <Check size={12} color="#10b981" />
                                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', color: '#475569', fontWeight: 500 }}>{ev.fileName}</span>
                                                        {canUpload && (submittingId !== taskId) && (
                                                            <button onClick={() => handleDeleteEvidence(taskId, ev.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}>
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {drafts.map((f, i) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.65rem', border: '1px solid #e2e8f0' }}>
                                                        <Paperclip size={12} color="#64748b" />
                                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', color: '#475569', fontWeight: 500 }}>{f.name}</span>
                                                        {canUpload && (submittingId !== taskId) && (
                                                            <button onClick={() => removeFile(taskId, i)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}>
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {canUpload && drafts.length > 0 && (
                                        <div style={{ marginTop: '0.25rem' }}>
                                            <button type="button" onClick={e => { e.preventDefault(); handleUploadEvidence(taskId); }} disabled={submittingId === taskId}
                                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontWeight: 800, fontSize: '0.75rem', cursor: submittingId === taskId ? 'not-allowed' : 'pointer', background: 'white', color: 'var(--accent-color)', border: '2px solid var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                {submittingId === taskId ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                                UPLOAD EVIDENCE
                                            </button>
                                        </div>
                                    )}
                                    {canUpload && [TaskStatus.InProgress, TaskStatus.Adjusting, TaskStatus.Missed].includes(activeTask.status) && (
                                        <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                                            <button type="button" onClick={e => { e.preventDefault(); setPendingSubmitTaskId(taskId); }} disabled={(submittingId === taskId) || (uploaded.length === 0)}
                                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontWeight: 800, fontSize: '0.75rem', cursor: (uploaded.length === 0) ? 'not-allowed' : 'pointer', background: (uploaded.length === 0) ? '#f1f5f9' : 'white', color: (uploaded.length === 0) ? '#94a3b8' : 'var(--accent-color)', border: `2px solid ${(uploaded.length === 0) ? '#e2e8f0' : 'var(--accent-color)'}` }}>
                                                {(submittingId === taskId) ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                                {(uploaded.length === 0) ? 'SUBMIT BLOCKED (UPLOAD FIRST)' : 'SUBMIT FOR REVIEW'}
                                            </button>
                                        </div>
                                    )}
                                    {successMessages[taskId] && <div style={{ color: '#10b981', fontSize: '0.65rem', fontWeight: 700, marginTop: '4px' }}>{successMessages[taskId]}</div>}
                                    {errorMessages[taskId] && <div style={{ color: '#ef4444', fontSize: '0.65rem', fontWeight: 700, marginTop: '4px' }}>{errorMessages[taskId]}</div>}
                                </div>
                            );
                        })()}

                        {/* Start Task */}
                        {activeTask.status === TaskStatus.Todo && ((activeTask as any).isAssignee === true || viewContext === 'personal') && (
                            <button onClick={() => handleStartTask(taskId)} disabled={submittingId === taskId}
                                style={{ padding: '0.85rem', background: 'white', color: 'var(--primary-color)', border: '1.5px solid var(--primary-color)', borderRadius: '12px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)', transition: 'all 0.2s' }}
                                onMouseOver={e => e.currentTarget.style.background = '#fff8f2'}
                                onMouseOut={e => e.currentTarget.style.background = 'white'}>
                                {submittingId === taskId ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />} START THIS TASK
                            </button>
                        )}

                        {/* Approve / Adjust */}
                        {isSpecialRole && !(activeTask as any).isAssignee && activeTask.status === TaskStatus.Submitted && (
                            <div style={{ display: 'flex', gap: '10px', width: '100%', marginBottom: '1rem' }}>
                                <button onClick={() => setPendingAdjustTaskId(taskId)} disabled={submittingId !== null}
                                    style={{ flex: 1, padding: '0.85rem', background: '#fff1f2', color: '#e11d48', border: '1.5px solid #fecdd3', borderRadius: '12px', fontWeight: 800, fontSize: '0.75rem', cursor: submittingId !== null ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', opacity: submittingId !== null ? 0.6 : 1 }}
                                    onMouseOver={e => { if (!submittingId) e.currentTarget.style.background = '#ffe4e6'; }}
                                    onMouseOut={e => { e.currentTarget.style.background = '#fff1f2'; }}>
                                    {submittingId === taskId ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />} REQUEST ADJUST
                                </button>
                                <button onClick={() => setPendingApproveTaskId(taskId)} disabled={submittingId !== null}
                                    style={{ flex: 1, padding: '0.85rem', background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0', borderRadius: '12px', fontWeight: 800, fontSize: '0.75rem', cursor: submittingId !== null ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', opacity: submittingId !== null ? 0.6 : 1 }}
                                    onMouseOver={e => { if (!submittingId) e.currentTarget.style.background = '#dcfce7'; }}
                                    onMouseOut={e => { e.currentTarget.style.background = '#f0fdf4'; }}>
                                    {submittingId === taskId ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} APPROVE TASK
                                </button>
                            </div>
                        )}

                        {/* Observer notice */}
                        {!(activeTask as any).isAssignee && viewContext !== 'personal' && !isSpecialRole && (
                            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.75rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                <User size={24} style={{ opacity: 0.2, marginBottom: '8px' }} />
                                <div>Viewing as Observer. Actions restricted to the assignee.</div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Evidence Inspector Modal */}
            {isEvidenceModalOpen && (
                <div onClick={() => setIsEvidenceModalOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)' }}>
                    <div onClick={e => e.stopPropagation()} style={{ width: '900px', maxWidth: '95vw', background: 'white', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'default', border: '1px solid #e2e8f0' }}>
                        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                            <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>evidence detail</h4>
                            <button onClick={() => setIsEvidenceModalOpen(false)} style={{ border: 'none', background: 'rgba(241,245,249,0.7)', backdropFilter: 'blur(8px)', color: '#64748b', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', padding: 0 }}
                                onMouseOver={e => e.currentTarget.style.background = 'rgba(226,232,240,0.9)'}
                                onMouseOut={e => e.currentTarget.style.background = 'rgba(241,245,249,0.7)'}>
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', height: '500px' }}>
                            {/* LEFT: preview */}
                            <div className="custom-scrollbar" style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', background: '#fafafa' }}>
                                {previewEvidence ? (
                                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ padding: '1.25rem', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-sm)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <div style={{ overflow: 'hidden' }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{previewEvidence.fileName}</div>
                                                    {(() => {
                                                        const dateVal = previewEvidence.uploadedDate || previewEvidence.createdDate;
                                                        if (!dateVal) return null;
                                                        const d = new Date(dateVal);
                                                        if (isNaN(d.getTime())) return null;
                                                        return <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Submitted on {d.toLocaleDateString()} at {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>;
                                                    })()}
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                    <a href={getInlineCloudinaryRawUrl(previewEvidence.fileUrl)} download={previewEvidence.fileName} rel="noopener noreferrer"
                                                        style={{ padding: '0.5rem 0.85rem', background: '#1e293b', color: 'white', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Download size={12} /> Download
                                                    </a>
                                                    <button onClick={() => handleDeleteEvidence(taskId, previewEvidence.id)}
                                                        style={{ padding: '0.5rem 0.85rem', background: '#fff1f1', color: '#ef4444', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 700, border: '1px solid #fee2e2', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <X size={12} /> Delete
                                                    </button>
                                                </div>
                                            </div>
                                            {(() => {
                                                const viewer = resolveEvidenceViewer(previewEvidence);
                                                if (viewer.mode === 'image') return <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'center', minHeight: '100px' }}><img src={viewer.url} alt={previewEvidence.fileName} style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', display: 'block' }} /></div>;
                                                if (viewer.mode === 'pdf') return <div style={{ width: '100%', height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #f1f5f9' }}><iframe src={`${viewer.url}#toolbar=0&navpanes=0`} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" /></div>;
                                                if (viewer.mode === 'office') return <div style={{ width: '100%', height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #f1f5f9' }}><iframe src={viewer.url} style={{ width: '100%', height: '100%', border: 'none' }} title="Document Preview" /></div>;
                                                return (
                                                    <div style={{ width: '100%', minHeight: '140px', background: '#f8fafc', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', border: '1px dashed #cbd5e1', padding: '1rem' }}>
                                                        <Paperclip size={24} color="#94a3b8" />
                                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Visual preview unavailable</div>
                                                        <a href={viewer.url || previewEvidence.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 700, textDecoration: 'none' }}>Open file in new tab</a>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                        <Search size={32} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Select a record to inspect</div>
                                    </div>
                                )}
                            </div>
                            {/* RIGHT: file list */}
                            <div style={{ width: '280px', borderLeft: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>evidence list</h4>
                                    <span style={{ fontSize: '0.6rem', color: '#64748b' }}>{(uploadedEvidences[taskId] || []).length} evidences found</span>
                                </div>
                                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {(uploadedEvidences[taskId] || []).map((ev: any) => (
                                            <div key={ev.id} onClick={() => setPreviewEvidence(ev)}
                                                style={{ padding: '0.65rem 0.75rem', borderRadius: '8px', background: previewEvidence?.id === ev.id ? 'white' : 'transparent', border: '1px solid', borderColor: previewEvidence?.id === ev.id ? '#e2e8f0' : 'transparent', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: previewEvidence?.id === ev.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
                                                <Paperclip size={12} style={{ color: previewEvidence?.id === ev.id ? 'var(--accent-color)' : '#94a3b8', flexShrink: 0 }} />
                                                <div style={{ overflow: 'hidden', flex: 1 }}>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: previewEvidence?.id === ev.id ? '#1e293b' : '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{ev.fileName}</div>
                                                </div>
                                            </div>
                                        ))}
                                        {(uploadedEvidences[taskId] || []).length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                                                <div style={{ fontSize: '0.65rem' }}>No records found</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Modals */}
            <ConfirmModal isOpen={!!pendingSubmitTaskId} onClose={() => setPendingSubmitTaskId(null)}
                onConfirm={async () => { const id = pendingSubmitTaskId; setPendingSubmitTaskId(null); if (id) await handleSubmitForReview(id); }}
                title="Confirm Submit" message="Submit this task for review? Make sure your evidence is correct and complete."
                confirmText="Submit" cancelText="Cancel" variant="info" />
            <ConfirmModal isOpen={!!pendingApproveTaskId} onClose={() => setPendingApproveTaskId(null)}
                onConfirm={async () => { const id = pendingApproveTaskId; setPendingApproveTaskId(null); if (id) await handleApproveTask(id); }}
                title="Approve Task" message="Are you sure you want to mark this task as completed? This action cannot be undone."
                confirmText="Approve" cancelText="Cancel" variant="success" />
            <ConfirmModal isOpen={!!pendingAdjustTaskId} onClose={() => setPendingAdjustTaskId(null)}
                onConfirm={async () => { const id = pendingAdjustTaskId; setPendingAdjustTaskId(null); if (id) await handleRequestAdjusting(id); }}
                title="Request Adjustment" message="Send this task back to the assignee for adjustments? They will need to re-submit once revised."
                confirmText="Request Adjust" cancelText="Cancel" variant="danger" />

            {/* Delete Evidence Confirm */}
            {pendingDelete && (
                <div onClick={() => setPendingDelete(null)} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <div onClick={e => e.stopPropagation()} style={{ width: '300px', background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', textAlign: 'center', cursor: 'default', border: '1px solid #f1f5f9' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>Confirm Delete</h4>
                        <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>Are you sure? This action cannot be undone.</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setPendingDelete(null)} style={{ flex: 1, padding: '0.6rem', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                            <button onClick={confirmDeleteEvidence} style={{ flex: 1, padding: '0.6rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default TaskDetailPanel;
