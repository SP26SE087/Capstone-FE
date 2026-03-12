import React, { useState, useEffect } from 'react';
import MainLayout from '@/layout/MainLayout';
import { taskService } from '@/services';
import { Task, TaskStatus, Priority } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import TaskFormModal from '@/features/tasks/TaskFormModal';
import {
    CheckSquare,
    Plus,
    Search,
    Calendar,
    Flag,
    Clock,
    CheckCircle2
} from 'lucide-react';
import TaskDetailModal from '@/features/tasks/TaskDetailModal';


const Tasks: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
    const { user: currentUser } = useAuth();

    const handleTaskClick = (taskId: string) => {
        setSelectedTaskId(taskId);
        setIsDetailModalOpen(true);
    };

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const data = await taskService.getPriorityTasks();
            setTasks(data || []);
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleFormSubmit = async (taskData: any) => {
        try {
            if (editingTask?.id) {
                await taskService.update(editingTask.id, taskData);
                await fetchTasks();
                setIsEditDrawerOpen(false);
                setEditingTask(null);
            }
        } catch (error) {
            console.error("Failed to update task:", error);
        }
    };

    const getStatusStyle = (status: TaskStatus) => {
        switch (status) {
            case TaskStatus.Todo: return { color: 'var(--text-secondary)', bg: 'var(--border-light)', icon: <Clock size={14} /> };
            case TaskStatus.InProgress: return { color: 'var(--info)', bg: 'var(--info-bg)', icon: <PlayIcon /> };
            case TaskStatus.Submitted: return { color: '#7c3aed', bg: '#ede9fe', icon: <Clock size={14} /> };
            case TaskStatus.Approved: return { color: 'var(--success)', bg: 'var(--success-bg)', icon: <CheckCircle2 size={14} /> };
            case TaskStatus.Rejected: return { color: 'var(--danger)', bg: 'var(--danger-bg)', icon: <AlertCircleIcon /> };
            case TaskStatus.Completed: return { color: 'var(--success)', bg: 'var(--success-bg)', icon: <CheckCircle2 size={14} /> };
            default: return { color: 'var(--text-secondary)', bg: 'var(--border-light)', icon: <Clock size={14} /> };
        }
    };

    const getPriorityStyle = (priority: Priority) => {
        switch (priority) {
            case Priority.Critical: return { color: 'var(--danger)', label: 'Critical' };
            case Priority.High: return { color: 'var(--warning)', label: 'High' };
            case Priority.Medium: return { color: 'var(--info)', label: 'Medium' };
            case Priority.Low: return { color: 'var(--text-muted)', label: 'Low' };
            default: return { color: 'var(--text-muted)', label: 'Normal' };
        }
    };

    return (
        <MainLayout role={currentUser.role} userName={currentUser.name}>
            <div className="page-container">
                {/* Page Header */}
                <div className="page-header">
                    <div>
                        <h1>Task Management</h1>
                        <p>Track and update your research activities and deadlines.</p>
                    </div>
                    <button className="btn btn-primary">
                        <Plus size={18} /> New Task
                    </button>
                </div>

                {/* Search & Filter */}
                <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            className="form-input"
                            style={{ paddingLeft: '40px' }}
                        />
                    </div>
                    <select
                        className="form-input"
                        style={{ width: 'auto', maxWidth: '180px' }}
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">All Status</option>
                        <option value="todo">To Do</option>
                        <option value="inprogress">In Progress</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>

                {/* Tasks Table */}
                {loading ? (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem' }}>Loading tasks...</p>
                ) : (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border-color)' }}>
                                <tr>
                                    <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Task Name</th>
                                    <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Priority</th>
                                    <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                                    <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Due Date</th>
                                    <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Created By</th>
                                    <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Last Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((task) => {
                                    const statusStyle = getStatusStyle(task.status);
                                    const priorityStyle = getPriorityStyle(task.priority);
                                    return (
                                        <tr
                                            key={task.id}
                                            onClick={() => handleTaskClick(task.id)}
                                            style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s', cursor: 'pointer' }}
                                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ padding: '8px', background: 'var(--accent-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-color)' }}>
                                                        <CheckSquare size={18} />
                                                    </div>
                                                    <div>
                                                        <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}>{task.name}</p>
                                                        <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-muted)' }}>Project: {task.projectId?.substring(0, 8) || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: priorityStyle.color, fontWeight: 500 }}>
                                                    <Flag size={14} />
                                                    {priorityStyle.label}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <span className="badge" style={{
                                                    background: statusStyle.bg,
                                                    color: statusStyle.color,
                                                    gap: '5px'
                                                }}>
                                                    {statusStyle.icon}
                                                    {TaskStatus[task.status]}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                    <Calendar size={14} />
                                                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                {task.createdBy || 'System'}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                                {task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : 'Recently'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <TaskDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                taskId={selectedTaskId}
            />

            <TaskFormModal
                isOpen={isFormModalOpen || isEditDrawerOpen}
                onClose={() => {
                    setIsFormModalOpen(false);
                    setIsEditDrawerOpen(false);
                    setEditingTask(null);
                }}
                onSubmit={handleFormSubmit}
                task={editingTask}
            />
        </MainLayout>
    );
};

const PlayIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
);

const AlertCircleIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
);

export default Tasks;
