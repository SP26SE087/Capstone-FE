import api from './api';
import { Project } from '@/types';
import { API_BASE_URL } from './api';

// Mock data to return if API fails or for initial development
const mockProjects: Project[] = [];

const mapProjects = (raw: any): Project[] => {
    const payload = raw?.data ?? raw ?? [];
    const list = payload?.items ?? payload?.Items ?? payload?.value ?? payload;
    if (!Array.isArray(list)) return [];
    return list.map((p: any) => ({
        ...p,
        projectId: p.projectId || p.id || p.ProjectID || p.ProjectId,
    }));
};


export const projectService = {
    getAll: async (): Promise<Project[]> => {
        try {
            const response = await api.get('/api/projects');
            const mapped = mapProjects(response.data);
            if (mapped.length === 0) {
                console.warn('Projects response empty or unmapped. Raw:', response.data);
            }
            return mapped;
        } catch (error) {
            console.error('Error fetching projects:', error);
            return mockProjects;
        }
    },

    getById: async (id: string): Promise<Project | null> => {
        if (!id || id === 'undefined') {
            console.warn('getById called with invalid id:', id);
            return null;
        }
        try {
            console.log(`fetching project by id: ${id}`);
            const response = await api.get(`/api/projects/${id}`);
            const rawData = response.data.data || response.data.value || response.data;
            const projectData = Array.isArray(rawData) ? rawData[0] : rawData;
            
            if (projectData && projectData.researchFields) {
                projectData.researchFields = projectData.researchFields.map((rf: any) => ({
                    ...rf,
                    researchFieldId: rf.researchFieldId || rf.id || rf.researchFieldID || rf.ResearchFieldId
                }));
            }
            return projectData;
        } catch (error) {
            console.error(`Error fetching project by id ${id}:`, error);
            // Only fallback to mock if the real ID matches a specific mock pattern if needed, 
            // but for now let's just return null to indicate not found
            return mockProjects.find(p => p.projectId === id) || null;
        }
    },

    create: async (projectData: any): Promise<any> => {
        try {
            const response = await api.post('/api/projects', projectData);
            return response.data;
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    },

    update: async (projectData: any): Promise<any> => {
        try {
            const { projectId, ...body } = projectData;
            const response = await api.patch(`/api/projects/${projectId}`, body);
            return response.data;
        } catch (error) {
            console.error('Error updating project:', error);
            throw error;
        }
    },

    delete: async (projectId: string): Promise<any> => {
        try {
            const response = await api.delete(`/api/projects/${projectId}`, {
                params: { id: projectId }
            });
            return response.data;
        } catch (error) {
            console.error('Error deleting project:', error);
            throw error;
        }
    },

    updateStatus: async (projectId: string, newStatus: number): Promise<any> => {
        try {
            const response = await api.patch(`/api/projects/${projectId}/status`, {
                newStatus
            });
            return response.data;
        } catch (error) {
            console.error('Error updating project status:', error);
            throw error;
        }
    },

    getCurrentMember: async (projectId: string): Promise<any> => {
        if (!projectId || projectId === 'undefined') return null;
        try {
            const response = await api.get(`/api/projects/${projectId}/member`);
            return response.data.data || response.data;
        } catch (error) {
            console.error('Error fetching current member project info:', error);
            return null;
        }
    },

    getRoles: async (): Promise<any[]> => {
        try {
            const response = await api.get('/api/ProjectRole');
            return response.data.data || response.data;
        } catch (error) {
            console.error('Error fetching project roles:', error);
            return [];
        }
    },

    getMilestoneTasks: async (projectId: string): Promise<any> => {
        if (!projectId || projectId === 'undefined') return null;
        try {
            const response = await api.get(`/api/projects/${projectId}/milestones/tasks`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching milestone tasks:', error);
            return null;
        }
    },

    getPublic: async (): Promise<any[]> => {
        try {
            const response = await api.get('/api/projects/public');
            const payload = response.data?.data ?? response.data ?? [];
            const list = payload?.items ?? payload?.Items ?? payload?.value ?? payload;
            return Array.isArray(list) ? list : [];
        } catch (error) {
            console.error('Error fetching public projects:', error);
            return [];
        }
    },

    getByUserEmail: async (email: string): Promise<{
        projects: any[];
        totalProjects: number;
        activeProjects: number;
        inactiveProjects: number;
        archivedProjects: number;
        completedProjects: number;
    }> => {
        try {
            const response = await api.get(`/api/projects/users/${encodeURIComponent(email)}`);
            const data = response.data.data || response.data;
            return {
                projects: data.projects || [],
                totalProjects: data.totalProjects ?? 0,
                activeProjects: data.activeProjects ?? 0,
                inactiveProjects: data.inactiveProjects ?? 0,
                archivedProjects: data.archivedProjects ?? 0,
                completedProjects: data.completedProjects ?? 0,
            };
        } catch (error) {
            console.error(`Error fetching projects for user ${email}:`, error);
            throw error;
        }
    },

    /** Download blank Excel import template (no auth needed) */
    downloadTemplate: () => {
        window.open(`${API_BASE_URL}api/projects/import/template`, '_blank');
    },

    /** Import projects from an Excel file. Returns { projectsCreated, milestonesCreated, tasksCreated, errors[], projects[] } */
    importProjects: async (file: File): Promise<any> => {
        const form = new FormData();
        form.append('file', file);
        const res = await api.post('/api/projects/import', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.data ?? res.data;
    },

    /** Export a project as an Excel file (triggers download) */
    exportProject: async (projectId: string): Promise<void> => {
        const res = await api.get(`/api/projects/${projectId}/export`, {
            responseType: 'blob',
        });
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Project_${projectId}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    },

    /** Clone a project with all milestones and tasks shifted to the new start date */
    cloneProject: async (projectId: string, newName: string, newStartDate: string): Promise<any> => {
        const res = await api.post(`/api/projects/${projectId}/clone`, { newName, newStartDate });
        return res.data.data ?? res.data;
    },
};
