import api from './api';
import { Task, TaskStatus } from '@/types';

// Mock priority tasks for development convenience
const mockTasks: Task[] = [
    {
        id: '9f0e1d2c-3b4a-5987-6543-210fedcba987',
        name: 'Submit Q1 Research Report',
        description: 'Complete and submit the first quarter report on AI project.',
        priority: 1, // High
        status: TaskStatus.InProgress,
        startDate: '2024-03-01T00:00:00Z',
        dueDate: '2024-10-15T23:59:59Z',
        tagIds: []
    },
    {
        id: '8e9d0c1b-2a3f-4e5d-6c7b-8a9012345678',
        name: 'Hardware Components Audit',
        description: 'Periodic check of lab equipment and sensors.',
        priority: 2, // Medium
        status: TaskStatus.Todo,
        startDate: '2024-03-05T00:00:00Z',
        dueDate: '2024-11-20T23:59:59Z',
        tagIds: []
    }
];

export const taskService = {
    getPriorityTasks: async (): Promise<Task[]> => {
        try {
            // Note: GET /api/projects/tasks?limit=5 currently returns 405 (Method Not Allowed).
            // This endpoint only supports POST and PUT in devApi.json.
            // Returning mock data until a correct GET endpoint for all tasks is available.
            // const response = await api.get('/api/projects/tasks?limit=5'); 
            // return response.data.data || response.data;
            return mockTasks;
        } catch (error) {
            console.error('Error fetching tasks:', error);
            // Fallback to more comprehensive mock for demonstration
            return mockTasks;
        }
    },

    create: async (taskData: any): Promise<any> => {
        try {
            const response = await api.post('/api/projects/tasks', taskData);
            return response.data;
        } catch (error) {
            console.error('Error creating task:', error);
            throw error;
        }
    },

    getByProject: async (projectId: string): Promise<Task[]> => {
        try {
            const response = await api.get(`/api/projects/${projectId}/tasks`);
            return response.data.data || response.data;
        } catch (error) {
            console.error(`Error fetching tasks for project ${projectId}:`, error);
            return [];
        }
    }
};
