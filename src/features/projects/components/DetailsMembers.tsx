import React, { useState } from 'react';
import { UserPlus, Search, User, AlertCircle, X, RotateCcw } from 'lucide-react';
import { ProjectMember, ProjectRoleEnum } from '@/types';
import AddMemberPanel from './AddMemberPanel';
import MemberProfilePanel from './MemberProfilePanel';

interface DetailsMembersProps {
    filteredMembers: ProjectMember[];
    memberSearchQuery: string;
    setMemberSearchQuery: (query: string) => void;
    canManageProject: boolean;
    isArchived: boolean;
    projectId: string;
    hasLeader: boolean;
    existingMemberIds: string[];
    currentProjectRole?: number;
    currentUserMemberStatus?: number;
    currentUser: any;
    onMemberAdded: () => void;
    onMemberUpdated: () => void;
    onMembersRefresh?: () => Promise<void>;
}

const statusColors: Record<number, { bg: string; color: string; label: string }> = {
    1: { bg: '#ecfdf5', color: '#10b981', label: 'Active' },
    2: { bg: '#fffbeb', color: '#f59e0b', label: 'Inactive' },
    3: { bg: '#fef2f2', color: '#ef4444', label: 'Banned' },
};

const MemberAvatar: React.FC<{ member: any; size?: number; active?: boolean }> = ({ member, size = 40, active = false }) => {
    const [err, setErr] = React.useState(false);
    const url = !err && member.avatarUrl;
    const initials = (member.fullName || member.userName || 'U')[0].toUpperCase();
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            background: active ? 'var(--primary-color)' : '#e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: active ? 'white' : '#64748b', fontWeight: 700, fontSize: size * 0.4,
            border: active ? '2px solid var(--primary-color)' : '2px solid transparent',
            transition: 'all 0.2s',
        }}>
            {url
                ? <img src={url} alt="" onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
            }
        </div>
    );
};

const DetailsMembers: React.FC<DetailsMembersProps> = ({
    filteredMembers,
    memberSearchQuery,
    setMemberSearchQuery,
    canManageProject,
    isArchived,
    projectId,
    hasLeader,
    existingMemberIds,
    currentProjectRole,
    currentUserMemberStatus,
    currentUser,
    onMemberAdded,
    onMemberUpdated,
    onMembersRefresh,
}) => {
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [selectedMember, setSelectedMember] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);

    const isSoloDirector =
        filteredMembers.length === 1 &&
        (Number(filteredMembers[0].projectRole) === ProjectRoleEnum.LabDirector ||
            filteredMembers[0].projectRoleName === 'Lab Director');

    const openProfile = (member: ProjectMember) => {
        setIsAddingMember(false);
        setSelectedMember(member);
    };

    const openAddPanel = () => {
        setSelectedMember(null);
        setIsAddingMember(true);
    };

    const closePanel = () => {
        setIsAddingMember(false);
        setSelectedMember(null);
    };

    const isPanelOpen = isAddingMember || !!selectedMember;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Project Team</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                    onClick={async () => {
                        if (!onMembersRefresh) return;
                        setRefreshing(true);
                        try { await onMembersRefresh(); } finally { setRefreshing(false); }
                    }}
                    disabled={refreshing || !onMembersRefresh}
                    style={{ padding: '6px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', cursor: refreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', opacity: refreshing ? 0.6 : 1, fontSize: '0.8rem', fontWeight: 600 }}
                >
                    <RotateCcw size={13} className={refreshing ? 'animate-spin' : ''} />
                    Refresh
                </button>
                {canManageProject && !isArchived && (
                    isPanelOpen ? (
                        <button
                            className="btn btn-text"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                color: '#64748b', fontSize: '0.85rem',
                            }}
                            onClick={closePanel}
                        >
                            <X size={16} /> Close Panel
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            onClick={openAddPanel}
                        >
                            <UserPlus size={18} /> Add Member
                        </button>
                    )
                )}
                </div>
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
                    boxShadow: '0 4px 6px -1px rgba(251, 146, 60, 0.05)',
                }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '12px',
                        background: '#ffedd5', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: '#c2410c',
                    }}>
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#9a3412' }}>
                            Solitary Lab Director
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#c2410c', opacity: 0.9 }}>
                            This project is currently managed only by you. Consider adding a Project Leader to coordinate research tasks.
                        </p>
                    </div>
                </div>
            )}

            {/* No Leader Warning — always visible when there's no leader yet */}
            {!hasLeader && !isSoloDirector && (
                <div style={{
                    padding: '1rem 1.25rem',
                    background: '#fff7ed',
                    borderRadius: '12px',
                    border: '1px solid #ffedd5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: '#ffedd5', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: '#c2410c', flexShrink: 0,
                    }}>
                        <AlertCircle size={18} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#9a3412' }}>
                            No Project Leader assigned
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#c2410c', opacity: 0.9 }}>
                            This project does not have a Leader yet. Assign one to coordinate research tasks.
                        </p>
                    </div>
                </div>
            )}

            {/* Search bar */}
            <div style={{
                display: 'flex', gap: '12px',
                background: '#f8fafc', padding: '1rem',
                borderRadius: '12px', border: '1px solid #e2e8f0',
            }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{
                        position: 'absolute', left: '12px', top: '50%',
                        transform: 'translateY(-50%)', color: '#94a3b8',
                    }} />
                    <input
                        type="text"
                        placeholder="Search members by name, email or role..."
                        value={memberSearchQuery}
                        onChange={e => setMemberSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.6rem 1rem 0.6rem 2.5rem',
                            borderRadius: '8px',
                            border: '1.5px solid #e2e8f0',
                            fontSize: '0.9rem',
                            outline: 'none',
                            background: 'white',
                        }}
                    />
                </div>
                {memberSearchQuery && (
                    <button
                        onClick={() => setMemberSearchQuery('')}
                        style={{
                            background: 'none', border: 'none',
                            color: 'var(--primary-color)', fontSize: '0.85rem',
                            fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* Main content: member list + side panel */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                {/* Member list */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '60vh', overflowY: 'auto' }} className="custom-scrollbar">
                    {filteredMembers.length > 0
                        ? filteredMembers.map((member, index) => {
                            const mid = member.id || member.memberId;
                            const isActive = selectedMember && (selectedMember.id === mid || selectedMember.memberId === mid);
                            const st = statusColors[member.status as number] ?? { bg: '#f1f5f9', color: '#64748b', label: 'Unknown' };
                            return (
                                <div
                                    key={mid || index}
                                    onClick={() => openProfile(member)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '0.65rem 1rem',
                                        cursor: 'pointer',
                                        borderRadius: '10px',
                                        border: `1.5px solid ${isActive ? 'var(--primary-color)' : '#e2e8f0'}`,
                                        background: isActive ? 'rgba(99,102,241,0.04)' : 'white',
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseOver={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                                    onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'white'; }}
                                >
                                    <MemberAvatar member={member} size={38} active={!!isActive} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {member.fullName || member.userName || 'Research Member'}
                                        </div>
                                        <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>
                                            {member.projectRoleName || member.roleName || 'Member'}
                                        </div>
                                    </div>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        padding: '2px 8px', borderRadius: '20px',
                                        background: st.bg, color: st.color,
                                        fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                                    }}>
                                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor' }} />
                                        {st.label}
                                    </span>
                                </div>
                            );
                        })
                        : (
                            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                                <p style={{ color: 'var(--text-secondary)' }}>
                                    No research members match your current search.
                                </p>
                            </div>
                        )
                    }
                </div>

                {/* Side panel — Add Member or Member Profile */}
                {isAddingMember && (
                    <AddMemberPanel
                        projectId={projectId}
                        hasLeader={hasLeader}
                        existingMemberIds={existingMemberIds}
                        currentProjectRole={currentProjectRole}
                        onSuccess={() => {
                            onMemberAdded();
                        }}
                        onClose={closePanel}
                    />
                )}

                {selectedMember && !isAddingMember && (
                    <MemberProfilePanel
                        member={selectedMember}
                        projectId={projectId}
                        currentUser={currentUser}
                        currentUserProjectRole={currentProjectRole}
                        currentUserMemberStatus={currentUserMemberStatus}
                        canManage={canManageProject}
                        onSuccess={() => {
                            onMemberUpdated();
                            setSelectedMember(null);
                        }}
                        onClose={closePanel}
                    />
                )}
            </div>
        </div>
    );
};

export default DetailsMembers;
