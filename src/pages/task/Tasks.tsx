import React, { useState, useEffect } from 'react';
import MainLayout from '@/layout/MainLayout';
import { taskService } from '@/services';
import { Task, TaskStatus, Priority } from '@/types';
import {
    CheckSquare,
    Plus,
    Search,
    Calendar,
    Flag,
    MoreVertical,
    Clock,
    CheckCircle2
} from 'lucide-react';

const Tasks: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        const fetchTasks = async () => {
            setLoading(true);
            try {
                // For a real app, we might need a more specific "get all my tasks" endpoint
                // base on devApi, we have /api/projects/tasks/member/{memberId}
                // for now we use the general one from service
                const data = await taskService.getPriorityTasks();
                setTasks(data || []);
            } catch (error) {
                console.error('Failed to fetch tasks:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTasks();
    }, []);

    const user = { name: "Alex Rivera", role: "Lab Director" };

    const getStatusStyle = (status: TaskStatus) => {
        switch (status) {
            case TaskStatus.Todo: return { color: '#64748b', bg: '#f1f5f9', icon: <Clock size={14} /> };
            case TaskStatus.InProgress: return { color: '#0288d1', bg: '#e1f5fe', icon: <PlayIcon /> };
            case TaskStatus.Completed: return { color: '#10b981', bg: '#ecfdf5', icon: <CheckCircle2 size={14} /> };
            case TaskStatus.Overdue: return { color: '#e63946', bg: '#fef2f2', icon: <AlertCircleIcon /> };
            default: return { color: '#64748b', bg: '#f1f5f9', icon: <Clock size={14} /> };
        }
    };

    const getPriorityStyle = (priority: Priority) => {
        switch (priority) {
            case Priority.Urgent: return { color: '#e63946', label: 'Urgent' };
            case Priority.High: return { color: '#f59e0b', label: 'High' };
            case Priority.Medium: return { color: '#0ea5e9', label: 'Medium' };
            case Priority.Low: return { color: '#94a3b8', label: 'Low' };
            default: return { color: '#94a3b8', label: 'Normal' };
        }
    };

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div style={{ maxWidth: '1240px' }}>
                <header style={{
                    marginBottom: '2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h1>Task Management</h1>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Track and update your research activities and deadlines.</p>
                    </div>
                    <button className="btn btn-primary">
                        <Plus size={18} /> New Task
                    </button>
                </header>

                <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            style={{
                                width: '100%',
                                padding: '10px 10px 10px 40px',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <select
                        style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white' }}
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">All Status</option>
                        <option value="todo">To Do</option>
                        <option value="inprogress">In Progress</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>

                {loading ? (
                    <p>Loading tasks...</p>
                ) : (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ background: '#f8f9fa', borderBottom: '1px solid var(--border-color)' }}>
                                <tr>
                                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Task Name</th>
                                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Priority</th>
                                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Status</th>
                                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Due Date</th>
                                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((task) => {
                                    const statusStyle = getStatusStyle(task.status);
                                    const priorityStyle = getPriorityStyle(task.priority);
                                    return (
                                        <tr key={task.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--accent-color)' }}>
                                                        <CheckSquare size={18} />
                                                    </div>
                                                    <div>
                                                        <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem' }}>{task.name}</p>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Project ID: {task.projectId?.substring(0, 8) || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: priorityStyle.color, fontWeight: 500 }}>
                                                    <Flag size={14} />
                                                    {priorityStyle.label}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    background: statusStyle.bg,
                                                    color: statusStyle.color,
                                                    fontWeight: 600,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    {statusStyle.icon}
                                                    {TaskStatus[task.status]}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                    <Calendar size={14} />
                                                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                                    <MoreVertical size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
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
