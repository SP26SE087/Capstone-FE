import { Search, Plus, X, List, LayoutGrid } from 'lucide-react';
import { Project, Task, TaskStatus, Milestone } from '@/types';
import KanbanBoard from '@/features/tasks/KanbanBoard';
import TaskItem from '@/components/task/TaskItem';

interface DetailsTasksProps {
    tasks: Task[];
    filteredTasks: Task[];
    taskSearchQuery: string;
    setTaskSearchQuery: (query: string) => void;
    taskStatusFilter: string;
    setTaskStatusFilter: (status: string) => void;
    taskPriorityFilter: string;
    setTaskPriorityFilter: (priority: string) => void;
    taskMilestoneFilter: string;
    setTaskMilestoneFilter: (milestone: string) => void;
    viewMode: 'list' | 'kanban';
    setViewMode: (mode: 'list' | 'kanban') => void;
    canManageTasks: boolean;
    isArchived: boolean;
    setIsTaskModalOpen: (isOpen: boolean) => void;
    handleTaskClick: (task: Task) => void;
    newTasks: any[];
    handleAddTaskForm: () => void;
    handleRemoveTaskForm: (id: string) => void;
    handleNewTaskChange: (id: string, field: string, value: any) => void;
    handleSaveNewTask: (id: string) => void;
    milestones: Milestone[];
    projectMembers: any[];
    project: Project;
    formatProjectDate: (date: string | Date | undefined, fallback?: string) => string;
}

const DetailsTasks: React.FC<DetailsTasksProps> = ({
    tasks, filteredTasks, taskSearchQuery, setTaskSearchQuery,
    taskStatusFilter, setTaskStatusFilter, taskPriorityFilter, setTaskPriorityFilter,
    taskMilestoneFilter, setTaskMilestoneFilter, viewMode, setViewMode,
    canManageTasks, isArchived, setIsTaskModalOpen, handleTaskClick,
    newTasks, handleAddTaskForm, handleRemoveTaskForm, handleNewTaskChange, handleSaveNewTask,
    milestones, projectMembers, project
}) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Project Tasks</h3>
                    <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', color: '#64748b', fontWeight: 700 }}>{tasks.length} total</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <button
                            onClick={() => setViewMode('list')}
                            style={{
                                padding: '6px 14px', borderRadius: '9px', border: 'none',
                                background: viewMode === 'list' ? 'white' : 'transparent',
                                color: viewMode === 'list' ? 'var(--primary-color)' : '#64748b',
                                boxShadow: viewMode === 'list' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.8rem'
                            }}
                        >
                            <List size={16} /> List
                        </button>
                        <button
                            onClick={() => setViewMode('kanban')}
                            style={{
                                padding: '6px 14px', borderRadius: '9px', border: 'none',
                                background: viewMode === 'kanban' ? 'white' : 'transparent',
                                color: viewMode === 'kanban' ? 'var(--primary-color)' : '#64748b',
                                boxShadow: viewMode === 'kanban' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.8rem'
                            }}
                        >
                            <LayoutGrid size={16} /> Kanban
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Search tasks by name, assignee, or ID..."
                            value={taskSearchQuery}
                            onChange={(e) => setTaskSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', background: 'white' }}
                        />
                    </div>
                    <select value={taskStatusFilter} onChange={(e) => setTaskStatusFilter(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white', fontWeight: 600, fontSize: '0.85rem' }}>
                        <option value="all">Any Status</option>
                        <option value={TaskStatus.Todo.toString()}>To Do</option>
                        <option value={TaskStatus.InProgress.toString()}>In Progress</option>
                        <option value={TaskStatus.Submitted.toString()}>In Review</option>
                        <option value={TaskStatus.Completed.toString()}>Completed</option>
                        <option value={TaskStatus.Missed.toString()}>Missed</option>
                    </select>

                    <select value={taskPriorityFilter} onChange={(e) => setTaskPriorityFilter(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white', fontWeight: 600, fontSize: '0.85rem' }}>
                        <option value="all">Any Priority</option>
                        <option value="0">Low</option>
                        <option value="1">Medium</option>
                        <option value="2">High</option>
                        <option value="3">Urgent</option>
                    </select>

                    <select value={taskMilestoneFilter} onChange={(e) => setTaskMilestoneFilter(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white', fontWeight: 600, fontSize: '0.85rem' }}>
                        <option value="all">Any Milestone</option>
                        {milestones.map(m => (
                            <option key={m.milestoneId} value={m.milestoneId}>{m.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {viewMode === 'kanban' ? (
                <KanbanBoard 
                    tasks={filteredTasks} 
                    onTaskClick={handleTaskClick}
                    projectMembers={projectMembers}
                    projectId={project.projectId || ''}
                    milestones={milestones}
                />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filteredTasks.length > 0 ? (
                        filteredTasks.map(task => (
                            <TaskItem key={task.taskId} task={task} onClick={handleTaskClick} />
                        ))
                    ) : (
                        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No tasks found matching your filters.</p>
                        </div>
                    )}

                    {newTasks.map((form) => (
                        <div key={form.tempId} className="card" style={{ border: '2px solid var(--primary-color)', background: '#f0f9ff', padding: '1.5rem', animation: 'slideIn 0.3s ease-out' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)' }}>
                                    <Plus size={18} />
                                    <span style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Draft Task</span>
                                </div>
                                <button onClick={() => handleRemoveTaskForm(form.tempId)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
                            </div>
                            <div style={{ display: 'grid', gap: '1.25rem' }}>
                                <input type="text" placeholder="What needs to be done?" className="form-input" style={{ fontSize: '1.1rem', fontWeight: 600 }} value={form.name} onChange={(e) => handleNewTaskChange(form.tempId, 'name', e.target.value)} autoFocus />
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Link to Milestone</label>
                                        <select className="form-input" value={form.milestoneId} onChange={(e) => handleNewTaskChange(form.tempId, 'milestoneId', e.target.value)}>
                                            <option value="">No Milestone</option>
                                            {milestones.map(m => (
                                                <option key={m.milestoneId} value={m.milestoneId}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Assignee</label>
                                        <select className="form-input" value={form.assigneeId} onChange={(e) => handleNewTaskChange(form.tempId, 'assigneeId', e.target.value)}>
                                            <option value="">Unassigned</option>
                                            {projectMembers.map(m => (
                                                <option key={m.userId} value={m.userId}>{m.fullName}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Due Date</label>
                                        <input type="date" className="form-input" value={form.endDate} onChange={(e) => handleNewTaskChange(form.tempId, 'endDate', e.target.value)} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                    <button className="btn btn-primary" onClick={() => handleSaveNewTask(form.tempId)}>Create Task</button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {canManageTasks && !isArchived && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={handleAddTaskForm}
                                style={{ flex: 1, padding: '1.25rem', background: 'transparent', border: '2px dashed #cbd5e1', borderRadius: '16px', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                                onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                            >
                                <Plus size={20} /> Add Task
                            </button>
                            <button
                                onClick={() => setIsTaskModalOpen(true)}
                                style={{ padding: '1.25rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', color: 'var(--primary-color)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                            >
                                Detailed Form
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DetailsTasks;
