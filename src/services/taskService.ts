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
            // Separate support members from main task data
            const { supportMembers, ...coreTaskData } = taskData;

            const response = await api.post('/api/projects/tasks', coreTaskData);
            const newTask = response.data.data || response.data;

            // If there are support members, add them one by one (as per devApi)
            if (newTask?.id && supportMembers && supportMembers.length > 0) {
                console.log('Adding support members to task:', newTask.id);
                await Promise.all(supportMembers.map((mId: string) =>
                    taskService.addMember(newTask.id, mId)
                ));
            }

            return newTask;
        } catch (error) {
            console.error('Error creating task:', error);
            throw error;
        }
    },

    addMember: async (taskId: string, memberId: string): Promise<any> => {
        try {
            const response = await api.post('/api/projects/tasks/members', { taskId, memberId });
            return response.data;
        } catch (error) {
            console.error(`Error adding member ${memberId} to task ${taskId}:`, error);
            throw error;
        }
    },

    removeMember: async (taskId: string, memberId: string): Promise<any> => {
        try {
            // Per devApi, DELETE /api/projects/tasks/members/{taskId}/{memberId}
            const response = await api.delete(`/api/projects/tasks/members/${taskId}/${memberId}`);
            return response.data;
        } catch (error) {
            console.error(`Error removing member ${memberId} from task ${taskId}:`, error);
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
    },

    getById: async (taskId: string): Promise<Task | null> => {
        try {
            const response = await api.get(`/api/projects/tasks/${taskId}`);
            const taskData: Task = response.data.data || response.data;

            // Hydrate member details
            let hydratedMembers: any[] = [];

            const fetchMember = async (memberId: string) => {
                try {
                    const res = await api.get(`/api/projects/members/${memberId}`);
                    return res.data.data || res.data;
                } catch (e) {
                    console.warn(`Could not fetch details for member ${memberId}`);
                    return null;
                }
            };

            // If there's a primary member
            if (taskData.memberId) {
                const primaryMember = await fetchMember(taskData.memberId);
                if (primaryMember) {
                    hydratedMembers.push({
                        id: primaryMember.memberId || taskData.memberId,
                        userName: primaryMember.fullName || primaryMember.email || 'Assignee'
                    });
                }
            }

            // If there are supporting members
            if (Array.isArray(taskData.members)) {
                for (const mId of taskData.members) {
                    // Check if it's a string ID and not already added as primary 
                    const idStr = typeof mId === 'string' ? mId : (mId as any).memberId || (mId as any).id;
                    if (idStr && idStr !== taskData.memberId) {
                        const supportMember = await fetchMember(idStr);
                        if (supportMember) {
                            hydratedMembers.push({
                                id: supportMember.memberId || idStr,
                                userName: supportMember.fullName || supportMember.email || 'Support Member'
                            });
                        }
                    }
                }
            }

            return {
                ...taskData,
                members: hydratedMembers,
                createdAt: taskData.createdDate || taskData.createdAt,
                updatedAt: taskData.updatedDate || taskData.updatedAt
            };
        } catch (error) {
            console.error(`Error fetching task details for ${taskId}:`, error);
            const mockTask = mockTasks.find(t => t.id === taskId);
            return mockTask || null;
        }
    }
};
