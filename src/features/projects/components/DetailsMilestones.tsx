import React from 'react';
import {
    Plus, Search, Calendar, Target, Edit3, X,
    Clock, Activity, CheckCircle2, User, Users, Info,
    Save, Trash2, ChevronRight, ChevronDown, CheckCircle, Timer, AlertTriangle
} from 'lucide-react';
import { Milestone, MilestoneStatus, Task } from '@/types';
import MilestoneItem from '@/components/milestone/MilestoneItem';
import { taskService } from '@/services/taskService';
import { milestoneService } from '@/services/milestoneService';
import { validateSpecialChars } from '@/utils/validation';


interface TaskDraft {
    id: string; // Internal temporary ID
    name: string;
    description: string;
    priority: number; // Low=1, Medium=2, High=3
    status: number; // Todo=1
    startDate: string;
    dueDate: string;
    assigneeId: string;
    collaboratorIds: string[];
    isSaving: boolean;
    isExpanded: boolean;
}

interface DetailsMilestonesProps {
    projectId?: string;
    milestones: Milestone[];
    filteredMilestones: Milestone[];
    milestoneSearchQuery: string;
    setMilestoneSearchQuery: (query: string) => void;
    milestoneStatusFilter: string;
    setMilestoneStatusFilter: (filter: string) => void;
    canManageMilestones: boolean;
    canManageProject: boolean;
    isArchived: boolean;
    milestoneContainerRef: React.RefObject<HTMLDivElement>;
    handleMilestoneClick: (milestone: Milestone | null) => void;
    newMilestoneData: any;
    handleMilestoneDataChange: (field: string, value: any) => void;
    handleQuickMilestoneSave: () => void;
    checkOverlap: (start: string, due: string) => boolean;
    editingMilestoneId: string | null;
    onCancelEdit: () => void;
    clearMilestoneEdit?: () => void;
    viewMode: 'roadmap' | 'detail';
    activeMilestone: Milestone | null;
    members: any[];
    refreshTasks?: () => void;
    refreshMilestones?: () => void;
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    projectStartDate?: string | null;
    projectEndDate?: string | null;
    isMilestoneSaving?: boolean;
    allTasks?: any[];
}

type FormTab = 'view' | 'edit' | 'add';

const DetailsMilestones: React.FC<DetailsMilestonesProps> = ({
    projectId,
    milestones,
    filteredMilestones,
    milestoneSearchQuery,
    setMilestoneSearchQuery,
    milestoneStatusFilter,
    setMilestoneStatusFilter,
    canManageMilestones,
    canManageProject,
    isArchived,
    milestoneContainerRef,
    handleMilestoneClick,
    newMilestoneData,
    handleMilestoneDataChange,
    handleQuickMilestoneSave,
    checkOverlap,
    editingMilestoneId,
    onCancelEdit,
    viewMode,
    activeMilestone,
    members,
    refreshTasks,
    refreshMilestones,
    showToast,
    projectStartDate,
    projectEndDate,
    isMilestoneSaving = false,
    allTasks = []
}) => {
    const milestoneIdsWithTasks = React.useMemo(() => {
        const s = new Set<string>();
        allTasks.forEach((t: any) => {
            const mid = t.milestoneId || t.milestoneID || t.milestone_id || t.milestone?.milestoneId || t.milestone?.id || '';
            if (mid) s.add(String(mid).toLowerCase());
        });
        return s;
    }, [allTasks]);
    // Standardize TODAY string using local time (YYYY-MM-DD)
    const today = new Date().toLocaleDateString('en-CA');
    const pStartFormatted = projectStartDate ? projectStartDate.split('T')[0] : today;
    const pEndFormatted = projectEndDate ? projectEndDate.split('T')[0] : '';
    const [formTab, setFormTab] = React.useState<FormTab>('view');
    const [draftTasks, setDraftTasks] = React.useState<TaskDraft[]>([]);
    const [confirmState, setConfirmState] = React.useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmLabel: string;
        cancelLabel: string;
        variant: 'danger' | 'success' | 'warning' | 'info';
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        variant: 'info',
        onConfirm: () => { }
    });
    const [milestoneTasks, setMilestoneTasks] = React.useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = React.useState(false);
    const [taskTab, setTaskTab] = React.useState<'draft' | 'current'>('current');
    const [expandedTasks, setExpandedTasks] = React.useState<string[]>([]);
    const [savingTaskId, setSavingTaskId] = React.useState<string | null>(null);

    // API Stats State
    const [milestoneStats, _setMilestoneStats] = React.useState<any>(null);
    const [_loadingStats, _setLoadingStats] = React.useState(false);

    const fetchMilestoneTasks = async (mId: string) => {
        setLoadingTasks(true);
        try {
            const tasks = await milestoneService.getTasksByMilestone(mId);
            const taskArr = Array.isArray(tasks) ? tasks : [];
            // Enrich with assignedToName from the members prop when the milestone
            // tasks endpoint does not return that field directly.
            const enriched = taskArr.map((t: any) => {
                // Normalize id → taskId so all downstream code uses task.taskId consistently
                const normalized = t.taskId ? t : { ...t, taskId: t.id || t.taskId };
                if (normalized.assignedToName) return normalized;
                const assigneeId = normalized.memberId || normalized.assignedToId;
                if (!assigneeId) return normalized;
                const found = members.find((m: any) =>
                    (m.id || m.memberId || m.membershipId || m.userId || '') === assigneeId
                );
                return found
                    ? { ...normalized, assignedToName: found.fullName || found.userName || normalized.assignedToName }
                    : normalized;
            });
            setMilestoneTasks(enriched);
        } catch (error) {
            console.error('Failed to fetch milestone tasks:', error);
        } finally {
            setLoadingTasks(false);
        }
    };

    const handleSaveDraftTask = async (draft: TaskDraft) => {
        const nameErr = validateSpecialChars(draft.name);
        if (nameErr) { showToast(`Task name: ${nameErr}`, 'error'); return; }
        const descErr = draft.description ? validateSpecialChars(draft.description) : '';
        if (descErr) { showToast(`Task description: ${descErr}`, 'error'); return; }
        setDraftTasks(prev => prev.map(d => d.id === draft.id ? { ...d, isSaving: true } : d));
        try {
            const mId = activeMilestone?.milestoneId || (activeMilestone as any)?.id || editingMilestoneId;
            const taskPayload = {
                name: draft.name,
                description: draft.description,
                priority: draft.priority,
                status: draft.status,
                memberId: draft.assigneeId,
                milestoneId: mId,
                projectId: projectId,
                startDate: draft.startDate + "T00:00:00.000Z",
                dueDate: draft.dueDate + "T23:59:59.000Z",
                supportMembers: draft.collaboratorIds
            };

            await taskService.create(taskPayload);
            showToast('Task created successfully', 'success');

            setDraftTasks(prev => prev.filter(d => d.id !== draft.id));
            if (mId) fetchMilestoneTasks(mId);
            if (refreshTasks) refreshTasks();
        } catch (error: any) {
            console.error("Failed to save task:", error);
            showToast(error.message || 'Failed to save task.', 'error');
            setDraftTasks(prev => prev.map(d => d.id === draft.id ? { ...d, isSaving: false } : d));
        }
    };

    const handleUpdateTaskField = (taskId: string, field: string, value: any) => {
        setMilestoneTasks(prev => prev.map(t => (t.taskId === taskId || (t as any).id === taskId) ? { ...t, [field]: value } : t));
    };

    const handleSaveExistingTask = async (task: any) => {
        const nameErr = validateSpecialChars(task.name || '');
        if (nameErr) { showToast(`Task name: ${nameErr}`, 'error'); return; }
        const descErr = task.description ? validateSpecialChars(task.description) : '';
        if (descErr) { showToast(`Task description: ${descErr}`, 'error'); return; }
        const taskId = task.taskId || task.id;
        if (savingTaskId === taskId) return;
        setSavingTaskId(taskId);
        try {
            // Construct base payload
            const updatePayload: any = {
                name: task.name,
                description: task.description,
                status: task.status,
                priority: task.priority,
                memberId: task.memberId || (task as any).assignedToId,
                supportMembers: task.collaboratorIds || [],
                milestoneId: activeMilestone?.milestoneId || (activeMilestone as any)?.id || editingMilestoneId,
                projectId: projectId
            };

            // Requirements: always send both start and due date
            const startDateOnly = task.startDate.includes('T') ? task.startDate.split('T')[0] : task.startDate;
            const dueDateOnly = task.dueDate.includes('T') ? task.dueDate.split('T')[0] : task.dueDate;
            updatePayload.startDate = startDateOnly + "T00:00:00.000Z";
            updatePayload.dueDate = dueDateOnly + "T23:59:59.000Z";

            await taskService.update(taskId, updatePayload);
            showToast('Changes saved successfully', 'success');

            const mId = activeMilestone?.milestoneId || (activeMilestone as any)?.id || editingMilestoneId;
            if (mId) fetchMilestoneTasks(mId);
            if (refreshTasks) refreshTasks();
        } catch (error) {
            console.error('Failed to save task changes:', error);
            showToast((error as any).message || 'Failed to save changes.', 'error');
        } finally {
            setSavingTaskId(null);
        }
    };

    const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!taskId) {
            showToast('Invalid task ID', 'error');
            return;
        }
        setConfirmState({
            isOpen: true,
            title: 'Delete Task?',
            message: 'Are you sure you want to permanently delete this task?',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await taskService.delete(taskId);
                    showToast('Task deleted successfully', 'success');
                    const mId = activeMilestone?.milestoneId || (activeMilestone as any)?.id || editingMilestoneId;
                    if (mId) fetchMilestoneTasks(mId);
                    if (refreshTasks) refreshTasks();
                } catch (error) {
                    console.error('Failed to delete task:', error);
                    showToast((error as any).message || 'Failed to delete task.', 'error');
                }
            }
        });
    };

    const toggleTaskExpand = (taskId: string) => {
        setExpandedTasks(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
    };

    const getStatusText = (status: number) => {
        switch (status) {
            case 1: return 'To Do';
            case 2: return 'In Progress';
            case 3: return 'Submitted';
            case 4: return 'Missed';
            case 5: return 'Adjusting';
            case 6: return 'Done';
            default: return 'Unknown';
        }
    };

    const getStatusColor = (status: number) => {
        switch (status) {
            case 1: return { bg: '#f1f5f9', text: '#64748b' };
            case 2: return { bg: '#eff6ff', text: '#3b82f6' };
            case 3: return { bg: '#ecfdf5', text: '#10b981' };
            case 4: return { bg: '#fef2f2', text: '#ef4444' };
            case 5: return { bg: '#fff7ed', text: '#f97316' };
            case 6: return { bg: '#f0fdf4', text: '#22c55e' };
            default: return { bg: '#f1f5f9', text: '#64748b' };
        }
    };

    // Pure UTC date arithmetic — avoids timezone shift from new Date(isoString)
    const addDays = (dateStr: string, days: number): string => {
        const plain = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const [y, m, d] = plain.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split('T')[0];
    };
    const maxDate = (a: string, b: string) => (a >= b ? a : b);

    const latestMilestoneDate = React.useMemo(() => {
        if (!milestones || milestones.length === 0) return null;
        let latest = '';
        milestones.forEach(m => {
            const d = m.dueDate ? m.dueDate.split('T')[0] : '';
            if (d && (!m.dueDate.startsWith('0001')) && d > latest) latest = d;
        });
        return latest || null;
    }, [milestones]);

    // Find first available non-overlapping start date for a new milestone (duration = 30 days)
    const getSmartDefaultStart = React.useCallback(() => {
        const DURATION = 30;
        const sorted = [...milestones]
            .filter(m => m.startDate && !m.startDate.startsWith('0001') && m.dueDate && !m.dueDate.startsWith('0001'))
            .sort((a, b) => (a.startDate.split('T')[0] > b.startDate.split('T')[0] ? 1 : -1));

        const base = maxDate(today, pStartFormatted);

        // Try to find a gap between existing milestones
        for (let i = 0; i < sorted.length; i++) {
            const gapStart = i === 0 ? base : maxDate(addDays(sorted[i - 1].dueDate, 1), base);
            const gapEnd = sorted[i].startDate.split('T')[0];
            const candidate = maxDate(gapStart, base);
            const candidateEnd = addDays(candidate, DURATION);
            if (candidateEnd <= gapEnd) {
                return candidate;
            }
        }

        // No gap found — start after the latest due date
        if (latestMilestoneDate) {
            return maxDate(addDays(latestMilestoneDate, 1), base);
        }

        return base;
    }, [milestones, today, pStartFormatted, latestMilestoneDate]);

    // State Syncing
    React.useEffect(() => {
        if (activeMilestone && (editingMilestoneId || activeMilestone.milestoneId)) {
            setFormTab('view');
            setDraftTasks([]);
            if (activeMilestone.status === MilestoneStatus.Completed || activeMilestone.status === MilestoneStatus.Cancelled) {
                setTaskTab('current');
            }
            const mId = activeMilestone.milestoneId || (activeMilestone as any).id || editingMilestoneId;
            if (mId) fetchMilestoneTasks(mId);
        } else if (viewMode === 'roadmap') {
            setFormTab('add');

            // PRE-FILL Add Milestone form with smart non-overlapping defaults
            if (!newMilestoneData.name) {
                const defaultStart = getSmartDefaultStart();

                const defaultDueStr = addDays(defaultStart, 30);
                const finalDueStr = (pEndFormatted && defaultDueStr > pEndFormatted)
                    ? pEndFormatted
                    : defaultDueStr;

                handleMilestoneDataChange('startDate', defaultStart);
                handleMilestoneDataChange('dueDate', finalDueStr);
            }
        }
    }, [activeMilestone?.milestoneId, editingMilestoneId, viewMode, activeMilestone?.status, latestMilestoneDate, pStartFormatted, pEndFormatted]);



    const handleNewStartDateChange = (newStart: string) => {
        handleMilestoneDataChange('startDate', newStart);
        if (newStart) {
            const proposedStr = addDays(newStart, 30);
            const finalDue = (pEndFormatted && proposedStr > pEndFormatted)
                ? pEndFormatted
                : proposedStr;
            handleMilestoneDataChange('dueDate', finalDue);
        }
    };

    const hasUnsavedChanges = React.useCallback(() => {
        if (formTab === 'view') return false;
        if (formTab === 'add') return !!newMilestoneData.name || !!newMilestoneData.description;
        if (formTab === 'edit' && activeMilestone) {
            return newMilestoneData.name !== activeMilestone.name || (newMilestoneData.description || '') !== (activeMilestone.description || '');
        }
        return false;
    }, [formTab, newMilestoneData, activeMilestone]);

    const protectedCancelEdit = () => {
        if (formTab !== 'add') {
            if (hasUnsavedChanges()) {
                setConfirmState({
                    isOpen: true,
                    title: 'Discard Changes?',
                    message: 'Your unsaved changes will be lost. Return to list anyway?',
                    confirmLabel: 'Discard',
                    cancelLabel: 'Stay',
                    variant: 'warning',
                    onConfirm: () => onCancelEdit()
                });
                return;
            }
            onCancelEdit();
            return;
        }

        if (viewMode === 'detail' && formTab === 'add') {
            handleMilestoneDataChange('name', '');
            handleMilestoneDataChange('description', '');
            handleMilestoneDataChange('startDate', '');
            handleMilestoneDataChange('dueDate', '');
            onCancelEdit();
            return;
        }

        onCancelEdit();
    };

    const handleSwitchToEdit = () => {
        if (!activeMilestone) return;

        // Populate the edit form fields with current milestone data
        handleMilestoneDataChange('name', activeMilestone.name);
        handleMilestoneDataChange('description', activeMilestone.description || '');

        // Format dates as YYYY-MM-DD for input fields
        const formatForInput = (dateInput: string | null | undefined) => {
            if (!dateInput) return '';
            try {
                const d = new Date(dateInput);
                if (isNaN(d.getTime())) return '';
                return d.toLocaleDateString('en-CA');
            } catch (e) {
                return '';
            }
        };

        handleMilestoneDataChange('startDate', formatForInput(activeMilestone.startDate));
        handleMilestoneDataChange('dueDate', formatForInput(activeMilestone.dueDate));

        setFormTab('edit');
    };

    const handleDeleteConfirm = (milestone: Milestone, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setConfirmState({
            isOpen: true,
            title: 'Delete Milestone?',
            message: `Are you sure you want to delete "${milestone.name}"? All associated data will be lost.`,
            confirmLabel: 'Delete',
            cancelLabel: 'Keep',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    const mId = milestone.milestoneId || (milestone as any).id;
                    if (mId) {
                        await milestoneService.delete(mId);
                        showToast('Milestone deleted successfully', 'success');
                        if (editingMilestoneId === mId) onCancelEdit();
                        if (refreshMilestones) refreshMilestones();
                    }
                } catch (error) {
                    console.error('Failed to delete milestone:', error);
                    showToast((error as any).message || 'Failed to delete milestone.', 'error');
                }
            }
        });
    };

    const renderMilestoneActions = (milestone: Milestone) => {
        if (!canManageMilestones) return null;

        const isClosed = milestone.status === MilestoneStatus.Completed || milestone.status === MilestoneStatus.Cancelled;

        const actionButtonStyle = (color: string, background: string): React.CSSProperties => ({
            width: '100%',
            padding: '0.82rem 0.95rem',
            border: 'none',
            background,
            color,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '0.82rem',
            fontWeight: 800,
            textAlign: 'left',
            borderRadius: '12px',
            transition: 'all 0.15s ease',
            boxShadow: 'inset 0 0 0 1px rgba(226, 232, 240, 0.9)'
        });

        return (
            <div style={{ width: '100%', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid #e2e8f0', borderRadius: '18px', boxShadow: '0 10px 28px rgba(15, 23, 42, 0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '0.9rem 1rem 0.75rem', borderBottom: '1px solid #eef2f7', background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.25rem' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Target size={14} />
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>Milestone actions</div>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.45 }}>
                        Update the milestone status or remove it from the project.
                    </div>
                </div>

                <div style={{ padding: '0.8rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                    {isClosed ? (
                        <div style={{ gridColumn: '1 / -1', padding: '0.85rem 0.95rem', borderRadius: '12px', background: milestone.status === MilestoneStatus.Completed ? '#ecfdf5' : '#fff1f2', color: milestone.status === MilestoneStatus.Completed ? '#15803d' : '#be123c', fontSize: '0.78rem', fontWeight: 700 }}>
                            This milestone is {milestone.status === MilestoneStatus.Completed ? 'completed' : 'cancelled'}. Quick actions are disabled.
                        </div>
                    ) : (
                        <>
                            {milestone.status == MilestoneStatus.NotStarted && (
                                <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(milestone, MilestoneStatus.InProgress)}
                                    style={actionButtonStyle('#0284c7', '#f8fafc')}
                                    onMouseOver={(e) => e.currentTarget.style.background = '#f0f9ff'}
                                    onMouseOut={(e) => e.currentTarget.style.background = '#f8fafc'}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Target size={14} /> Start milestone</span>
                                    <ChevronRight size={14} />
                                </button>
                            )}

                            {milestone.status == MilestoneStatus.InProgress && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => handleUpdateStatus(milestone, MilestoneStatus.Completed)}
                                        style={actionButtonStyle('#10b981', '#f8fafc')}
                                        onMouseOver={(e) => e.currentTarget.style.background = '#f0fdf4'}
                                        onMouseOut={(e) => e.currentTarget.style.background = '#f8fafc'}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={14} /> Mark complete</span>
                                        <ChevronRight size={14} />
                                    </button>
                                </>
                            )}

                            {milestone.status == MilestoneStatus.OnHold && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => handleUpdateStatus(milestone, MilestoneStatus.InProgress)}
                                        style={actionButtonStyle('#0284c7', '#f8fafc')}
                                        onMouseOver={(e) => e.currentTarget.style.background = '#f0f9ff'}
                                        onMouseOut={(e) => e.currentTarget.style.background = '#f8fafc'}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ChevronRight size={14} /> Resume milestone</span>
                                        <ChevronRight size={14} />
                                    </button>
                                </>
                            )}

                            {(milestone.status == MilestoneStatus.NotStarted || milestone.status == MilestoneStatus.OnHold) && (
                                <button
                                    type="button"
                                    onClick={() => handleDeleteConfirm(milestone)}
                                    style={actionButtonStyle('#e11d48', '#fff1f2')}
                                    onMouseOver={(e) => e.currentTarget.style.background = '#ffe4e6'}
                                    onMouseOut={(e) => e.currentTarget.style.background = '#fff1f2'}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Trash2 size={14} /> Delete milestone</span>
                                    <ChevronRight size={14} />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    const handleUpdateStatus = async (milestone: Milestone, newStatus: MilestoneStatus) => {
        // Validation: Cannot complete if there are incomplete tasks
        if (newStatus === MilestoneStatus.Completed) {
            const incompleteTask = milestoneTasks.find(t => t.status !== 6);
            if (incompleteTask) {
                setConfirmState({
                    isOpen: true,
                    title: 'UNFINISHED TASKS',
                    message: `You cannot complete this milestone because "${incompleteTask.name}" is not yet finished. Please complete all tasks first.`,
                    confirmLabel: 'GO TO TASK',
                    cancelLabel: 'CANCEL',
                    variant: 'warning',
                    onConfirm: () => {
                        setTaskTab('current');
                        setExpandedTasks([incompleteTask.taskId]);
                        // Scroll logic if needed
                        const el = document.querySelector(`[data-task-id="${incompleteTask.taskId}"]`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
                return;
            }
        }

        if (newStatus === MilestoneStatus.Completed) {
            setConfirmState({
                isOpen: true,
                title: 'Complete Milestone',
                message: `Are you sure you want to mark "${milestone.name}" as completed? This action cannot be undone.`,
                confirmLabel: 'MARK COMPLETE',
                cancelLabel: 'CANCEL',
                variant: 'success',
                onConfirm: async () => {
                    try {
                        const mId = milestone.milestoneId || (milestone as any).id;
                        if (!mId) return;
                        await milestoneService.updateStatus(mId, newStatus);
                        showToast('Milestone marked as completed!', 'success');
                        if (refreshMilestones) refreshMilestones();
                    } catch (error) {
                        console.error('Failed to update milestone status:', error);
                        showToast((error as any).message || 'Failed to update status.', 'error');
                    }
                }
            });
            return;
        }

        const isResume = milestone.status === MilestoneStatus.OnHold;
        const isStart = milestone.status === MilestoneStatus.NotStarted && newStatus === MilestoneStatus.InProgress;
        const confirmTitle = isStart ? 'Start Milestone?' : isResume ? 'Resume Milestone?' : 'Update Status?';
        const confirmMsg = isStart
            ? `Are you sure you want to start "${milestone.name}"?`
            : isResume
                ? `Are you sure you want to resume "${milestone.name}"?`
                : `Update status of "${milestone.name}"?`;

        setConfirmState({
            isOpen: true,
            title: confirmTitle,
            message: confirmMsg,
            confirmLabel: isStart ? 'START' : isResume ? 'RESUME' : 'CONFIRM',
            cancelLabel: 'CANCEL',
            variant: 'info',
            onConfirm: async () => {
                try {
                    const mId = milestone.milestoneId || (milestone as any).id;
                    if (!mId) return;
                    await milestoneService.updateStatus(mId, newStatus);
                    showToast('Milestone status updated!', 'success');
                    if (refreshMilestones) refreshMilestones();
                } catch (error) {
                    console.error('Failed to update milestone status:', error);
                    showToast((error as any).message || 'Failed to update status.', 'error');
                }
            }
        });
    };

    const protectedMilestoneClick = (milestone: Milestone) => {
        handleMilestoneClick(milestone);
    };

    const getLiveMilestoneItem = (milestone: Milestone | null): any => {
        if (!milestone) return null;
        if (formTab === 'edit' && editingMilestoneId === milestone.milestoneId) {
            return {
                ...milestone,
                name: newMilestoneData.name || milestone.name,
                startDate: newMilestoneData.startDate || milestone.startDate,
                dueDate: newMilestoneData.dueDate || milestone.dueDate
            };
        }
        return milestone;
    };

    const header = (() => {
        if (formTab === 'add') return { name: newMilestoneData.name || "Draft Milestone", startDate: newMilestoneData.startDate, dueDate: newMilestoneData.dueDate };
        if (formTab === 'edit' && editingMilestoneId === activeMilestone?.milestoneId) return { name: newMilestoneData.name || activeMilestone?.name, startDate: newMilestoneData.startDate || activeMilestone?.startDate, dueDate: newMilestoneData.dueDate || activeMilestone?.dueDate };
        return { name: activeMilestone?.name || "No Milestone Selected", startDate: activeMilestone?.startDate, dueDate: activeMilestone?.dueDate };
    })();

    const cancelBtnLabel = viewMode === 'detail' ? "Back to List" : "Cancel";

    const formatDate = (d: string | Date | null | undefined): string => {
        if (!d) return 'N/A';
        try {
            const plain = typeof d === 'string' ? d.split('T')[0] : d.toISOString().split('T')[0];
            const [year, month, day] = plain.split('-').map(Number);
            if (!year || !month || !day) return 'N/A';
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return `${months[month - 1]} ${day}, ${year}`;
        } catch {
            return 'N/A';
        }
    };

    const mStartDate = activeMilestone?.startDate ? activeMilestone.startDate.split('T')[0] : '';
    const mDueDate = activeMilestone?.dueDate ? activeMilestone.dueDate.split('T')[0] : '';
    const mDueDateMinus1 = activeMilestone?.dueDate ? (() => { const plain = activeMilestone.dueDate.split('T')[0]; const [y, mo, d] = plain.split('-').map(Number); return new Date(Date.UTC(y, mo - 1, d - 1)).toISOString().split('T')[0]; })() : '';

    const addDraftSlot = () => {
        if (draftTasks.length >= 5) return;
        const newDraft: TaskDraft = {
            id: `draft-${Date.now()}`,
            name: '',
            description: '',
            priority: 2,
            status: 1,
            startDate: mStartDate || today,
            dueDate: mDueDateMinus1 || '',
            assigneeId: '',
            collaboratorIds: [],
            isSaving: false,
            isExpanded: true
        };
        setDraftTasks(prev => [newDraft, ...prev.map(d => ({ ...d, isExpanded: false }))]);
        setTaskTab('draft');
    };

    const toggleDraftExpand = (id: string) => {
        setDraftTasks(prev => prev.map(d => d.id === id ? { ...d, isExpanded: !d.isExpanded } : d));
    };

    const updateDraft = (id: string, field: string, value: any) => {
        setDraftTasks(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    };

    const handleSingleTaskSave = async (draft: TaskDraft) => {
        await handleSaveDraftTask(draft);
    };

    const removeDraft = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDraftTasks(prev => prev.filter(d => d.id !== id));
    };

    // 📊 Redesigned Stats Logic
    const getMilestoneMetrics = () => {
        if (milestoneStats) return {
            total: milestoneStats.totalMilestones ?? milestoneStats.total ?? milestones.length,
            inProgress: milestoneStats.inProgressMilestones ?? milestoneStats.inProgress ?? 0,
            onHold: milestoneStats.onHoldMilestones ?? milestoneStats.onHold ?? 0,
            notStarted: milestoneStats.notStartedMilestones ?? milestoneStats.notStarted ?? 0,
            completed: milestoneStats.completedMilestones ?? milestoneStats.completed ?? 0,
            cancelled: milestoneStats.cancelledMilestones ?? milestoneStats.cancelled ?? 0,
            nearDeadline: milestoneStats.nearDeadlineMilestones ?? milestoneStats.nearDeadline ?? 0,
            staleStart: milestoneStats.staleStartMilestones ?? milestoneStats.staleStart ?? 0
        };

        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);

        return {
            total: milestones.length,
            inProgress: milestones.filter(m => m.status == MilestoneStatus.InProgress).length,
            onHold: milestones.filter(m => m.status == MilestoneStatus.OnHold).length,
            notStarted: milestones.filter(m => m.status == MilestoneStatus.NotStarted).length,
            completed: milestones.filter(m => m.status == MilestoneStatus.Completed).length,
            cancelled: milestones.filter(m => m.status == MilestoneStatus.Cancelled).length,
            nearDeadline: milestones.filter(m =>
                m.status != MilestoneStatus.Completed &&
                m.status != MilestoneStatus.Cancelled &&
                m.dueDate && new Date(m.dueDate) <= nextWeek && new Date(m.dueDate) >= now
            ).length,
            staleStart: milestones.filter(m =>
                m.status == MilestoneStatus.NotStarted &&
                m.startDate && new Date(m.startDate) <= now
            ).length
        };
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflow: 'hidden', position: 'relative' }}>
            {/* Unified Status Board - Dashboard Style */}
            <div style={{
                background: 'white', padding: '1rem 1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0',
                display: 'grid', gridTemplateColumns: '1.2fr auto 1.2fr auto 1.5fr', gap: '1.25rem', alignItems: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)', position: 'relative', marginBottom: '0.5rem'
            }}>
                {/* Helper for Table Rows */}
                {(() => {
                    const StatRow = ({ icon, label, count, color, bg, tooltip, pulse = false }: any) => (
                        <div
                            title={tooltip}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0',
                                opacity: count > 0 ? 1 : 0.45, transition: 'all 0.2s', cursor: 'help'
                            }}>
                            <div className={pulse ? (color === '#ef4444' ? 'pulse-red' : 'pulse-orange') : ''} style={{
                                width: '26px', height: '26px', borderRadius: '7px', background: bg, color: color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                border: `1px solid ${color}20`
                            }}>
                                {React.cloneElement(icon, { size: 14 })}
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', flex: 1 }}>{label}:</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: count > 0 ? '#1e293b' : '#94a3b8' }}>{count}</span>
                        </div>
                    );

                    const metrics = getMilestoneMetrics();

                    return (
                        <React.Fragment>
                            {/* Column 1: Primary Status */}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <StatRow icon={<Activity />} label="Total" count={metrics.total} color="#0284c7" bg="#f0f9ff" tooltip="Total number of strategic milestones in this project." />
                                <StatRow icon={<Timer />} label="Running" count={metrics.inProgress} color="#4f46e5" bg="#eef2ff" tooltip="Milestones currently active and in progress." />
                            </div>

                            <div style={{ width: '1px', alignSelf: 'stretch', background: '#f1f5f9' }}></div>

                            {/* Column 2: Detailed Status */}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <StatRow icon={<Target />} label="Not Start" count={metrics.notStarted} color="#475569" bg="#f1f5f9" tooltip="Planned milestones that haven't been initiated yet." />
                                <StatRow icon={<CheckCircle2 />} label="Done" count={metrics.completed} color="#059669" bg="#ecfdf5" tooltip="Milestones that have been successfully completed." />
                            </div>

                            <div style={{ width: '1px', alignSelf: 'stretch', background: '#f1f5f9' }}></div>

                            {/* Column 3: Smart Alerts */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.62rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action Items</h4>
                                <StatRow
                                    icon={<Calendar />}
                                    label="Critical Due"
                                    count={metrics.nearDeadline}
                                    color={metrics.nearDeadline > 0 ? '#ea580c' : '#94a3b8'}
                                    bg={metrics.nearDeadline > 0 ? '#fff7ed' : '#f8fafc'}
                                    tooltip="Warning: Milestones due within 7 days with remaining tasks."
                                    pulse={metrics.nearDeadline > 0}
                                />
                                <StatRow
                                    icon={<Info />}
                                    label="Stale Start"
                                    count={metrics.staleStart}
                                    color={metrics.staleStart > 0 ? '#ef4444' : '#94a3b8'}
                                    bg={metrics.staleStart > 0 ? '#fef2f2' : '#f8fafc'}
                                    tooltip="Warning: Past due start date but not yet running."
                                    pulse={metrics.staleStart > 0}
                                />
                            </div>
                        </React.Fragment>
                    );
                })()}
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'stretch', position: 'relative', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', flex: 1, minHeight: 0 }}>
                <div style={{ flex: viewMode === 'roadmap' ? 7 : 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem', opacity: viewMode === 'roadmap' ? 1 : 0, pointerEvents: viewMode === 'roadmap' ? 'auto' : 'none', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', width: viewMode === 'roadmap' ? 'auto' : 0, overflow: 'hidden', minHeight: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '2px solid #1e293b', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Target size={18} style={{ color: '#1e293b' }} />
                            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Milestone List</h4>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', background: 'white', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input type="text" placeholder="Search..." value={milestoneSearchQuery} onChange={(e) => setMilestoneSearchQuery(e.target.value)} style={{ ...inputStyle, padding: '0.6rem 0.6rem 0.6rem 2.25rem', fontSize: '0.8rem' }} />
                        </div>
                        <select value={milestoneStatusFilter} onChange={(e) => setMilestoneStatusFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '0.6rem 0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>
                            <option value="all">Filter</option>
                            <option value={MilestoneStatus.InProgress}>In Progress</option>
                            <option value={MilestoneStatus.Completed}>Done</option>
                        </select>
                    </div>
                    <div ref={milestoneContainerRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="custom-scrollbar">
                        {[...filteredMilestones].sort((a, b) => {
                            const dateA = new Date(a.dueDate).getTime();
                            const dateB = new Date(b.dueDate).getTime();
                            const isInvalidA = !a.dueDate || a.dueDate.startsWith('0001');
                            const isInvalidB = !b.dueDate || b.dueDate.startsWith('0001');
                            if (isInvalidA && !isInvalidB) return 1;
                            if (!isInvalidA && isInvalidB) return -1;
                            return dateA - dateB;
                        }).map((milestone, idx) => (
                            <MilestoneItem
                                key={`ml-${milestone.milestoneId || idx}`}
                                milestone={getLiveMilestoneItem(milestone)}
                                onClick={protectedMilestoneClick}
                                hasNoTasks={!milestoneIdsWithTasks.has(String(milestone.milestoneId || (milestone as any).id || '').toLowerCase()) && milestone.status !== MilestoneStatus.NotStarted && milestone.status !== MilestoneStatus.Completed}
                            />
                        ))}
                    </div>
                </div>

                {!isArchived && (editingMilestoneId || canManageMilestones) && (
                    <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '0.8rem', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', minWidth: '310px', minHeight: 0 }}>
                        {!!editingMilestoneId ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '0.5rem', borderBottom: '2px solid #1e293b', width: '100%' }}>
                                    {formTab === 'edit' ? <Edit3 size={16} style={{ color: '#1e293b' }} /> : <Target size={16} style={{ color: '#1e293b' }} />}
                                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>{formTab === 'edit' ? 'Edit Milestone' : 'Detail Milestone'}</h4>
                                </div>
                                <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0', height: '36px', boxSizing: 'border-box' }}>
                                    <button onClick={() => setFormTab('view')} style={{ ...tabStyle, flex: 1, height: '100%', ...(formTab === 'view' ? activeTabStyle : inactiveTabStyle) }}>View</button>
                                    {(canManageMilestones && activeMilestone?.status === MilestoneStatus.NotStarted) && (
                                        <button onClick={handleSwitchToEdit} style={{ ...tabStyle, flex: 1, height: '100%', ...(formTab === 'edit' ? activeTabStyle : inactiveTabStyle) }}>Edit</button>
                                    )}
                                </div>
                                <div style={{ background: 'white', padding: '1.25rem', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1, minHeight: 0 }} className="custom-scrollbar">
                                    {formTab === 'view' && activeMilestone ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div><label style={labelStyle}>Name</label><div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{activeMilestone.name}</div></div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                <div><label style={labelStyle}>Start Date</label><div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{formatDate(activeMilestone.startDate)}</div></div>
                                                <div><label style={labelStyle}>Due Date</label><div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{formatDate(activeMilestone.dueDate)}</div></div>
                                            </div>
                                            <div><label style={labelStyle}>Goal</label><div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5, background: '#f8fafc', padding: '0.85rem', borderRadius: '12px' }}>{activeMilestone.description || "No goal defined."}</div></div>
                                            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                    {renderMilestoneActions(activeMilestone)}
                                                <button onClick={protectedCancelEdit} style={{ ...btnSecondary, width: '100%', padding: '0.75rem' }}>{cancelBtnLabel}</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}><label style={labelStyle}>Name</label><input type="text" placeholder="Enter name..." value={newMilestoneData.name} onChange={(e) => handleMilestoneDataChange('name', e.target.value)} style={{ ...inputStyle, padding: '0.75rem' }} /></div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                                                <div>
                                                    <label style={labelStyle}>Start</label>
                                                    <input
                                                        type="date" min={today} value={newMilestoneData.startDate}
                                                        onChange={(e) => handleNewStartDateChange(e.target.value)}
                                                        style={{ ...inputStyle, padding: '0.65rem' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>Due</label>
                                                    <input
                                                        type="date" min={newMilestoneData.startDate || today} value={newMilestoneData.dueDate}
                                                        onChange={(e) => handleMilestoneDataChange('dueDate', e.target.value)}
                                                        style={{ ...inputStyle, padding: '0.65rem' }}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Goal</label>
                                                <textarea placeholder="Description..." value={newMilestoneData.description} onChange={(e) => handleMilestoneDataChange('description', e.target.value)} style={{ ...inputStyle, minHeight: '80px', padding: '0.75rem' }} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                                                {activeMilestone && renderMilestoneActions(activeMilestone)}
                                                <div style={{ display: 'flex', gap: '0.6rem' }}>
                                                    <button onClick={() => setFormTab('view')} disabled={isMilestoneSaving} style={{ ...btnSecondary, flex: 1, padding: '0.75rem', opacity: isMilestoneSaving ? 0.7 : 1 }}>Cancel</button>
                                                    <button 
                                                        onClick={handleQuickMilestoneSave} 
                                                        disabled={!newMilestoneData.name || isMilestoneSaving} 
                                                        style={{ 
                                                            ...btnPrimary, 
                                                            flex: 1, 
                                                            padding: '0.75rem', 
                                                            opacity: (!newMilestoneData.name || isMilestoneSaving) ? 0.5 : 1,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '8px'
                                                        }}
                                                    >
                                                        {isMilestoneSaving ? (
                                                            <>
                                                                <Clock className="animate-spin-slow" size={16} />
                                                                Saving...
                                                            </>
                                                        ) : 'Save Changes'}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : canManageMilestones ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '0.5rem', borderBottom: '2px solid var(--primary-color)', width: 'fit-content' }}>
                                    <Plus size={16} />
                                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>New Milestone</h4>
                                </div>
                                <div style={{ background: 'white', padding: '1.25rem', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', flex: 1, minHeight: 0 }} className="custom-scrollbar">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}><label style={labelStyle}>Name</label><input type="text" placeholder="Enter name..." value={newMilestoneData.name} onChange={(e) => handleMilestoneDataChange('name', e.target.value)} style={{ ...inputStyle, padding: '0.75rem' }} /></div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                                        <div>
                                            <label style={labelStyle}>Start</label>
                                            <input
                                                type="date"
                                                min={pStartFormatted}
                                                max={pEndFormatted || undefined}
                                                value={newMilestoneData.startDate}
                                                onChange={(e) => handleNewStartDateChange(e.target.value)}
                                                style={{ ...inputStyle, padding: '0.65rem' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Due</label>
                                            <input
                                                type="date"
                                                min={newMilestoneData.startDate || pStartFormatted}
                                                max={pEndFormatted || undefined}
                                                value={newMilestoneData.dueDate}
                                                onChange={(e) => handleMilestoneDataChange('dueDate', e.target.value)}
                                                style={{ ...inputStyle, padding: '0.65rem' }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Goal</label>
                                        <textarea placeholder="Description..." value={newMilestoneData.description} onChange={(e) => handleMilestoneDataChange('description', e.target.value)} style={{ ...inputStyle, minHeight: '80px', padding: '0.75rem' }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
                                        <button onClick={protectedCancelEdit} disabled={isMilestoneSaving} style={{ ...btnSecondary, flex: 1, padding: '0.75rem', opacity: isMilestoneSaving ? 0.7 : 1 }}>{cancelBtnLabel}</button>
                                        <button 
                                            onClick={handleQuickMilestoneSave} 
                                            disabled={!newMilestoneData.name || isMilestoneSaving} 
                                            style={{ 
                                                ...btnPrimary, 
                                                flex: 1, 
                                                padding: '0.75rem', 
                                                opacity: (!newMilestoneData.name || isMilestoneSaving) ? 0.5 : 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                            }}
                                        >
                                           {isMilestoneSaving ? (
                                                <>
                                                    <Clock className="animate-spin-slow" size={16} />
                                                    Creating...
                                                </>
                                            ) : 'Create Milestone'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {latestMilestoneDate && (
                            <div style={{ display: 'flex', gap: '8px', padding: '0.85rem 1rem', background: '#f0f9ff', borderRadius: '14px', border: '1px solid #e0f2fe' }}>
                                <Info size={16} style={{ color: '#0369a1', marginTop: '2px', flexShrink: 0 }} />
                                <div style={{ fontSize: '0.75rem', color: '#075985' }}>Last milestone ends on <strong>{formatDate(latestMilestoneDate)}</strong>.</div>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ flex: viewMode === 'detail' ? 7 : 0, display: 'flex', flexDirection: 'column', gap: '1rem', opacity: viewMode === 'detail' ? 1 : 0, pointerEvents: viewMode === 'detail' ? 'auto' : 'none', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', width: viewMode === 'detail' ? 'auto' : 0, overflow: 'hidden', minHeight: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '2px solid #1e293b', width: '100%', overflow: 'hidden', minWidth: 0 }}>
                        <Target size={16} style={{ color: '#1e293b', flexShrink: 0 }} />
                        <h4 style={{ margin: '0 0 0 8px', fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>Milestone Tasks: {header.name}</h4>
                    </div>

                    <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0', height: '36px', boxSizing: 'border-box' }}>
                        <button
                            onClick={() => setTaskTab('current')}
                            style={{ ...tabStyle, flex: 1, height: '100%', fontSize: '0.7rem', borderRadius: '8px', ...(taskTab === 'current' ? activeTabStyle : inactiveTabStyle) }}
                        >
                            Current ({milestoneTasks.length})
                        </button>
                        {activeMilestone?.status !== MilestoneStatus.Completed && activeMilestone?.status !== MilestoneStatus.Cancelled && (
                            <button
                                onClick={() => setTaskTab('draft')}
                                style={{ ...tabStyle, flex: 1, height: '100%', fontSize: '0.7rem', borderRadius: '8px', ...(taskTab === 'draft' ? activeTabStyle : inactiveTabStyle) }}
                            >
                                Draft ({draftTasks.length})
                            </button>
                        )}
                    </div>

                    <div style={{ flex: 1, background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.02)', minHeight: 0 }}>
                        <div style={{ padding: '0.6rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#64748b' }}>
                                <Calendar size={14} /><span style={{ fontSize: '0.72rem', fontWeight: 750 }}>{header.startDate ? `${formatDate(header.startDate)} - ${formatDate(header.dueDate)}` : "TBD"}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {canManageProject && taskTab === 'draft' && activeMilestone?.status !== MilestoneStatus.Completed && activeMilestone?.status !== MilestoneStatus.Cancelled && (
                                    <React.Fragment>
                                        <button
                                            onClick={addDraftSlot}
                                            disabled={draftTasks.length >= 5}
                                            title={draftTasks.length >= 5 ? 'Maximum 5 drafts allowed' : undefined}
                                            style={{ ...btnPrimary, padding: '7px 15px', fontSize: '0.75rem', borderRadius: '10px', opacity: draftTasks.length >= 5 ? 0.45 : 1, cursor: draftTasks.length >= 5 ? 'not-allowed' : 'pointer' }}
                                        >
                                            <Plus size={14} /> New Task {draftTasks.length >= 5 ? '(5/5)' : `(${draftTasks.length}/5)`}
                                        </button>
                                    </React.Fragment>
                                )}
                            </div>
                        </div>

                        <div
                            style={{ flex: 1, overflow: 'auto', padding: '1.25rem', minHeight: 0 }}
                            className="custom-scrollbar"
                        >
                            {taskTab === 'draft' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {draftTasks.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Edit3 size={12} style={{ color: '#1e293b' }} /> Planning Mode ({draftTasks.length} draft tasks)
                                            </div>
                                            {draftTasks.map((draft) => (
                                                <div
                                                    key={draft.id}
                                                    style={{
                                                        background: 'white',
                                                        padding: '12px 16px',
                                                        borderRadius: 'var(--radius-lg)',
                                                        border: '1px solid var(--border-color)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: draft.isExpanded ? '1rem' : '0',
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        cursor: 'pointer',
                                                        boxShadow: draft.isExpanded ? 'var(--shadow-md)' : 'var(--shadow-xs)',
                                                        animation: 'slideIn 0.3s ease-out',
                                                        position: 'relative',
                                                        overflow: 'hidden'
                                                    }}
                                                    onClick={() => toggleDraftExpand(draft.id)}
                                                    className="task-draft-card"
                                                >
                                                    {draft.isExpanded && <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--primary-color)' }} />}
                                                    <div style={{ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr) auto auto auto', gap: '12px', alignItems: 'center' }}>
                                                        <div style={{ color: draft.isExpanded ? 'var(--primary-color)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                                                            {draft.isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                        </div>
                                                        <div style={{ position: 'relative', overflow: 'visible' }}>
                                                            {draft.isExpanded ? (
                                                                <input
                                                                    type="text" placeholder="What needs to be done?" value={draft.name}
                                                                    onChange={(e) => updateDraft(draft.id, 'name', e.target.value)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    style={{
                                                                        width: '100%',
                                                                        border: 'none',
                                                                        background: 'transparent',
                                                                        padding: '4px 0',
                                                                        fontWeight: 700,
                                                                        fontSize: '0.9rem',
                                                                        position: 'relative',
                                                                        zIndex: 10,
                                                                        color: 'var(--text-primary)',
                                                                        outline: 'none'
                                                                    }}
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 650, color: draft.name ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{draft.name || "Untitled Task"}</div>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                            {!draft.isExpanded && <div style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', background: 'var(--border-light)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', letterSpacing: '0.05em' }}>Draft</div>}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                            {!draft.isExpanded && (
                                                                <>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                                                                        <User size={12} style={{ color: 'var(--text-muted)' }} />
                                                                        <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                                                            {(() => {
                                                                                const match = members.find(m => (m.id || m.memberId || m.membershipId || "") === draft.assigneeId);
                                                                                return match?.fullName || match?.userName || "Unassigned";
                                                                            })()}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-bg)', padding: '2px 8px', borderRadius: '20px', border: '1px solid var(--accent-color)22', color: 'var(--accent-color)' }}>
                                                                        <Users size={12} />
                                                                        <span style={{ fontWeight: 700 }}>{(draft.collaboratorIds || []).filter(id => id !== draft.assigneeId).length}</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleSingleTaskSave(draft); }} 
                                                                disabled={draft.isSaving}
                                                                style={{ 
                                                                    width: '30px', height: '30px', borderRadius: '8px', border: 'none', 
                                                                    color: draft.isSaving ? 'var(--text-muted)' : 'var(--success)', 
                                                                    background: 'var(--success-bg)', 
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                                    cursor: draft.isSaving ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                                                                    opacity: draft.isSaving ? 0.6 : 1
                                                                }}
                                                            >
                                                                {draft.isSaving ? <Clock className="animate-spin-slow" size={14} /> : <Save size={14} />}
                                                            </button>
                                                            <button onClick={(e) => removeDraft(draft.id, e)} disabled={draft.isSaving} style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', color: 'var(--danger)', background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', opacity: draft.isSaving ? 0.5 : 1 }}><Trash2 size={14} /></button>
                                                        </div>
                                                    </div>
                                                    {draft.isExpanded && (
                                                        <React.Fragment>
                                                            <textarea
                                                                placeholder="Description..." value={draft.description}
                                                                onChange={(e) => updateDraft(draft.id, 'description', e.target.value)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{ ...inputStyle, minHeight: '54px', padding: '8px 12px', fontSize: '0.75rem' }}
                                                            />
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
                                                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                                                    <input
                                                                        type="date" value={draft.startDate}
                                                                        min={mStartDate || today}
                                                                        max={draft.dueDate || mDueDate}
                                                                        onChange={(e) => updateDraft(draft.id, 'startDate', e.target.value)}
                                                                        style={{ ...compactInput, flex: 1, fontSize: '0.65rem' }}
                                                                    />
                                                                    <span style={{ color: '#94a3b8' }}>→</span>
                                                                    <input
                                                                        type="date" value={draft.dueDate}
                                                                        min={draft.startDate || mStartDate || today}
                                                                        max={mDueDate}
                                                                        onChange={(e) => updateDraft(draft.id, 'dueDate', e.target.value)}
                                                                        style={{ ...compactInput, flex: 1, fontSize: '0.65rem' }}
                                                                    />
                                                                </div>
                                                                <select value={draft.priority} onChange={(e) => updateDraft(draft.id, 'priority', parseInt(e.target.value))} style={{ ...compactInput, fontSize: '0.65rem' }}>
                                                                    <option value="1">Low</option>
                                                                    <option value="2">Medium</option>
                                                                    <option value="3">High</option>
                                                                    <option value="4">Critical</option>
                                                                </select>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
                                                                <select
                                                                    value={draft.assigneeId}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        updateDraft(draft.id, 'assigneeId', val);
                                                                        if (val) {
                                                                            const next = (draft.collaboratorIds || []).filter(id => id !== val);
                                                                            updateDraft(draft.id, 'collaboratorIds', next);
                                                                        }
                                                                    }}
                                                                    style={{ ...compactInput, fontSize: '0.65rem' }}
                                                                >
                                                                    <option value="">Select Assignee</option>
                                                                    {members.filter(m => Number(m.projectRole) !== 1).map(m => (
                                                                        <option key={m.id || m.memberId || m.membershipId} value={m.id || m.memberId || m.membershipId}>{m.fullName || m.userName}</option>
                                                                    ))}
                                                                </select>
                                                                <select
                                                                    value=""
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        if (!val) return;
                                                                        const current = draft.collaboratorIds || [];
                                                                        const next = current.includes(val) ? current.filter(id => id !== val) : [...current, val];
                                                                        updateDraft(draft.id, 'collaboratorIds', next);
                                                                    }}
                                                                    style={{ ...compactInput, fontSize: '0.65rem', background: '#f8fafc' }}
                                                                >
                                                                    <option value="">Select Collaborators ({draft.collaboratorIds.length})</option>
                                                                    {members.filter(m => Number(m.projectRole) !== 1 && (m.id || m.memberId || m.membershipId) !== draft.assigneeId).map(m => (
                                                                        <option key={m.id || m.memberId || m.membershipId} value={m.id || m.memberId || m.membershipId}>
                                                                            {draft.collaboratorIds.includes(m.id || m.memberId || m.membershipId) ? "✓ " : ""} {m.fullName || m.userName} - {m.email || 'No email'}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                                            <Plus size={32} style={{ color: '#cbd5e1', marginBottom: '1.5rem' }} />
                                            <h5 style={{ color: '#1e293b', fontSize: '1rem', fontWeight: 800 }}>Drafting Workspace</h5>
                                            <p style={{ fontSize: '0.8rem' }}>Plan your new tasks here. Use the "New Task" button above to start.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {milestoneTasks.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <CheckCircle size={12} /> Current Task ({milestoneTasks.length})
                                            </div>
                                            {milestoneTasks.map((task) => {
                                                const isEx = expandedTasks.includes(task.taskId);
                                                const sColors = getStatusColor(task.status);
                                                const aId = task.memberId || (task as any).assignedToId;
                                                const rawAssigneeName = (task as any).assigneeName || task.assignedToName || task.member?.fullName;
                                                const matchById = members.find(m => (m.id || m.memberId || m.membershipId || '') === aId);
                                                const matchByName = !matchById && rawAssigneeName
                                                    ? members.find(m => (m.fullName || m.userName || '') === rawAssigneeName)
                                                    : undefined;
                                                const match = matchById || matchByName;
                                                const assigneeDisplayName = match?.fullName || match?.userName || rawAssigneeName;
                                                const collabCount = ((task as any).collaborators || (task as any).collaboratorIds || []).length;

                                                return (
                                                    <div
                                                        key={task.taskId}
                                                        data-task-id={task.taskId}
                                                        style={{
                                                            background: 'white',
                                                            padding: '12px 16px',
                                                            borderRadius: 'var(--radius-lg)',
                                                            border: '1px solid var(--border-color)',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: isEx ? '1rem' : '0',
                                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                            cursor: 'pointer',
                                                            boxShadow: isEx ? 'var(--shadow-md)' : 'var(--shadow-xs)',
                                                            position: 'relative',
                                                            overflow: 'hidden'
                                                        }}
                                                        onClick={() => toggleTaskExpand(task.taskId)}
                                                        className="task-item-card"
                                                    >
                                                        {isEx && <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--primary-color)' }} />}
                                                        <div style={{ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr) auto auto auto 70px', gap: '12px', alignItems: 'center' }}>
                                                            <div style={{ color: isEx ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                                                                {isEx ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                            </div>
                                                            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                                                                {isEx && (canManageProject && !isArchived && task.status === 1 && activeMilestone?.status !== MilestoneStatus.Completed && activeMilestone?.status !== MilestoneStatus.Cancelled) ? (
                                                                    <input
                                                                        type="text" value={task.name} placeholder="Task Name"
                                                                        onChange={(e) => handleUpdateTaskField(task.taskId, 'name', e.target.value)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        style={{
                                                                            width: '100%',
                                                                            border: 'none',
                                                                            background: 'transparent',
                                                                            padding: '2px 0',
                                                                            fontWeight: 700,
                                                                            fontSize: '0.9rem',
                                                                            color: 'var(--text-primary)',
                                                                            outline: 'none'
                                                                        }}
                                                                        autoFocus
                                                                    />
                                                                ) : (
                                                                    <div title={task.name} style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</div>
                                                                )}
                                                            </div>

                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                                                                    <User size={12} style={{ color: 'var(--text-muted)' }} />
                                                                    <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                                                        {assigneeDisplayName || 'Unassigned'}
                                                                    </span>
                                                                </div>
                                                                {collabCount > 0 && (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent-bg)', padding: '2px 8px', borderRadius: '20px', border: '1px solid var(--accent-color)22', color: 'var(--accent-color)' }}>
                                                                        <Users size={12} />
                                                                        <span style={{ fontWeight: 700 }}>{collabCount}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <Calendar size={12} />
                                                                <span>{formatDate(task.startDate)} - {formatDate(task.dueDate)}</span>
                                                            </div>

                                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                                <div style={{
                                                                    fontSize: '0.6rem',
                                                                    fontWeight: 800,
                                                                    padding: '2px 10px',
                                                                    borderRadius: 'var(--radius-full)',
                                                                    textTransform: 'uppercase',
                                                                    background: sColors.bg,
                                                                    color: sColors.text,
                                                                    border: `1px solid ${sColors.text}15`,
                                                                    letterSpacing: '0.05em'
                                                                }}>
                                                                    {getStatusText(task.status)}
                                                                </div>
                                                            </div>

                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                                {(canManageProject && !isArchived && activeMilestone?.status !== MilestoneStatus.Completed && activeMilestone?.status !== MilestoneStatus.Cancelled) && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleSaveExistingTask(task); }}
                                                                        disabled={savingTaskId === task.taskId}
                                                                        style={{
                                                                            width: '28px',
                                                                            height: '28px',
                                                                            borderRadius: '8px',
                                                                            border: 'none',
                                                                            color: savingTaskId === task.taskId ? 'var(--text-muted)' : 'var(--success)',
                                                                            background: 'var(--success-bg)',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            cursor: savingTaskId === task.taskId ? 'not-allowed' : 'pointer',
                                                                            opacity: savingTaskId === task.taskId ? 0.6 : 1
                                                                        }}
                                                                        title="Save Update"
                                                                    >
                                                                        {savingTaskId === task.taskId ? <Clock className="animate-spin-slow" size={14} /> : <Save size={14} />}
                                                                    </button>
                                                                )}
                                                                {task.status === 1 && activeMilestone?.status !== MilestoneStatus.Completed && activeMilestone?.status !== MilestoneStatus.Cancelled && (
                                                                    <button onClick={(e) => handleDeleteTask(task.taskId || (task as any).id, e)} disabled={savingTaskId === task.taskId} style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', color: 'var(--danger)', background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: savingTaskId === task.taskId ? 0.5 : 1 }}><Trash2 size={14} /></button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isEx && (
                                                            <React.Fragment>
                                                                {(() => {
                                                                    const canEditFull = canManageProject && !isArchived && task.status === 1 && activeMilestone?.status !== MilestoneStatus.Completed && activeMilestone?.status !== MilestoneStatus.Cancelled;
                                                                    const canEditCollab = canManageProject && !isArchived && activeMilestone?.status !== MilestoneStatus.Completed && activeMilestone?.status !== MilestoneStatus.Cancelled;

                                                                    return (
                                                                        <React.Fragment>
                                                                            {!canEditFull && (
                                                                                <div style={{ padding: '0.6rem 0.85rem', background: '#f8fafc', color: '#64748b', borderRadius: 'var(--radius-md)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e2e8f0' }} onClick={(e) => e.stopPropagation()}>
                                                                                    <Info size={14} />
                                                                                    <span style={{ fontWeight: 600 }}>View only — task fields are locked.{canEditCollab ? ' You can still update collaborators.' : ''}</span>
                                                                                </div>
                                                                            )}
                                                                            <textarea
                                                                                placeholder="Add a detailed description..."
                                                                                value={task.description || ''}
                                                                                onChange={(e) => handleUpdateTaskField(task.taskId, 'description', e.target.value)}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                readOnly={!canEditFull}
                                                                                style={{
                                                                                    ...inputStyle,
                                                                                    minHeight: '70px',
                                                                                    padding: '10px 14px',
                                                                                    fontSize: '0.8rem',
                                                                                    background: canEditFull ? 'var(--surface-hover)' : '#f8fafc',
                                                                                    border: '1px solid var(--border-color)',
                                                                                    borderRadius: '12px',
                                                                                    cursor: canEditFull ? 'text' : 'default'
                                                                                }}
                                                                            />
                                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} onClick={(e) => e.stopPropagation()}>
                                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                                    <div style={{ flex: 1, position: 'relative' }}>
                                                                                        <label style={{ position: 'absolute', top: '-8px', left: '10px', background: 'white', padding: '0 4px', fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>START</label>
                                                                                        <input
                                                                                            type="date"
                                                                                            value={task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : ''}
                                                                                            disabled={!canEditFull}
                                                                                            min={mStartDate || undefined}
                                                                                            max={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : undefined}
                                                                                            onChange={(e) => handleUpdateTaskField(task.taskId, 'startDate', e.target.value)}
                                                                                            style={{ ...compactInput, width: '100%', fontSize: '0.75rem', padding: '10px', background: canEditFull ? 'white' : 'var(--border-light)', borderRadius: '10px' }}
                                                                                        />
                                                                                    </div>
                                                                                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                                                                                    <div style={{ flex: 1, position: 'relative' }}>
                                                                                        <label style={{ position: 'absolute', top: '-8px', left: '10px', background: 'white', padding: '0 4px', fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>DUE</label>
                                                                                        <input
                                                                                            type="date"
                                                                                            value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
                                                                                            disabled={!canEditFull}
                                                                                            min={task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : undefined}
                                                                                            max={mDueDate || undefined}
                                                                                            onChange={(e) => handleUpdateTaskField(task.taskId, 'dueDate', e.target.value)}
                                                                                            style={{ ...compactInput, width: '100%', fontSize: '0.75rem', padding: '10px', background: canEditFull ? 'white' : 'var(--border-light)', borderRadius: '10px' }}
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                                <div style={{ position: 'relative' }}>
                                                                                    <label style={{ position: 'absolute', top: '-8px', left: '10px', background: 'white', padding: '0 4px', fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>PRIORITY</label>
                                                                                    <select value={task.priority} disabled={!canEditFull} onChange={(e) => handleUpdateTaskField(task.taskId, 'priority', parseInt(e.target.value))} style={{ ...compactInput, width: '100%', fontSize: '0.75rem', padding: '10px', borderRadius: '10px' }}>
                                                                                        <option value="1">Low</option>
                                                                                        <option value="2">Medium</option>
                                                                                        <option value="3">High</option>
                                                                                        <option value="4">Critical</option>
                                                                                    </select>
                                                                                </div>
                                                                            </div>
                                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} onClick={(e) => e.stopPropagation()}>
                                                                                <div style={{ position: 'relative' }}>
                                                                                    <label style={{ position: 'absolute', top: '-8px', left: '10px', background: 'white', padding: '0 4px', fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>ASSIGNEE</label>
                                                                                    <select
                                                                                        value={(() => {
                                                                                            if (match) return match.id || match.memberId || match.membershipId || '';
                                                                                            const assigneeId = task.memberId || (task as any).assignedToId || '';
                                                                                            if (!assigneeId) return '';
                                                                                            const found = members.find((m: any) =>
                                                                                                (m.id || m.memberId || m.membershipId || m.userId || '') === assigneeId
                                                                                            );
                                                                                            return found ? (found.id || found.memberId || found.membershipId || assigneeId) : assigneeId;
                                                                                        })()}
                                                                                        disabled={!canEditFull}
                                                                                        onChange={(e) => {
                                                                                            const val = e.target.value;
                                                                                            handleUpdateTaskField(task.taskId, 'memberId', val);
                                                                                            if (val) {
                                                                                                const cur = (task as any).collaboratorIds || [];
                                                                                                const next = cur.filter((id: string) => id !== val);
                                                                                                handleUpdateTaskField(task.taskId, 'collaboratorIds', next);
                                                                                            }
                                                                                        }}
                                                                                        style={{ ...compactInput, width: '100%', fontSize: '0.75rem', padding: '10px', borderRadius: '10px' }}
                                                                                    >
                                                                                        <option value="">Select Assignee</option>
                                                                                        {members.filter(m => Number(m.projectRole) !== 1).map(m => (
                                                                                            <option key={m.id || m.memberId || m.membershipId} value={m.id || m.memberId || m.membershipId}>{m.fullName || m.userName}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                </div>
                                                                                <div style={{ position: 'relative' }}>
                                                                                    <label style={{ position: 'absolute', top: '-8px', left: '10px', background: 'white', padding: '0 4px', fontSize: '0.6rem', fontWeight: 800, color: canEditCollab && !canEditFull ? '#6366f1' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                                        COLLABORATORS{canEditCollab && !canEditFull && <span style={{ fontSize: '0.55rem', background: '#eef2ff', color: '#6366f1', borderRadius: '4px', padding: '1px 4px', fontWeight: 900 }}>EDITABLE</span>}
                                                                                    </label>
                                                                                    <select
                                                                                        value=""
                                                                                        disabled={!canEditCollab}
                                                                                        style={{ ...compactInput, width: '100%', fontSize: '0.75rem', padding: '10px', borderRadius: '10px', background: canEditCollab ? 'var(--surface-hover)' : '#f8fafc', ...(canEditCollab && !canEditFull ? { borderColor: '#6366f1', borderWidth: '1.5px' } : {}) }}
                                                                                        onChange={(e) => {
                                                                                            const val = e.target.value;
                                                                                            if (!val) return;
                                                                                            const current = (task as any).collaboratorIds || [];
                                                                                            const next = current.includes(val) ? current.filter((id: string) => id !== val) : [...current, val];
                                                                                            handleUpdateTaskField(task.taskId, 'collaboratorIds', next);
                                                                                        }}
                                                                                    >
                                                                                        <option value="">Add Collaborators ({((task as any).collaboratorIds || []).length})</option>
                                                                                        {members.filter(m => Number(m.projectRole) !== 1 && (m.id || m.memberId || m.membershipId) !== (task.memberId || (task as any).assignedToId)).map(m => (
                                                                                            <option key={m.id || m.memberId || m.membershipId} value={m.id || m.memberId || m.membershipId}>
                                                                                                {((task as any).collaboratorIds || []).includes(m.id || m.memberId || m.membershipId) ? "✓ " : ""} {m.fullName || m.userName}
                                                                                            </option>
                                                                                        ))}
                                                                                    </select>
                                                                                </div>
                                                                            </div>
                                                                        </React.Fragment>
                                                                    );
                                                                })()}
                                                            </React.Fragment>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                                            {loadingTasks ? (
                                                <div className="spin"><Clock size={32} style={{ color: '#cbd5e1', marginBottom: '1.5rem' }} /></div>
                                            ) : (
                                                <Target size={32} style={{ color: '#cbd5e1', marginBottom: '1.5rem' }} />
                                            )}
                                            <h5 style={{ color: '#1e293b', fontSize: '1rem', fontWeight: 800 }}>{loadingTasks ? "Loading Tasks..." : "Current Tasks"}</h5>
                                            <p style={{ fontSize: '0.8rem' }}>{loadingTasks ? "Syncing..." : "No committed tasks for this milestone."}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {confirmState.isOpen && (() => {
                const variantMap = {
                    danger:  { bg: '#fff1f2', color: '#e11d48', btnBg: '#e11d48', icon: <Trash2 size={20} /> },
                    success: { bg: '#f0fdf4', color: '#16a34a', btnBg: '#16a34a', icon: <CheckCircle size={20} /> },
                    warning: { bg: '#fffbeb', color: '#d97706', btnBg: '#d97706', icon: <AlertTriangle size={20} /> },
                    info:    { bg: '#f0f9ff', color: '#0369a1', btnBg: '#0369a1', icon: <Info size={20} /> },
                };
                const v = variantMap[confirmState.variant] ?? variantMap.info;
                return (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255, 255, 255, 0.3)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease-out' }}>
                        <div style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0', maxWidth: '300px', width: '90%', textAlign: 'center', animation: 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: v.bg, color: v.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {v.icon}
                                </div>
                            </div>
                            <div style={{ fontWeight: 800, color: '#1e293b', marginBottom: '0.4rem', fontSize: '0.9rem' }}>{confirmState.title}</div>
                            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>{confirmState.message}</p>
                            <div style={{ display: 'flex', gap: '0.6rem' }}>
                                <button onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} style={{ ...btnSecondary, flex: 1, padding: '0.6rem', fontSize: '0.75rem', borderRadius: '10px' }}>{confirmState.cancelLabel}</button>
                                <button onClick={() => { confirmState.onConfirm(); setConfirmState(prev => ({ ...prev, isOpen: false })); }} style={{ ...btnPrimary, flex: 1, padding: '0.6rem', fontSize: '0.75rem', background: v.btnBg, borderRadius: '10px' }}>{confirmState.confirmLabel}</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <style>{`
                @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes popIn { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                .spin { animation: rotation 1.5s infinite linear; }
                @keyframes rotation { from { transform: rotate(0deg); } to { transform: rotate(359deg); } }
            `}</style>
        </div>
    );
};

const labelStyle: React.CSSProperties = { fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' };
const inputStyle: React.CSSProperties = { width: '100%', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', background: '#f8fafc', boxSizing: 'border-box' };
const compactInput: React.CSSProperties = { border: '1.5px solid #e2e8f0', background: 'white', borderRadius: '10px', height: '36px', fontSize: '0.75rem', outline: 'none', padding: '0 10px', transition: 'border-color 0.2s' };
const tabStyle: React.CSSProperties = { padding: '8px 12px', fontSize: '0.7rem', fontWeight: 800, border: 'none', borderRadius: '8px', cursor: 'pointer' };
const activeTabStyle: React.CSSProperties = { background: 'white', color: 'var(--primary-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' };
const inactiveTabStyle: React.CSSProperties = { background: 'transparent', color: '#64748b' };
const btnPrimary: React.CSSProperties = { background: 'var(--primary-color)', color: 'white', border: 'none', fontWeight: 800, borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const btnSecondary: React.CSSProperties = { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 800, borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
 

export default DetailsMilestones;
