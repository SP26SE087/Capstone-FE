import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, Plus, X, LayoutGrid, User, Users, Calendar, Loader2, Play, Send,
    Upload, Paperclip, Target, Filter, ChevronDown, Check, RotateCw, CheckCircle2, Clock
} from 'lucide-react';
import { Project, Task, TaskStatus, Milestone, MilestoneStatus } from '@/types';
import ActivityTimeline from './ActivityTimeline';
import { taskService } from '@/services/taskService';

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
    const myMembershipId = currentMember?.membershipId || currentMember?.id || (currentMember as any)?.memberId;
    const isSpecialRole = currentMember?.projectRole === 1 || currentMember?.projectRole === 4;
    const [viewContext, setViewContext] = useState<'personal' | 'all'>(isSpecialRole ? 'all' : 'personal');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [showCollabs, setShowCollabs] = useState(false);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [evidenceFiles, setEvidenceFiles] = useState<{ [taskId: string]: File[] }>({});
    const [uploadedEvidences, setUploadedEvidences] = useState<{ [taskId: string]: any[] }>({});
    const [errorMessages, setErrorMessages] = useState<{ [taskId: string]: string | null }>({});

    const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
    const [previewEvidence, setPreviewEvidence] = useState<any>(null);
    const [pendingDelete, setPendingDelete] = useState<{ taskId: string, evidenceId: number } | null>(null);

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

    const displayTasks = (viewContext === 'all' ? filteredTasks : personalTasks).filter((t: Task) => {
        const matchesSearch = t.name.toLowerCase().includes(taskSearchQuery.toLowerCase());
        const matchesStatus = taskStatusFilter.length === 0 || taskStatusFilter.includes('all') || taskStatusFilter.includes(t.status.toString());
        const matchesPriority = taskPriorityFilter.length === 0 || taskPriorityFilter.includes('all') || taskPriorityFilter.includes(t.priority.toString());
        const matchesMilestone = taskMilestoneFilter.length === 0 || taskMilestoneFilter.includes('all') || taskMilestoneFilter.includes(t.milestoneId || 'ungrouped');
        return matchesSearch && matchesStatus && matchesPriority && matchesMilestone;
    });

    const activeTask = (viewContext === 'all' ? tasks : personalTasks).find((t: Task) => (t.taskId || (t as any).id) === selectedTaskId);

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
        } catch (error) {
            console.error('Failed to delete evidence:', error);
            setErrorMessages(prev => ({ ...prev, [taskId]: 'Failed to delete file. Please reload the page if the issue persists.' }));
        } finally {
            setPendingDelete(null);
        }
    };


    const handleSubmitForReview = async (taskId: string) => {
        const drafts = (evidenceFiles[taskId] || []);
        const uploadedCount = (uploadedEvidences[taskId] || []).length;

        if (uploadedCount === 0 && drafts.length === 0) {
            setErrorMessages(prev => ({ ...prev, [taskId]: 'Upload at least 1 evidence before submitting.' }));
            return;
        }

        setErrorMessages(prev => ({ ...prev, [taskId]: null }));
        setSubmittingId(taskId);
        try {
            // First: Auto-upload any local drafts before final submission
            if (drafts.length > 0) {
                await taskService.uploadEvidences(taskId, drafts);
                setEvidenceFiles(prev => {
                    const newState = { ...prev };
                    delete newState[taskId];
                    return newState;
                });
                await fetchEvidences(taskId);
            }

            // Second: Update task status to Submitted - only happens if upload succeeds
            await taskService.updateStatus(taskId, TaskStatus.Submitted);
            refreshTasks();
            if (viewContext === 'personal') fetchPersonalTasks();
        } catch (error) {
            console.error('Failed to submit for review:', error);
            setErrorMessages(prev => ({ ...prev, [taskId]: 'Failed to submit. Please reload the page if the issue persists.' }));
        } finally {
            setSubmittingId(null);
        }
    };

    const handleApproveTask = async (taskId: string) => {
        setSubmittingId(taskId);
        try {
            await taskService.updateStatus(taskId, TaskStatus.Completed);
            refreshTasks();
            if (viewContext === 'personal') fetchPersonalTasks();
        } catch (error) {
            console.error('Failed to approve task:', error);
            setErrorMessages(prev => ({ ...prev, [taskId]: 'Failed to approve task. Please reload the page if the issue persists.' }));
        } finally {
            setSubmittingId(null);
        }
    };

    const handleRequestAdjusting = async (taskId: string) => {
        setSubmittingId(taskId);
        try {
            await taskService.updateStatus(taskId, TaskStatus.Adjusting);
            refreshTasks();
            if (viewContext === 'personal') fetchPersonalTasks();
        } catch (error) {
            console.error('Failed to request adjusting:', error);
            setErrorMessages(prev => ({ ...prev, [taskId]: 'Failed to request adjusting. Please reload the page if the issue persists.' }));
        } finally {
            setSubmittingId(null);
        }
    };

    const handleStartTask = async (taskId: string) => {
        setSubmittingId(taskId);
        try {
            await taskService.updateStatus(taskId, TaskStatus.InProgress);
            refreshTasks();
            if (viewContext === 'personal') {
                fetchPersonalTasks();
            }
        } catch (error) {
            console.error('Failed to start task:', error);
            setErrorMessages(prev => ({ ...prev, [taskId]: 'Failed to start task. Please reload the page if the issue persists.' }));
        } finally {
            setSubmittingId(null);
        }
    };

    const handleAddNewClick = () => {
        setIsAddingNew(true);
        setSelectedTaskId(null);
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

                <div style={{ flex: 1, maxHeight: 'calc(100vh - 320px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '4px' }} className="custom-scrollbar">
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
                                            const selMilestone = milestones.find(m => m.milestoneId === form.milestoneId);
                                            const today = new Date().toLocaleDateString('en-CA');

                                            // minDate is the later of (milestone start OR project start) AND today
                                            let baseMin = selMilestone?.startDate
                                                ? new Date(selMilestone.startDate).toLocaleDateString('en-CA')
                                                : (project.startDate ? new Date(project.startDate).toLocaleDateString('en-CA') : '');

                                            const minDate = (baseMin && baseMin > today) ? baseMin : today;
                                            const maxDate = selMilestone?.dueDate ? new Date(selMilestone.dueDate).toLocaleDateString('en-CA') : (project.endDate ? new Date(project.endDate).toLocaleDateString('en-CA') : '');

                                            return (
                                                <>
                                                    <div>
                                                        <label style={labelStyle}>Start Date <span style={{ color: '#ef4444' }}>*</span></label>
                                                        <input
                                                            type="date"
                                                            style={{ ...inputStyle, border: (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0' }}
                                                            value={form.startDate}
                                                            min={minDate}
                                                            max={form.endDate || maxDate}
                                                            onChange={(e) => handleNewTaskChange(form.tempId, 'startDate', e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={labelStyle}>Due Date <span style={{ color: '#ef4444' }}>*</span></label>
                                                        <input
                                                            type="date"
                                                            style={{ ...inputStyle, border: (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0' }}
                                                            value={form.endDate}
                                                            min={form.startDate || minDate}
                                                            max={maxDate}
                                                            onChange={(e) => handleNewTaskChange(form.tempId, 'endDate', e.target.value)}
                                                        />
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={labelStyle}>Priority</label>
                                            <select style={inputStyle} value={form.priority || 2} onChange={(e) => handleNewTaskChange(form.tempId, 'priority', parseInt(e.target.value))}>
                                                <option value={1}>Low</option>
                                                <option value={2}>Medium</option>
                                                <option value={3}>High</option>
                                                <option value={4}>Critical</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Milestone</label>
                                            <select style={inputStyle} value={form.milestoneId} onChange={(e) => handleNewTaskChange(form.tempId, 'milestoneId', e.target.value)}>
                                                <option value="">Select Milestone</option>
                                                {milestones
                                                    .filter(m => m.status !== MilestoneStatus.Completed && m.status !== MilestoneStatus.Cancelled)
                                                    .map(m => <option key={m.milestoneId} value={m.milestoneId}>{m.name}</option>)
                                                }
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Assignee</label>
                                        <select style={inputStyle} value={form.assigneeId} onChange={(e) => handleNewTaskChange(form.tempId, 'assigneeId', e.target.value)}>
                                            <option value="">Unassigned</option>
                                            {projectMembers.filter(m => m.projectRole !== 1).map(m => (
                                                <option key={m.userId || m.membershipId || m.id} value={m.userId || m.membershipId || m.id}>
                                                    {m.fullName || m.userName}
                                                </option>
                                            ))}
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
                                            {projectMembers.filter(m => m.projectRole !== 1 && (m.userId || m.membershipId || m.id) !== form.assigneeId).map(m => {
                                                const mId = m.userId || m.membershipId || m.id;
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
                                            disabled={submittingId === form.tempId || !form.name || !form.description || !form.startDate || !form.endDate || (new Date(form.startDate) > new Date(form.endDate))}
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
                                                opacity: (submittingId === form.tempId || !form.name || !form.description || !form.startDate || !form.endDate || (new Date(form.startDate) > new Date(form.endDate))) ? 0.6 : 1
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>{activeTask.name}</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {(() => {
                                            const s = getStatusColor(activeTask.status);
                                            return <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '5px', background: s.bg, color: s.text, textTransform: 'uppercase' }}>{s.label}</span>;
                                        })()}
                                        {(() => {
                                            const p = parseInt(activeTask.priority?.toString() || '1');
                                            const labels = ['Low', 'Medium', 'High', 'Critical'];
                                            const colors = ['#f1f5f9', '#eff6ff', '#fff7ed', '#fef2f2'];
                                            const texts = ['#64748b', '#3b82f6', '#f97316', '#ef4444'];
                                            return <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '5px', background: colors[p - 1], color: texts[p - 1], textTransform: 'uppercase' }}>{labels[p - 1]} Priority</span>;
                                        })()}
                                    </div>
                                </div>
                            </div>

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
                                    <div style={{ fontSize: '0.75rem', color: '#1e293b', fontWeight: 600 }}>
                                        {milestones.find(m => m.milestoneId === activeTask.milestoneId)?.name || 'Ungrouped'}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Assignee</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '28px', height: '28px', background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={14} color="#64748b" />
                                        </div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                                            {(activeTask as any).assigneeName || (activeTask as any).assignedToName || 'Unassigned'}
                                        </div>
                                    </div>

                                    {(() => {
                                        const collabs = (activeTask as any).collaborators || (activeTask as any).supportMembers || (activeTask as any).supportMemberIds || (activeTask as any).collaboratorIds || [];
                                        if (collabs.length === 0) return null;
                                        return (
                                            <div style={{ marginTop: '0.25rem', position: 'relative' }}>
                                                <button
                                                    onClick={() => setShowCollabs(!showCollabs)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0',
                                                        padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', width: '100%', transition: 'all 0.2s',
                                                        justifyContent: 'flex-start'
                                                    }}
                                                >
                                                    <Users size={14} style={{ color: '#94a3b8' }} />
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', flex: 1, textAlign: 'left' }}>
                                                        Collaborators ({collabs.length})
                                                    </div>
                                                    <ChevronDown size={14} style={{ color: '#94a3b8', transform: showCollabs ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                                </button>

                                                {showCollabs && (
                                                    <div style={{
                                                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                                                        background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '6px',
                                                        display: 'flex', flexDirection: 'column', gap: '4px',
                                                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)'
                                                    }}>
                                                        {collabs.map((collab: any, index: number) => {
                                                            const fullName = collab.fullName || collab.userName || 'Member';
                                                            const email = collab.email || 'No email';
                                                            const role = collab.roleName || (collab.projectRole === 4 ? 'Leader' : 'Researcher');

                                                            return (
                                                                <div key={index} style={{ display: 'flex', flexDirection: 'column', padding: '8px 10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b' }}>{fullName}</span>
                                                                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--primary-color)', opacity: 0.8, textTransform: 'uppercase' }}>{role}</span>
                                                                    </div>
                                                                    <span style={{ fontSize: '0.65rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Task Description</label>
                                <div style={{ fontSize: '0.85rem', color: '#445469', lineHeight: 1.6, background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>{activeTask.description || 'No description provided.'}</div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* Evidence Section - Management approach */}
                                {(() => {
                                    const taskId = activeTask.taskId || (activeTask as any).id;
                                    const canUpload = [TaskStatus.Todo, TaskStatus.InProgress, TaskStatus.Adjusting, TaskStatus.Missed].includes(activeTask.status) &&
                                        (viewContext === 'personal' || (activeTask.memberId || (activeTask as any).assignedToId) === myMembershipId);
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

                                            {/* Submit Actions */}
                                            {canUpload && [TaskStatus.InProgress, TaskStatus.Adjusting, TaskStatus.Missed].includes(activeTask.status) && (
                                                <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                                                    <button
                                                        onClick={() => handleSubmitForReview(taskId)}
                                                        disabled={(submittingId === taskId) || (drafts.length + uploaded.length === 0)}
                                                        style={{
                                                            width: '100%', padding: '0.75rem', borderRadius: '10px', fontWeight: 800, fontSize: '0.75rem',
                                                            cursor: (drafts.length + uploaded.length === 0) ? 'not-allowed' : 'pointer',
                                                            background: (drafts.length + uploaded.length === 0) ? '#f1f5f9' : 'white',
                                                            color: (drafts.length + uploaded.length === 0) ? '#94a3b8' : 'var(--accent-color)',
                                                            border: `2px solid ${(drafts.length + uploaded.length === 0) ? '#e2e8f0' : 'var(--accent-color)'}`
                                                        }}
                                                    >
                                                        {(submittingId === taskId) ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                                        {(drafts.length + uploaded.length === 0) ? 'SUBMIT BLOCKED (NEED EVIDENCE)' : (drafts.length > 0 ? 'UPLOAD & SUBMIT' : 'SUBMIT FOR REVIEW')}
                                                    </button>
                                                </div>
                                            )}
                                            {errorMessages[taskId] && <div style={{ color: '#ef4444', fontSize: '0.65rem', fontWeight: 700, marginTop: '4px' }}>{errorMessages[taskId]}</div>}
                                        </div>
                                    );
                                })()}

                                {/* Primary Action: Start Working (Only for Todo) */}
                                {activeTask.status === TaskStatus.Todo && (viewContext === 'personal' || (activeTask.memberId || (activeTask as any).assignedToId) === myMembershipId) && (
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

                                {isSpecialRole && activeTask.status === TaskStatus.Submitted && (
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
                                {!(viewContext === 'personal' || (activeTask.memberId || (activeTask as any).assignedToId) === myMembershipId) && (
                                    <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.75rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                        <User size={24} style={{ opacity: 0.2, marginBottom: '8px' }} />
                                        <div>Viewing as {isSpecialRole ? 'Admin' : 'Observer'}. Actions restricted to the assignee.</div>
                                    </div>
                                )}
                            </div>
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
                                                        href={previewEvidence.fileUrl}
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
                                                const ext = previewEvidence.fileName?.split('.').pop()?.toLowerCase();
                                                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
                                                const isPDF = ext === 'pdf';
                                                const isDoc = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '');

                                                if (isImage) {
                                                    return (
                                                        <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'center', minHeight: '100px' }}>
                                                            <img
                                                                src={previewEvidence.fileUrl}
                                                                alt={previewEvidence.fileName}
                                                                style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', display: 'block' }}
                                                            />
                                                        </div>
                                                    );
                                                }

                                                if (isPDF) {
                                                    return (
                                                        <div style={{ width: '100%', height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                                                            <iframe
                                                                src={`${previewEvidence.fileUrl}#toolbar=0&navpanes=0`}
                                                                style={{ width: '100%', height: '100%', border: 'none' }}
                                                                title="PDF Preview"
                                                            />
                                                        </div>
                                                    );
                                                }

                                                if (isDoc) {
                                                    return (
                                                        <div style={{ width: '100%', height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                                                            <iframe
                                                                src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewEvidence.fileUrl)}&embedded=true`}
                                                                style={{ width: '100%', height: '100%', border: 'none' }}
                                                                title="Document Preview"
                                                            />
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div style={{ width: '100%', height: '140px', background: '#f8fafc', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', border: '1px dashed #cbd5e1' }}>
                                                        <Paperclip size={24} color="#94a3b8" />
                                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Visual preview unavailable</div>
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
