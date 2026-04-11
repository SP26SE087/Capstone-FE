import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, Plus, X, LayoutGrid, User, Calendar, Loader2,
    Target, Filter, ChevronDown, Check, Clock
} from 'lucide-react';
import { Project, Task, TaskStatus, Milestone, MilestoneStatus } from '@/types';
import ActivityTimeline from './ActivityTimeline';
import { taskService } from '@/services';
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
    const isSpecialRole = currentMember?.projectRole === 1 || currentMember?.projectRole === 4;
    const [viewContext, setViewContext] = useState<'personal' | 'all'>(isSpecialRole ? 'all' : 'personal');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [openCollabDropdownId, setOpenCollabDropdownId] = useState<string | null>(null);
    const [openAssigneeDropdownId, setOpenAssigneeDropdownId] = useState<string | null>(null);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');

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
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {viewToggle}
                {viewMode === 'list' && canManageTasks && !isArchived && (
                    <button onClick={handleAddNewClick} style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--primary-color)', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <Plus size={16} /> New Task
                    </button>
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

            {/* Column 2: Task Detail / Create Form */}
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
                                                        {milestoneHasError && selMilestone && (
                                                            <div style={{ fontSize: '0.65rem', color: '#ef4444', marginTop: '3px', fontWeight: 500 }}>
                                                                Task dates must be within milestone: {mStart ? `${mStart} – ` : ''}{mEnd || ''}
                                                            </div>
                                                        )}
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
                                        {(() => {
                                            const assigneeKey = `__new_assignee__${form.tempId}`;
                                            const isOpen = openAssigneeDropdownId === assigneeKey;
                                            const selectedMember = projectMembers.find(m => getMemberOptionId(m) === form.assigneeId);

                                            const filteredMembers = projectMembers.filter(m => {
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
                                                            flexShrink: 0
                                                        }}>
                                                            {selectedMember?.avatarUrl || selectedMember?.AvatarUrl ? (
                                                                <img src={selectedMember.avatarUrl || selectedMember.AvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <User size={12} style={{ color: selectedMember ? 'var(--primary-color)' : '#94a3b8' }} />
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
                                                                                        width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0
                                                                                    }}>
                                                                                        {m.avatarUrl || m.AvatarUrl ? (
                                                                                            <img src={m.avatarUrl || m.AvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                        ) : (
                                                                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary-color)' }}>{initials}</span>
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
                                            const eligible = projectMembers.filter(m => getMemberOptionId(m) !== form.assigneeId);

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
                                                                            width: '24px', height: '24px', borderRadius: '50%', background: 'white', border: '1.5px solid white', marginLeft: idx > 0 ? '-10px' : 0, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 3 - idx
                                                                        }}>
                                                                            {m.avatarUrl || m.AvatarUrl ? (
                                                                                <img src={m.avatarUrl || m.AvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                            ) : (
                                                                                <div style={{ width: '100%', height: '100%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                                                                                    {(m.fullName || m.userName || '?')[0].toUpperCase()}
                                                                                </div>
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
                                                                                        width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0
                                                                                    }}>
                                                                                        {m.avatarUrl || m.AvatarUrl ? (
                                                                                            <img src={m.avatarUrl || m.AvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                        ) : (
                                                                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary-color)' }}>{initials}</span>
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
                    ) : (
                        <TaskDetailPanel
                            selectedTaskId={selectedTaskId}
                            project={project}
                            projectMembers={projectMembers}
                            milestones={milestones}
                            canManageTasks={canManageTasks}
                            isArchived={isArchived}
                            isSpecialRole={isSpecialRole}
                            formatProjectDate={formatProjectDate}
                            showToast={showToast}
                            refreshTasks={refreshTasks}
                            onPersonalRefresh={fetchPersonalTasks}
                            viewContext={viewContext}
                        />
                    )}
                </div>
            </div>
            </div>
        </div>
    );
};

export default DetailsTasks;
