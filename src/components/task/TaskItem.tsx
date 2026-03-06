import React from 'react';
import { Task, TaskStatus } from '@/types';

interface TaskItemProps {
    task: Task;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
    return (
        <div className="task-item">
            <p>{task.name}</p>
            <span>{TaskStatus[task.status]}</span>
        </div>
    );
};

export default TaskItem;
