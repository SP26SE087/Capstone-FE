import React, { useState } from 'react';
import { Task, TaskStatus, ProjectMember } from '@/types';
import TaskItem from '@/components/task/TaskItem';
import { Plus, MoreHorizontal } from 'lucide-react';
import TaskFormModal from './TaskFormModal';
import { taskService } from '@/services';

interface KanbanBoardProps {
    tasks: Task[];
    projectMembers: ProjectMember[];
    projectId: string;
    onTaskCreated?: () => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
    tasks,
    projectMembers,
    projectId,
    onTaskCreated
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<TaskStatus>(TaskStatus.Todo);

    const columns = [
        { id: TaskStatus.Todo, title: 'To Do', color: '#64748b' },
        { id: TaskStatus.InProgress, title: 'In Progress', color: '#0288d1' },
        { id: TaskStatus.InReview, title: 'In Review', color: '#7c3aed' },
        { id: TaskStatus.Completed, title: 'Completed', color: '#10b981' }
    ];

    const getTasksByStatus = (status: TaskStatus) => {
        return tasks.filter(task => task.status === status);
    };

    const handleAddTask = (status: TaskStatus) => {
        setSelectedStatus(status);
        setIsModalOpen(true);
    };

    const handleFormSubmit = async (taskData: any) => {
        try {
            await taskService.create({ ...taskData, projectId });
            onTaskCreated?.();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to create task:', error);
            alert('Failed to register research activity. Please check console for details.');
        }
    };

    return (
        <div style={{
            display: 'flex',
            gap: '1.5rem',
            overflowX: 'auto',
            paddingBottom: '1rem',
            minHeight: '600px',
            alignItems: 'flex-start'
        }}>
            {columns.map(column => {
                const columnTasks = getTasksByStatus(column.id);
                return (
                    <div
                        key={column.id}
                        style={{
                            flex: 1,
                            minWidth: '300px',
                            background: '#f8fafc',
                            borderRadius: '16px',
                            padding: '1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            border: '1px solid #e2e8f0'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: column.color }} />
                                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {column.title}
                                </h3>
                                <span style={{
                                    background: '#cbd5e1',
                                    color: 'white',
                                    fontSize: '0.7rem',
                                    padding: '2px 6px',
                                    borderRadius: '10px',
                                    fontWeight: 700
                                }}>
                                    {columnTasks.length}
                                </span>
                            </div>
                            <button style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                <MoreHorizontal size={16} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {columnTasks.map(task => (
                                <TaskItem key={task.id} task={task} />
                            ))}
                        </div>

                        <button
                            onClick={() => handleAddTask(column.id)}
                            style={{
                                marginTop: '0.5rem',
                                width: '100%',
                                padding: '0.75rem',
                                background: 'transparent',
                                border: '1px dashed #cbd5e1',
                                borderRadius: '12px',
                                color: '#64748b',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = '#f1f5f9';
                                e.currentTarget.style.borderColor = '#94a3b8';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = '#cbd5e1';
                            }}
                        >
                            <Plus size={16} />
                            Add Activity
                        </button>
                    </div>
                );
            })}

            <TaskFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleFormSubmit}
                projectMembers={projectMembers}
                initialStatus={selectedStatus}
            />
        </div>
    );
};

export default KanbanBoard;
