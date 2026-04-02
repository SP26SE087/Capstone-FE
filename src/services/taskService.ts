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

    getMembers: async (taskId: string): Promise<any[]> => {
        try {
            // Per devApi: GET /api/projects/tasks/{taskId}/members
            const response = await api.get(`/api/projects/tasks/${taskId}/members`);
            const data = response.data.data || response.data;
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error(`Error fetching task members for task ${taskId}:`, error);
            return [];
        }
    },

    update: async (taskId: string, taskData: any): Promise<any> => {
        try {
            const hasMemberId = Object.prototype.hasOwnProperty.call(taskData, 'memberId');
            const nextMemberId = hasMemberId ? (taskData.memberId || null) : undefined;

            const hasSupportMembers = Object.prototype.hasOwnProperty.call(taskData, 'supportMembers');

            if (taskId && nextMemberId) {
                const currentMembers = await taskService.getMembers(taskId);
                const conflictingMember = currentMembers.find((tm: any) => {
                    const membershipId = tm.membershipId || tm.memberId || tm.member?.membershipId || tm.member?.id;
                    const userId = tm.userId || tm.user?.id;
                    return membershipId === nextMemberId || userId === nextMemberId;
                });

                const associationId =
                    conflictingMember?.id ||
                    conflictingMember?.taskMemberId ||
                    conflictingMember?.taskMemberID ||
                    conflictingMember?.taskMemberAssociationId;

                if (associationId) {
                    try {
                        await taskService.removeMember(associationId);
                    } catch (memberError) {
                        console.error('Failed to remove assignee from current collaborators before task update:', memberError);
                        throw memberError;
                    }
                }
            }

            // Per updated model: PUT /api/projects/tasks
            const updatePayload = {
                id: taskId,
                name: taskData.name,
                description: taskData.description,
                priority: taskData.priority,
                status: taskData.status,
                ...(hasMemberId ? { memberId: nextMemberId } : {}),
                startDate: taskData.startDate,
                dueDate: taskData.dueDate,
                milestoneId: taskData.milestoneId || null
            };

            const response = await api.put('/api/projects/tasks', updatePayload);
            const updatedTask = response.data.data || response.data;

            // If supportMembers is provided (including empty array), sync collaborators
            if (taskId && hasSupportMembers) {
                console.log('Updating support members for task:', taskId);

                // Use the dedicated members endpoint to ensure we have association IDs
                // required for DELETE /tasks/members/{taskMemberId}.
                const currentMembers = await taskService.getMembers(taskId);

                const currentKeySet = new Set<string>();
                currentMembers.forEach((tm: any) => {
                    const membershipKey = tm.membershipId || tm.memberId || tm.member?.membershipId || tm.member?.id;
                    const userKey = tm.userId || tm.user?.id;
                    if (membershipKey) currentKeySet.add(String(membershipKey));
                    if (userKey) currentKeySet.add(String(userKey));
                });

                const desiredSupportIdsRaw = Array.isArray(taskData.supportMembers) ? taskData.supportMembers : [];
                const newSupportIds = desiredSupportIdsRaw
                    .filter((id: string) => !!id)
                    .filter((id: string) => !nextMemberId || id !== nextMemberId);

                const toAdd = newSupportIds.filter((id: string) => id && !currentKeySet.has(String(id)));

                const desiredKeySet = new Set<string>(newSupportIds.map((id: string) => String(id)));
                const toRemoveAssociationIds = currentMembers
                    .map((tm: any) => {
                        const associationId = tm.id || tm.taskMemberId || tm.taskMemberID || tm.taskMemberAssociationId;
                        const membershipKey = tm.membershipId || tm.memberId || tm.member?.membershipId || tm.member?.id;
                        const userKey = tm.userId || tm.user?.id;
                        return { associationId, membershipKey, userKey };
                    })
                    .filter((row: any) => !!row.associationId)
                    .filter((row: any) => {
                        const membershipHit = row.membershipKey && desiredKeySet.has(String(row.membershipKey));
                        const userHit = row.userKey && desiredKeySet.has(String(row.userKey));
                        return !membershipHit && !userHit;
                    })
                    .map((row: any) => row.associationId);

                console.log('Support members diff:', { toAdd: toAdd.length, toRemove: toRemoveAssociationIds.length });

                try {
                    await Promise.all([
                        ...toAdd.map((mId: string) => taskService.addMember(taskId, mId)),
                        ...toRemoveAssociationIds.map((assocId: string) => taskService.removeMember(assocId))
                    ]);
                } catch (memberError) {
                    console.error('Failed to update some project collaborators:', memberError);
                    updatedTask._partialError = "Task updated successfully, but collaborator changes failed.";
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

            // 1. Process existing members (collaborators) - backend field name varies across endpoints
            const rawTaskMembers =
                taskData.members ??
                taskData.taskMembers ??
                taskData.taskMember ??
                taskData.supportMembers ??
                taskData.collaborators ??
                taskData.taskMemberDtos ??
                taskData.taskMemberResponses ??
                [];

            const taskMembers = Array.isArray(rawTaskMembers) ? rawTaskMembers : [];
            const processedMembers = taskMembers.map((tm: any) => {
                const pr = tm.projectRole;
                const projectRoleName = tm.projectRoleName || tm.roleName ||
                    (pr === 1 ? 'Lab Director' :
                        pr === 2 ? 'Senior Researcher' :
                            pr === 3 ? 'Member' :
                                pr === 4 ? 'Leader' : 'Researcher');

                const associationId = tm.id || tm.taskMemberId || tm.taskMemberID || tm.taskMemberAssociationId;
                const membershipId = tm.membershipId || tm.memberId || tm.member?.membershipId || tm.member?.id;
                const userId = tm.userId || tm.user?.id;
                const displayName =
                    tm.fullName ||
                    tm.userName ||
                    tm.email ||
                    tm.user?.fullName ||
                    tm.user?.userName ||
                    tm.user?.email ||
                    'Unknown';

                return {
                    ...tm,
                    id: associationId, // TaskMember association ID
                    membershipId,
                    memberId: membershipId || tm.memberId, // Prefer membershipId as identifier for add/remove
                    userId,
                    userName: displayName,
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
    },

    getActivitiesByMilestone: async (milestoneId: string): Promise<any[]> => {
        try {
            const response = await api.get(`/api/projects/milestones/${milestoneId}/tasks/status-activities`);
            return response.data.data || response.data || [];
        } catch (error) {
            console.error(`Error fetching milestone activities for ${milestoneId}:`, error);
            return [];
        }
    },

    getActivitiesByMember: async (memberId: string): Promise<any[]> => {
        try {
            const response = await api.get(`/api/projects/tasks/member/${memberId}/status-activities`);
            return response.data.data || response.data || [];
        } catch (error) {
            console.error(`Error fetching member activities for ${memberId}:`, error);
            return [];
        }
    },

    getActivitiesByTask: async (taskId: string): Promise<any> => {
        try {
            const response = await api.get(`/api/projects/tasks/${taskId}/status-activities`);
            return response.data.data || response.data;
        } catch (error) {
            console.error(`Error fetching task activities for ${taskId}:`, error);
            return null;
        }
    }
};
