import React, { useState, useRef } from 'react';
import { Task, TaskStatus, ProjectMember } from '@/types';
import TaskItem from '@/components/task/TaskItem';
import { Plus, MoreHorizontal } from 'lucide-react';
import TaskFormModal from './TaskFormModal';
import TaskDetailModal from './TaskDetailModal';

import { taskService } from '@/services';

interface KanbanBoardProps {
    tasks: Task[];
    projectMembers: ProjectMember[];
    projectId: string;
    onTaskCreated?: () => void;
    onTaskUpdated?: () => void;
    milestones: Milestone[];
}

import { Milestone } from '@/types/milestone';

const DraggableColumn: React.FC<{ 
    tasks: Task[], 
    onTaskClick: (task: Task) => void 
}> = ({ tasks, onTaskClick }) => {
    const columnRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const [hasMoved, setHasMoved] = useState(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!columnRef.current) return;
        setIsDragging(true);
        setHasMoved(false);
        setStartY(e.pageY - columnRef.current.offsetTop);
        setScrollTop(columnRef.current.scrollTop);
    };

    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !columnRef.current) return;
        e.preventDefault();
        const y = e.pageY - columnRef.current.offsetTop;
        const walk = (y - startY) * 1.5;
        if (Math.abs(walk) > 5) setHasMoved(true);
        columnRef.current.scrollTop = scrollTop - walk;
    };

    return (
        <div
            ref={columnRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                overflowY: 'auto',
                maxHeight: '400px',
                paddingRight: tasks.length > 2 ? '4px' : '0',
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 transparent',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: isDragging ? 'none' : 'auto',
            }}
        >
            {tasks.map(task => (
                <div 
                    key={task.id} 
                    onClickCapture={(e) => {
                        if (hasMoved) {
                            e.stopPropagation();
                        }
                    }}
                >
                    <TaskItem 
                        task={task} 
                        onClick={(t) => {
                            if (!hasMoved) onTaskClick(t);
                        }} 
                    />
                </div>
            ))}
        </div>
    );
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({
    tasks,
    projectMembers,
    projectId,
    onTaskCreated,
    onTaskUpdated,
    milestones
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<TaskStatus>(TaskStatus.Todo);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    
    // Drag to scroll logic
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        setScrollLeft(scrollRef.current.scrollLeft);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2; // Scroll speed multiplier
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    const columns = [
        { id: TaskStatus.Todo, title: 'To Do', color: '#64748b' },
        { id: TaskStatus.InProgress, title: 'In Progress', color: '#0288d1' },
        { id: TaskStatus.Submitted, title: 'Submitted', color: '#7c3aed' },
        { id: TaskStatus.Rejected, title: 'Rejected', color: '#ef4444' },
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
            console.error('Failed to save task:', error);
            alert('Failed to save research activity. Please check console for details.');
        }
    };

    const handleTaskClick = (task: Task) => {
        setSelectedTaskId(task.id);
        setIsDetailModalOpen(true);
    };

    return (
        <div 
            ref={scrollRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            style={{
                display: 'flex',
                gap: '1.5rem',
                overflowX: 'auto',
                paddingBottom: '1rem',
                minHeight: '600px',
                alignItems: 'flex-start',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: isDragging ? 'none' : 'auto',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'auto', // Re-enable scrollbar
            }}
            className="kanban-scroll-container"
        >
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

                        <DraggableColumn 
                            tasks={columnTasks} 
                            onTaskClick={handleTaskClick} 
                        />

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
                onClose={() => {
                    setIsModalOpen(false);
                }}
                onSubmit={handleFormSubmit}
                projectMembers={projectMembers}
                initialStatus={selectedStatus}
                task={null}
                milestones={milestones}
            />

            <TaskDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                taskId={selectedTaskId}
                projectMembers={projectMembers}
                onTaskUpdated={onTaskUpdated}
                milestones={milestones}
            />
        </div>
    );
};

export default KanbanBoard;
