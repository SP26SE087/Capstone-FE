import api from './api';
import { Task } from '@/types';

// Mock priority tasks for development convenience
const mockTasks: Task[] = [];

export const taskService = {
    getPriorityTasks: async (): Promise<Task[]> => {
        try {
            const response = await api.get('/api/projects/tasks?limit=5'); 
            return response.data.data || response.data;
        } catch (error) {
            console.error('Error fetching tasks:', error);
            return [];
        }
    },

    create: async (taskData: any): Promise<any> => {
        try {
            // Filter fields for CreateTaskRequest as per updated model
            const createPayload = {
                name: taskData.name,
                description: taskData.description,
                priority: taskData.priority,
                status: taskData.status,
                memberId: taskData.memberId || null,
                projectId: taskData.projectId,
                startDate: taskData.startDate,
                dueDate: taskData.dueDate,
                milestoneId: taskData.milestoneId || null
            };

            const response = await api.post('/api/projects/tasks', createPayload);
            const newTask = response.data.data || response.data;

            // If there are support members, add them one by one (as per devApi)
            if (newTask?.id && taskData.supportMembers && taskData.supportMembers.length > 0) {
                console.log('Adding support members to task:', newTask.id);
                await Promise.all(taskData.supportMembers.map((mId: string) =>
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

    update: async (taskId: string, taskData: any): Promise<any> => {
        try {
            // Per updated model: PUT /api/projects/tasks
            const updatePayload = {
                id: taskId,
                name: taskData.name,
                description: taskData.description,
                priority: taskData.priority,
                status: taskData.status,
                memberId: taskData.memberId || null,
                startDate: taskData.startDate,
                dueDate: taskData.dueDate,
                milestoneId: taskData.milestoneId || null
            };

            const response = await api.put('/api/projects/tasks', updatePayload);
            const updatedTask = response.data.data || response.data;
            
            return updatedTask;
        } catch (error) {
            console.error(`Error updating task ${taskId}:`, error);
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
    },

    delete: async (taskId: string): Promise<any> => {
        try {
            const response = await api.delete(`/api/projects/tasks/${taskId}`);
            return response.data;
        } catch (error) {
            console.error(`Error deleting task ${taskId}:`, error);
            throw error;
        }
    }
};
