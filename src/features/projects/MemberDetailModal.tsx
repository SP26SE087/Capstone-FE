import React, { useState, useEffect } from 'react';
import AppSelect from '@/components/common/AppSelect';
import Modal from '@/components/common/Modal';
import { membershipService, projectService, userService } from '@/services';
import { Mail, Trash2, Loader2, Check, User, Calendar, ShieldCheck, Settings, Info, ClipboardList } from 'lucide-react';
import { ProjectRoleEnum } from '@/types/project';

interface MemberDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: any;
    projectId: string;
    currentUser: any;
    currentUserProjectRole?: number;
    canManage: boolean;
    onSuccess: () => void;
}

const ProjectRoleMap: Record<number, string> = {
    1: 'Lab Director',
    2: 'Senior Researcher',
    3: 'Member',
    4: 'Leader'
};

const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ 
    isOpen, 
    onClose, 
    member, 
    projectId, 
    currentUser,
    currentUserProjectRole,
    canManage,
    onSuccess 
}) => {
    const [roles, setRoles] = useState<any[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [selectedRoleId, setSelectedRoleId] = useState<string>('');
    const [updating, setUpdating] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    const [systemDetails, setSystemDetails] = useState<any>(null);
    const [projectDetails, setProjectDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [avatarError, setAvatarError] = useState(false);

    useEffect(() => {
        if (isOpen && member) {
            fetchRoles();
            fetchMemberDetails();
            setSelectedRoleId(member.projectRoleId || member.roleId || '');
        } else {
            setSystemDetails(null);
            setProjectDetails(null);
        }
    }, [isOpen, member]);

    const fetchRoles = async () => {
        setLoadingRoles(true);
        try {
            const fetchedRoles = await projectService.getRoles();
            setRoles(fetchedRoles);
            if (member && !selectedRoleId) {
                const currentRole = fetchedRoles.find((r: any) => r.name === member.roleName || r.name === member.projectRoleName);
                if (currentRole) setSelectedRoleId(currentRole.id);
            }
        } catch (err) {
            console.error("Failed to fetch roles:", err);
        } finally {
            setLoadingRoles(false);
        }
    };

    const fetchMemberDetails = async () => {
        if (!member) return;
        setLoadingDetails(true);
        try {
            const userId = member.userId;
            const memberId = member.id || member.memberId;

            const [userData, memberData] = await Promise.all([
                userService.getById(userId),
                membershipService.getMemberById(memberId)
            ]);

            setSystemDetails(userData);
            setProjectDetails(memberData);
        } catch (err) {
            console.error("Failed to fetch detailed member info:", err);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleUpdateRole = async () => {
        if (!member || !selectedRoleId) return;
        setUpdating(true);
        try {
            const memberId = member.id || member.memberId;
            await membershipService.updateMemberRole(memberId, selectedRoleId);
            onSuccess();
            onClose();
        } catch (err) {
            console.error("Failed to update role:", err);
        } finally {
            setUpdating(false);
        }
    };

    const handleRemoveMember = async () => {
        if (!member || !projectId) return;
        setRemoving(true);
        try {
            const memberId = member.id || member.memberId;
            await membershipService.removeMember(projectId, memberId);
            onSuccess();
            onClose();
        } catch (err) {
            console.error("Failed to remove member:", err);
        } finally {
            setRemoving(false);
            setShowDeleteConfirm(false);
        }
    };

    if (!member) return null;

    const avatarUrl = !avatarError && (projectDetails?.avatarUrl || member.avatarUrl || systemDetails?.avatarUrl);

    const taskStatusColors: Record<string, { bg: string; color: string }> = {
        'Completed':   { bg: '#ecfdf5', color: '#10b981' },
        'InProgress':  { bg: '#eff6ff', color: '#3b82f6' },
        'In Progress': { bg: '#eff6ff', color: '#3b82f6' },
        'ToDo':        { bg: '#f8fafc', color: '#64748b' },
        'To Do':       { bg: '#f8fafc', color: '#64748b' },
        'Overdue':     { bg: '#fef2f2', color: '#ef4444' },
        'Cancelled':   { bg: '#fef2f2', color: '#dc2626' },
    };

    const isSelf = member.userId === currentUser.userId;
    const isTargetLabDirector = 
        Number(member.projectRole) === ProjectRoleEnum.LabDirector || 
        member.projectRoleName === 'Lab Director' || 
        member.roleName === 'Lab Director' || 
        Number(projectDetails?.projectRole) === ProjectRoleEnum.LabDirector ||
        projectDetails?.projectRoleName === 'Lab Director' ||
        systemDetails?.role === 2;
    
    const isTargetLeader = 
        Number(member.projectRole) === ProjectRoleEnum.Leader || 
        member.projectRoleName === 'Leader' || 
        member.roleName === 'Leader' ||
        Number(projectDetails?.projectRole) === ProjectRoleEnum.Leader ||
        projectDetails?.projectRoleName === 'Leader';

    const isAdmin = currentUser && (Number(currentUser.role) === 1 || currentUser.role === 'Admin');
    const isCurrentUserLD = Number(currentUserProjectRole) === ProjectRoleEnum.LabDirector;
    const isCurrentUserLeader = Number(currentUserProjectRole) === ProjectRoleEnum.Leader;

    const canEdit = canManage && !isSelf && (
        isAdmin || 
        (isCurrentUserLD && !isTargetLabDirector) ||
        (isCurrentUserLeader && !isTargetLabDirector && !isTargetLeader)
    );

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={() => {
                if (!updating && !removing) {
                    onClose();
                    setShowDeleteConfirm(false);
                }
            }} 
            title="Member Profile & Management"
            maxWidth="850px"
        >
            <div style={{ display: 'flex', gap: '30px', padding: '10px' }}>
                {/* Left Side: Profile SideBar */}
                <div style={{ 
                    flex: '0 0 280px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    padding: '2rem 1.5rem',
                    background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    textAlign: 'center'
                }}>
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt={member.fullName || member.userName}
                            onError={() => setAvatarError(true)}
                            style={{
                                width: '120px', height: '120px', borderRadius: '50%',
                                objectFit: 'cover',
                                boxShadow: '0 10px 25px rgba(99, 102, 241, 0.25)',
                                marginBottom: '1.5rem',
                                border: '4px solid white',
                                flexShrink: 0
                            }}
                        />
                    ) : (
                        <div style={{
                            width: '120px', height: '120px', borderRadius: '50%',
                            background: 'var(--primary-color)', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '3rem', fontWeight: 800,
                            boxShadow: '0 10px 25px rgba(99, 102, 241, 0.25)',
                            marginBottom: '1.5rem',
                            border: '4px solid white',
                            flexShrink: 0
                        }}>
                            {(member.fullName || member.userName || 'U')[0]}
                        </div>
                    )}
                    
                    <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>
                        {member.fullName || member.userName}
                    </h2>
                    
                    <div style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '4px 12px',
                        background: member.status === 1 ? '#ecfdf5' : '#fef2f2', 
                        color: member.status === 1 ? '#10b981' : '#ef4444',
                        borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '1.5rem'
                    }}>
                        {member.status === 1 ? 'Active Member' : 'Inactive'}
                    </div>

                    <div style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b' }}>
                            <Mail size={16} />
                            <span style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{member.email}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b' }}>
                            <Calendar size={16} />
                            <span style={{ fontSize: '0.85rem' }}>Joined { (member.joinDate || member.joinedDate) ? new Date(member.joinDate || member.joinedDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>
                    
                    {isSelf && (
                        <div style={{ 
                            marginTop: '2rem',
                            padding: '12px', 
                            background: '#eff6ff', 
                            borderRadius: '12px', 
                            border: '1px solid #dbeafe',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            color: '#1e40af',
                            fontSize: '0.8rem',
                            fontWeight: 500
                        }}>
                            <User size={16} />
                            Your Profile
                        </div>
                    )}
                </div>

                {/* Right Side: Content Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Role Info Section */}
                    <div>
                        <h4 style={{ margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', color: '#1e293b' }}>
                            <Info size={20} style={{ color: 'var(--primary-color)' }} /> 
                            Member Information
                        </h4>
                        
                        <div style={{ padding: '1.25rem', background: 'white', border: '1.5px solid #f1f5f9', borderRadius: '14px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                                <ShieldCheck size={14} /> Project Role
                            </label>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                                {loadingDetails ? <Loader2 size={18} className="animate-spin" /> : (ProjectRoleMap[Number(member.projectRole)] || ProjectRoleMap[Number(projectDetails?.projectRole)] || 'N/A')}
                            </div>
                        </div>
                    </div>

                    {/* Task Overview */}
                    <div>
                        <h4 style={{ margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', color: '#1e293b' }}>
                            <ClipboardList size={20} style={{ color: 'var(--primary-color)' }} />
                            Task Overview
                        </h4>
                        {loadingDetails ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
                                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--primary-color)' }} />
                            </div>
                        ) : (
                            <div style={{ padding: '1.25rem', background: 'white', border: '1.5px solid #f1f5f9', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Total Assigned</span>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                                        {projectDetails?.totalAssignedTasks ?? 0}
                                    </span>
                                </div>
                                {projectDetails?.taskCountsByStatus?.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                                        {projectDetails.taskCountsByStatus.map((ts: { status: string; count: number }) => {
                                            const style = taskStatusColors[ts.status] || { bg: '#f1f5f9', color: '#64748b' };
                                            return (
                                                <span key={ts.status} style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                    padding: '3px 10px', borderRadius: '20px',
                                                    background: style.bg, color: style.color,
                                                    fontSize: '0.75rem', fontWeight: 700
                                                }}>
                                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: style.color, flexShrink: 0 }} />
                                                    {ts.status}: {ts.count}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                                {(!projectDetails?.taskCountsByStatus || projectDetails.taskCountsByStatus.length === 0) && (
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>No tasks assigned</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Management Operations */}
                    {canEdit && (
                        <div style={{ 
                            background: '#f8fafc', 
                            padding: '1.5rem', 
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0'
                        }}>
                            <h4 style={{ margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', color: '#1e293b' }}>
                                <Settings size={20} style={{ color: '#64748b' }} /> 
                                Admin Controls
                            </h4>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '10px', color: '#475569' }}>
                                    Update Member's Project Role
                                </label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <AppSelect
                                        value={selectedRoleId}
                                        onChange={setSelectedRoleId}
                                        isDisabled={loadingRoles || updating}
                                        options={roles
                                            .filter(role => {
                                                const roleId = Number(role.id);
                                                const name = role.name;
                                                if (isAdmin) return true;
                                                if (name === 'Lab Director' || roleId === ProjectRoleEnum.LabDirector) return false;
                                                if (isCurrentUserLeader) {
                                                    return roleId === ProjectRoleEnum.Member || roleId === ProjectRoleEnum.SeniorResearcher ||
                                                           name === 'Member' || name === 'Senior Researcher';
                                                }
                                                return true;
                                            })
                                            .map(role => ({ value: role.id, label: role.name }))
                                        }
                                    />
                                    <button 
                                        className="btn btn-primary"
                                        onClick={handleUpdateRole}
                                        disabled={updating || !selectedRoleId || selectedRoleId === (member.projectRoleId || member.roleId)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 24px', borderRadius: '10px' }}
                                    >
                                        {updating ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                        Save Change
                                    </button>
                                </div>
                            </div>

                            {!showDeleteConfirm ? (
                                <button 
                                    onClick={() => setShowDeleteConfirm(true)}
                                    style={{ 
                                        width: '100%', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        gap: '10px',
                                        padding: '14px',
                                        background: 'white',
                                        color: '#ef4444',
                                        border: '1.5px solid #fee2e2',
                                        borderRadius: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.background = '#fef2f2';
                                        e.currentTarget.style.borderColor = '#fda4af';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.background = 'white';
                                        e.currentTarget.style.borderColor = '#fee2e2';
                                    }}
                                >
                                    <Trash2 size={18} />
                                    Remove Participant from Project
                                </button>
                            ) : (
                                <div style={{ 
                                    padding: '1.5rem', 
                                    background: '#fff1f2', 
                                    borderRadius: '14px', 
                                    border: '1.5px solid #fda4af',
                                    animation: 'slideIn 0.3s ease-out'
                                }}>
                                    <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.95rem', color: '#9f1239', fontWeight: 600 }}>
                                        Are you absolutely sure you want to remove this member?
                                    </p>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button 
                                            onClick={handleRemoveMember}
                                            disabled={removing}
                                            style={{ 
                                                flex: 1, padding: '12px', background: '#e11d48', color: 'white', 
                                                border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
                                                boxShadow: '0 4px 12px rgba(225, 29, 72, 0.2)'
                                            }}
                                        >
                                            {removing ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Removal'}
                                        </button>
                                        <button 
                                            onClick={() => setShowDeleteConfirm(false)}
                                            disabled={removing}
                                            style={{ 
                                                flex: 1, padding: '12px', background: 'white', color: '#475569', 
                                                border: '1.5px solid #cbd5e1', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' 
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </Modal>
    );
};

export default MemberDetailModal;
