import React from 'react';
import { UserPlus, Search, User, AlertCircle } from 'lucide-react';
import { ProjectMember, ProjectRoleEnum } from '@/types';

interface DetailsMembersProps {
    filteredMembers: ProjectMember[];
    memberSearchQuery: string;
    setMemberSearchQuery: (query: string) => void;
    canManageProject: boolean;
    setIsAddMemberModalOpen: (open: boolean) => void;
    setSelectedMember: (member: ProjectMember) => void;
    setIsMemberDetailModalOpen: (open: boolean) => void;
}

const DetailsMembers: React.FC<DetailsMembersProps> = ({
    filteredMembers,
    memberSearchQuery,
    setMemberSearchQuery,
    canManageProject,
    setIsAddMemberModalOpen,
    setSelectedMember,
    setIsMemberDetailModalOpen
}) => {
    // Check if only the Lab Director is present
    const isSoloDirector = filteredMembers.length === 1 && 
        (Number(filteredMembers[0].projectRole) === ProjectRoleEnum.LabDirector || 
         filteredMembers[0].projectRoleName === 'Lab Director');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Research Team</h3>
                {canManageProject && (
                    <button
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => setIsAddMemberModalOpen(true)}
                    >
                        <UserPlus size={18} /> Add Member
                    </button>
                )}
            </div>

            {/* Solo Director Warning */}
            {isSoloDirector && (
                <div style={{
                    padding: '1.25rem',
                    background: '#fff7ed',
                    borderRadius: '16px',
                    border: '1px solid #ffedd5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '1rem',
                    boxShadow: '0 4px 6px -1px rgba(251, 146, 60, 0.05)'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: '#ffedd5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#c2410c'
                    }}>
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#9a3412' }}>Solitary Lab Director</h4>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#c2410c', opacity: 0.9 }}>This project is currently managed only by you. Consider adding a Project Leader to coordinate research tasks.</p>
                    </div>
                </div>
            )}

            <div style={{
                display: 'flex',
                gap: '12px',
                background: '#f8fafc',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '0.5rem'
            }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Search members by name, email or role..."
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.6rem 1rem 0.6rem 2.5rem',
                            borderRadius: '8px',
                            border: '1.5px solid #e2e8f0',
                            fontSize: '0.9rem',
                            outline: 'none',
                            background: 'white'
                        }}
                    />
                </div>
                {memberSearchQuery && (
                    <button
                        onClick={() => setMemberSearchQuery('')}
                        style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Clear
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {filteredMembers.length > 0 ? filteredMembers.map((member, index) => (
                    <div
                        key={member.id || member.memberId || index}
                        className="card member-card"
                        onClick={() => {
                            setSelectedMember(member);
                            setIsMemberDetailModalOpen(true);
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px',
                            padding: '1.25rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            border: '1.5px solid transparent'
                        }}
                    >
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '50%',
                            background: '#f1f5f9', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: '#64748b'
                        }}>
                            <User size={24} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {member.fullName || member.userName || 'Research Member'}
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                                {member.projectRoleName || member.roleName || 'Member'}
                            </p>
                        </div>
                    </div>
                )) : (
                    <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem' }}>
                        <p style={{ color: 'var(--text-secondary)' }}>No research members match your current search.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DetailsMembers;
