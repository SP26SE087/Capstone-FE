import { useState, useEffect } from 'react';
import { Task } from '@/types';
import { taskService } from '@/services';

export const useTasks = (projectId?: string) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTasks = async () => {
            setLoading(true);
            try {
                // Assuming taskService has a method to get by project or priority
                const data = projectId
                    ? await taskService.getPriorityTasks() // Mocking for now
                    : await taskService.getPriorityTasks();
                setTasks(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchTasks();
    }, [projectId]);

    return { tasks, loading };
};
