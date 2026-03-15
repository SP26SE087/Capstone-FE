import React from 'react';
import { Task, TaskStatus, Priority } from '@/types';
import {
    Clock,
    CheckCircle2,
    User,
    Calendar,
    MoreHorizontal,
    MapPin,
    Send,
    AlertTriangle,
    Settings,
    AlertOctagon,
    ChevronUp,
    ChevronDown,
    Minus
} from 'lucide-react';

interface TaskItemProps {
    task: Task;
    onClick?: (task: Task) => void;
    milestoneName?: string;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onClick, milestoneName }) => {
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
            case Priority.Critical: return { color: '#ef4444', label: 'Critical', bg: '#fef2f2', icon: <AlertOctagon size={12} /> };
            case Priority.High: return { color: '#f59e0b', label: 'High', bg: '#fffbeb', icon: <ChevronUp size={12} /> };
            case Priority.Medium: return { color: '#3b82f6', label: 'Medium', bg: '#eff6ff', icon: <Minus size={12} /> };
            case Priority.Low: return { color: '#94a3b8', label: 'Low', bg: '#f8fafc', icon: <ChevronDown size={12} /> };
            default: return { color: '#94a3b8', label: 'Normal', bg: '#f8fafc', icon: <Minus size={12} /> };
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
                    {priorityStyle.icon}
                    {priorityStyle.label}
                </div>
                <button style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <MoreHorizontal size={16} />
                </button>
            </div>

            <h4
                title={task.name}
                style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#1e293b',
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'break-all',
                    lineHeight: '1.3'
                }}
            >
                {task.name}
            </h4>

            {milestoneName && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.7rem',
                    color: 'var(--primary-color)',
                    fontWeight: 700,
                    marginBottom: '-4px'
                }}>
                    <MapPin size={12} />
                    <span style={{ textTransform: 'uppercase', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {milestoneName}
                    </span>
                </div>
            )}

            <p style={{
                margin: 0,
                fontSize: '0.8rem',
                color: '#64748b',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: '1.5',
                height: '3em', // Fixes height to exactly 2 lines (1.5 * 2)
                wordBreak: 'break-word',
                opacity: task.description ? 1 : 0.5,
                fontStyle: task.description ? 'normal' : 'italic'
            }}>
                {task.description || 'No description provided'}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {/* Always show primary assignee if they exist */}
                        {task.memberId && (
                            <div title="Assignee" style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: 'var(--primary-color)',
                                border: '2px solid white',
                                zIndex: 3,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                            }}>
                                {/* Try to find assignee name in members array or fallback to User icon */}
                                {task.members?.find(m => (m.memberId || m.id) === task.memberId)?.userName?.charAt(0) || <User size={12} />}
                            </div>
                        )}
                        
                        {/* Show support members (Collaborators) */}
                        {task.members && task.members.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', marginLeft: task.memberId ? '-8px' : 0 }}>
                                {task.members
                                    .filter(m => (m.memberId || m.id) !== task.memberId) // Don't duplicate assignee
                                    .slice(0, 2)
                                    .map((member, i) => (
                                        <div key={member.id || i} style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: '#7c3aed',
                                            border: '2px solid white',
                                            marginLeft: i > 0 || task.memberId ? '-8px' : 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontSize: '0.6rem',
                                            fontWeight: 600,
                                            zIndex: 2 - i
                                        }}>
                                            {member.userName?.charAt(0) || '?'}
                                        </div>
                                    ))}
                                {task.members.filter(m => (m.memberId || m.id) !== task.memberId).length > 2 && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                                        +{task.members.filter(m => (m.memberId || m.id) !== task.memberId).length - 2}
                                    </span>
                                )}
                            </div>
                        )}
                        
                        {!task.memberId && (!task.members || task.members.length === 0) && (
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                <User size={12} />
                            </div>
                        )}
                    </div>

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
