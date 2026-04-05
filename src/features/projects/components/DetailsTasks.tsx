import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, Plus, X, LayoutGrid, User, Calendar, Loader2, Play, Send,
    Upload, Paperclip, Target, Filter, ChevronDown, Check, RotateCw, CheckCircle2, Clock, Pencil, Save
} from 'lucide-react';
import { Project, Task, TaskStatus, Priority, Milestone, MilestoneStatus } from '@/types';
import ActivityTimeline from './ActivityTimeline';
import { milestoneService, taskService } from '@/services';
import ConfirmModal from '@/components/common/ConfirmModal';

interface DetailsTasksProps {
    tasks: Task[];
    filteredTasks: Task[];
    taskSearchQuery: string;
    setTaskSearchQuery: (query: string) => void;
    taskStatusFilter: string[];
    setTaskStatusFilter: (status: string[]) => void;
    taskPriorityFilter: string[];
    setTaskPriorityFilter: (priority: string[]) => void;
    taskMilestoneFilter: string[];
    setTaskMilestoneFilter: (milestone: string[]) => void;
    viewMode: 'list' | 'timeline';
    setViewMode: (mode: 'list' | 'timeline') => void;
    canManageTasks: boolean;
    isArchived: boolean;
    newTasks: any[];
    handleAddTaskForm: () => void;
    handleRemoveTaskForm: (id: string) => void;
    handleNewTaskChange: (id: string, field: string, value: any) => void;
    handleSaveNewTask: (id: string) => void;
    milestones: Milestone[];
    projectMembers: any[];
    project: Project;
    formatProjectDate: (date: string | Date | undefined, fallback?: string) => string;
    currentUser?: any;
    currentMember: any;
    refreshTasks: () => void;
    onEditTask?: (task: Task) => void;
}

const getStatusColor = (status: TaskStatus) => {
    switch (status) {
        case TaskStatus.Todo: return { bg: '#f1f5f9', text: '#64748b', label: 'TO DO' };
        case TaskStatus.InProgress: return { bg: '#e0f2fe', text: '#0ea5e9', label: 'IN PROGRESS' };
        case TaskStatus.Submitted: return { bg: '#fef3c7', text: '#d97706', label: 'IN REVIEW' };
        case TaskStatus.Completed: return { bg: '#dcfce7', text: '#10b981', label: 'COMPLETED' };
        case TaskStatus.Missed: return { bg: '#fee2e2', text: '#ef4444', label: 'MISSED' };
        case TaskStatus.Adjusting: return { bg: '#f3e8ff', text: '#a855f7', label: 'ADJUSTING' };
        default: return { bg: '#f1f5f9', text: '#64748b', label: 'UNKNOWN' };
    }
};

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

    if (imageExts.includes(ext)) {
        return { mode: 'image' as const, url: normalizedUrl };
    }

    if (ext === 'pdf') {
        return { mode: 'pdf' as const, url: normalizedUrl };
    }

    if (officeExts.includes(ext)) {
        return {
            mode: 'office' as const,
            url: `https://docs.google.com/viewer?url=${encodeURIComponent(normalizedUrl)}&embedded=true`
        };
    }

    return { mode: 'none' as const, url: normalizedUrl };
};

// getPriorityStyle removed as it was unused

const DetailsTasks: React.FC<DetailsTasksProps> = ({
    tasks, filteredTasks, taskSearchQuery, setTaskSearchQuery,
    taskStatusFilter, setTaskStatusFilter, taskPriorityFilter, setTaskPriorityFilter,
    taskMilestoneFilter, setTaskMilestoneFilter, viewMode, setViewMode,
    canManageTasks, isArchived,
    newTasks, handleAddTaskForm, handleRemoveTaskForm, handleNewTaskChange, handleSaveNewTask,
    milestones, projectMembers, project, formatProjectDate, currentMember, refreshTasks
}) => {
    const [personalTasks, setPersonalTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const isSpecialRole = currentMember?.projectRole === 1 || currentMember?.projectRole === 4;
    const [viewContext, setViewContext] = useState<'personal' | 'all'>(isSpecialRole ? 'all' : 'personal');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [evidenceFiles, setEvidenceFiles] = useState<{ [taskId: string]: File[] }>({});
    const [uploadedEvidences, setUploadedEvidences] = useState<{ [taskId: string]: any[] }>({});
    const [errorMessages, setErrorMessages] = useState<{ [taskId: string]: string | null }>({});
    const [successMessages, setSuccessMessages] = useState<{ [taskId: string]: string | null }>({});
    const [selectedTaskDetail, setSelectedTaskDetail] = useState<Task | null>(null);

    const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
    const [previewEvidence, setPreviewEvidence] = useState<any>(null);
    const [pendingDelete, setPendingDelete] = useState<{ taskId: string, evidenceId: number } | null>(null);
    const [pendingSubmitTaskId, setPendingSubmitTaskId] = useState<string | null>(null);
    const [selectedTaskMilestone, setSelectedTaskMilestone] = useState<Milestone | null>(null);

    const [isEditMode, setIsEditMode] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '', description: '', priority: Priority.Medium as number,
        startDate: '', dueDate: '', milestoneId: '', memberId: '', supportMemberIds: [] as string[]
    });
    const [editError, setEditError] = useState<string | null>(null);
    const [editSaving, setEditSaving] = useState(false);

    const fetchPersonalTasks = useCallback(async () => {
        setLoadingTasks(true);
        try {
            const allMyTasks = await taskService.getPriorityTasks();
            const pId = project.projectId || (project as any).id;
            const filteredByProject = allMyTasks.filter((t: any) => (t.projectId || t.project?.id) === pId);
            setPersonalTasks(filteredByProject);
        } catch (error) {
            console.error('Failed to fetch personal tasks:', error);
        } finally {
            setLoadingTasks(false);
        }
    }, [project.projectId]);

    const fetchEvidences = useCallback(async (taskId: string) => {
        try {
            const evidences = await taskService.getEvidences(taskId);
            setUploadedEvidences(prev => ({ ...prev, [taskId]: evidences }));
            if (evidences.length > 0 && !previewEvidence && isEvidenceModalOpen) {
                setPreviewEvidence(evidences[0]);
            }
        } catch (error) {
            console.error(`Failed to fetch evidences for task ${taskId}:`, error);
        }
    }, [isEvidenceModalOpen, previewEvidence]);

    const loadSelectedTaskDetail = useCallback(async (taskId: string) => {
        if (!taskId) {
            setSelectedTaskDetail(null);
            setSelectedTaskMilestone(null);
            return null;
        }

        try {
            const detail = await taskService.getById(taskId);
            setSelectedTaskDetail(detail);
            return detail;
        } catch (error) {
            console.error(`Failed to fetch task detail for ${taskId}:`, error);
            setSelectedTaskDetail(null);
            setSelectedTaskMilestone(null);
            return null;
        }
    }, []);

    useEffect(() => {
        if (viewContext === 'personal') {
            fetchPersonalTasks();
        }
    }, [viewContext, fetchPersonalTasks]);

    useEffect(() => {
        if (selectedTaskId) {
            fetchEvidences(selectedTaskId);
        }
    }, [selectedTaskId, fetchEvidences]);

    useEffect(() => {
        void loadSelectedTaskDetail(selectedTaskId || '');
    }, [selectedTaskId, loadSelectedTaskDetail]);

    const displayTasks = (viewContext === 'all' ? filteredTasks : personalTasks).filter((t: Task) => {
        const matchesSearch = t.name.toLowerCase().includes(taskSearchQuery.toLowerCase());
        const matchesStatus = taskStatusFilter.length === 0 || taskStatusFilter.includes('all') || taskStatusFilter.includes(t.status.toString());
        const matchesPriority = taskPriorityFilter.length === 0 || taskPriorityFilter.includes('all') || taskPriorityFilter.includes(t.priority.toString());
        const matchesMilestone = taskMilestoneFilter.length === 0 || taskMilestoneFilter.includes('all') || taskMilestoneFilter.includes(t.milestoneId || 'ungrouped');
        return matchesSearch && matchesStatus && matchesPriority && matchesMilestone;
    });

    const activeTask = selectedTaskDetail || (viewContext === 'all' ? tasks : personalTasks).find((t: Task) => (t.taskId || (t as any).id) === selectedTaskId);

    useEffect(() => {
        let cancelled = false;

        const loadSelectedTaskMilestone = async () => {
            if (!activeTask) {
                setSelectedTaskMilestone(null);
                return;
            }

            const rawMilestoneId =
                (activeTask as any)?.milestoneId ||
                (activeTask as any)?.milestoneID ||
                (activeTask as any)?.milestone_id ||
                (activeTask as any)?.milestone?.milestoneId ||
                (activeTask as any)?.milestone?.id ||
                (activeTask as any)?.milestone?.name ||
                (activeTask as any)?.milestoneName ||
                (typeof (activeTask as any)?.milestone === 'string' ? (activeTask as any).milestone : '') ||
                '';

            const localMilestone = resolveMilestone(rawMilestoneId);
            if (localMilestone) {
                setSelectedTaskMilestone(localMilestone);
                return;
            }

            if (!rawMilestoneId) {
                setSelectedTaskMilestone(null);
                return;
            }

            try {
                const fetchedMilestone = await milestoneService.getById(String(rawMilestoneId));
                if (!cancelled) {
                    setSelectedTaskMilestone(fetchedMilestone);
                }
            } catch (error) {
                if (!cancelled) {
                    setSelectedTaskMilestone(null);
                }
            }
        };

        loadSelectedTaskMilestone();

        return () => {
            cancelled = true;
        };
    }, [activeTask, milestones]);

    const normalizeId = (value: any): string => value === undefined || value === null ? '' : String(value);
    const toDateInput = (value: any): string => {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    const resolveMilestone = (rawId: any): Milestone | undefined => {
        const target = normalizeId(rawId).toLowerCase();
        if (!target) return undefined;
        return milestones.find((m: any) => {
            const identifiers = [m.milestoneId, m.id, m.ID, m.name, m.milestoneName].map(v => normalizeId(v).toLowerCase()).filter(Boolean);
            return identifiers.includes(target);
        });
    };

    const getMilestoneOptionId = (milestone: any): string => {
        return normalizeId(milestone?.milestoneId || milestone?.id || milestone?.ID || milestone?.milestoneID);
    };

    const findMemberId = (rawIdOrEmail: any): string => {
        const target = normalizeId(rawIdOrEmail).toLowerCase();
        if (!target) return '';
        const matched = projectMembers.find((m: any) => {
            const identifiers = [m.membershipId, m.memberId, m.email, m.userId, m.id, m.fullName, m.userName, m.name, m.memberEmail].map(v => normalizeId(v).toLowerCase()).filter(Boolean);
            return identifiers.includes(target);
        });
        if (matched) {
            // Priority for GUID-like identifiers
            const guid = matched.membershipId || matched.memberId || matched.userId || (matched.id?.length > 20 ? matched.id : '');
            return normalizeId(guid);
        }
        // Fallback for direct GUID-like inputs
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

            return {
                id,
                fullName,
                email: matchedMember?.email || ''
            };
        }).filter((item: any) => !!item.id || !!item.fullName);
    };

    const today = toDateInput(new Date());

    const selectedEditMilestone = resolveMilestone(editForm.milestoneId);
    const editMilestoneStart = toDateInput(selectedEditMilestone?.startDate);
    const editMilestoneEnd = toDateInput(selectedEditMilestone?.dueDate);

    // Initial values to check for changes
    const originalStart = toDateInput(activeTask?.startDate);
    const originalDue = toDateInput(activeTask?.dueDate);
    const rawActiveMilestoneId =
        (activeTask as any)?.milestoneId ||
        (activeTask as any)?.milestoneID ||
        (activeTask as any)?.milestone_id ||
        (activeTask as any)?.milestone?.milestoneId ||
        (activeTask as any)?.milestone?.id ||
        (activeTask as any)?.milestone?.name ||
        (activeTask as any)?.milestoneName ||
        (typeof (activeTask as any)?.milestone === 'string' ? (activeTask as any).milestone : '') ||
        '';
    const originalMilestoneId = resolveMilestone(rawActiveMilestoneId)?.milestoneId || '';

    // Only validate if a field was actually modified by the user
    const isStartDirty = editForm.startDate !== originalStart;
    const isDueDirty = editForm.dueDate !== originalDue;
    const isMilestoneDirty = editForm.milestoneId !== originalMilestoneId;

    const rawActiveAssignee =
        (activeTask as any)?.member?.fullName ||
        (activeTask as any)?.member?.userName ||
        (activeTask as any)?.member?.name ||
        (activeTask as any)?.member?.email ||
        (activeTask as any)?.assignee?.email ||
        (activeTask as any)?.memberEmail ||
        (activeTask as any)?.assigneeEmail ||
        (activeTask as any)?.memberId ||
        (activeTask as any)?.assigneeId ||
        (activeTask as any)?.assigneeName ||
        '';
    const originalMemberId = findMemberId(rawActiveAssignee);
    const isMemberDirty = editForm.memberId !== originalMemberId;

    const invalidEditStartInPast = isStartDirty && !!editForm.startDate && editForm.startDate < today;
    const invalidEditDueInPast = isDueDirty && !!editForm.dueDate && editForm.dueDate < today;
    const invalidEditStartAfterDue = (isStartDirty || isDueDirty) && !!editForm.startDate && !!editForm.dueDate && editForm.startDate > editForm.dueDate;
    const invalidEditStartBeforeMilestone = (isStartDirty || isMilestoneDirty) && !!selectedEditMilestone && !!editForm.startDate && !!editMilestoneStart && editForm.startDate < editMilestoneStart;
    const invalidEditDueAfterMilestone = (isDueDirty || isMilestoneDirty) && !!selectedEditMilestone && !!editForm.dueDate && !!editMilestoneEnd && editForm.dueDate > editMilestoneEnd;

    const editStartDateHasError = invalidEditStartInPast || invalidEditStartAfterDue || invalidEditStartBeforeMilestone;
    const editDueDateHasError = invalidEditDueInPast || invalidEditStartAfterDue || invalidEditDueAfterMilestone;
    const editMilestoneHasError = invalidEditStartBeforeMilestone || invalidEditDueAfterMilestone;

    const handleFileChange = (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const currentFiles = evidenceFiles[taskId] || [];
            const MAX_SIZE = 10 * 1024 * 1024; // 10MB
            const MAX_FILES = 5;

            // Check total files (drafts + already uploaded)
            const alreadyUploadedCount = (uploadedEvidences[taskId] || []).length;
            if (currentFiles.length + newFiles.length + alreadyUploadedCount > MAX_FILES) {
                setErrorMessages(prev => ({ ...prev, [taskId]: `You can only have a maximum of ${MAX_FILES} evidence files total. (Currently have ${alreadyUploadedCount} uploaded and ${currentFiles.length} drafts).` }));
                return;
            }

            const largeFiles = newFiles.filter(f => f.size > MAX_SIZE);
            if (largeFiles.length > 0) {
                setErrorMessages(prev => ({ ...prev, [taskId]: `Some files exceed the 10MB limit: ${largeFiles.map(f => f.name).join(', ')}` }));
                return;
            }

            setEvidenceFiles(prev => ({
                ...prev,
                [taskId]: [...currentFiles, ...newFiles]
            }));
            setErrorMessages(prev => ({ ...prev, [taskId]: null }));
        }
    };

    const removeFile = (taskId: string, index: number) => {
        setEvidenceFiles(prev => ({
            ...prev,
            [taskId]: (prev[taskId] || []).filter((_: any, i: number) => i !== index)
        }));
    };

    const handleDeleteEvidence = (taskId: string, evidenceId: number) => {
        setPendingDelete({ taskId, evidenceId });
    };

    const refreshSelectedTaskViews = useCallback(async (taskId: string) => {
        await Promise.all([
            loadSelectedTaskDetail(taskId),
            fetchEvidences(taskId),
        ]);
        refreshTasks();
        if (viewContext === 'personal') {
            fetchPersonalTasks();
        }
    }, [fetchEvidences, fetchPersonalTasks, loadSelectedTaskDetail, refreshTasks, viewContext]);

    const handleUploadEvidence = async (taskId: string) => {
        // Safety: ensure we don't have a submit-confirm open while uploading
        setPendingSubmitTaskId(null);
        const drafts = evidenceFiles[taskId] || [];

        if (drafts.length === 0) {
            setErrorMessages(prev => ({ ...prev, [taskId]: 'Please select at least 1 file first.' }));
            return;
        }

        setErrorMessages(prev => ({ ...prev, [taskId]: null }));
        setSuccessMessages(prev => ({ ...prev, [taskId]: null }));
        setSubmittingId(taskId);
        try {
            await taskService.uploadEvidences(taskId, drafts);
            setEvidenceFiles(prev => {
                const next = { ...prev };
                delete next[taskId];
                return next;
            });
            await refreshSelectedTaskViews(taskId);
            setSuccessMessages(prev => ({ ...prev, [taskId]: 'Evidence uploaded successfully.' }));
        } catch (error: any) {
            console.error('Failed to upload evidence:', error);
            setErrorMessages(prev => ({ ...prev, [taskId]: error.message || 'Failed to upload evidence.' }));
        } finally {
            setSubmittingId(null);
        }
    };

    const confirmDeleteEvidence = async () => {
        if (!pendingDelete) return;
        const { taskId, evidenceId } = pendingDelete;
        try {
            await taskService.deleteEvidence(taskId, evidenceId);
            await fetchEvidences(taskId);
            // If the deleted evidence was being previewed, clear it
            if (previewEvidence?.id === evidenceId) {
                setPreviewEvidence(null);
            }
        } catch (error: any) {
            console.error('Failed to delete evidence:', error);
            setErrorMessages(prev => ({ ...prev, [taskId]: error.message || 'Failed to delete file.' }));
        } finally {
            setPendingDelete(null);
        }
    };


    const handleSubmitForReview = async (taskId: string) => {
        const uploadedCount = (uploadedEvidences[taskId] || []).length;

        if (uploadedCount === 0) {
            setErrorMessages(prev => ({ ...prev, [taskId]: 'Upload evidence successfully before submitting.' }));
            return;
        }

        setErrorMessages(prev => ({ ...prev, [taskId]: null }));
        setSuccessMessages(prev => ({ ...prev, [taskId]: null }));
        setSubmittingId(taskId);
        try {
            await taskService.updateStatus(taskId, TaskStatus.Submitted);
            await refreshSelectedTaskViews(taskId);
            refreshTasks();
            if (viewContext === 'personal') fetchPersonalTasks();
            setSuccessMessages(prev => ({ ...prev, [taskId]: 'Task submitted for review successfully.' }));
        } catch (error: any) {
            console.error('Failed to submit for review:', error);
            setErrorMessages(prev => ({ ...prev, [taskId]: error.message || 'Failed to submit.' }));
        } finally {
            setSubmittingId(null);
        }
    };

    const handleApproveTask = async (taskId: string) => {
        setSubmittingId(taskId);
        try {
            await taskService.updateStatus(taskId, TaskStatus.Completed);
            await refreshSelectedTaskViews(taskId);
            refreshTasks();
            if (viewContext === 'personal') fetchPersonalTasks();
        } catch (error: any) {
            console.error('Failed to approve task:', error);
            setErrorMessages(prev => ({ ...prev, [taskId]: error.message || 'Failed to approve task.' }));
        } finally {
            setSubmittingId(null);
        }
    };

    const handleRequestAdjusting = async (taskId: string) => {
        setSubmittingId(taskId);
        try {
            await taskService.updateStatus(taskId, TaskStatus.Adjusting);
            await refreshSelectedTaskViews(taskId);
            refreshTasks();
            if (viewContext === 'personal') fetchPersonalTasks();
        } catch (error: any) {
            console.error('Failed to request adjusting:', error);
            setErrorMessages(prev => ({ ...prev, [taskId]: error.message || 'Failed to request adjusting.' }));
        } finally {
            setSubmittingId(null);
        }
    };

    const handleEditSave = async () => {
        if (!activeTask) return;
        const tId = activeTask.taskId || (activeTask as any).id;

        if (!editForm.name.trim()) {
            setEditError('Task name is required.');
            return;
        }

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

        if (isMemberDirty) {
            updatePayload.memberId = editForm.memberId || null;
        }

        if (isStartDirty) {
            updatePayload.startDate = editForm.startDate ? new Date(editForm.startDate).toISOString() : null;
        }
        if (isDueDirty) {
            updatePayload.dueDate = editForm.dueDate ? new Date(editForm.dueDate).toISOString() : null;
        }

        try {
            await taskService.update(tId, updatePayload);
            await refreshSelectedTaskViews(tId);
            setIsEditMode(false);
            refreshTasks();
            if (viewContext === 'personal') fetchPersonalTasks();
        } catch (err: any) {
            setEditError(err.message || 'Failed to save changes.');
        } finally {
            setEditSaving(false);
        }
    };

    const handleStartTask = async (taskId: string) => {
        const task = (viewContext === 'all' ? tasks : personalTasks).find((t: Task) => (t.taskId || (t as any).id) === taskId);
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
            refreshTasks();
            if (viewContext === 'personal') {
                fetchPersonalTasks();
            }
        } catch (error: any) {
            console.error('Failed to start task:', error);
            setErrorMessages(prev => ({ ...prev, [taskId]: error.message || 'Failed to start task.' }));
        } finally {
            setSubmittingId(null);
        }
    };

    const handleAddNewClick = () => {
        setIsAddingNew(true);
        setSelectedTaskId(null);
        setSelectedTaskDetail(null);
        setSelectedTaskMilestone(null);
        handleAddTaskForm();
    };

    const onSaveTask = async (id: string) => {
        setSubmittingId(id);
        try {
            await handleSaveNewTask(id);
            // Parent's handleSaveNewTask already handles errors and success toasts
            // We just need to ensure we sync our local "My Tasks" view
            if (viewContext === 'personal') {
                fetchPersonalTasks();
            }
            // If the user wants to add multiple, they can click again, but typically
            // it's cleaner to close it after success.
            const stillHasForm = (newTasks.length > 0 && newTasks.find(t => t.tempId === id));
            if (!stillHasForm) {
                setIsAddingNew(false);
            }
        } finally {
            setSubmittingId(null);
        }
    };

    const onTaskSelect = (task: Task) => {
        setIsAddingNew(false);
        const tId = task.taskId || (task as any).id;
        setSelectedTaskId(tId);
        setIsEditMode(false);
        setEditError(null);
    };

    const labelStyle = {
        fontSize: '0.75rem',
        fontWeight: 500,
        color: '#475569',
        textTransform: 'uppercase',
        marginBottom: '4px',
        display: 'block',
        letterSpacing: '0.025em'
    } as const;

    const inputStyle = {
        width: '100%',
        padding: '0.65rem 0.8rem',
        borderRadius: '10px',
        border: '1.5px solid #e2e8f0',
        fontSize: '0.85rem',
        fontWeight: 400,
        background: 'white',
        outline: 'none',
        color: '#1e293b',
        transition: 'all 0.2s'
    } as const;

    if (viewMode === 'timeline') {
        return (
            <ActivityTimeline
                projectId={project.projectId || (project as any).id}
                milestones={milestones}
                projectMembers={projectMembers}
                currentMember={currentMember}
                isSpecialRole={isSpecialRole}
                viewMode={viewMode}
                setViewMode={setViewMode}
            />
        );
    }

    return (
        <div style={{ display: 'flex', gap: '1.5rem', height: '100%', alignItems: 'stretch' }}>
            {/* Column 1: Task List & Filters */}
            <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Tasks</h3>
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <button
                                onClick={() => setViewContext('personal')}
                                style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', background: viewContext === 'personal' ? 'white' : 'transparent', color: viewContext === 'personal' ? 'var(--primary-color)' : '#64748b', boxShadow: viewContext === 'personal' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                            >
                                My Tasks
                            </button>
                            <button
                                onClick={() => setViewContext('all')}
                                style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', background: viewContext === 'all' ? 'white' : 'transparent', color: viewContext === 'all' ? 'var(--primary-color)' : '#64748b', boxShadow: viewContext === 'all' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                            >
                                Project
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <button
                                onClick={() => setViewMode('list')}
                                style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', background: 'white', color: 'var(--primary-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <LayoutGrid size={12} />
                                    List View
                                </div>
                            </button>
                            <button
                                onClick={() => setViewMode('timeline')}
                                style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#64748b', boxShadow: 'none' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={12} />
                                    Timeline
                                </div>
                            </button>
                        </div>
                        {canManageTasks && !isArchived && (
                            <button onClick={handleAddNewClick} style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--primary-color)', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><Plus size={16} /> New Task</button>
                        )}
                    </div>
                </div>

                <div style={{ padding: '0.6rem 0.75rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input type="text" placeholder="Search tasks..." value={taskSearchQuery} onChange={(e) => setTaskSearchQuery(e.target.value)} style={{ ...inputStyle, padding: '0.4rem 0.5rem 0.4rem 2.2rem', fontSize: '0.75rem', borderRadius: '8px' }} />
                    </div>

                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 0.75rem',
                                border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700, color: '#475569', cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: showFilterDropdown ? '#f8fafc' : 'white',
                                borderColor: showFilterDropdown ? 'var(--primary-color)' : '#e2e8f0'
                            }}
                        >
                            <Filter size={12} style={{ color: (taskStatusFilter.length + taskPriorityFilter.length + taskMilestoneFilter.length) > 0 ? 'var(--primary-color)' : '#94a3b8' }} />
                            Filter
                            {(taskStatusFilter.length + taskPriorityFilter.length + taskMilestoneFilter.length) > 0 && (
                                <span style={{ background: 'var(--primary-color)', color: 'white', fontSize: '0.55rem', minWidth: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontWeight: 800 }}>
                                    {taskStatusFilter.length + taskPriorityFilter.length + taskMilestoneFilter.length}
                                </span>
                            )}
                            <ChevronDown size={12} style={{ opacity: 0.4, transform: showFilterDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>

                        {showFilterDropdown && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '240px', background: 'white',
                                border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, overflow: 'hidden'
                            }}>
                                <div style={{ padding: '10px', maxHeight: '400px', overflowY: 'auto' }} className="custom-scrollbar">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Filters</span>
                                        <button
                                            onClick={() => { setTaskStatusFilter([]); setTaskPriorityFilter([]); setTaskMilestoneFilter([]); }}
                                            style={{ background: 'none', border: 'none', fontSize: '0.55rem', color: '#94a3b8', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            Reset
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <section>
                                            <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                                {Object.keys(TaskStatus).filter(k => isNaN(Number(k))).map(k => {
                                                    const val = TaskStatus[k as keyof typeof TaskStatus].toString();
                                                    const isChecked = taskStatusFilter.includes(val);
                                                    return (
                                                        <div key={k} onClick={() => {
                                                            const next = isChecked ? taskStatusFilter.filter(v => v !== val) : [...taskStatusFilter, val];
                                                            setTaskStatusFilter(next);
                                                        }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', cursor: 'pointer' }}>
                                                            <div style={{ width: '10px', height: '10px', border: '1.5px solid #cbd5e1', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isChecked ? 'var(--primary-color)' : 'white', borderColor: isChecked ? 'var(--primary-color)' : '#cbd5e1' }}>
                                                                {isChecked && <Check size={6} color="white" strokeWidth={4} />}
                                                            </div>
                                                            <span style={{ fontSize: '0.6rem', fontWeight: isChecked ? 700 : 500, color: isChecked ? 'var(--text-primary)' : '#64748b' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>

                                        <section>
                                            <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', marginBottom: '4px' }}>Priority</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                                {['Low', 'Medium', 'High', 'Critical'].map((p, i) => {
                                                    const val = (i + 1).toString();
                                                    const isChecked = taskPriorityFilter.includes(val);
                                                    return (
                                                        <div key={p} onClick={() => {
                                                            const next = isChecked ? taskPriorityFilter.filter(v => v !== val) : [...taskPriorityFilter, val];
                                                            setTaskPriorityFilter(next);
                                                        }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', cursor: 'pointer' }}>
                                                            <div style={{ width: '10px', height: '10px', border: '1.5px solid #cbd5e1', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isChecked ? (val === '4' ? '#ef4444' : 'var(--primary-color)') : 'white', borderColor: isChecked ? (val === '4' ? '#ef4444' : 'var(--primary-color)') : '#cbd5e1' }}>
                                                                {isChecked && <Check size={6} color="white" strokeWidth={4} />}
                                                            </div>
                                                            <span style={{ fontSize: '0.6rem', fontWeight: isChecked ? 700 : 500, color: isChecked ? 'var(--text-primary)' : '#64748b' }}>{p}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>

                                        <section>
                                            <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', marginBottom: '4px' }}>Milestone</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <div onClick={() => {
                                                    const val = 'ungrouped';
                                                    const isChecked = taskMilestoneFilter.includes(val);
                                                    const next = isChecked ? taskMilestoneFilter.filter(v => v !== val) : [...taskMilestoneFilter, val];
                                                    setTaskMilestoneFilter(next);
                                                }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', cursor: 'pointer' }}>
                                                    <div style={{ width: '10px', height: '10px', border: '1.5px solid #cbd5e1', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: taskMilestoneFilter.includes('ungrouped') ? '#64748b' : 'white', borderColor: taskMilestoneFilter.includes('ungrouped') ? '#64748b' : '#cbd5e1' }}>
                                                        {taskMilestoneFilter.includes('ungrouped') && <Check size={6} color="white" strokeWidth={4} />}
                                                    </div>
                                                    <span style={{ fontSize: '0.6rem', fontWeight: taskMilestoneFilter.includes('ungrouped') ? 700 : 500, color: taskMilestoneFilter.includes('ungrouped') ? 'var(--text-primary)' : '#64748b' }}>Ungrouped</span>
                                                </div>
                                                {milestones.slice(0, 5).map(m => {
                                                    const val = m.milestoneId;
                                                    const isChecked = taskMilestoneFilter.includes(val);
                                                    return (
                                                        <div key={val} onClick={() => {
                                                            const next = isChecked ? taskMilestoneFilter.filter(v => v !== val) : [...taskMilestoneFilter, val];
                                                            setTaskMilestoneFilter(next);
                                                        }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', cursor: 'pointer' }}>
                                                            <div style={{ width: '10px', height: '10px', border: '1.5px solid #cbd5e1', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isChecked ? 'var(--primary-color)' : 'white', borderColor: isChecked ? 'var(--primary-color)' : '#cbd5e1' }}>
                                                                {isChecked && <Check size={6} color="white" strokeWidth={4} />}
                                                            </div>
                                                            <span style={{ fontSize: '0.6rem', fontWeight: isChecked ? 700 : 500, color: isChecked ? 'var(--text-primary)' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ flex: 1, minHeight: 'calc(100vh - 180px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '4px' }} className="custom-scrollbar">
                    {loadingTasks ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 size={24} className="animate-spin-slow" style={{ opacity: 0.3, margin: '0 auto' }} /></div>
                    ) : displayTasks.length > 0 ? (
                        displayTasks.map(task => {
                            const tId = task.taskId || (task as any).id;
                            const isActive = selectedTaskId === tId;
                            const sStyle = getStatusColor(task.status);
                            return (
                                <div key={tId} onClick={() => onTaskSelect(task)} style={{
                                    padding: '1rem', background: 'white', border: `1px solid ${isActive ? 'var(--primary-color)' : '#e2e8f0'}`, borderRadius: '12px', cursor: 'pointer',
                                    transition: 'all 0.2s', boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                                }}>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: isActive ? 'var(--primary-color)' : '#1e293b', marginBottom: '8px' }}>{task.name}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Calendar size={12} /> {formatProjectDate(task.dueDate || undefined)}
                                        </div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: sStyle.bg, color: sStyle.text }}>{sStyle.label}</div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ textAlign: 'center', padding: '4rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px' }}>
                            <p style={{ color: '#94a3b8', margin: 0, fontWeight: 600 }}>No tasks found.</p>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: '320px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '0.5rem', borderBottom: '2px solid #1e293b', marginBottom: '1.25rem' }}>
                    {isAddingNew ? <Plus size={18} /> : <Target size={18} />}
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase' }}>{isAddingNew ? 'Create Task' : 'Task Context'}</h4>
                </div>

                <div style={{ flex: 1, background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(0,0,0,0.03)', padding: '1.5rem', overflowY: 'auto' }} className="custom-scrollbar">
                    {isAddingNew && newTasks.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {newTasks.map(form => (
                                <div key={form.tempId} style={{ display: 'grid', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-color)' }}></div>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Draft Task</span>
                                        </div>
                                        <button
                                            onClick={() => { setIsAddingNew(false); handleRemoveTaskForm(form.tempId); }}
                                            style={{ background: '#f8fafc', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Task Name <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input type="text" style={inputStyle} value={form.name} onChange={(e) => handleNewTaskChange(form.tempId, 'name', e.target.value)} placeholder="e.g. Conduct user interviews" />
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Description <span style={{ color: '#ef4444' }}>*</span></label>
                                        <textarea
                                            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
                                            value={form.description}
                                            onChange={(e) => handleNewTaskChange(form.tempId, 'description', e.target.value)}
                                            placeholder="Write a brief overview of the research activity..."
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {(() => {
                                            const selMilestone = resolveMilestone(form.milestoneId);
                                            const mStart = toDateInput(selMilestone?.startDate);
                                            const mEnd = toDateInput(selMilestone?.dueDate);

                                            const isStartInPast = !!form.startDate && form.startDate < today;
                                            const isDueInPast = !!form.endDate && form.endDate < today;
                                            const isStartAfterDue = !!form.startDate && !!form.endDate && form.startDate > form.endDate;
                                            const isStartBeforeMilestone = !!selMilestone && !!form.startDate && !!mStart && form.startDate < mStart;
                                            const isDueAfterMilestone = !!selMilestone && !!form.endDate && !!mEnd && form.endDate > mEnd;

                                            const startHasError = isStartInPast || isStartAfterDue || isStartBeforeMilestone;
                                            const dueHasError = isDueInPast || isStartAfterDue || isDueAfterMilestone;
                                            const milestoneHasError = isStartBeforeMilestone || isDueAfterMilestone;

                                            const minDateForCreate = (mStart && mStart > today) ? mStart : today;
                                            const maxDateForCreate = mEnd || '';

                                            return (
                                                <>
                                                    <div style={{ gridColumn: 'span 2' }}>
                                                        <label style={labelStyle}>Milestone</label>
                                                        <select
                                                            style={{ ...inputStyle, border: milestoneHasError ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0' }}
                                                            value={form.milestoneId}
                                                            onChange={(e) => handleNewTaskChange(form.tempId, 'milestoneId', e.target.value)}
                                                        >
                                                            <option value="">Select Milestone</option>
                                                            {milestones
                                                                .filter(m => m.status !== MilestoneStatus.Completed && m.status !== MilestoneStatus.Cancelled)
                                                                .map(m => <option key={getMilestoneOptionId(m)} value={getMilestoneOptionId(m)}>{m.name}</option>)
                                                            }
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style={labelStyle}>Start Date <span style={{ color: '#ef4444' }}>*</span></label>
                                                        <input
                                                            type="date"
                                                            style={{ ...inputStyle, border: startHasError ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0' }}
                                                            value={form.startDate}
                                                            min={minDateForCreate}
                                                            max={form.endDate || maxDateForCreate}
                                                            onChange={(e) => handleNewTaskChange(form.tempId, 'startDate', e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={labelStyle}>Due Date <span style={{ color: '#ef4444' }}>*</span></label>
                                                        <input
                                                            type="date"
                                                            style={{ ...inputStyle, border: dueHasError ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0' }}
                                                            value={form.endDate}
                                                            min={form.startDate || minDateForCreate}
                                                            max={maxDateForCreate}
                                                            onChange={(e) => handleNewTaskChange(form.tempId, 'endDate', e.target.value)}
                                                        />
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                                        <div>
                                            <label style={labelStyle}>Priority</label>
                                            <select style={inputStyle} value={form.priority || 2} onChange={(e) => handleNewTaskChange(form.tempId, 'priority', parseInt(e.target.value))}>
                                                <option value={1}>Low</option>
                                                <option value={2}>Medium</option>
                                                <option value={3}>High</option>
                                                <option value={4}>Critical</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Assignee</label>
                                        <select
                                            style={inputStyle}
                                            value={form.assigneeId}
                                            onChange={(e) => {
                                                const nextAssigneeId = e.target.value;
                                                handleNewTaskChange(form.tempId, 'assigneeId', nextAssigneeId);
                                                const nextSupportIds = (form.supportMemberIds || []).filter((id: string) => id !== nextAssigneeId);
                                                if (nextSupportIds.length !== (form.supportMemberIds || []).length) {
                                                    handleNewTaskChange(form.tempId, 'supportMemberIds', nextSupportIds);
                                                }
                                            }}
                                        >
                                            <option value="">Unassigned</option>
                                            {projectMembers.map(m => {
                                                const id = getMemberOptionId(m);
                                                return (
                                                    <option key={id} value={id}>
                                                        {m.fullName || m.userName}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Collaborators</label>
                                        <select
                                            value=""
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                                const val = e.target.value;
                                                if (!val) return;
                                                const currentIds = form.supportMemberIds || [];
                                                const newIds = currentIds.includes(val)
                                                    ? currentIds.filter((id: string) => id !== val)
                                                    : [...currentIds, val];
                                                handleNewTaskChange(form.tempId, 'supportMemberIds', newIds);
                                            }}
                                            style={inputStyle}
                                        >
                                            <option value="">Select Collaborators ({form.supportMemberIds?.length || 0})</option>
                                            {projectMembers.filter(m => getMemberOptionId(m) !== form.assigneeId).map(m => {
                                                const mId = getMemberOptionId(m);
                                                const isSelected = (form.supportMemberIds || []).includes(mId);
                                                return (
                                                    <option key={mId} value={mId}>
                                                        {isSelected ? "✓ " : ""} {m.fullName || m.userName}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>

                                    <div style={{ marginTop: '0.5rem' }}>
                                        <button
                                            onClick={() => onSaveTask(form.tempId)}
                                            disabled={submittingId === form.tempId || !form.name || !form.description || !form.startDate || !form.endDate || (new Date(form.startDate) > new Date(form.endDate)) || form.startDate < today || form.endDate < today}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                background: 'var(--primary-color)',
                                                color: 'white',
                                                borderRadius: '10px',
                                                border: 'none',
                                                fontWeight: 800,
                                                fontSize: '0.8rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                cursor: (submittingId === form.tempId) ? 'not-allowed' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s',
                                                opacity: (submittingId === form.tempId || !form.name || !form.description || !form.startDate || !form.endDate || (new Date(form.startDate) > new Date(form.endDate)) || form.startDate < today || form.endDate < today) ? 0.6 : 1
                                            }}
                                        >
                                            {submittingId === form.tempId ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : null}
                                            {submittingId === form.tempId ? 'Creating...' : 'Create Task'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : activeTask ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Header row with title/status and edit toggle */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
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
                                {/* Edit toggle — Lab Director & Leader only */}
                                {isSpecialRole && !isEditMode && (
                                    <button
                                        onClick={() => {
                                            const rawMilestoneId =
                                                (activeTask as any).milestoneId ||
                                                (activeTask as any).milestoneID ||
                                                (activeTask as any).milestone_id ||
                                                (activeTask as any).milestone?.milestoneId ||
                                                (activeTask as any).milestone?.id ||
                                                (activeTask as any).milestone?.name ||
                                                (activeTask as any).milestoneName ||
                                                (typeof (activeTask as any).milestone === 'string' ? (activeTask as any).milestone : '') ||
                                                '';
                                            const normalizedMilestoneId = resolveMilestone(rawMilestoneId)?.milestoneId || '';

                                            const rawAssignee =
                                                (activeTask as any).member?.fullName ||
                                                (activeTask as any).member?.userName ||
                                                (activeTask as any).member?.name ||
                                                (activeTask as any).member?.email ||
                                                (activeTask as any).assignee?.email ||
                                                (activeTask as any).memberEmail ||
                                                (activeTask as any).assigneeEmail ||
                                                (activeTask as any).memberId ||
                                                (activeTask as any).assigneeId ||
                                                (activeTask as any).assigneeName ||
                                                (activeTask as any).assignedToName ||
                                                '';
                                            const normalizedAssigneeId = findMemberId(rawAssignee);

                                            const collaboratorRows =
                                                (activeTask as any).members ||
                                                (activeTask as any).supportMembers ||
                                                (activeTask as any).collaborators ||
                                                (activeTask as any).supportMemberIds ||
                                                (activeTask as any).collaboratorIds ||
                                                (activeTask as any).collaboratorNames ||
                                                [];

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
                                                supportMemberIds: normalizedCollaboratorIds,
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
                                        <button
                                            onClick={() => { setIsEditMode(false); setEditError(null); }}
                                            style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleEditSave}
                                            disabled={editSaving}
                                            style={{ background: 'var(--primary-color)', border: 'none', borderRadius: '8px', padding: '5px 10px', cursor: editSaving ? 'not-allowed' : 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: 700, opacity: editSaving ? 0.7 : 1 }}
                                        >
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
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                            style={{ ...inputStyle }}
                                            placeholder="Task name"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ ...labelStyle, marginBottom: '4px' }}>Description</label>
                                        <textarea
                                            value={editForm.description}
                                            onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                            style={{ ...inputStyle, minHeight: '72px', resize: 'vertical', fontFamily: 'inherit' }}
                                            placeholder="Description"
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ ...labelStyle, marginBottom: '4px' }}>Priority</label>
                                            <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: parseInt(e.target.value) }))} style={inputStyle}>
                                                <option value={Priority.Low}>Low</option>
                                                <option value={Priority.Medium}>Medium</option>
                                                <option value={Priority.High}>High</option>
                                                <option value={Priority.Critical}>Critical</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, marginBottom: '4px' }}>Milestone</label>
                                            <select
                                                value={editForm.milestoneId}
                                                onChange={e => setEditForm(f => ({ ...f, milestoneId: e.target.value }))}
                                                style={{ ...inputStyle, border: editMilestoneHasError ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0' }}
                                            >
                                                <option value="">No Milestone</option>
                                                {milestones.filter(m => m.status !== MilestoneStatus.Cancelled).map(m => (
                                                    <option key={getMilestoneOptionId(m)} value={getMilestoneOptionId(m)}>{m.name}</option>
                                                ))}
                                            </select>
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
                                                        <input
                                                            type="date"
                                                            value={editForm.startDate}
                                                            min={minD}
                                                            max={editForm.dueDate || maxD}
                                                            onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))}
                                                            style={{ ...inputStyle, border: editStartDateHasError ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0' }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ ...labelStyle, marginBottom: '4px' }}>Due Date</label>
                                                        <input
                                                            type="date"
                                                            value={editForm.dueDate}
                                                            min={editForm.startDate || minD}
                                                            max={maxD}
                                                            onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))}
                                                            style={{ ...inputStyle, border: editDueDateHasError ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0' }}
                                                        />
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <div>
                                        <label style={{ ...labelStyle, marginBottom: '4px' }}>Assignee</label>
                                        <select
                                            value={editForm.memberId}
                                            onChange={e => {
                                                const nextAssigneeId = e.target.value;
                                                setEditForm(f => ({
                                                    ...f,
                                                    memberId: nextAssigneeId,
                                                    supportMemberIds: f.supportMemberIds.filter(id => id !== nextAssigneeId)
                                                }));
                                            }}
                                            style={inputStyle}
                                        >
                                            <option value="">Unassigned</option>
                                            {projectMembers.filter(m => m.projectRole !== 1).map(m => {
                                                const id = getMemberOptionId(m);
                                                return <option key={id} value={id}>{m.fullName || m.userName}</option>;
                                            })}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ ...labelStyle, marginBottom: '4px' }}>Collaborators</label>
                                        <div
                                            className="custom-scrollbar"
                                            style={{
                                                ...inputStyle,
                                                background: 'white',
                                                padding: '8px 10px',
                                                maxHeight: '160px',
                                                overflowY: 'auto',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '8px'
                                            }}
                                        >
                                            {projectMembers
                                                .filter(m => getMemberOptionId(m) !== editForm.memberId)
                                                .map(m => {
                                                    const id = getMemberOptionId(m);
                                                    const checked = (editForm.supportMemberIds || []).includes(id);
                                                    return (
                                                        <label key={id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#1e293b', fontWeight: 500, cursor: 'pointer' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => {
                                                                    setEditForm(f => ({
                                                                        ...f,
                                                                        supportMemberIds: f.supportMemberIds.includes(id)
                                                                            ? f.supportMemberIds.filter(x => x !== id)
                                                                            : [...f.supportMemberIds, id]
                                                                    }));
                                                                }}
                                                            />
                                                            <span>{m.fullName || m.userName}</span>
                                                        </label>
                                                    );
                                                })}
                                            {projectMembers.filter(m => getMemberOptionId(m) !== editForm.memberId).length === 0 && (
                                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>No collaborators</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

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
                                            const m = resolveMilestone((activeTask as any).milestoneId || (activeTask as any).milestoneID || (activeTask as any).milestone_id || (activeTask as any).milestone?.milestoneId || (activeTask as any).milestone?.id || (activeTask as any).milestone?.name) || selectedTaskMilestone;
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
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                                                {(activeTask as any).member?.fullName || (activeTask as any).member?.userName || (activeTask as any).member?.name || (activeTask as any).assigneeName || (activeTask as any).assignedToName || 'Unassigned'}
                                            </div>
                                        </div>

                                        {(() => {
                                            const collabs = getTaskCollaboratorEntries(activeTask);
                                            if (collabs.length === 0) {
                                                return (
                                                    <div style={{ marginTop: '0.25rem' }}>
                                                        <label style={labelStyle}>Collaborators (0)</label>
                                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>No collaborators</div>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div style={{ marginTop: '0.25rem' }}>
                                                    <label style={labelStyle}>Collaborators ({collabs.length})</label>
                                                    <div style={{
                                                        ...inputStyle,
                                                        background: 'white',
                                                        padding: '8px 10px',
                                                        maxHeight: '120px',
                                                        overflowY: 'auto',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '6px'
                                                    }}
                                                    className="custom-scrollbar"
                                                    >
                                                        {collabs.map((collab: any) => (
                                                            <div key={collab.id || collab.fullName} style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 500 }}>
                                                                {collab.fullName}
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
                                    {/* Evidence Section - Management approach */}
                                    {(() => {
                                        const taskId = activeTask.taskId || (activeTask as any).id;
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
                                                            <div
                                                                title="Upload at least 1 evidence"
                                                                style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', cursor: 'help' }}
                                                            />
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setIsEvidenceModalOpen(true);
                                                            if (uploaded.length > 0) setPreviewEvidence(uploaded[0]);
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <Search size={12} /> View Detail
                                                    </button>
                                                </div>

                                                {/* Input Box - ONLY for uploaders */}
                                                {canUpload && (
                                                    <div style={{
                                                        position: 'relative',
                                                        padding: '1rem',
                                                        border: '1.5px dashed #cbd5e1',
                                                        borderRadius: '12px',
                                                        textAlign: 'center',
                                                        background: (drafts.length + uploaded.length) >= 5 ? '#f8fafc' : 'white',
                                                        transition: 'all 0.2s',
                                                        opacity: ((submittingId === taskId) || (drafts.length + uploaded.length) >= 5) ? 0.6 : 1,
                                                        pointerEvents: ((submittingId === taskId) || (drafts.length + uploaded.length) >= 5) ? 'none' : 'auto'
                                                    }}>
                                                        <input
                                                            type="file"
                                                            multiple
                                                            disabled={(submittingId === taskId) || (drafts.length + uploaded.length) >= 5}
                                                            onChange={(e) => handleFileChange(taskId, e)}
                                                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                                        />
                                                        <Upload size={18} style={{ color: '#94a3b8', marginBottom: '4px' }} />
                                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>
                                                            {(drafts.length + uploaded.length) >= 5 ? 'FILE LIMIT REACHED (MAX 5)' : 'Click or drag to add files (Max 10MB)'}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* File List */}
                                                {hasRecords && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: (submittingId === taskId) ? 0.8 : 1 }}>
                                                        <div className="custom-scrollbar" style={{
                                                            display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px',
                                                            overflowY: (drafts.length + uploaded.length) >= 3 ? 'auto' : 'visible',
                                                            paddingRight: '2px'
                                                        }}>
                                                            {uploaded.map((ev: any) => (
                                                                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'white', borderRadius: '8px', fontSize: '0.65rem', border: '1px solid #e2e8f0' }}>
                                                                    <Check size={12} color="#10b981" />
                                                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', color: '#475569', fontWeight: 500 }}>{ev.fileName}</span>
                                                                    {canUpload && (submittingId !== taskId) && (
                                                                        <button
                                                                            onClick={() => handleDeleteEvidence(taskId, ev.id)}
                                                                            style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                                                        >
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
                                                                        <button
                                                                            onClick={() => removeFile(taskId, i)}
                                                                            style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                                                                        >
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
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleUploadEvidence(taskId);
                                                            }}
                                                            disabled={submittingId === taskId}
                                                            style={{
                                                                width: '100%', padding: '0.75rem', borderRadius: '10px', fontWeight: 800, fontSize: '0.75rem',
                                                                cursor: submittingId === taskId ? 'not-allowed' : 'pointer',
                                                                background: 'white',
                                                                color: 'var(--accent-color)',
                                                                border: '2px solid var(--accent-color)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                                            }}
                                                        >
                                                            {submittingId === taskId ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                                            UPLOAD EVIDENCE
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Submit Actions */}
                                                {canUpload && [TaskStatus.InProgress, TaskStatus.Adjusting, TaskStatus.Missed].includes(activeTask.status) && (
                                                    <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setPendingSubmitTaskId(taskId);
                                                            }}
                                                            disabled={(submittingId === taskId) || (uploaded.length === 0)}
                                                            style={{
                                                                width: '100%', padding: '0.75rem', borderRadius: '10px', fontWeight: 800, fontSize: '0.75rem',
                                                                cursor: (uploaded.length === 0) ? 'not-allowed' : 'pointer',
                                                                background: (uploaded.length === 0) ? '#f1f5f9' : 'white',
                                                                color: (uploaded.length === 0) ? '#94a3b8' : 'var(--accent-color)',
                                                                border: `2px solid ${(uploaded.length === 0) ? '#e2e8f0' : 'var(--accent-color)'}`
                                                            }}
                                                        >
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

                                    {/* Primary Action: Start Working (Only for Todo, only for assignee) */}
                                    {activeTask.status === TaskStatus.Todo && ((activeTask as any).isAssignee === true || viewContext === 'personal') && (
                                        <button
                                            onClick={() => handleStartTask(activeTask.taskId || (activeTask as any).id)}
                                            disabled={submittingId === (activeTask.taskId || (activeTask as any).id)}
                                            style={{
                                                padding: '0.85rem',
                                                background: 'white',
                                                color: 'var(--primary-color)',
                                                border: '1.5px solid var(--primary-color)',
                                                borderRadius: '12px',
                                                fontWeight: 700,
                                                fontSize: '0.8rem',
                                                cursor: 'pointer',
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '10px',
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.03)',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = '#fff8f2'}
                                            onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                                        >
                                            {submittingId === (activeTask.taskId || (activeTask as any).id) ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />} START THIS TASK
                                        </button>
                                    )}

                                    {isSpecialRole && !(activeTask as any).isAssignee && activeTask.status === TaskStatus.Submitted && (
                                        <div style={{ display: 'flex', gap: '10px', width: '100%', marginBottom: '1rem' }}>
                                            <button
                                                onClick={() => handleRequestAdjusting(activeTask.taskId || (activeTask as any).id)}
                                                disabled={submittingId !== null}
                                                style={{ flex: 1, padding: '0.85rem', background: '#fff1f2', color: '#e11d48', border: '1.5px solid #fecdd3', borderRadius: '12px', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                                                onMouseOver={(e) => e.currentTarget.style.background = '#ffe4e6'}
                                                onMouseOut={(e) => e.currentTarget.style.background = '#fff1f2'}
                                            >
                                                <RotateCw size={14} /> REQUEST ADJUST
                                            </button>
                                            <button
                                                onClick={() => handleApproveTask(activeTask.taskId || (activeTask as any).id)}
                                                disabled={submittingId !== null}
                                                style={{ flex: 1, padding: '0.85rem', background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0', borderRadius: '12px', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                                                onMouseOver={(e) => e.currentTarget.style.background = '#dcfce7'}
                                                onMouseOut={(e) => e.currentTarget.style.background = '#f0fdf4'}
                                            >
                                                <CheckCircle2 size={14} /> APPROVE TASK
                                            </button>
                                        </div>
                                    )}

                                    {/* Restricted View Notice */}
                                    {!(activeTask as any).isAssignee && viewContext !== 'personal' && !isSpecialRole && (
                                        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.75rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                            <User size={24} style={{ opacity: 0.2, marginBottom: '8px' }} />
                                            <div>Viewing as Observer. Actions restricted to the assignee.</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                            <Target size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Select a task to review</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Evidence Inspector Modal Overlay */}
            {isEvidenceModalOpen && (
                <div
                    onClick={() => setIsEvidenceModalOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        background: 'rgba(0, 0, 0, 0.2)',
                        backdropFilter: 'blur(4px)'
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ width: '900px', maxWidth: '95vw', background: 'white', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'default', border: '1px solid #e2e8f0' }}
                    >
                        {/* Unified Modal Header */}
                        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                            <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>evidence detail</h4>
                            <button
                                onClick={() => setIsEvidenceModalOpen(false)}
                                style={{
                                    border: 'none',
                                    background: 'rgba(241, 245, 249, 0.7)',
                                    backdropFilter: 'blur(8px)',
                                    color: '#64748b',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    padding: 0
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(226, 232, 240, 0.9)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(241, 245, 249, 0.7)'}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', height: '500px' }}>
                            {/* LEFT Pane: Inspection View (70%) */}
                            <div className="custom-scrollbar" style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', background: '#fafafa' }}>
                                {previewEvidence ? (
                                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ padding: '1.25rem', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-sm)' }}>
                                            {/* Header Section - Moved to Top */}
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
                                                    <a
                                                        href={getInlineCloudinaryRawUrl(previewEvidence.fileUrl)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ padding: '0.5rem 0.85rem', background: '#1e293b', color: 'white', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                    >
                                                        <LayoutGrid size={12} /> View
                                                    </a>
                                                    <button
                                                        onClick={() => handleDeleteEvidence(activeTask?.taskId || (activeTask as any)?.id, previewEvidence.id)}
                                                        style={{ padding: '0.5rem 0.85rem', background: '#fff1f1', color: '#ef4444', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 700, border: '1px solid #fee2e2', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <X size={12} /> Delete
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Media Preview Section - Now below the title */}
                                            {(() => {
                                                const viewer = resolveEvidenceViewer(previewEvidence);

                                                if (viewer.mode === 'image') {
                                                    return (
                                                        <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'center', minHeight: '100px' }}>
                                                            <img
                                                                src={viewer.url}
                                                                alt={previewEvidence.fileName}
                                                                style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', display: 'block' }}
                                                            />
                                                        </div>
                                                    );
                                                }

                                                if (viewer.mode === 'pdf') {
                                                    return (
                                                        <div style={{ width: '100%', height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                                                            <iframe
                                                                src={`${viewer.url}#toolbar=0&navpanes=0`}
                                                                style={{ width: '100%', height: '100%', border: 'none' }}
                                                                title="PDF Preview"
                                                            />
                                                        </div>
                                                    );
                                                }

                                                if (viewer.mode === 'office') {
                                                    return (
                                                        <div style={{ width: '100%', height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                                                            <iframe
                                                                src={viewer.url}
                                                                style={{ width: '100%', height: '100%', border: 'none' }}
                                                                title="Document Preview"
                                                            />
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div style={{ width: '100%', minHeight: '140px', background: '#f8fafc', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', border: '1px dashed #cbd5e1', padding: '1rem' }}>
                                                        <Paperclip size={24} color="#94a3b8" />
                                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Visual preview unavailable</div>
                                                        <a
                                                            href={viewer.url || previewEvidence.fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 700, textDecoration: 'none' }}
                                                        >
                                                            Open file in new tab
                                                        </a>
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

                            {/* RIGHT Pane: File List (30%) - Scrollable */}
                            <div style={{ width: '280px', borderLeft: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>evidence list</h4>
                                    <span style={{ fontSize: '0.6rem', color: '#64748b' }}>{(uploadedEvidences[activeTask?.taskId || (activeTask as any)?.id] || []).length} evidences found</span>
                                </div>
                                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {(uploadedEvidences[activeTask?.taskId || (activeTask as any)?.id] || []).map((ev: any) => (
                                            <div
                                                key={ev.id}
                                                onClick={() => setPreviewEvidence(ev)}
                                                style={{
                                                    padding: '0.65rem 0.75rem',
                                                    borderRadius: '8px',
                                                    background: previewEvidence?.id === ev.id ? 'white' : 'transparent',
                                                    border: '1px solid',
                                                    borderColor: previewEvidence?.id === ev.id ? '#e2e8f0' : 'transparent',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    boxShadow: previewEvidence?.id === ev.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                                }}
                                            >
                                                <Paperclip size={12} style={{ color: previewEvidence?.id === ev.id ? 'var(--accent-color)' : '#94a3b8', flexShrink: 0 }} />
                                                <div style={{ overflow: 'hidden', flex: 1 }}>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: previewEvidence?.id === ev.id ? '#1e293b' : '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{ev.fileName}</div>
                                                </div>
                                            </div>
                                        ))}
                                        {(uploadedEvidences[activeTask?.taskId || (activeTask as any)?.id] || []).length === 0 && (
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

            <ConfirmModal
                isOpen={!!pendingSubmitTaskId}
                onClose={() => setPendingSubmitTaskId(null)}
                onConfirm={async () => {
                    const id = pendingSubmitTaskId;
                    setPendingSubmitTaskId(null);
                    if (!id) return;
                    await handleSubmitForReview(id);
                }}
                title="Confirm Submit"
                message="Submit this task for review? Make sure your evidence is correct and complete."
                confirmText="Submit"
                cancelText="Cancel"
                variant="info"
            />

            {/* Simple Delete Confirmation Overlay */}
            {pendingDelete && (
                <div
                    onClick={() => setPendingDelete(null)}
                    style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ width: '300px', background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', textAlign: 'center', cursor: 'default', border: '1px solid #f1f5f9' }}
                    >
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>Confirm Delete</h4>
                        <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>Are you sure? This action cannot be undone.</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setPendingDelete(null)}
                                style={{ flex: 1, padding: '0.6rem', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteEvidence}
                                style={{ flex: 1, padding: '0.6rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DetailsTasks;
