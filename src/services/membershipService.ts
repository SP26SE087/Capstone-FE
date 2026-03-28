import api from './api';

export const membershipService = {
    getProjectMembers: async (projectId: string): Promise<any[]> => {
        if (!projectId || projectId === 'undefined') return [];
        try {
            const response = await api.get(`/api/projects/${projectId}/members`);
            const members = response.data.data || response.data || [];
            return members.map((m: any) => {
                if (!m.projectRoleName) {
                    const pr = m.projectRole;
                    m.projectRoleName = m.roleName || 
                        (pr === 1 ? 'Lab Director' : 
                         pr === 2 ? 'Senior Researcher' : 
                         pr === 3 ? 'Researcher' : 
                         pr === 4 ? 'Leader' : 'Researcher');
                }
                return m;
            });
        } catch (error) {
            console.error(`Error fetching members for project ${projectId}:`, error);
            return [];
        }
    },

    addMember: async (membershipData: any): Promise<any> => {
        try {
            const response = await api.post('/api/projects/memberships', membershipData);
            return response.data;
        } catch (error) {
            console.error('Error adding member to project:', error);
            throw error;
        }
    },

    addMembersBatch: async (batchData: any): Promise<any> => {
        try {
            const response = await api.post('/api/projects/memberships/batch', batchData);
            return response.data;
        } catch (error) {
            console.error('Error adding batch members to project:', error);
            throw error;
        }
    },

    removeMember: async (projectId: string, memberId: string): Promise<any> => {
        try {
            const response = await api.delete('/api/projects/memberships', {
                data: { projectId, memberId }
            });
            return response.data;
        } catch (error) {
            console.error(`Error removing member ${memberId} from project ${projectId}:`, error);
            throw error;
        }
    },

    updateMemberRole: async (memberId: string, projectRoleId: string): Promise<any> => {
        try {
            const response = await api.patch('/api/projects/memberships', {
                memberId,
                projectRoleId
            });
            return response.data;
        } catch (error) {
            console.error('Error updating member role:', error);
            throw error;
        }
    },

    getMemberById: async (memberId: string): Promise<any> => {
        try {
            const response = await api.get(`/api/projects/members/${memberId}`);
            const m = response.data.data || response.data;
            if (m && !m.projectRoleName) {
                const pr = m.projectRole;
                m.projectRoleName = m.roleName || 
                    (pr === 1 ? 'Lab Director' : 
                     pr === 2 ? 'Senior Researcher' : 
                     pr === 3 ? 'Researcher' : 
                     pr === 4 ? 'Leader' : 'Researcher');
            }
            return m;
        } catch (error) {
            console.error(`Error fetching member ${memberId}:`, error);
            throw error;
        }
    }
};
