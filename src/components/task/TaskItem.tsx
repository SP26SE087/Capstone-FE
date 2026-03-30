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
    Minus,
    Timer
} from 'lucide-react';

interface TaskItemProps {
    task: Task;
    onClick?: (task: Task) => void;
    milestoneName?: string;
    isCompact?: boolean;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onClick, milestoneName, isCompact }) => {
    const getStatusStyle = (status: TaskStatus) => {
        switch (status) {
            case TaskStatus.Todo: return { color: 'var(--text-secondary)', bg: 'var(--border-light)', label: 'To Do', icon: <Clock size={12} /> };
            case TaskStatus.InProgress: return { color: 'var(--info)', bg: 'var(--info-bg)', label: 'In Progress', icon: <Timer size={12} /> };
            case TaskStatus.Submitted: return { color: '#7c3aed', bg: '#f5f3ff', label: 'Submitted', icon: <Send size={12} /> };
            case TaskStatus.Missed: return { color: 'var(--danger)', bg: 'var(--danger-bg)', label: 'Missed', icon: <AlertTriangle size={12} /> };
            case TaskStatus.Adjusting: return { color: 'var(--warning)', bg: 'var(--warning-bg)', label: 'Adjusting', icon: <Settings size={12} /> };
            case TaskStatus.Completed: return { color: 'var(--success)', bg: 'var(--success-bg)', label: 'Completed', icon: <CheckCircle2 size={12} /> };
            default: return { color: 'var(--text-muted)', bg: 'var(--border-light)', label: 'Unknown', icon: <Clock size={12} /> };
        }
    };

    const getPriorityStyle = (priority: Priority) => {
        switch (priority) {
            case Priority.Critical: return { color: 'var(--danger)', label: 'Critical', bg: 'var(--danger-bg)', icon: <AlertOctagon size={12} /> };
            case Priority.High: return { color: 'var(--warning)', label: 'High', bg: 'var(--warning-bg)', icon: <ChevronUp size={12} /> };
            case Priority.Medium: return { color: 'var(--info)', label: 'Medium', bg: 'var(--info-bg)', icon: <Minus size={12} /> };
            case Priority.Low: return { color: 'var(--text-muted)', label: 'Low', bg: 'var(--border-light)', icon: <ChevronDown size={12} /> };
            default: return { color: 'var(--text-muted)', label: 'Normal', bg: 'var(--border-light)', icon: <Minus size={12} /> };
        }
    };

    const statusStyle = getStatusStyle(task.status);
    const priorityStyle = getPriorityStyle(task.priority);

    // Common card styles
    const cardBaseStyle: React.CSSProperties = {
        background: 'white',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: 'var(--shadow-xs)',
        position: 'relative',
        overflow: 'hidden'
    };

    if (isCompact) {
        return (
            <div
                onClick={() => onClick?.(task)}
                style={{
                    ...cardBaseStyle,
                    padding: '0.85rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                }}
                className="task-item-premium"
            >
                <div style={{ width: '100px', flexShrink: 0 }}>
                    <div style={{
                        fontSize: '0.65rem',
                        padding: '2px 10px',
                        borderRadius: 'var(--radius-full)',
                        background: priorityStyle.bg,
                        color: priorityStyle.color,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        border: `1px solid ${priorityStyle.color}15`
                    }}>
                        {priorityStyle.icon}
                        {priorityStyle.label}
                    </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{
                        margin: 0,
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {task.name}
                    </h4>
                    {milestoneName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--accent-color)', fontWeight: 800, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            <MapPin size={10} />
                            {milestoneName}
                        </div>
                    )}
                </div>

                <div style={{ width: '100px', flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : 'No date'}
                    </div>
                </div>

                <div style={{ width: '60px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {task.memberId ? (
                            <div title="Assignee" style={{ 
                                width: '28px', 
                                height: '28px', 
                                borderRadius: '50%', 
                                background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))', 
                                border: '2px solid white', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                color: 'white', 
                                fontSize: '0.7rem', 
                                fontWeight: 800,
                                boxShadow: 'var(--shadow-sm)'
                            }}>
                                {task.members?.find(m => (m.memberId || m.id) === task.memberId)?.userName?.charAt(0).toUpperCase() || <User size={14} />}
                            </div>
                        ) : (
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                <User size={14} />
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ width: '120px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                        fontSize: '0.65rem',
                        padding: '3px 12px',
                        borderRadius: 'var(--radius-full)',
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        border: `1px solid ${statusStyle.color}15`
                    }}>
                        {statusStyle.icon}
                        {statusStyle.label}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={() => onClick?.(task)}
            style={{
                ...cardBaseStyle,
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
            }}
            className="task-item-premium"
        >
            <style>{`
                @keyframes warningBlink {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(1.1); }
                }
                .task-item-premium:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                    border-color: var(--accent-color)44;
                }
            `}</style>
            
            {(() => {
                const isNearDeadline = () => {
                    if (!task.dueDate) return false;
                    if (task.status === TaskStatus.Completed || task.status === TaskStatus.Submitted) return false;
                    const diffDays = (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                    return diffDays <= 3;
                };

                if (isNearDeadline()) {
                    return (
                        <div style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: 'var(--danger)',
                            border: '2px solid white',
                            boxShadow: '0 0 8px var(--danger)',
                            animation: 'warningBlink 1.5s ease-in-out infinite',
                            zIndex: 10
                        }} title="Deadline approach" />
                    );
                }
                return null;
            })()}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{
                    fontSize: '0.65rem',
                    padding: '2px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: priorityStyle.bg,
                    color: priorityStyle.color,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    border: `1px solid ${priorityStyle.color}15`
                }}>
                    {priorityStyle.icon}
                    {priorityStyle.label}
                </div>
                <button style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }} className="hover-bg-light">
                    <MoreHorizontal size={18} />
                </button>
            </div>

            <h4
                title={task.name}
                style={{
                    margin: 0,
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: '1.4'
                }}
            >
                {task.name}
            </h4>

            {milestoneName && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.65rem',
                    color: 'var(--accent-color)',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em'
                }}>
                    <MapPin size={12} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {milestoneName}
                    </span>
                </div>
            )}

            <p style={{
                margin: 0,
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: '1.6',
                height: '3.2em',
                opacity: task.description ? 1 : 0.6,
                fontStyle: task.description ? 'normal' : 'italic'
            }}>
                {task.description || 'No description provided'}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {task.memberId && (
                            <div title="Assignee" style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
                                border: '2px solid white',
                                zIndex: 3,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                boxShadow: 'var(--shadow-sm)'
                            }}>
                                {task.members?.find(m => (m.memberId || m.id) === task.memberId)?.userName?.charAt(0).toUpperCase() || <User size={14} />}
                            </div>
                        )}
                        
                        {task.members && task.members.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', marginLeft: task.memberId ? '-10px' : 0 }}>
                                {task.members
                                    .filter(m => (m.memberId || m.id) !== task.memberId)
                                    .slice(0, 2)
                                    .map((member, i) => (
                                        <div key={member.id || i} style={{
                                            width: '26px',
                                            height: '26px',
                                            borderRadius: '50%',
                                            background: '#7c3aed',
                                            border: '2px solid white',
                                            marginLeft: i > 0 || task.memberId ? '-10px' : 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            zIndex: 2 - i,
                                            boxShadow: 'var(--shadow-sm)'
                                        }}>
                                            {member.userName?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                    ))}
                                {task.members.filter(m => (m.memberId || m.id) !== task.memberId).length > 2 && (
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 600 }}>
                                        +{task.members.filter(m => (m.memberId || m.id) !== task.memberId).length - 2}
                                    </span>
                                )}
                            </div>
                        )}
                        
                        {!task.memberId && (!task.members || task.members.length === 0) && (
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                <User size={14} />
                            </div>
                        )}
                    </div>
                </div>

                <div style={{
                    fontSize: '0.65rem',
                    padding: '3px 12px',
                    borderRadius: 'var(--radius-full)',
                    background: statusStyle.bg,
                    color: statusStyle.color,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    border: `1px solid ${statusStyle.color}15`
                }}>
                    {statusStyle.icon}
                    {statusStyle.label}
                </div>
            </div>
        </div>
    );
};

export default TaskItem;
