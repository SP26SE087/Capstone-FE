import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, Plus, X, LayoutGrid, User, Calendar, Loader2,
    Target, Filter, ChevronDown, Check, Clock, RotateCcw, Sparkles, CheckCircle2
} from 'lucide-react';
import { Project, Task, TaskStatus, Milestone, MilestoneStatus } from '@/types';
import ActivityTimeline from './ActivityTimeline';
import { taskService } from '@/services';
import { milestoneService } from '@/services/milestoneService';
import TaskDetailPanel from './TaskDetailPanel';

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
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const getStatusColor = (status: TaskStatus) => {
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

const DetailsTasks: React.FC<DetailsTasksProps> = ({
    tasks: _tasks, filteredTasks, taskSearchQuery, setTaskSearchQuery,
    taskStatusFilter, setTaskStatusFilter, taskPriorityFilter, setTaskPriorityFilter,
    taskMilestoneFilter, setTaskMilestoneFilter, viewMode, setViewMode,
    canManageTasks, isArchived,
    newTasks, handleAddTaskForm, handleRemoveTaskForm, handleNewTaskChange, handleSaveNewTask,
    milestones, projectMembers, project, formatProjectDate, currentMember, refreshTasks, showToast
}) => {
    const [personalTasks, setPersonalTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [panelRefreshKey, setPanelRefreshKey] = useState(0);
    const isSpecialRole = currentMember?.projectRole === 1 || currentMember?.projectRole === 4;
    const [viewContext, setViewContext] = useState<'personal' | 'all' | 'ai-drafts'>(isSpecialRole ? 'all' : 'personal');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [openCollabDropdownId, setOpenCollabDropdownId] = useState<string | null>(null);
    const [openAssigneeDropdownId, setOpenAssigneeDropdownId] = useState<string | null>(null);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    // ─── AI Task Generation State ─────────────────────────────────────────────
    const [aiTaskPanelOpen, setAiTaskPanelOpen] = useState(false);
    const [aiTaskMilestoneId, setAiTaskMilestoneId] = useState<string>('');
    const [generatingAITasks, setGeneratingAITasks] = useState(false);
    const [aiTaskDrafts, setAiTaskDrafts] = useState<any[]>([]);
    const [savingAiDraftId, setSavingAiDraftId] = useState<string | null>(null);
    const [selectedAiDraftKey, setSelectedAiDraftKey] = useState<string | null>(null);

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

    useEffect(() => {
        if (viewContext === 'personal') {
            fetchPersonalTasks();
        }
    }, [viewContext, fetchPersonalTasks]);

    const displayTasks = (viewContext === 'all' ? filteredTasks : personalTasks).filter((t: Task) => {
        const matchesSearch = t.name.toLowerCase().includes(taskSearchQuery.toLowerCase());
        const matchesStatus = taskStatusFilter.length === 0 || taskStatusFilter.includes('all') || taskStatusFilter.includes(t.status.toString());
        const matchesPriority = taskPriorityFilter.length === 0 || taskPriorityFilter.includes('all') || taskPriorityFilter.includes(t.priority.toString());
        const matchesMilestone = taskMilestoneFilter.length === 0 || taskMilestoneFilter.includes('all') || taskMilestoneFilter.includes(t.milestoneId || 'ungrouped');
        return matchesSearch && matchesStatus && matchesPriority && matchesMilestone;
    });

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
            const identifiers = [m.milestoneId, m.id, m.ID, m.name, m.milestoneName].map(v => normalizeId(v).toLowerCase()).filter(Boolean);
            return identifiers.includes(target);
        });
    };
    const getMilestoneOptionId = (milestone: any): string => {
        return normalizeId(milestone?.milestoneId || milestone?.id || milestone?.ID || milestone?.milestoneID);
    };
    const getMemberOptionId = (member: any): string => {
        const guid = member?.membershipId || member?.memberId || member?.userId || (member?.id?.length > 20 ? member.id : '');
        return normalizeId(guid);
    };

    const today = toDateInput(new Date());

    const handleAddNewClick = () => {
        setIsAddingNew(true);
        setSelectedTaskId(null);
        setAiTaskPanelOpen(false);
        setSelectedAiDraftKey(null);
        if (viewContext === 'ai-drafts') setViewContext(isSpecialRole ? 'all' : 'personal');
        handleAddTaskForm();
    };

    const onSaveTask = async (id: string) => {
        setSubmittingId(id);
        try {
            await handleSaveNewTask(id);
            if (viewContext === 'personal') {
                fetchPersonalTasks();
            }
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
        setSelectedAiDraftKey(null);
        const tId = task.taskId || (task as any).id;
        setSelectedTaskId(tId);
    };

    const handleGenerateAITasks = async () => {
        if (!aiTaskMilestoneId || generatingAITasks) return;
        setGeneratingAITasks(true);
        try {
            const results = await milestoneService.generateAITasks(aiTaskMilestoneId);
            const list = Array.isArray(results) ? results : [];
            if (list.length === 0) {
                showToast('AI found no task suggestions for this milestone.', 'warning');
                return;
            }
            setAiTaskDrafts(list.map((t: any, i: number) => ({
                _key: `aitd-${Date.now()}-${i}`,
                milestoneId: aiTaskMilestoneId,
                name: t.name || '',
                description: t.description || '',
                priority: t.priority ?? 2,
                startDate: t.startDate ? t.startDate.split('T')[0] : '',
                dueDate: t.dueDate ? t.dueDate.split('T')[0] : '',
                _dismissed: false,
            })));
            setViewContext('ai-drafts');
            setSelectedAiDraftKey(null);
            setSelectedTaskId(null);
            setIsAddingNew(false);
            showToast(`AI suggested ${list.length} task${list.length !== 1 ? 's' : ''}. Click any in the AI Drafts tab to review.`, 'info');
        } catch (error: any) {
            showToast(error?.response?.data?.message || error?.message || 'AI task generation failed.', 'error');
        } finally {
            setGeneratingAITasks(false);
        }
    };

    const handleAiDraftChange = (key: string, field: string, value: any) => {
        setAiTaskDrafts(prev => prev.map(d => d._key === key ? { ...d, [field]: value } : d));
    };

    const handleAcceptAITaskDraft = async (draft: any) => {
        if (savingAiDraftId) return;
        setSavingAiDraftId(draft._key);
        try {
            const pId = project.projectId || (project as any).id;
            await taskService.create({
                projectId: pId,
                milestoneId: draft.milestoneId || undefined,
                name: draft.name,
                description: draft.description,
                priority: draft.priority,
                startDate: draft.startDate || undefined,
                dueDate: draft.dueDate || undefined,
                memberId: draft.assigneeId || null,
                status: 1,
            });
            setAiTaskDrafts(prev => prev.map(d => d._key === draft._key ? { ...d, _saved: true } : d));
            await refreshTasks();
            if (viewContext === 'personal') fetchPersonalTasks();
            showToast(`Task "${draft.name}" created!`, 'success');
        } catch (e: any) {
            showToast(e?.response?.data?.message || e?.message || 'Failed to create task.', 'error');
        } finally {
            setSavingAiDraftId(null);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            if (viewContext === 'personal') {
                await fetchPersonalTasks();
            }
            await refreshTasks();
            setPanelRefreshKey(k => k + 1);
        } finally {
            setRefreshing(false);
        }
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

    // Shared view toggle — renders outside both views so position never changes
    const viewToggle = (
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <button
                onClick={() => setViewMode('list')}
                style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', background: viewMode === 'list' ? 'white' : 'transparent', color: viewMode === 'list' ? 'var(--primary-color)' : '#64748b', boxShadow: viewMode === 'list' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <LayoutGrid size={12} /> List
                </div>
            </button>
            <button
                onClick={() => setViewMode('timeline')}
                style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', background: viewMode === 'timeline' ? 'white' : 'transparent', color: viewMode === 'timeline' ? 'var(--primary-color)' : '#64748b', boxShadow: viewMode === 'timeline' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={12} /> Timeline
                </div>
            </button>
        </div>
    );

    // Shared persistent header — rendered once, above both views
    const sharedHeader = (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Tasks</h3>
                {viewMode === 'list' && (
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
                        {aiTaskDrafts.filter(d => !d._dismissed).length > 0 && (
                            <button
                                onClick={() => { setViewContext('ai-drafts'); setSelectedTaskId(null); setIsAddingNew(false); }}
                                style={{ padding: '5px 10px', borderRadius: '8px', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', background: viewContext === 'ai-drafts' ? '#7c3aed' : 'transparent', color: viewContext === 'ai-drafts' ? 'white' : '#7c3aed', boxShadow: viewContext === 'ai-drafts' ? '0 2px 4px rgba(124,58,237,0.2)' : 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <Sparkles size={11} /> AI ({aiTaskDrafts.filter(d => !d._dismissed).length})
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {viewToggle}
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: refreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', opacity: refreshing ? 0.7 : 1, fontSize: '0.78rem', fontWeight: 600 }}
                >
                    <RotateCcw size={13} className={refreshing ? 'animate-spin' : ''} />
                    Refresh
                </button>
                {viewMode === 'list' && canManageTasks && !isArchived && (
                    <>
                        <button
                            onClick={() => {
                                const next = !aiTaskPanelOpen;
                                setAiTaskPanelOpen(next);
                                if (next) {
                                    setAiTaskDrafts([]);
                                    setAiTaskMilestoneId(milestones[0] ? (milestones[0].milestoneId || (milestones[0] as any).id || '') : '');
                                    setSelectedAiDraftKey(null);
                                    setSelectedTaskId(null);
                                    setIsAddingNew(false);
                                } else {
                                    setSelectedAiDraftKey(null);
                                    if (viewContext === 'ai-drafts') setViewContext(isSpecialRole ? 'all' : 'personal');
                                }
                            }}
                            title="Let AI generate tasks for a milestone"
                            style={{
                                padding: '8px 12px', borderRadius: '8px',
                                border: `1.5px solid ${aiTaskPanelOpen ? '#7c3aed' : '#c4b5fd'}`,
                                background: aiTaskPanelOpen ? '#7c3aed' : '#faf5ff',
                                color: aiTaskPanelOpen ? 'white' : '#7c3aed',
                                fontWeight: 700, fontSize: '0.8rem',
                                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <Sparkles size={14} /> AI Tasks
                        </button>
                        <button onClick={handleAddNewClick} style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--primary-color)', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <Plus size={16} /> New Task
                        </button>
                    </>
                )}
            </div>
        </div>
    );

    if (viewMode === 'timeline') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                {sharedHeader}
                <div style={{ flex: 1, minHeight: 0 }}>
                    <ActivityTimeline
                        projectId={project.projectId || (project as any).id}
                        milestones={milestones}
                        projectMembers={projectMembers}
                        currentMember={currentMember}
                        isSpecialRole={isSpecialRole}
                        viewMode={viewMode}
                    />
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
            {sharedHeader}
            <div style={{ display: 'flex', gap: '1.5rem', flex: 1, alignItems: 'stretch', minHeight: 0 }}>
            {/* Column 1: Task List & Filters */}
            <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
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
                                                    const val = m.milestoneId || (m as any).id;
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
                    {viewContext === 'ai-drafts' ? (
                        aiTaskDrafts.filter(d => !d._dismissed).length > 0 ? (
                            aiTaskDrafts.filter(d => !d._dismissed).map(draft => {
                                const isActive = selectedAiDraftKey === draft._key;
                                return (
                                    <div key={draft._key} onClick={() => { setSelectedAiDraftKey(draft._key); setSelectedTaskId(null); setIsAddingNew(false); }} style={{
                                        padding: '1rem', background: 'white',
                                        border: `1px solid ${isActive ? 'var(--primary-color)' : '#e2e8f0'}`,
                                        borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                                        boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                        opacity: draft._saved ? 0.7 : 1, position: 'relative'
                                    }}>
                                        {draft._saved && <span style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '0.6rem', color: '#10b981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px' }}><CheckCircle2 size={11} /> Saved</span>}
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: isActive ? 'var(--primary-color)' : '#1e293b', marginBottom: '8px', paddingRight: draft._saved ? '52px' : 0 }}>{draft.name}</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}><Sparkles size={11} /> AI Draft</div>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: draft._saved ? '#dcfce7' : '#f1f5f9', color: draft._saved ? '#16a34a' : '#475569' }}>{draft._saved ? 'SAVED' : 'PENDING'}</div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ textAlign: 'center', padding: '4rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px' }}>
                                <CheckCircle2 size={28} style={{ color: '#94a3b8', opacity: 0.4, margin: '0 auto 0.75rem' }} />
                                <p style={{ color: '#94a3b8', margin: 0, fontWeight: 600 }}>All AI drafts reviewed!</p>
                            </div>
                        )
                    ) : loadingTasks ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 size={24} className="animate-spin-slow" style={{ opacity: 0.3, margin: '0 auto' }} /></div>
                    ) : displayTasks.length > 0 ? (
                        displayTasks.map(task => {
                            const tId = task.taskId || (task as any).id;
                            const isActive = selectedTaskId === tId;
                            const sStyle = getStatusColor(task.status);
                            return (
                                <div key={tId} onClick={() => onTaskSelect(task)} style={{
                                    padding: '1rem', background: 'white', border: `1px solid ${isActive ? 'var(--primary-color)' : '#e2e8f0'}`, borderRadius: '12px', cursor: 'pointer',
                                    transition: 'all 0.2s', boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                    position: 'relative', overflow: 'hidden'
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

            {/* Column 2: AI Generator / Task Detail / Create Form */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: '320px' }}>
                {/* ─ Header title row ─ */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '0.5rem', borderBottom: '2px solid #1e293b', marginBottom: '0.75rem' }}>
                    {selectedAiDraftKey ? <Sparkles size={18} style={{ color: '#7c3aed' }} /> : (selectedTaskId && !isAddingNew) ? <Target size={18} /> : aiTaskPanelOpen ? <Sparkles size={18} style={{ color: '#7c3aed' }} /> : isAddingNew ? <Plus size={18} /> : <Target size={18} />}
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: (selectedAiDraftKey || (aiTaskPanelOpen && !selectedTaskId && !isAddingNew)) ? '#4c1d95' : '#1e293b' }}>
                        {selectedAiDraftKey ? 'AI Draft Review' : (selectedTaskId && !isAddingNew) ? 'Task Context' : aiTaskPanelOpen ? 'AI Task Generator' : isAddingNew ? 'Create Task' : 'Task Context'}
                    </h4>
                    {aiTaskPanelOpen && (
                        <button
                            onClick={() => { setAiTaskPanelOpen(false); setSelectedAiDraftKey(null); if (viewContext === 'ai-drafts') setViewContext(isSpecialRole ? 'all' : 'personal'); }}
                            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', display: 'flex', alignItems: 'center', padding: '2px' }}
                            title="Close AI Generator"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* ─ Pinned milestone (shared for manual, AI & task detail) ─ */}
                {(() => {
                    const showForCreate = (isAddingNew && newTasks.length > 0) || (aiTaskPanelOpen && !selectedAiDraftKey);
                    const showForDetail = !!(selectedTaskId && !isAddingNew && !selectedAiDraftKey);
                    const activeDraftForMilestone = selectedAiDraftKey ? aiTaskDrafts.find(d => d._key === selectedAiDraftKey) : null;
                    if (!showForCreate && !showForDetail && !activeDraftForMilestone) return null;

                    const labelStyle2: React.CSSProperties = { fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' };

                    if (showForDetail) {
                        const selectedTask = [...filteredTasks, ...personalTasks].find(t => (t.taskId || (t as any).id) === selectedTaskId);
                        const taskMilestoneId = (selectedTask as any)?.milestoneId;
                        const taskMilestone = taskMilestoneId ? resolveMilestone(taskMilestoneId) : null;
                        return (
                            <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.75rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                <label style={{ ...labelStyle2, color: '#475569' }}>Milestone</label>
                                {taskMilestone ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{taskMilestone.name}</span>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Calendar size={11} />{formatProjectDate(taskMilestone.startDate)} — {formatProjectDate(taskMilestone.dueDate)}
                                        </span>
                                    </div>
                                ) : (
                                    <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>No Milestone</span>
                                )}
                            </div>
                        );
                    }

                    if (activeDraftForMilestone) {
                        const draftMilestone = activeDraftForMilestone.milestoneId ? resolveMilestone(activeDraftForMilestone.milestoneId) : null;
                        return (
                            <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <label style={{ ...labelStyle2, color: '#475569' }}>Milestone</label>
                                <select
                                    value={activeDraftForMilestone.milestoneId || ''}
                                    onChange={e => handleAiDraftChange(activeDraftForMilestone._key, 'milestoneId', e.target.value)}
                                    style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', fontSize: '0.82rem', background: 'white', boxSizing: 'border-box', border: '1.5px solid #e2e8f0', color: '#1e293b', cursor: 'pointer' }}
                                >
                                    <option value="">No Milestone</option>
                                    {milestones
                                        .filter(m => m.status !== MilestoneStatus.Completed && m.status !== MilestoneStatus.Cancelled)
                                        .map(m => {
                                            const mId = getMilestoneOptionId(m);
                                            return <option key={mId} value={mId}>{m.name} ({formatProjectDate(m.startDate)} – {formatProjectDate(m.dueDate)})</option>;
                                        })
                                    }
                                </select>
                                {draftMilestone && (
                                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Calendar size={10} />{formatProjectDate(draftMilestone.startDate)} — {formatProjectDate(draftMilestone.dueDate)}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    const selectedMilestoneId = aiTaskMilestoneId || (newTasks[0]?.milestoneId ?? '');
                    const hintMilestone = selectedMilestoneId ? resolveMilestone(selectedMilestoneId) : null;
                    return (
                        <div style={{
                            marginBottom: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: '10px',
                            background: aiTaskPanelOpen ? 'linear-gradient(135deg, #fdf4ff 0%, #eff6ff 100%)' : '#f8fafc',
                            border: aiTaskPanelOpen ? '1.5px solid #c4b5fd' : '1px solid #e2e8f0',
                        }}>
                            <label style={{ ...labelStyle2, color: aiTaskPanelOpen ? '#7c3aed' : '#475569' }}>Milestone</label>
                            <select
                                value={selectedMilestoneId}
                                disabled={generatingAITasks}
                                onChange={e => {
                                    const val = e.target.value;
                                    setAiTaskMilestoneId(val);
                                    if (isAddingNew && newTasks.length > 0) handleNewTaskChange(newTasks[0].tempId, 'milestoneId', val);
                                }}
                                style={{
                                    width: '100%', padding: '6px 10px', borderRadius: '8px', fontSize: '0.82rem', background: 'white', boxSizing: 'border-box',
                                    border: aiTaskPanelOpen ? '1.5px solid #c4b5fd' : '1.5px solid #e2e8f0',
                                    color: aiTaskPanelOpen ? '#4c1d95' : '#1e293b',
                                    cursor: generatingAITasks ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <option value="">No Milestone</option>
                                {milestones
                                    .filter(m => m.status !== MilestoneStatus.Completed && m.status !== MilestoneStatus.Cancelled)
                                    .map(m => {
                                        const mId = getMilestoneOptionId(m);
                                        const s = formatProjectDate(m.startDate);
                                        const e = formatProjectDate(m.dueDate);
                                        return <option key={mId} value={mId}>{m.name} ({s} – {e})</option>;
                                    })
                                }
                            </select>
                            {hintMilestone && (
                                <div style={{ fontSize: '0.68rem', color: aiTaskPanelOpen ? '#6b21a8' : '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Calendar size={10} />
                                    {formatProjectDate(hintMilestone.startDate)} — {formatProjectDate(hintMilestone.dueDate)}
                                </div>
                            )}
                        </div>
                    );
                })()}

                <div style={{ flex: 1, background: 'white', borderRadius: '16px', border: `1px solid ${aiTaskPanelOpen ? '#e9d5ff' : '#e2e8f0'}`, boxShadow: '0 8px 30px rgba(0,0,0,0.03)', padding: '1.5rem', overflowY: 'auto' }} className="custom-scrollbar">
                    {/* AI Draft Detail — editable form */}
                    {(() => {
                        // Task detail takes priority over AI panel
                        if (selectedTaskId && !isAddingNew && !selectedAiDraftKey) return null;

                        const activeDraft = aiTaskDrafts.find(d => d._key === selectedAiDraftKey);
                        if (activeDraft) {
                            const selMilestone = resolveMilestone(activeDraft.milestoneId);
                            const mStart = toDateInput(selMilestone?.startDate);
                            const mEnd = toDateInput(selMilestone?.dueDate);
                            const isStartAfterDue = !!activeDraft.startDate && !!activeDraft.dueDate && activeDraft.startDate > activeDraft.dueDate;
                            const isStartBeforeMilestone = !!selMilestone && !!activeDraft.startDate && !!mStart && activeDraft.startDate < mStart;
                            const isDueAfterMilestone = !!selMilestone && !!activeDraft.dueDate && !!mEnd && activeDraft.dueDate > mEnd;
                            const startHasError = isStartAfterDue || isStartBeforeMilestone;
                            const dueHasError = isStartAfterDue || isDueAfterMilestone;
                            const minDate = (mStart && mStart > today) ? mStart : today;
                            const assigneeKey = `__aidraft_assignee__${activeDraft._key}`;
                            const isAssigneeOpen = openAssigneeDropdownId === assigneeKey;
                            const selectedMember = projectMembers.find(m => getMemberOptionId(m) === activeDraft.assigneeId);
                            const filteredAssignees = projectMembers
                                .filter(m => m.projectRole !== 1 && m.projectRoleName !== 'Lab Director' && m.roleName !== 'Lab Director')
                                .filter(m => !memberSearchQuery || (m.fullName || m.userName || '').toLowerCase().includes(memberSearchQuery.toLowerCase()) || (m.email || '').toLowerCase().includes(memberSearchQuery.toLowerCase()));
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {/* Badge row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: 24, height: 24, borderRadius: 7, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Sparkles size={12} color="white" />
                                        </div>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>AI Draft — Edit before saving</span>
                                        {activeDraft._saved && <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}><CheckCircle2 size={12} /> Saved</span>}
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Task Name <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input
                                            type="text" style={inputStyle}
                                            value={activeDraft.name}
                                            onChange={e => handleAiDraftChange(activeDraft._key, 'name', e.target.value)}
                                            placeholder="e.g. Conduct user interviews"
                                        />
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Description <span style={{ color: '#ef4444' }}>*</span></label>
                                        <textarea
                                            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
                                            value={activeDraft.description}
                                            onChange={e => handleAiDraftChange(activeDraft._key, 'description', e.target.value)}
                                            placeholder="Write a brief overview..."
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {(isStartBeforeMilestone || isDueAfterMilestone) && selMilestone && (
                                            <div style={{ gridColumn: 'span 2', fontSize: '0.65rem', color: '#ef4444', fontWeight: 500 }}>
                                                Task dates must be within milestone: {mStart ? `${mStart} – ` : ''}{mEnd || ''}
                                            </div>
                                        )}
                                        <div>
                                            <label style={labelStyle}>Start Date <span style={{ color: '#ef4444' }}>*</span></label>
                                            <input type="date"
                                                style={{ ...inputStyle, border: startHasError ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0' }}
                                                value={activeDraft.startDate}
                                                min={minDate} max={activeDraft.dueDate || mEnd || ''}
                                                onChange={e => handleAiDraftChange(activeDraft._key, 'startDate', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Due Date <span style={{ color: '#ef4444' }}>*</span></label>
                                            <input type="date"
                                                style={{ ...inputStyle, border: dueHasError ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0' }}
                                                value={activeDraft.dueDate}
                                                min={activeDraft.startDate || minDate} max={mEnd || ''}
                                                onChange={e => handleAiDraftChange(activeDraft._key, 'dueDate', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Priority</label>
                                        <select style={inputStyle} value={activeDraft.priority || 2} onChange={e => handleAiDraftChange(activeDraft._key, 'priority', parseInt(e.target.value))}>
                                            <option value={1}>Low</option>
                                            <option value={2}>Medium</option>
                                            <option value={3}>High</option>
                                            <option value={4}>Critical</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Assignee</label>
                                        <div style={{ position: 'relative' }}>
                                            <button type="button"
                                                onClick={() => { setOpenAssigneeDropdownId(isAssigneeOpen ? null : assigneeKey); setMemberSearchQuery(''); }}
                                                style={{ ...inputStyle, padding: '0.5rem 0.8rem', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'white', border: isAssigneeOpen ? '1.5px solid var(--primary-color)' : '1.5px solid #e2e8f0', boxShadow: isAssigneeOpen ? '0 0 0 3px rgba(var(--primary-rgb), 0.1)' : 'none' }}
                                            >
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: selectedMember ? 'var(--accent-bg)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0, position: 'relative' }}>
                                                    <User size={12} style={{ color: selectedMember ? 'var(--primary-color)' : '#94a3b8' }} />
                                                    {(selectedMember?.avatarUrl || selectedMember?.AvatarUrl || selectedMember?.avatar) && (
                                                        <img src={selectedMember.avatarUrl || selectedMember.AvatarUrl || selectedMember.avatar} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                                                    )}
                                                </div>
                                                <span style={{ flex: 1, color: selectedMember ? '#1e293b' : '#94a3b8', fontWeight: selectedMember ? 600 : 400, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {selectedMember ? (selectedMember.fullName || selectedMember.userName) : 'Select Assignee'}
                                                </span>
                                                <ChevronDown size={14} style={{ flexShrink: 0, color: '#94a3b8', transform: isAssigneeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                            </button>
                                            {isAssigneeOpen && (
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
                                                            <div onClick={() => { handleAiDraftChange(activeDraft._key, 'assigneeId', ''); setOpenAssigneeDropdownId(null); }}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', cursor: 'pointer', borderRadius: '6px', background: !activeDraft.assigneeId ? '#f1f5f9' : 'transparent' }}>
                                                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1' }}><User size={14} color="#94a3b8" /></div>
                                                                <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b', fontStyle: 'italic' }}>Unassigned</div>
                                                                {!activeDraft.assigneeId && <Check size={14} style={{ marginLeft: 'auto', color: 'var(--primary-color)' }} />}
                                                            </div>
                                                            {filteredAssignees.map(m => {
                                                                const mId = getMemberOptionId(m);
                                                                const isSelected = activeDraft.assigneeId === mId;
                                                                const initials = (m.fullName || m.userName || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                                                                return (
                                                                    <div key={mId} onClick={() => { handleAiDraftChange(activeDraft._key, 'assigneeId', mId); setOpenAssigneeDropdownId(null); }}
                                                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', cursor: 'pointer', borderRadius: '6px', background: isSelected ? '#f1f5f9' : 'transparent' }}>
                                                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0, position: 'relative' }}>
                                                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary-color)' }}>{initials}</span>
                                                                            {(m.avatarUrl || m.AvatarUrl || m.avatar) && (<img src={m.avatarUrl || m.AvatarUrl || m.avatar} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} />)}
                                                                        </div>
                                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isSelected ? 'var(--primary-color)' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.fullName || m.userName}</div>
                                                                            <div style={{ fontSize: '0.62rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
                                                                        </div>
                                                                        {isSelected && <Check size={14} style={{ flexShrink: 0, color: 'var(--primary-color)' }} />}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {!activeDraft._saved && (
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                                            <button
                                                onClick={() => { setAiTaskDrafts(prev => prev.map(d => d._key === activeDraft._key ? { ...d, _dismissed: true } : d)); setSelectedAiDraftKey(null); }}
                                                disabled={savingAiDraftId === activeDraft._key}
                                                style={{ flex: 1, padding: '9px', borderRadius: '10px', border: '1.5px solid #e9d5ff', background: 'white', color: '#7c3aed', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Dismiss
                                            </button>
                                            <button
                                                onClick={() => handleAcceptAITaskDraft(activeDraft)}
                                                disabled={savingAiDraftId === activeDraft._key || !activeDraft.name || !activeDraft.description || !activeDraft.startDate || !activeDraft.dueDate || isStartAfterDue}
                                                style={{ flex: 2, padding: '9px', borderRadius: '10px', border: 'none', background: (savingAiDraftId === activeDraft._key || !activeDraft.name || !activeDraft.description || !activeDraft.startDate || !activeDraft.dueDate || isStartAfterDue) ? '#a78bfa' : '#7c3aed', color: 'white', fontSize: '0.78rem', fontWeight: 700, cursor: (savingAiDraftId === activeDraft._key || !activeDraft.name || !activeDraft.description) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                            >
                                                {savingAiDraftId === activeDraft._key ? <><Clock size={13} className="animate-spin-slow" />Saving...</> : <><CheckCircle2 size={13} />Accept & Create</>}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        if (aiTaskPanelOpen && aiTaskDrafts.length > 0 && !selectedAiDraftKey) {
                            const remaining = aiTaskDrafts.filter(d => !d._dismissed && !d._saved).length;
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', height: '100%', textAlign: 'center', padding: '1rem' }}>
                                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Sparkles size={22} color="white" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#4c1d95', marginBottom: '4px' }}>{remaining} task{remaining !== 1 ? 's' : ''} to review</div>
                                        <div style={{ fontSize: '0.78rem', color: '#6b21a8' }}>Select a task from the <strong>AI Drafts</strong> tab to review details.</div>
                                    </div>
                                    <button
                                        onClick={() => setViewContext('ai-drafts')}
                                        style={{ padding: '8px 20px', borderRadius: '10px', border: 'none', background: '#7c3aed', color: 'white', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Sparkles size={13} /> View AI Drafts
                                    </button>
                                    <div style={{ borderTop: '1px solid #e9d5ff', width: '100%', paddingTop: '1rem' }}>
                                        <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 700, marginBottom: '8px' }}>Generate more tasks</div>
                                        <button
                                            onClick={handleGenerateAITasks}
                                            disabled={generatingAITasks || !aiTaskMilestoneId}
                                            style={{ width: '100%', padding: '8px', borderRadius: '10px', border: 'none', background: generatingAITasks || !aiTaskMilestoneId ? '#a78bfa' : '#7c3aed', color: 'white', fontSize: '0.78rem', fontWeight: 700, cursor: generatingAITasks || !aiTaskMilestoneId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
                                        >
                                            {generatingAITasks ? <><Clock size={13} className="animate-spin-slow" />Generating...</> : <><Sparkles size={13} />Suggest More Tasks</>}
                                        </button>
                                    </div>
                                </div>
                            );
                        }

                        if (aiTaskPanelOpen && aiTaskDrafts.length === 0) {
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', height: '100%', textAlign: 'center', padding: '1rem' }}>
                                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Sparkles size={22} color="white" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#4c1d95', marginBottom: '4px' }}>AI Task Generator</div>
                                        <div style={{ fontSize: '0.78rem', color: '#6b21a8', lineHeight: 1.6 }}>Select a milestone above, then click <strong>Suggest Tasks</strong> to get AI-powered task ideas.</div>
                                    </div>
                                    <button
                                        onClick={handleGenerateAITasks}
                                        disabled={generatingAITasks || !aiTaskMilestoneId}
                                        style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: generatingAITasks || !aiTaskMilestoneId ? '#a78bfa' : '#7c3aed', color: 'white', fontSize: '0.85rem', fontWeight: 700, cursor: generatingAITasks || !aiTaskMilestoneId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }}
                                    >
                                        {generatingAITasks ? <><Clock size={14} className="animate-spin-slow" />Generating...</> : <><Sparkles size={14} />Suggest Tasks</>}
                                    </button>
                                </div>
                            );
                        }

                        return null;
                    })()}

                    {isAddingNew && newTasks.length > 0 && !aiTaskPanelOpen && (
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
                                                    {milestoneHasError && selMilestone && (
                                                        <div style={{ gridColumn: 'span 2', fontSize: '0.65rem', color: '#ef4444', fontWeight: 500 }}>
                                                            Task dates must be within milestone: {mStart ? `${mStart} – ` : ''}{mEnd || ''}
                                                        </div>
                                                    )}
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
                                        {(() => {
                                            const assigneeKey = `__new_assignee__${form.tempId}`;
                                            const isOpen = openAssigneeDropdownId === assigneeKey;
                                            const selectedMember = projectMembers.find(m => getMemberOptionId(m) === form.assigneeId);

                                            const filteredMembers = projectMembers
                                                .filter(m => m.projectRole !== 1 && m.projectRoleName !== 'Lab Director' && m.roleName !== 'Lab Director')
                                                .filter(m => {
                                                    if (!memberSearchQuery) return true;
                                                    const query = memberSearchQuery.toLowerCase();
                                                    return (m.fullName || m.userName || '').toLowerCase().includes(query) ||
                                                           (m.email || '').toLowerCase().includes(query);
                                                });

                                            return (
                                                <div style={{ position: 'relative' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setOpenAssigneeDropdownId(isOpen ? null : assigneeKey);
                                                            setMemberSearchQuery('');
                                                        }}
                                                        style={{
                                                            ...inputStyle,
                                                            padding: '0.5rem 0.8rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            cursor: 'pointer',
                                                            background: 'white',
                                                            border: isOpen ? '1.5px solid var(--primary-color)' : '1.5px solid #e2e8f0',
                                                            boxShadow: isOpen ? '0 0 0 3px rgba(var(--primary-rgb), 0.1)' : 'none'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            background: selectedMember ? 'var(--accent-bg)' : '#f1f5f9',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            overflow: 'hidden',
                                                            border: '1px solid #e2e8f0',
                                                            flexShrink: 0,
                                                            position: 'relative'
                                                        }}>
                                                            <User size={12} style={{ color: selectedMember ? 'var(--primary-color)' : '#94a3b8' }} />
                                                            {(selectedMember?.avatarUrl || selectedMember?.AvatarUrl || selectedMember?.avatar) && (
                                                                <img src={selectedMember.avatarUrl || selectedMember.AvatarUrl || selectedMember.avatar} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                                            )}
                                                        </div>
                                                        <span style={{
                                                            flex: 1,
                                                            color: selectedMember ? '#1e293b' : '#94a3b8',
                                                            fontWeight: selectedMember ? 600 : 400,
                                                            fontSize: '0.85rem',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }}>
                                                            {selectedMember ? (selectedMember.fullName || selectedMember.userName) : 'Select Assignee'}
                                                        </span>
                                                        <ChevronDown size={14} style={{ flexShrink: 0, color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                                    </button>

                                                    {isOpen && (
                                                        <>
                                                            <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => { setOpenAssigneeDropdownId(null); }} />
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: 'calc(100% + 4px)',
                                                                left: 0,
                                                                width: '100%',
                                                                zIndex: 9999,
                                                                background: 'white',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '12px',
                                                                boxShadow: '0 -8px 30px rgba(0,0,0,0.15)',
                                                                overflow: 'hidden',
                                                                display: 'flex',
                                                                flexDirection: 'column'
                                                            }} data-dropdown-list>
                                                                <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                                                                    <div style={{ position: 'relative' }}>
                                                                        <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                                        <input
                                                                            autoFocus
                                                                            type="text"
                                                                            placeholder="Search members..."
                                                                            value={memberSearchQuery}
                                                                            onChange={(e) => setMemberSearchQuery(e.target.value)}
                                                                            style={{
                                                                                width: '100%',
                                                                                padding: '6px 10px 6px 30px',
                                                                                fontSize: '0.75rem',
                                                                                border: '1px solid #e2e8f0',
                                                                                borderRadius: '6px',
                                                                                outline: 'none',
                                                                                background: '#f8fafc'
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="custom-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
                                                                    <div
                                                                        onClick={() => {
                                                                            handleNewTaskChange(form.tempId, 'assigneeId', '');
                                                                            setOpenAssigneeDropdownId(null);
                                                                        }}
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '10px',
                                                                            padding: '8px 10px',
                                                                            cursor: 'pointer',
                                                                            borderRadius: '6px',
                                                                            background: !form.assigneeId ? '#f1f5f9' : 'transparent',
                                                                            transition: 'background 0.15s'
                                                                        }}
                                                                    >
                                                                        <div style={{
                                                                            width: '28px', height: '28px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1'
                                                                        }}>
                                                                            <User size={14} color="#94a3b8" />
                                                                        </div>
                                                                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b', fontStyle: 'italic' }}>Unassigned</div>
                                                                        {!form.assigneeId && <Check size={14} style={{ marginLeft: 'auto', color: 'var(--primary-color)' }} />}
                                                                    </div>

                                                                    {filteredMembers.length === 0 ? (
                                                                        <div style={{ padding: '20px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>No members found</div>
                                                                    ) : (
                                                                        filteredMembers.map(m => {
                                                                            const mId = getMemberOptionId(m);
                                                                            const isSelected = form.assigneeId === mId;
                                                                            const initials = (m.fullName || m.userName || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

                                                                            return (
                                                                                <div
                                                                                    key={mId}
                                                                                    onClick={() => {
                                                                                        handleNewTaskChange(form.tempId, 'assigneeId', mId);
                                                                                        const nextSupportIds = (form.supportMemberIds || []).filter((id: string) => id !== mId);
                                                                                        if (nextSupportIds.length !== (form.supportMemberIds || []).length) {
                                                                                            handleNewTaskChange(form.tempId, 'supportMemberIds', nextSupportIds);
                                                                                        }
                                                                                        setOpenAssigneeDropdownId(null);
                                                                                    }}
                                                                                    style={{
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '10px',
                                                                                        padding: '8px 10px',
                                                                                        cursor: 'pointer',
                                                                                        borderRadius: '6px',
                                                                                        background: isSelected ? '#f1f5f9' : 'transparent',
                                                                                        transition: 'background 0.15s'
                                                                                    }}
                                                                                >
                                                                                    <div style={{
                                                                                        width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0, position: 'relative'
                                                                                    }}>
                                                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary-color)' }}>{initials}</span>
                                                                                        {(m.avatarUrl || m.AvatarUrl || m.avatar) && (
                                                                                            <img src={m.avatarUrl || m.AvatarUrl || m.avatar} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                                                                        )}
                                                                                    </div>
                                                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isSelected ? 'var(--primary-color)' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.fullName || m.userName}</div>
                                                                                        <div style={{ fontSize: '0.62rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
                                                                                    </div>
                                                                                    {isSelected && <Check size={14} style={{ color: 'var(--primary-color)' }} />}
                                                                                </div>
                                                                            );
                                                                        })
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Collaborators</label>
                                        {(() => {
                                            const collabKey = form.tempId;
                                            const isOpen = openCollabDropdownId === collabKey;
                                            const selectedIds: string[] = form.supportMemberIds || [];
                                            const eligible = projectMembers
                                                .filter(m => getMemberOptionId(m) !== form.assigneeId)
                                                .filter(m => m.projectRole !== 1 && m.projectRoleName !== 'Lab Director' && m.roleName !== 'Lab Director');

                                            const filteredMembers = eligible.filter(m => {
                                                if (!memberSearchQuery) return true;
                                                const query = memberSearchQuery.toLowerCase();
                                                return (m.fullName || m.userName || '').toLowerCase().includes(query) ||
                                                       (m.email || '').toLowerCase().includes(query);
                                            });

                                            const selectedMembers = projectMembers.filter(m => selectedIds.includes(getMemberOptionId(m)));

                                            return (
                                                <div style={{ position: 'relative' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setOpenCollabDropdownId(isOpen ? null : collabKey);
                                                            setMemberSearchQuery('');
                                                        }}
                                                        style={{
                                                            ...inputStyle,
                                                            padding: '0.5rem 0.8rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            cursor: 'pointer',
                                                            background: 'white',
                                                            border: isOpen ? '1.5px solid var(--primary-color)' : '1.5px solid #e2e8f0',
                                                            boxShadow: isOpen ? '0 0 0 3px rgba(var(--primary-rgb), 0.1)' : 'none'
                                                        }}
                                                    >
                                                        {selectedMembers.length > 0 ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                                                    {selectedMembers.slice(0, 3).map((m, idx) => (
                                                                        <div key={getMemberOptionId(m)} style={{
                                                                            width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-bg)', border: '1.5px solid white', marginLeft: idx > 0 ? '-10px' : 0, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 3 - idx, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                        }}>
                                                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--primary-color)' }}>{(m.fullName || m.userName || '?')[0].toUpperCase()}</span>
                                                                            {(m.avatarUrl || m.AvatarUrl || m.avatar) && (
                                                                                <img src={m.avatarUrl || m.AvatarUrl || m.avatar} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                    {selectedMembers.length > 3 && (
                                                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f1f5f9', border: '1.5px solid white', marginLeft: '-10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, color: '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 0 }}>
                                                                            +{selectedMembers.length - 3}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {selectedMembers.length} member(s)
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span style={{ flex: 1, color: '#94a3b8', fontSize: '0.85rem' }}>Select collaborators</span>
                                                        )}
                                                        <ChevronDown size={14} style={{ flexShrink: 0, color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                                    </button>

                                                    {isOpen && (
                                                        <>
                                                            <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => { setOpenCollabDropdownId(null); }} />
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: 'calc(100% + 4px)',
                                                                left: 0,
                                                                width: '100%',
                                                                zIndex: 9999,
                                                                background: 'white',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '12px',
                                                                boxShadow: '0 -8px 30px rgba(0,0,0,0.15)',
                                                                overflow: 'hidden',
                                                                display: 'flex',
                                                                flexDirection: 'column'
                                                            }} data-dropdown-list>
                                                                <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                                                                    <div style={{ position: 'relative' }}>
                                                                        <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                                        <input
                                                                            autoFocus
                                                                            type="text"
                                                                            placeholder="Search collaborators..."
                                                                            value={memberSearchQuery}
                                                                            onChange={(e) => setMemberSearchQuery(e.target.value)}
                                                                            style={{
                                                                                width: '100%',
                                                                                padding: '6px 10px 6px 30px',
                                                                                fontSize: '0.75rem',
                                                                                border: '1px solid #e2e8f0',
                                                                                borderRadius: '6px',
                                                                                outline: 'none',
                                                                                background: '#f8fafc'
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="custom-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
                                                                    {filteredMembers.length === 0 ? (
                                                                        <div style={{ padding: '20px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>No members found</div>
                                                                    ) : (
                                                                        filteredMembers.map(m => {
                                                                            const mId = getMemberOptionId(m);
                                                                            const checked = selectedIds.includes(mId);
                                                                            const initials = (m.fullName || m.userName || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

                                                                            return (
                                                                                <div
                                                                                    key={mId}
                                                                                    onClick={() => {
                                                                                        const next = checked ? selectedIds.filter(x => x !== mId) : [...selectedIds, mId];
                                                                                        handleNewTaskChange(form.tempId, 'supportMemberIds', next);
                                                                                    }}
                                                                                    style={{
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '10px',
                                                                                        padding: '8px 10px',
                                                                                        cursor: 'pointer',
                                                                                        borderRadius: '6px',
                                                                                        background: checked ? '#f1f5f9' : 'transparent',
                                                                                        transition: 'background 0.15s'
                                                                                    }}
                                                                                >
                                                                                    <div style={{ width: '16px', height: '16px', flexShrink: 0, borderRadius: '4px', border: '1.5px solid', borderColor: checked ? 'var(--primary-color)' : '#cbd5e1', background: checked ? 'var(--primary-color)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                        {checked && <Check size={10} color="white" strokeWidth={3} />}
                                                                                    </div>
                                                                                    <div style={{
                                                                                        width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0, position: 'relative'
                                                                                    }}>
                                                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary-color)' }}>{initials}</span>
                                                                                        {(m.avatarUrl || m.AvatarUrl || m.avatar) && (
                                                                                            <img src={m.avatarUrl || m.AvatarUrl || m.avatar} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                                                                        )}
                                                                                    </div>
                                                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: checked ? 'var(--primary-color)' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.fullName || m.userName}</div>
                                                                                        <div style={{ fontSize: '0.62rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })()}
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
                    )}

                    {!isAddingNew && !selectedAiDraftKey && (
                        <TaskDetailPanel
                            selectedTaskId={selectedTaskId}
                            project={project}
                            projectMembers={projectMembers}
                            milestones={milestones}
                            canManageTasks={canManageTasks}
                            isArchived={isArchived}
                            isSpecialRole={isSpecialRole}
                            isLabDirector={currentMember?.projectRole === 1}
                            formatProjectDate={formatProjectDate}
                            showToast={showToast}
                            refreshTasks={refreshTasks}
                            onPersonalRefresh={fetchPersonalTasks}
                            viewContext={viewContext === 'ai-drafts' ? 'all' : viewContext}
                            panelRefreshKey={panelRefreshKey}
                        />
                    )}
                </div>
            </div>
            </div>
        </div>
    );
};

export default DetailsTasks;
