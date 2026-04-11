import React from 'react';
import { Task, TaskStatus } from '@/types';
import { Calendar, Users } from 'lucide-react';
import { getStatusStyle, getPriorityStyle } from '../taskHelpers';

interface TaskTableProps {
    tasks: Task[];
    selectedTaskId: string | null;
    onTaskClick: (taskId: string) => void;
    loading: boolean;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

const TaskTable: React.FC<TaskTableProps> = ({
    tasks,
    selectedTaskId,
    onTaskClick,
    loading,
    currentPage,
    totalPages,
    onPageChange,
}) => {
    if (loading) {
        return <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem' }}>Loading tasks...</p>;
    }

    return (
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
                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Collaborators</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    No tasks found matching your criteria.
                                </td>
                            </tr>
                        ) : tasks.map((task) => {
                            const tid = task.taskId;
                            const statusStyle = getStatusStyle(task.status);
                            const priorityStyle = getPriorityStyle(task.priority);
                            const isSelected = tid === selectedTaskId;
                            const isNearDeadline = !!(
                                task.dueDate
                                && ![TaskStatus.Completed, TaskStatus.Submitted].includes(task.status)
                                && ((new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 3
                            );

                            return (
                                <tr
                                    key={tid}
                                    onClick={() => tid && onTaskClick(tid)}
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
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {task.name}
                                                    {isNearDeadline && (
                                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} title="Due soon" />
                                                    )}
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    {task.projectName || (task.projectId?.substring(0, 8) ?? 'N/A')}
                                                </p>
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
                                        {task.assignedToName ?? 'N/A'}
                                    </td>
                                    <td style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--accent-bg)', color: 'var(--accent-color)', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '0.72rem' }}>
                                            <Users size={12} />
                                            {task.members?.length ?? 0}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.25rem', alignItems: 'center' }}>
                    <button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '0.85rem', opacity: currentPage === 1 ? 0.5 : 1 }}>Prev</button>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {[...Array(totalPages)].map((_, i) => (
                            <button key={i + 1} onClick={() => onPageChange(i + 1)}
                                className={`btn ${currentPage === i + 1 ? 'btn-primary' : 'btn-text'}`}
                                style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', minWidth: 'unset' }}>
                                {i + 1}
                            </button>
                        ))}
                    </div>
                    <button disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '0.85rem', opacity: currentPage === totalPages ? 0.5 : 1 }}>Next</button>
                </div>
            )}
        </>
    );
};

export default TaskTable;
