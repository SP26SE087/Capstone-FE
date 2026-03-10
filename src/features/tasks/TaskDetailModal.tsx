import React, { useState, useEffect } from 'react';
import { X, Calendar, Flag, User, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Task, TaskStatus, Priority } from '@/types';
import { taskService } from '@/services';

interface TaskDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    taskId: string | null;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ isOpen, onClose, taskId }) => {
    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !taskId) return;

        const fetchTask = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await taskService.getById(taskId);
                setTask(data);
            } catch (err) {
                console.error("Failed to load task details:", err);
                setError("Failed to load task details. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchTask();
    }, [isOpen, taskId]);

    if (!isOpen) return null;

    const getStatusStyle = (status: TaskStatus) => {
        switch (status) {
            case TaskStatus.Todo: return { color: '#64748b', bg: '#f1f5f9', label: 'To Do', icon: <Clock size={14} /> };
            case TaskStatus.InProgress: return { color: '#0288d1', bg: '#e1f5fe', label: 'In Progress', icon: <div style={{ width: 8, height: 8, background: '#0288d1', borderRadius: '50%', marginRight: 4 }} /> };
            case TaskStatus.Submitted: return { color: '#7c3aed', bg: '#ede9fe', label: 'Submitted', icon: <Clock size={14} /> };
            case TaskStatus.Approved: return { color: '#059669', bg: '#d1fae5', label: 'Approved', icon: <CheckCircle2 size={14} /> };
            case TaskStatus.Rejected: return { color: '#ef4444', bg: '#fee2e2', label: 'Rejected', icon: <AlertCircle size={14} /> };
            case TaskStatus.Completed: return { color: '#10b981', bg: '#ecfdf5', label: 'Completed', icon: <CheckCircle2 size={14} /> };
            default: return { color: '#64748b', bg: '#f1f5f9', label: 'Unknown', icon: <Clock size={14} /> };
        }
    };

    const getPriorityStyle = (priority: Priority) => {
        switch (priority) {
            case Priority.Critical: return { color: '#e63946', label: 'Critical', bg: '#fef2f2' };
            case Priority.High: return { color: '#f59e0b', label: 'High', bg: '#fffbeb' };
            case Priority.Medium: return { color: '#0ea5e9', label: 'Medium', bg: '#f0f9ff' };
            case Priority.Low: return { color: '#94a3b8', label: 'Low', bg: '#f8fafc' };
            default: return { color: '#94a3b8', label: 'Normal', bg: '#f8fafc' };
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                        Task Details
                    </h2>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
                    {loading && <p>Loading task details...</p>}
                    {error && <p style={{ color: '#ef4444' }}>{error}</p>}

                    {!loading && !error && task && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: 700 }}>{task.name}</h3>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    {/* Status Badge */}
                                    <span style={{
                                        fontSize: '0.8rem',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        background: getStatusStyle(task.status).bg,
                                        color: getStatusStyle(task.status).color,
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        {getStatusStyle(task.status).icon}
                                        {getStatusStyle(task.status).label}
                                    </span>

                                    {/* Priority Badge */}
                                    <span style={{
                                        fontSize: '0.8rem',
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        background: getPriorityStyle(task.priority).bg,
                                        color: getPriorityStyle(task.priority).color,
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <Flag size={14} />
                                        {getPriorityStyle(task.priority).label}
                                    </span>
                                </div>
                            </div>

                            {/* Description Section */}
                            <div>
                                <h4 style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 0.5rem 0', fontWeight: 600 }}>Description</h4>
                                <div style={{
                                    padding: '1rem',
                                    background: '#f8fafc',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.95rem',
                                    lineHeight: '1.6',
                                    color: '#334155',
                                    minHeight: '80px',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {task.description || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No description provided.</span>}
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Calendar size={14} /> Start Date
                                    </span>
                                    <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                                        {task.startDate ? new Date(task.startDate).toLocaleDateString() : 'Not set'}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Calendar size={14} /> Due Date
                                    </span>
                                    <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}
                                    </span>
                                </div>
                            </div>

                            {/* Members */}
                            <div>
                                <h4 style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 0.5rem 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <User size={16} /> Assignees
                                </h4>
                                {task.members && task.members.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {task.members.map((member) => (
                                            <div key={member.id} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '6px 12px',
                                                background: '#f1f5f9',
                                                borderRadius: '20px',
                                                border: '1px solid #e2e8f0',
                                                fontSize: '0.85rem',
                                                fontWeight: 500
                                            }}>
                                                <div style={{
                                                    width: '20px', height: '20px',
                                                    borderRadius: '50%', background: 'var(--primary-color)',
                                                    color: 'white', display: 'flex', justifyContent: 'center',
                                                    alignItems: 'center', fontSize: '0.7rem'
                                                }}>
                                                    {member.userName.charAt(0).toUpperCase()}
                                                </div>
                                                {member.userName}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    background: '#f8fafc',
                    borderRadius: '0 0 16px 16px'
                }}>
                    <button
                        onClick={onClose}
                        className="btn btn-secondary"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailModal;
