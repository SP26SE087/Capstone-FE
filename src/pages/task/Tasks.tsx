import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/layout/MainLayout';
import { taskService } from '@/services';
import { Task, TaskStatus, Priority } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import ConfirmModal from '@/components/common/ConfirmModal';
import {
    CheckSquare, Plus, Search, Clock, CheckCircle2,
    Calendar, AlertOctagon, ChevronUp, ChevronDown,
    Minus, User, Send, AlertTriangle, Settings,
    X, Upload, Paperclip, Check, Play, RotateCw,
    Target, Loader2, FileText, Users
} from 'lucide-react';

const Tasks: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterProject, setFilterProject] = useState<string>('all');
    const [startDateFilter, setStartDateFilter] = useState<string>('');
    const [endDateFilter, setEndDateFilter] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const TASKS_PER_PAGE = 8;
    const { user: currentUser } = useAuth();

    // Panel state
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [panelLoading, setPanelLoading] = useState(false);
    const [serverEvidences, setServerEvidences] = useState<any[]>([]);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [panelError, setPanelError] = useState<string | null>(null);
    const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);

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

    useEffect(() => { fetchTasks(); }, []);
    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, filterProject, startDateFilter, endDateFilter]);

    const loadPanel = useCallback(async (taskId: string) => {
        setPanelLoading(true);
        setPanelError(null);
        setPendingFiles([]);
        try {
            const [task, evidences] = await Promise.all([
                taskService.getById(taskId),
                taskService.getEvidences(taskId)
            ]);
            setSelectedTask(task);
            setServerEvidences(evidences || []);
        } catch {
            setPanelError('Failed to load task details.');
        } finally {
            setPanelLoading(false);
        }
    }, []);

    const handleTaskClick = (taskId: string) => {
        setSelectedTaskId(taskId);
        loadPanel(taskId);
    };

    const handleClosePanel = () => {
        setSelectedTaskId(null);
        setSelectedTask(null);
        setServerEvidences([]);
        setPendingFiles([]);
        setPanelError(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const MAX = 10 * 1024 * 1024;
        const available = 5 - serverEvidences.length - pendingFiles.length;
        const valid = Array.from(e.target.files).filter(f => f.size <= MAX).slice(0, available);
        setPendingFiles(prev => [...prev, ...valid]);
        e.target.value = '';
    };

    const handleUploadOnly = async () => {
        if (!selectedTaskId || pendingFiles.length === 0) return;
        setIsSubmitConfirmOpen(false);
        setSubmitting(true);
        setPanelError(null);
        try {
            await taskService.uploadEvidences(selectedTaskId, pendingFiles);
            setPendingFiles([]);
            const evidences = await taskService.getEvidences(selectedTaskId);
            setServerEvidences(evidences || []);
        } catch (err: any) {
            setPanelError(err.message || 'Upload failed.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteEvidence = async (evidenceId: number) => {
        if (!selectedTaskId) return;
        try {
            await taskService.deleteEvidence(selectedTaskId, evidenceId);
            setServerEvidences(prev => prev.filter((e: any) => e.id !== evidenceId));
        } catch (err: any) {
            setPanelError(err.message || 'Delete failed.');
        }
    };

    const handleStatusAction = async (newStatus: TaskStatus) => {
        if (!selectedTaskId) return;
        if (newStatus === TaskStatus.Submitted) {
            if (pendingFiles.length > 0) {
                setPanelError('Upload pending files first before submitting.');
                return;
            }
            if (serverEvidences.length === 0) {
                setPanelError('Upload at least 1 evidence before submitting.');
                return;
            }
        }
        setSubmitting(true);
        setPanelError(null);
        try {
            await taskService.updateStatus(selectedTaskId, newStatus);
            await loadPanel(selectedTaskId);
            fetchTasks();
        } catch (err: any) {
            setPanelError(err.message || 'Action failed.');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusStyle = (status: TaskStatus) => {
        switch (status) {
            case TaskStatus.Todo: return { color: '#64748b', bg: '#f1f5f9', label: 'To Do', icon: <Clock size={14} /> };
            case TaskStatus.InProgress: return { color: '#0ea5e9', bg: '#e0f2fe', label: 'In Progress', icon: <div style={{ width: 8, height: 8, background: '#0ea5e9', borderRadius: '50%' }} /> };
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

    const formatDate = (d?: string | null) => {
        if (!d || d.startsWith('0001')) return 'N/A';
        return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const canUploadEvidence = selectedTask && [TaskStatus.InProgress, TaskStatus.Adjusting, TaskStatus.Missed].includes(selectedTask.status);
    const totalFiles = serverEvidences.length + pendingFiles.length;

    // Filtering
    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || task.status.toString() === filterStatus;
        const matchesProject = filterProject === 'all' || (task.projectName || task.projectId) === filterProject;
        if (!task.dueDate) return matchesSearch && matchesStatus && matchesProject && !startDateFilter && !endDateFilter;
        const taskDate = new Date(task.dueDate).getTime();
        const matchesStart = !startDateFilter || taskDate >= new Date(startDateFilter).getTime();
        const matchesEnd = !endDateFilter || taskDate <= new Date(endDateFilter).getTime();
        return matchesSearch && matchesStatus && matchesProject && matchesStart && matchesEnd;
    });
    const totalPages = Math.ceil(filteredTasks.length / TASKS_PER_PAGE);
    const paginatedTasks = filteredTasks.slice((currentPage - 1) * TASKS_PER_PAGE, currentPage * TASKS_PER_PAGE);

    return (
        <MainLayout role={currentUser.role} userName={currentUser.name}>
            <div className="page-container">
                {/* Page Header */}
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>Task Management</h1>
                        <p>Track and update your research activities and deadlines.</p>
                    </div>
                    <button className="btn btn-primary" style={{ padding: '0.8rem 1.5rem' }}>
                        <Plus size={18} /> New Task
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                    {/* ── Left: filter + table ── */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Search & Filter */}
                        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                                <select className="form-input" style={{ width: 'auto', minWidth: '150px' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
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
                                <select className="form-input" style={{ width: 'auto', minWidth: '180px' }} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
                                    <option value="all">All Projects</option>
                                    {Array.from(new Set(tasks.map(t => t.projectName || t.projectId))).filter(Boolean).map(proj => (
                                        <option key={proj} value={proj}>{proj}</option>
                                    ))}
                                </select>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Calendar size={16} color="var(--text-muted)" />
                                    <input type="date" className="form-input" style={{ width: 'auto', fontSize: '0.85rem' }} value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)} title="From Due Date" />
                                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                                    <input type="date" className="form-input" style={{ width: 'auto', fontSize: '0.85rem' }} value={endDateFilter} onChange={(e) => setEndDateFilter(e.target.value)} title="To Due Date" />
                                </div>
                                <button onClick={() => { setSearchTerm(''); setFilterStatus('all'); setFilterProject('all'); setStartDateFilter(''); setEndDateFilter(''); }}
                                    style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                                    Reset
                                </button>
                            </div>
                        </div>

                        {/* Task Table */}
                        {loading ? (
                            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem' }}>Loading tasks...</p>
                        ) : (
                            <>
                                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border-color)' }}>
                                            <tr>
                                                <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Task Name</th>
                                                <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Priority</th>
                                                <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                                                <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Due Date</th>
                                                <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Assignee</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedTasks.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                        No tasks found matching your criteria.
                                                    </td>
                                                </tr>
                                            ) : paginatedTasks.map((task) => {
                                                const statusStyle = getStatusStyle(task.status);
                                                const priorityStyle = getPriorityStyle(task.priority);
                                                const isSelected = task.taskId === selectedTaskId;
                                                return (
                                                    <tr
                                                        key={task.taskId}
                                                        onClick={() => handleTaskClick(task.taskId)}
                                                        style={{
                                                            borderBottom: '1px solid var(--border-color)',
                                                            transition: 'background 0.15s',
                                                            cursor: 'pointer',
                                                            background: isSelected ? 'var(--accent-bg)' : 'transparent',
                                                            borderLeft: isSelected ? '3px solid var(--accent-color)' : '3px solid transparent',
                                                        }}
                                                        onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                                                        onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                                    >
                                                        <td style={{ padding: '0.9rem 1.25rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <div style={{ padding: '7px', background: 'var(--accent-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-color)', position: 'relative' }}>
                                                                    <CheckSquare size={16} />
                                                                    {task.dueDate && ![TaskStatus.Completed, TaskStatus.Submitted].includes(task.status) && ((new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 3 && (
                                                                        <div style={{ position: 'absolute', right: '-4px', top: '-4px', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', border: '2px solid white' }} />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>{task.name}</p>
                                                                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{task.projectName || task.projectId?.substring(0, 8) || 'N/A'}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '0.9rem 1rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: priorityStyle.color, fontWeight: 500 }}>
                                                                {priorityStyle.icon} {priorityStyle.label}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '0.9rem 1rem' }}>
                                                            <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: '3px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                                {statusStyle.icon} {statusStyle.label}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                <Calendar size={13} />
                                                                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)', fontSize: '0.65rem', fontWeight: 700 }}>
                                                                    {task.assignedToName?.charAt(0) || <User size={11} />}
                                                                </div>
                                                                {task.assignedToName || task.createdBy || 'System'}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.25rem', alignItems: 'center' }}>
                                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '0.85rem', opacity: currentPage === 1 ? 0.5 : 1 }}>Prev</button>
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            {[...Array(totalPages)].map((_, i) => (
                                                <button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={`btn ${currentPage === i + 1 ? 'btn-primary' : 'btn-text'}`}
                                                    style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', minWidth: 'unset' }}>
                                                    {i + 1}
                                                </button>
                                            ))}
                                        </div>
                                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '0.85rem', opacity: currentPage === totalPages ? 0.5 : 1 }}>Next</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── Right: Task Detail Panel ── */}
                    {selectedTaskId && (
                        <div style={{ width: '400px', flexShrink: 0, position: 'sticky', top: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '0.5rem', borderBottom: '2px solid #1e293b', marginBottom: '1.25rem' }}>
                                <Target size={18} />
                                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', flex: 1 }}>Task Context</h4>
                                <button onClick={handleClosePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: '4px' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(0,0,0,0.05)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }} className="custom-scrollbar">
                                {panelLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: '#94a3b8' }}>
                                        <Loader2 size={24} className="animate-spin" />
                                    </div>
                                ) : !selectedTask ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Task not found.</div>
                                ) : (
                                    <>
                                        {/* Header: name + badges */}
                                        <div>
                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>{selectedTask.name}</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {(() => {
                                                    const s = getStatusStyle(selectedTask.status);
                                                    return <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '5px', background: s.bg, color: s.color, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{s.icon}{s.label}</span>;
                                                })()}
                                                {(() => {
                                                    const p = getPriorityStyle(selectedTask.priority);
                                                    return <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '5px', background: '#f8fafc', color: p.color, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #e2e8f0' }}>{p.icon}{p.label} Priority</span>;
                                                })()}
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>Description</label>
                                            <div style={{ fontSize: '0.82rem', color: '#445469', lineHeight: 1.6, background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                                                {selectedTask.description || 'No description provided.'}
                                            </div>
                                        </div>

                                        {/* Timeline + Milestone */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#f8fafc', padding: '0.875rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                            <div>
                                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Timeline</label>
                                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '2px' }}>Start</div>
                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>{formatDate(selectedTask.startDate)}</div>
                                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '2px' }}>Due</div>
                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b' }}>{formatDate(selectedTask.dueDate)}</div>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Milestone</label>
                                                {(selectedTask as any).milestoneName || (selectedTask as any).milestone?.name ? (
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color)', background: '#f0f9ff', padding: '3px 8px', borderRadius: '6px', border: '1px solid #bae6fd', display: 'inline-block' }}>
                                                        {(selectedTask as any).milestoneName || (selectedTask as any).milestone?.name}
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No Milestone</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Assignee */}
                                        <div>
                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Assignee</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '28px', height: '28px', background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <User size={14} color="#64748b" />
                                                </div>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                                                    {(selectedTask as any).assigneeName || (selectedTask as any).assignedToName || (selectedTask as any).member?.fullName || 'Unassigned'}
                                                </div>
                                            </div>
                                            {((selectedTask as any).members?.length > 0) && (
                                                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: '#64748b' }}>
                                                    <Users size={12} />
                                                    {(selectedTask as any).members.length} collaborator{(selectedTask as any).members.length !== 1 ? 's' : ''}
                                                </div>
                                            )}
                                        </div>

                                        {/* Evidence Section */}
                                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                                                    Evidence {serverEvidences.length > 0 && `(${serverEvidences.length})`}
                                                </span>
                                                {canUploadEvidence && serverEvidences.length === 0 && pendingFiles.length === 0 && (
                                                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444' }} title="Evidence required to submit" />
                                                )}
                                            </div>

                                            {/* Upload drop zone */}
                                            {canUploadEvidence && totalFiles < 5 && (
                                                <label style={{
                                                    position: 'relative', padding: '0.75rem', border: '1.5px dashed #cbd5e1', borderRadius: '10px',
                                                    textAlign: 'center', background: 'white', cursor: 'pointer', display: 'block', opacity: submitting ? 0.6 : 1,
                                                    pointerEvents: submitting ? 'none' : 'auto'
                                                }}>
                                                    <input type="file" multiple onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} disabled={submitting} />
                                                    <Upload size={16} style={{ color: '#94a3b8', marginBottom: '3px' }} />
                                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>Click or drag files (max 10MB, {5 - totalFiles} slot{5 - totalFiles !== 1 ? 's' : ''} left)</div>
                                                </label>
                                            )}

                                            {/* Uploaded files */}
                                            {serverEvidences.length > 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {serverEvidences.map((ev: any) => (
                                                        <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.68rem' }}>
                                                            <Check size={12} color="#10b981" />
                                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#475569', fontWeight: 500 }}>{ev.fileName || ev.name}</span>
                                                            {canUploadEvidence && !submitting && (
                                                                <button onClick={() => handleDeleteEvidence(ev.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex' }}>
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Pending (not yet uploaded) files */}
                                            {pendingFiles.length > 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {pendingFiles.map((f, i) => (
                                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.68rem' }}>
                                                            <Paperclip size={12} color="#64748b" />
                                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#475569', fontWeight: 500 }}>{f.name}</span>
                                                            {!submitting && (
                                                                <button onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', display: 'flex' }}>
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Upload only button */}
                                            {canUploadEvidence && pendingFiles.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        handleUploadOnly();
                                                    }}
                                                    disabled={submitting}
                                                    style={{
                                                        padding: '0.6rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.72rem',
                                                        background: 'white', color: 'var(--primary-color)', border: '1.5px solid var(--primary-color)',
                                                        cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                        opacity: submitting ? 0.7 : 1
                                                    }}
                                                >
                                                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                                    UPLOAD FILES ({pendingFiles.length})
                                                </button>
                                            )}

                                            {panelError && <div style={{ color: '#ef4444', fontSize: '0.65rem', fontWeight: 700 }}>{panelError}</div>}
                                        </div>

                                        {/* Status Actions */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {/* Start task */}
                                            {selectedTask.status === TaskStatus.Todo && (
                                                <button onClick={() => handleStatusAction(TaskStatus.InProgress)} disabled={submitting}
                                                    style={{ padding: '0.8rem', background: 'white', color: 'var(--primary-color)', border: '1.5px solid var(--primary-color)', borderRadius: '12px', fontWeight: 700, fontSize: '0.78rem', cursor: submitting ? 'not-allowed' : 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', opacity: submitting ? 0.7 : 1 }}
                                                    onMouseOver={(e) => { if (!submitting) e.currentTarget.style.background = '#fff8f2'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.background = 'white'; }}
                                                >
                                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                                                    START THIS TASK
                                                </button>
                                            )}

                                            {/* Submit for review */}
                                            {[TaskStatus.InProgress, TaskStatus.Adjusting, TaskStatus.Missed].includes(selectedTask.status) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (pendingFiles.length > 0) {
                                                            setPanelError('Upload pending files first before submitting.');
                                                            return;
                                                        }
                                                        if (serverEvidences.length === 0) {
                                                            setPanelError('Upload at least 1 evidence before submitting.');
                                                            return;
                                                        }
                                                        setPanelError(null);
                                                        setIsSubmitConfirmOpen(true);
                                                    }}
                                                    disabled={submitting || serverEvidences.length === 0 || pendingFiles.length > 0}
                                                    style={{
                                                        padding: '0.8rem', borderRadius: '12px', fontWeight: 800, fontSize: '0.78rem',
                                                        cursor: (submitting || serverEvidences.length === 0 || pendingFiles.length > 0) ? 'not-allowed' : 'pointer',
                                                        background: (serverEvidences.length === 0 || pendingFiles.length > 0) ? '#f1f5f9' : 'white',
                                                        color: (serverEvidences.length === 0 || pendingFiles.length > 0) ? '#94a3b8' : 'var(--accent-color)',
                                                        border: `2px solid ${(serverEvidences.length === 0 || pendingFiles.length > 0) ? '#e2e8f0' : 'var(--accent-color)'}`,
                                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                                    }}
                                                >
                                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                                    {serverEvidences.length === 0
                                                        ? 'SUBMIT BLOCKED — UPLOAD EVIDENCE'
                                                        : pendingFiles.length > 0
                                                            ? 'SUBMIT BLOCKED — UPLOAD FILES FIRST'
                                                            : 'SUBMIT FOR REVIEW'}
                                                </button>
                                            )}

                                            {/* Request Adjust (leader/admin review) - shown for viewer only when task is submitted */}
                                            {selectedTask.status === TaskStatus.Submitted && (
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => handleStatusAction(TaskStatus.Adjusting)} disabled={submitting}
                                                        style={{ flex: 1, padding: '0.75rem', background: '#fff1f2', color: '#e11d48', border: '1.5px solid #fecdd3', borderRadius: '12px', fontWeight: 800, fontSize: '0.72rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                                        onMouseOver={(e) => { if (!submitting) e.currentTarget.style.background = '#ffe4e6'; }}
                                                        onMouseOut={(e) => { e.currentTarget.style.background = '#fff1f2'; }}
                                                    >
                                                        <RotateCw size={13} /> REQUEST ADJUST
                                                    </button>
                                                    <button onClick={() => handleStatusAction(TaskStatus.Completed)} disabled={submitting}
                                                        style={{ flex: 1, padding: '0.75rem', background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0', borderRadius: '12px', fontWeight: 800, fontSize: '0.72rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                                        onMouseOver={(e) => { if (!submitting) e.currentTarget.style.background = '#dcfce7'; }}
                                                        onMouseOut={(e) => { e.currentTarget.style.background = '#f0fdf4'; }}
                                                    >
                                                        <CheckCircle2 size={13} /> APPROVE TASK
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={isSubmitConfirmOpen}
                onClose={() => setIsSubmitConfirmOpen(false)}
                onConfirm={async () => {
                    setIsSubmitConfirmOpen(false);
                    await handleStatusAction(TaskStatus.Submitted);
                }}
                title="Confirm Submit"
                message="Submit this task for review? Make sure your evidence is correct and complete."
                confirmText="Submit"
                cancelText="Cancel"
                variant="info"
            />
        </MainLayout>
    );
};

export default Tasks;
