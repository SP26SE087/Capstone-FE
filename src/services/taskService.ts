import api from './api';
import { Task } from '@/types';

// Mock priority tasks for development convenience
const mockTasks: Task[] = [];

export const taskService = {
    getPriorityTasks: async (): Promise<Task[]> => {
        try {
            const response = await api.get('/api/projects/tasks/me');
            let tasks = response.data.data || response.data;
            if (Array.isArray(tasks)) {
                tasks = tasks.sort((a: any, b: any) => {
                    const isNearDeadlineA = a.dueDate && (a.status !== 6 && a.status !== 3) && ((new Date(a.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 3;
                    const isNearDeadlineB = b.dueDate && (b.status !== 6 && b.status !== 3) && ((new Date(b.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 3;

                    if (isNearDeadlineA && !isNearDeadlineB) return -1;
                    if (!isNearDeadlineA && isNearDeadlineB) return 1;

                    const aDone = a.status === 6 || a.status === 3;
                    const bDone = b.status === 6 || b.status === 3;
                    if (!aDone && bDone) return -1;
                    if (aDone && !bDone) return 1;

                    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                    return dateA - dateB;
                });
            }
            return tasks;
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
                try {
                    console.log('Adding support members to task:', newTask.id);
                    await Promise.all(taskData.supportMembers.map((mId: string) =>
                        taskService.addMember(newTask.id, mId)
                    ));
                } catch (memberError) {
                    console.error('Failed to add some support members:', memberError);
                    newTask._partialError = "Task created successfully, but collaborator assignment failed.";
                }
            }

            // If there are evidence files, upload them
            if (newTask?.id && taskData.evidence && taskData.evidence.length > 0) {
                console.log('Uploading evidence for task:', newTask.id);
                await taskService.uploadEvidences(newTask.id, taskData.evidence);
            }

            return newTask;
        } catch (error) {
            console.error('Error creating task:', error);
            throw error;
        }
    },

    addMember: async (taskId: string, memberId: string): Promise<any> => {
        try {
            const response = await api.post(`/api/projects/tasks/${taskId}/members`, { memberId });
            return response.data;
        } catch (error) {
            console.error(`Error adding member ${memberId} to task ${taskId}:`, error);
            throw error;
        }
    },

    removeMember: async (taskMemberId: string): Promise<any> => {
        try {
            // Per devApi: DELETE /api/projects/tasks/members/{taskMemberId}
            const response = await api.delete(`/api/projects/tasks/members/${taskMemberId}`);
            return response.data;
        } catch (error) {
            console.error(`Error removing task member association ${taskMemberId}:`, error);
            throw error;
        }
    },

    update: async (taskId: string, taskData: any): Promise<any> => {
        try {
            // Per updated model: PUT /api/projects/tasks
            const updatePayload = {
                taskId: taskId,
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

            // If there are support members, update them
            if (taskId && taskData.supportMembers) {
                console.log('Updating support members for task:', taskId);

                // Get current details to know who to add/remove
                const currentTask = await taskService.getById(taskId);
                if (currentTask) {
                    // Use memberId (which we've mapped to membershipId) for ID comparison
                    const currentSupportIds = (currentTask.members || []).map((m: any) => m.memberId);
                    const newSupportIds = taskData.supportMembers || [];

                    // Members to add: in newSupportIds but not in currentSupportIds
                    const toAdd = newSupportIds.filter((id: string) => id && !currentSupportIds.includes(id));

                    // Members to remove: in currentSupportIds but not in newSupportIds
                    const toRemove = (currentTask.members || []).filter((m: any) => m.memberId && !newSupportIds.includes(m.memberId));

                    try {
                        await Promise.all([
                            ...toAdd.map((mId: string) => taskService.addMember(taskId, mId)),
                            ...toRemove.map((m: any) => taskService.removeMember(m.id)) // Use association ID for deletion
                        ]);
                    } catch (memberError) {
                        console.error('Failed to update some project collaborators:', memberError);
                        updatedTask._partialError = "Task updated successfully, but collaborator changes failed.";
                    }
                }
            }

            // If there are evidence files, upload them
            if (taskId && taskData.evidence && taskData.evidence.length > 0) {
                console.log('Uploading evidence for task update:', taskId);
                await taskService.uploadEvidences(taskId, taskData.evidence);
            }

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

    getTaskByMember: async (memberId: string): Promise<Task[]> => {
        try {
            const response = await api.get(`/api/projects/tasks/member/${memberId}`);
            return response.data.data || response.data;
        } catch (error) {
            console.error(`Error fetching tasks for member ${memberId}:`, error);
            return [];
        }
    },

    getByUserId: async (userId: string): Promise<Task[]> => {
        try {
            const response = await api.get(`/api/projects/tasks/user/${userId}`);
            return response.data.data || response.data;
        } catch (error) {
            console.error(`Error fetching tasks for user ${userId}:`, error);
            return [];
        }
    },

    getCurrentUserTasks: async (): Promise<Task[]> => {
        try {
            const response = await api.get('/api/projects/tasks/current-user');
            return response.data.data || response.data;
        } catch (error) {
            console.error('Error fetching current user tasks:', error);
            return [];
        }
    },

    getById: async (taskId: string): Promise<Task | null> => {
        try {
            const response = await api.get(`/api/projects/tasks/${taskId}`);
            const taskData: any = response.data.data || response.data;

            // 1. Process existing members (collaborators) - data is already provided in the array
            const taskMembers = taskData.members || [];
            const processedMembers = taskMembers.map((tm: any) => {
                const pr = tm.projectRole;
                const projectRoleName = tm.projectRoleName || tm.roleName ||
                    (pr === 1 ? 'Lab Director' :
                        pr === 2 ? 'Senior Researcher' :
                            pr === 3 ? 'Member' :
                                pr === 4 ? 'Leader' : 'Researcher');

                return {
                    ...tm,
                    id: tm.id, // TaskMember association ID
                    membershipId: tm.membershipId,
                    memberId: tm.membershipId || tm.memberId, // Use membershipId as the primary identifier
                    userId: tm.userId,
                    userName: tm.fullName || tm.userName || tm.email || 'Unknown',
                    projectRoleName: projectRoleName,
                };
            });

            // 2. Fetch primary member details if memberId exists
            let primaryMemberDetail = null;
            if (taskData.memberId) {
                try {
                    const { membershipService } = await import('./membershipService');
                    primaryMemberDetail = await membershipService.getMemberById(taskData.memberId);
                } catch (e) {
                    console.warn(`Could not fetch details for primary member ${taskData.memberId}:`, e);
                }
            }

            return {
                ...taskData,
                member: primaryMemberDetail, // Primary member full details
                members: processedMembers, // Hydrated collaborators
                createdAt: taskData.createdDate || taskData.createdAt,
                updatedAt: taskData.updatedDate || taskData.updatedAt
            };
        } catch (error) {
            console.error(`Error fetching task details for ${taskId}:`, error);
            const mockTask = mockTasks.find(t => t.taskId === taskId);
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
    },

    getEvidences: async (taskId: string): Promise<any[]> => {
        try {
            const response = await api.get(`/api/projects/tasks/${taskId}/evidences`);
            return response.data.data || response.data || [];
        } catch (error) {
            console.error(`Error fetching evidences for task ${taskId}:`, error);
            return [];
        }
    },

    uploadEvidences: async (taskId: string, files: File[]): Promise<any> => {
        try {
            const formData = new FormData();
            files.forEach(file => {
                formData.append('files', (file as any).file || file);
            });
            const response = await api.post(`/api/projects/tasks/${taskId}/evidences/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data;
        } catch (error) {
            console.error(`Error uploading evidences for task ${taskId}:`, error);
            throw error;
        }
    },

    deleteEvidence: async (taskId: string, evidenceId: number): Promise<any> => {
        try {
            const response = await api.delete(`/api/projects/tasks/${taskId}/evidences/${evidenceId}`);
            return response.data;
        } catch (error) {
            console.error(`Error deleting evidence ${evidenceId} for task ${taskId}:`, error);
            throw error;
        }
    },

    updateStatus: async (taskId: string, status: number): Promise<any> => {
        try {
            // Updated to use the new format: PATCH /api/projects/tasks/${taskId}/status
            const response = await api.patch(`/api/projects/tasks/${taskId}/status`, { newStatus: status });
            return response.data;
        } catch (error) {
            console.error(`Error updating status for task ${taskId}:`, error);
            throw error;
        }
    },

    createBulk: async (tasks: any[]): Promise<any> => {
        try {
            // Per devApi: POST /api/projects/tasks/bulk
            const response = await api.post('/api/projects/tasks/bulk', tasks);
            return response.data;
        } catch (error) {
            console.error('Error creating bulk tasks:', error);
            throw error;
        }
    }
};
