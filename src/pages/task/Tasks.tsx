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
    Clock,
    CheckCircle2,
    Calendar,
    AlertOctagon,
    ChevronUp,
    ChevronDown,
    Minus,
    User,
    Send,
    AlertTriangle,
    Settings
} from 'lucide-react';
import TaskDetailModal from '@/features/tasks/TaskDetailModal';


const Tasks: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterProject, setFilterProject] = useState<string>('all');
    const [startDateFilter, setStartDateFilter] = useState<string>('');
    const [endDateFilter, setEndDateFilter] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');

    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
    const { user: currentUser } = useAuth();

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const TASKS_PER_PAGE = 5;

    const handleTaskClick = (taskId: string) => {
        setSelectedTaskId(taskId);
        setIsDetailModalOpen(true);
    };

    const fetchTasks = async () => {
        setLoading(true);
        try {
            // Always fetch tasks for the current user (Task Manager focus)
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

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, filterProject, startDateFilter, endDateFilter]);

    const handleFormSubmit = async (taskData: any) => {
        try {
            if (editingTask?.taskId) {
                await taskService.update(editingTask.taskId, taskData);
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
            case TaskStatus.Todo: return { color: '#64748b', bg: '#f1f5f9', label: 'To Do', icon: <Clock size={14} /> };
            case TaskStatus.InProgress: return { color: '#0ea5e9', bg: '#e0f2fe', label: 'In Progress', icon: <div style={{ width: 8, height: 8, background: '#0ea5e9', borderRadius: '50%', marginRight: 4 }} /> };
            case TaskStatus.Submitted: return { color: '#7c3aed', bg: '#f5f3ff', label: 'Submitted', icon: <Send size={14} /> };
            case TaskStatus.Missed: return { color: '#ef4444', bg: '#fef2f2', label: 'Missed', icon: <AlertTriangle size={14} /> };
            case TaskStatus.Adjusting: return { color: '#f59e0b', bg: '#fffbeb', label: 'Adjusting', icon: <Settings size={14} /> };
            case TaskStatus.Completed: return { color: '#10b981', bg: '#ecfdf5', label: 'Completed', icon: <CheckCircle2 size={14} /> };
            default: return { color: '#64748b', bg: '#f1f5f9', label: 'Unknown', icon: <Clock size={14} /> };
        }
    };

    const getPriorityStyle = (priority: Priority) => {
        switch (priority) {
            case Priority.Critical: return { color: '#ef4444', label: 'Critical', icon: <AlertOctagon size={14} /> };
            case Priority.High: return { color: '#f59e0b', label: 'High', icon: <ChevronUp size={14} /> };
            case Priority.Medium: return { color: '#3b82f6', label: 'Medium', icon: <Minus size={14} /> };
            case Priority.Low: return { color: '#94a3b8', label: 'Low', icon: <ChevronDown size={14} /> };
            default: return { color: '#94a3b8', label: 'Normal', icon: <Minus size={14} /> };
        }
    };

    return (
        <MainLayout role={currentUser.role} userName={currentUser.name}>
            <div className="page-container">
                {/* Page Header */}
                <div className="page-header" style={{ marginBottom: '2.5rem' }}>
                    <div>
                        <h1>Task Management</h1>
                        <p>Track and update your research activities and deadlines.</p>
                    </div>
                    <button className="btn btn-primary" style={{ padding: '0.8rem 1.5rem' }}>
                        <Plus size={18} /> New Task
                    </button>
                </div>

                {/* Search & Filter */}
                <div className="card" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search by activity name..."
                                className="form-input"
                                style={{ paddingLeft: '40px' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-input"
                            style={{ width: 'auto', minWidth: '150px' }}
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value={TaskStatus.Todo.toString()}>To Do</option>
                            <option value={TaskStatus.InProgress.toString()}>In Progress</option>
                            <option value={TaskStatus.Submitted.toString()}>Submitted</option>
                            <option value={TaskStatus.Missed.toString()}>Missed</option>
                            <option value={TaskStatus.Adjusting.toString()}>Adjusting</option>
                            <option value={TaskStatus.Completed.toString()}>Completed</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Project Filter */}
                        <select
                            className="form-input"
                            style={{ width: 'auto', minWidth: '180px' }}
                            value={filterProject}
                            onChange={(e) => setFilterProject(e.target.value)}
                        >
                            <option value="all">All Projects</option>
                            {Array.from(new Set(tasks.map(t => t.projectName || t.projectId))).filter(Boolean).map(proj => (
                                <option key={proj} value={proj}>{proj}</option>
                            ))}
                        </select>

                        {/* Date Filters */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={16} color="var(--text-muted)" />
                            <input
                                type="date"
                                className="form-input"
                                style={{ width: 'auto', fontSize: '0.85rem' }}
                                value={startDateFilter}
                                onChange={(e) => setStartDateFilter(e.target.value)}
                                title="From Due Date"
                            />
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                            <input
                                type="date"
                                className="form-input"
                                style={{ width: 'auto', fontSize: '0.85rem' }}
                                value={endDateFilter}
                                onChange={(e) => setEndDateFilter(e.target.value)}
                                title="To Due Date"
                            />
                        </div>

                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setFilterStatus('all');
                                setFilterProject('all');
                                setStartDateFilter('');
                                setEndDateFilter('');
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-color)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                paddingLeft: '8px'
                            }}
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {/* Tasks Table */}
                {loading ? (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem' }}>Loading tasks...</p>
                ) : (
                    <>
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border-color)' }}>
                                    <tr>
                                        <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Task Name</th>
                                        <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Priority</th>
                                        <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                                        <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Due Date</th>
                                        <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Assignee</th>
                                        <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Last Updated</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const filteredTasks = tasks.filter(task => {
                                            const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase());
                                            const matchesStatus = filterStatus === 'all' || task.status.toString() === filterStatus;
                                            const matchesProject = filterProject === 'all' || (task.projectName || task.projectId) === filterProject;

                                            // Date filtering
                                            if (!task.dueDate) {
                                                if (startDateFilter || endDateFilter) return false;
                                                return matchesSearch && matchesStatus && matchesProject;
                                            }

                                            const taskDate = new Date(task.dueDate).getTime();
                                            const matchesStart = !startDateFilter || taskDate >= new Date(startDateFilter).getTime();
                                            const matchesEnd = !endDateFilter || taskDate <= new Date(endDateFilter).getTime();

                                            return matchesSearch && matchesStatus && matchesProject && matchesStart && matchesEnd;
                                        });

                                        const startIndex = (currentPage - 1) * TASKS_PER_PAGE;
                                        const paginatedTasks = filteredTasks.slice(startIndex, startIndex + TASKS_PER_PAGE);

                                        if (paginatedTasks.length === 0) {
                                            return (
                                                <tr>
                                                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                        No tasks found matching your criteria.
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        return paginatedTasks.map((task) => {
                                            const statusStyle = getStatusStyle(task.status);
                                            const priorityStyle = getPriorityStyle(task.priority);
                                            return (
                                                <tr
                                                    key={task.taskId}
                                                    onClick={() => handleTaskClick(task.taskId)}
                                                    style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s', cursor: 'pointer' }}
                                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <td style={{ padding: '1rem 1.5rem', position: 'relative' }}>
                                                        <style>{`
                                                            @keyframes warningBlink {
                                                                0%, 100% { opacity: 1; transform: scale(1); }
                                                                50% { opacity: 0.5; transform: scale(1.3); }
                                                            }
                                                        `}</style>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{ padding: '8px', background: 'var(--accent-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-color)', position: 'relative' }}>
                                                                <CheckSquare size={18} />
                                                                {task.dueDate && (task.status !== TaskStatus.Completed && task.status !== TaskStatus.Submitted) && ((new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 3 && (
                                                                    <div style={{
                                                                        position: 'absolute', right: '-4px', top: '-4px',
                                                                        width: '10px', height: '10px', borderRadius: '50%',
                                                                        background: '#ef4444', border: '2px solid white',
                                                                        boxShadow: '0 0 6px #ef4444',
                                                                        animation: 'warningBlink 1s ease-in-out infinite'
                                                                    }} title="Deadline is within 3 days or overdue!" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}>{task.name}</p>
                                                                <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-muted)' }}>Project: {task.projectName || task.projectId?.substring(0, 8) || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem 1.5rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: priorityStyle.color, fontWeight: 500 }}>
                                                            {priorityStyle.icon}
                                                            {priorityStyle.label}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem 1.5rem' }}>
                                                        <span className="badge" style={{
                                                            background: statusStyle.bg,
                                                            color: statusStyle.color,
                                                            gap: '6px',
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            fontWeight: 600,
                                                            fontSize: '0.75rem',
                                                            display: 'inline-flex',
                                                            alignItems: 'center'
                                                        }}>
                                                            {statusStyle.icon}
                                                            {statusStyle.label}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '1rem 1.5rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                            <Calendar size={14} />
                                                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{
                                                                width: '24px',
                                                                height: '24px',
                                                                borderRadius: '50%',
                                                                background: 'var(--accent-bg)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: 'var(--accent-color)',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 600
                                                            }}>
                                                                {task.assignedToName?.charAt(0) || <User size={12} />}
                                                            </div>
                                                            {task.assignedToName || task.createdBy || 'System'}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                                        {task.updatedDate ? new Date(task.updatedDate).toLocaleDateString() : (task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : 'Recently')}
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {(() => {
                            const filteredTasks = tasks.filter(task => {
                                const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase());
                                const matchesStatus = filterStatus === 'all' || task.status.toString() === filterStatus;
                                const matchesProject = filterProject === 'all' || (task.projectName || task.projectId) === filterProject;

                                if (!task.dueDate) {
                                    if (startDateFilter || endDateFilter) return false;
                                    return matchesSearch && matchesStatus && matchesProject;
                                }

                                const taskDate = new Date(task.dueDate).getTime();
                                const matchesStart = !startDateFilter || taskDate >= new Date(startDateFilter).getTime();
                                const matchesEnd = !endDateFilter || taskDate <= new Date(endDateFilter).getTime();

                                return matchesSearch && matchesStatus && matchesProject && matchesStart && matchesEnd;
                            });

                            const filteredTasksCount = filteredTasks.length;
                            const totalPages = Math.ceil(filteredTasksCount / TASKS_PER_PAGE);

                            if (totalPages <= 1) return null;

                            return (
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem', alignItems: 'center' }}>
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => prev - 1)}
                                        className="btn btn-outline"
                                        style={{ padding: '4px 12px', fontSize: '0.85rem', opacity: currentPage === 1 ? 0.5 : 1 }}
                                    >
                                        Prev
                                    </button>

                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        {[...Array(totalPages)].map((_, i) => (
                                            <button
                                                key={i + 1}
                                                onClick={() => setCurrentPage(i + 1)}
                                                className={`btn ${currentPage === i + 1 ? 'btn-primary' : 'btn-text'}`}
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    padding: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.85rem',
                                                    minWidth: 'unset'
                                                }}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                        className="btn btn-outline"
                                        style={{ padding: '4px 12px', fontSize: '0.85rem', opacity: currentPage === totalPages ? 0.5 : 1 }}
                                    >
                                        Next
                                    </button>
                                </div>
                            );
                        })()}
                    </>
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


export default Tasks;
