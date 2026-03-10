import React from 'react';
import { Task, TaskStatus, Priority } from '@/types';
import {
    Clock,
    CheckCircle2,
    AlertCircle,
    Flag,
    User,
    Calendar,
    MoreHorizontal
} from 'lucide-react';

interface TaskItemProps {
    task: Task;
    onClick?: (task: Task) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onClick }) => {
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

    const statusStyle = getStatusStyle(task.status);
    const priorityStyle = getPriorityStyle(task.priority);

    return (
        <div
            onClick={() => onClick?.(task)}
            style={{
                padding: '1rem',
                background: 'white',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}
            onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'}
            onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: priorityStyle.bg,
                    color: priorityStyle.color,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <Flag size={10} />
                    {priorityStyle.label}
                </div>
                <button style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <MoreHorizontal size={16} />
                </button>
            </div>

            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{task.name}</h4>

            {task.description && (
                <p style={{
                    margin: 0,
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: '1.4'
                }}>
                    {task.description}
                </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {task.members && task.members.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            {task.members.slice(0, 2).map((member, i) => (
                                <div key={member.id} style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: '#7c3aed',
                                    border: '2px solid white',
                                    marginLeft: i > 0 ? '-8px' : 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '0.6rem',
                                    fontWeight: 600
                                }}>
                                    {member.userName.charAt(0)}
                                </div>
                            ))}
                            {task.members.length > 2 && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>+{task.members.length - 2}</span>
                            )}
                        </div>
                    ) : (
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                            <User size={12} />
                        </div>
                    )}

                    {task.dueDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            <Calendar size={12} />
                            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                    )}
                </div>

                <div style={{
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    background: statusStyle.bg,
                    color: statusStyle.color,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    {statusStyle.icon}
                    {statusStyle.label}
                </div>
            </div>
        </div>
    );
};

export default TaskItem;
