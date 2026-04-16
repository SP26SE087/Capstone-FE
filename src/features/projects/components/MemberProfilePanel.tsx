import React, { useState, useEffect } from 'react';
import AppSelect from '@/components/common/AppSelect';
import Modal from '@/components/common/Modal';
import {
    X, Mail, Calendar, ShieldCheck, Settings,
    Loader2, Check, Trash2, User, Crown, Shield, Users, AlertTriangle, ExternalLink, Phone, ClipboardList,
} from 'lucide-react';
import { membershipService, projectService, userService } from '@/services';
import { ProjectRoleEnum, MemberStatus } from '@/types/project';
import ConfirmModal from '@/components/common/ConfirmModal';
import { useToastStore } from '@/store/slices/toastSlice';

interface MemberProfilePanelProps {
    member: any;
    projectId: string;
    currentUser: any;
    currentUserProjectRole?: number;
    currentUserMemberStatus?: number;
    canManage: boolean;
    onSuccess: () => void;
    onClose: () => void;
}

const ProjectRoleMap: Record<number, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    [ProjectRoleEnum.Leader]: {
        label: 'Leader',
        color: '#d97706',
        bg: '#fffbeb',
        icon: <Crown size={13} />,
    },
    [ProjectRoleEnum.LabDirector]: {
        label: 'Lab Director',
        color: '#7c3aed',
        bg: '#f5f3ff',
        icon: <Shield size={13} />,
    },
    [ProjectRoleEnum.SeniorResearcher]: {
        label: 'Senior Researcher',
        color: '#0284c7',
        bg: '#f0f9ff',
        icon: <Users size={13} />,
    },
    [ProjectRoleEnum.Member]: {
        label: 'Member',
        color: '#64748b',
        bg: '#f1f5f9',
        icon: <User size={13} />,
    },
};

const MemberProfilePanel: React.FC<MemberProfilePanelProps> = ({
    member,
    projectId,
    currentUser,
    currentUserProjectRole,
    currentUserMemberStatus,
    canManage,
    onSuccess,
    onClose,
}) => {
    const { addToast } = useToastStore();
    const [roles, setRoles] = useState<any[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [selectedRoleId, setSelectedRoleId] = useState<string>('');

    const [systemDetails, setSystemDetails] = useState<any>(null);
    const [projectDetails, setProjectDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const [updating, setUpdating] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<number | null>(null);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);
    const [removeError, setRemoveError] = useState<string | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<number>(member?.status ?? 1);
    const [avatarError, setAvatarError] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);

    useEffect(() => {
        if (!member) return;
        setShowDeleteConfirm(false);
        setPendingStatus(null);
        setUpdateError(null);
        setStatusError(null);
        setRemoveError(null);
        setSelectedRoleId(member.projectRoleId || member.roleId || '');
        setSelectedStatus(member?.status ?? 1);
        setAvatarError(false);
        setShowProfileModal(false);
        fetchRoles();
        fetchMemberDetails();
    }, [member?.id, member?.memberId]);

    const fetchRoles = async () => {
        setLoadingRoles(true);
        try {
            const fetchedRoles = await projectService.getRoles();
            setRoles(fetchedRoles);
            const currentRole = fetchedRoles.find(
                (r: any) => r.name === member.roleName || r.name === member.projectRoleName
            );
            if (currentRole) setSelectedRoleId(currentRole.id);
        } catch (err) {
            console.error('Failed to fetch roles:', err);
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
            const [userResult, memberResult] = await Promise.allSettled([
                userService.getById(userId),
                membershipService.getMemberById(memberId),
            ]);
            if (userResult.status === 'fulfilled') setSystemDetails(userResult.value);
            if (memberResult.status === 'fulfilled') setProjectDetails(memberResult.value);
        } catch (err) {
            console.error('Failed to fetch member details:', err);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleUpdateRole = async () => {
        if (!member || !selectedRoleId) return;
        setUpdating(true);
        setUpdateError(null);
        try {
            const memberId = member.id || member.memberId;
            await membershipService.updateMemberRole(memberId, selectedRoleId);
            onSuccess();
            onClose();
        } catch (err: any) {
            setUpdateError(err.message || 'Failed to update role.');
        } finally {
            setUpdating(false);
        }
    };

    const mapStatusError = (err: any): string => {
        const msg: string = err?.response?.data?.message || err?.message || '';
        if (msg.includes('Only Admin can unban')) return 'Only an Admin can unban a member.';
        if (msg.includes('inactive in this project')) return 'You are inactive in this project and cannot perform this action.';
        if (msg.includes('banned from the project')) return 'You are banned from this project.';
        if (msg.includes('Invalid status transition')) return 'This status change is not allowed.';
        return msg || 'Failed to update status.';
    };

    const handleUpdateStatus = async (newStatus: number) => {
        if (!member) return;
        setUpdatingStatus(true);
        setStatusError(null);
        try {
            const memberId = member.id || member.memberId;
            await membershipService.updateMemberStatus(memberId, newStatus);
            setSelectedStatus(newStatus);
            setPendingStatus(null);
            onSuccess();
        } catch (err: any) {
            setStatusError(mapStatusError(err));
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleRemoveMember = async () => {
        if (!member || !projectId) return;
        setRemoving(true);
        setRemoveError(null);
        try {
            const memberId = member.id || member.memberId;
            await membershipService.removeMember(projectId, memberId);
            onSuccess();
            onClose();
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to remove member.';
            setRemoveError(msg);
            setShowDeleteConfirm(false);
            addToast(msg, 'error');
        } finally {
            setRemoving(false);
        }
    };

    const isSelf = member.userId === currentUser?.userId;
    const isAdmin = currentUser && (Number(currentUser.role) === 1 || currentUser.role === 'Admin');
    const isCurrentUserLD = Number(currentUserProjectRole) === ProjectRoleEnum.LabDirector;
    const isCurrentUserLeader = Number(currentUserProjectRole) === ProjectRoleEnum.Leader;
    // Current user must be Active in the project to perform any admin action
    const isCurrentUserActiveInProject =
        currentUserMemberStatus === undefined || currentUserMemberStatus === MemberStatus.Active;

    const isTargetLabDirector =
        Number(member.projectRole) === ProjectRoleEnum.LabDirector ||
        member.projectRoleName === 'Lab Director' ||
        Number(projectDetails?.projectRole) === ProjectRoleEnum.LabDirector;

    const isTargetLeader =
        Number(member.projectRole) === ProjectRoleEnum.Leader ||
        member.projectRoleName === 'Leader' ||
        Number(projectDetails?.projectRole) === ProjectRoleEnum.Leader;

    const canEdit =
        canManage &&
        !isSelf &&
        isCurrentUserActiveInProject &&
        (isAdmin ||
            (isCurrentUserLD && !isTargetLabDirector) ||
            (isCurrentUserLeader && !isTargetLabDirector && !isTargetLeader));

    // Status transition matrix:
    // Admin (system):        Active ↔ Inactive only — cannot ban or unban
    // Lab Director (project): Full control — Active↔Inactive, ban, unban
    // Others:                 No status permissions
    const allStatusOptions = [
        { value: MemberStatus.Active, label: 'Active', color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7' },
        { value: MemberStatus.Inactive, label: 'Inactive', color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d' },
        { value: MemberStatus.Banned, label: 'Banned', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' },
    ] as const;

    const canChangeStatus = !isSelf && isCurrentUserActiveInProject && (isAdmin || isCurrentUserLD);

    const visibleStatusOptions = allStatusOptions.filter(opt => {
        if (isCurrentUserLD) {
            // Lab Director: full control
            // Banned target → only Active (unban)
            if (selectedStatus === MemberStatus.Banned) return opt.value === MemberStatus.Active;
            return true;
        }
        if (isAdmin) {
            // Admin: Active ↔ Inactive only, cannot ban or unban
            if (selectedStatus === MemberStatus.Banned) return false;
            return opt.value !== MemberStatus.Banned;
        }
        return false;
    });

    const projectRoleId =
        projectDetails?.projectRole
            ? Number(projectDetails.projectRole)
            : Number(member.projectRole);
    const roleMeta = ProjectRoleMap[projectRoleId];

    const joinDate = member.joinDate || member.joinedDate;

    // Derive the project role that maps to this member's system role (use name to avoid GUID mismatch)
    const targetSystemRole = Number(systemDetails?.role || member.role);
    const mappedProjectRoleName = targetSystemRole === 3 ? 'Senior Researcher' : 'Member';
    const mappedProjectRoleId =
        targetSystemRole === 3 ? ProjectRoleEnum.SeniorResearcher : ProjectRoleEnum.Member;

    const visibleRoles = roles.filter(role => {
        const roleId = Number(role.id);
        const name = role.name;
        // Never allow assigning Lab Director via this UI
        if (name === 'Lab Director' || roleId === ProjectRoleEnum.LabDirector) return false;
        // Always allow promoting to Leader
        if (name === 'Leader' || roleId === ProjectRoleEnum.Leader) return true;
        // Allow their system-role-mapped project role (match by name first, fallback to numeric)
        return name === mappedProjectRoleName || roleId === mappedProjectRoleId;
    });

    const originalRoleId = member.projectRoleId || member.roleId || '';
    const roleChanged = selectedRoleId !== originalRoleId && selectedRoleId !== '';

    return (
        <div
            style={{
                width: '310px',
                flexShrink: 0,
                background: 'white',
                borderRadius: '12px',
                border: '1.5px solid #e2e8f0',
                boxShadow: '0 4px 16px rgba(0,0,0,0.07)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'slideInPanel 0.2s ease-out',
                alignSelf: 'flex-start',
                position: 'sticky',
                top: '1.5rem',
            }}
        >
            {/* Header */}
            <div style={{
                padding: '0.6rem 1rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fafbfc',
            }}>
                <h4 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#1e293b' }}>
                    Member Profile
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#94a3b8', padding: '4px', borderRadius: '6px',
                            display: 'flex', alignItems: 'center',
                            transition: 'all 0.15s',
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }}
                        onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                {/* Avatar + identity */}
                <div style={{
                    padding: '1rem 1rem 0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    background: 'linear-gradient(180deg, #f8fafc 0%, white 100%)',
                    borderBottom: '1px solid #f1f5f9',
                }}>
                    <div style={{
                        width: '52px', height: '52px', borderRadius: '50%',
                        background: 'var(--primary-color)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.25rem', fontWeight: 800,
                        boxShadow: '0 4px 12px rgba(99,102,241,0.2)',
                        border: '2px solid white',
                        marginBottom: '0.5rem',
                        flexShrink: 0,
                        overflow: 'hidden',
                    }}>
                        {!avatarError && (projectDetails?.avatarUrl || member.avatarUrl) ? (
                            <img
                                src={projectDetails?.avatarUrl || member.avatarUrl}
                                alt=""
                                onError={() => setAvatarError(true)}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            (member.fullName || member.userName || 'U')[0].toUpperCase()
                        )}
                    </div>

                    <h3 style={{
                        margin: '0 0 0.25rem', fontSize: '0.78rem', fontWeight: 700, color: '#1e293b',
                        lineHeight: 1.3,
                    }}>
                        {member.fullName || member.userName}
                    </h3>

                    {/* Project role badge */}
                    {roleMeta && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '2px 8px',
                            background: roleMeta.bg, color: roleMeta.color,
                            borderRadius: '20px', fontSize: '0.58rem', fontWeight: 700,
                            marginBottom: '0.35rem',
                        }}>
                            {roleMeta.icon} {roleMeta.label}
                        </div>
                    )}

                    {/* Status badge */}
                    {(() => {
                        const badgeMap: Record<number, { label: string; bg: string; color: string }> = {
                            1: { label: 'Active', bg: '#ecfdf5', color: '#10b981' },
                            2: { label: 'Inactive', bg: '#fffbeb', color: '#f59e0b' },
                            3: { label: 'Banned', bg: '#fef2f2', color: '#ef4444' },
                        };
                        const b = badgeMap[selectedStatus] ?? { label: 'Unknown', bg: '#f1f5f9', color: '#64748b' };
                        return (
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '2px 7px', background: b.bg, color: b.color,
                                borderRadius: '20px', fontSize: '0.6rem', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.04em',
                            }}>
                                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor' }} />
                                {b.label}
                            </div>
                        );
                    })()}

                    {isSelf && (
                        <div style={{
                            marginTop: '0.5rem',
                            padding: '4px 10px',
                            background: '#eff6ff',
                            borderRadius: '8px',
                            border: '1px solid #dbeafe',
                            display: 'flex', alignItems: 'center', gap: '5px',
                            color: '#1e40af', fontSize: '0.68rem', fontWeight: 600,
                        }}>
                            <User size={11} /> Your Profile
                        </div>
                    )}
                </div>

                {/* Info rows */}
                <div style={{ padding: '0.6rem 1rem', display: 'flex', flexDirection: 'column', gap: '0' }}>
                    <InfoRow
                        icon={<Mail size={14} />}
                        label="Email"
                        value={member.email}
                    />
                    <InfoRow
                        icon={<Calendar size={14} />}
                        label="Joined"
                        value={joinDate ? new Date(joinDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                    />
                    <InfoRow
                        icon={<ShieldCheck size={14} />}
                        label="Project Role"
                        value={
                            loadingDetails
                                ? <Loader2 size={13} className="animate-spin" style={{ color: '#94a3b8' }} />
                                : (roleMeta?.label || member.projectRoleName || 'N/A')
                        }
                        valueColor={roleMeta?.color}
                        last
                    />
                </div>

                {/* View Tasks button */}
                <div style={{ padding: '0 1rem 0.75rem' }}>
                    <button
                        onClick={() => setShowProfileModal(true)}
                        style={{
                            width: '100%', padding: '8px',
                            background: '#f0f4ff', color: 'var(--primary-color)',
                            border: '1px solid #c7d7fd',
                            borderRadius: '8px',
                            fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            transition: 'all 0.15s',
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = '#e0eaff'; }}
                        onMouseOut={e => { e.currentTarget.style.background = '#f0f4ff'; }}
                    >
                        <ClipboardList size={14} /> View Task Summary
                    </button>
                </div>
                {canEdit && (
                    <>
                        <div style={{ height: '1px', background: '#f1f5f9', margin: '0 1.25rem' }} />
                        <div style={{ padding: '1rem 1.25rem 0' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '7px',
                                marginBottom: '0.9rem',
                            }}>
                                <Settings size={14} style={{ color: '#64748b' }} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Admin Controls
                                </span>
                            </div>

                            {/* Role change */}
                            <div style={{ marginBottom: '0.75rem' }}>
                                <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                                    Change Project Role
                                </p>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                        <AppSelect
                                            value={selectedRoleId}
                                            onChange={setSelectedRoleId}
                                            isDisabled={loadingRoles || updating}
                                            options={visibleRoles.map(role => ({ value: role.id, label: role.name }))}
                                        />
                                    </div>
                                    <button
                                        onClick={handleUpdateRole}
                                        disabled={updating || !roleChanged}
                                        style={{
                                            padding: '8px 12px',
                                            background: roleChanged ? 'var(--primary-color)' : '#e2e8f0',
                                            color: roleChanged ? 'white' : '#94a3b8',
                                            border: 'none', borderRadius: '8px',
                                            fontWeight: 700, fontSize: '0.78rem',
                                            cursor: roleChanged ? 'pointer' : 'not-allowed',
                                            display: 'flex', alignItems: 'center', gap: '5px',
                                            transition: 'all 0.15s', flexShrink: 0,
                                        }}
                                    >
                                        {updating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                        Save
                                    </button>
                                </div>
                                {updateError && (
                                    <p style={{ margin: '5px 0 0', fontSize: '0.72rem', color: '#ef4444' }}>{updateError}</p>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* Status change — Admin (Active↔Inactive only) hoặc Lab Director (full) */}
                {canChangeStatus && visibleStatusOptions.length > 0 && (
                    <>
                        <div style={{ height: '1px', background: '#f1f5f9', margin: '0 1.25rem' }} />
                        <div style={{ padding: canEdit ? '0.75rem 1.25rem 0' : '1rem 1.25rem 0' }}>
                            <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                                Member Status
                            </p>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                {visibleStatusOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => {
                                            if (selectedStatus === opt.value) return;
                                            setPendingStatus(opt.value);
                                            setStatusError(null);
                                        }}
                                        disabled={updatingStatus}
                                        style={{
                                            flex: 1, padding: '7px 4px',
                                            background: selectedStatus === opt.value ? opt.bg : 'white',
                                            color: selectedStatus === opt.value ? opt.color : '#94a3b8',
                                            border: `1.5px solid ${pendingStatus === opt.value ? opt.border : selectedStatus === opt.value ? opt.border : '#e2e8f0'}`,
                                            borderRadius: '8px',
                                            fontWeight: 700, fontSize: '0.72rem',
                                            cursor: selectedStatus === opt.value ? 'default' : 'pointer',
                                            transition: 'all 0.15s',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                            opacity: pendingStatus !== null && pendingStatus !== opt.value && selectedStatus !== opt.value ? 0.5 : 1,
                                        }}
                                    >
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            {statusError && (
                                <p style={{ margin: '5px 0 0', fontSize: '0.72rem', color: '#ef4444' }}>{statusError}</p>
                            )}
                        </div>
                    </>
                )}

                {/* Remove member */}
                {canEdit && (
                    <>
                        <div style={{ height: '1px', background: '#f1f5f9', margin: '0.75rem 1.25rem 0' }} />
                        <div style={{ padding: '0.75rem 1.25rem 1.25rem' }}>
                            {!showDeleteConfirm ? (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    disabled={removing}
                                    style={{
                                        width: '100%', padding: '9px',
                                        background: 'white', color: '#ef4444',
                                        border: '1.5px solid #fee2e2', borderRadius: '10px',
                                        fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseOver={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fda4af'; }}
                                    onMouseOut={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#fee2e2'; }}
                                >
                                    <Trash2 size={14} /> Remove from Project
                                </button>
                            ) : (
                                <div style={{
                                    padding: '0.9rem', background: '#fff1f2',
                                    borderRadius: '10px', border: '1.5px solid #fda4af',
                                    animation: 'slideInPanel 0.15s ease-out',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '0.6rem' }}>
                                        <AlertTriangle size={14} style={{ color: '#e11d48', marginTop: '2px', flexShrink: 0 }} />
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#9f1239', fontWeight: 700, lineHeight: 1.4 }}>
                                            Remove <strong>{member.fullName || member.userName}</strong> from this project?
                                        </p>
                                    </div>
                                    <div style={{ margin: '0 0 0.75rem', padding: '0.6rem 0.75rem', background: '#ffe4e6', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#9f1239', lineHeight: 1.5 }}>
                                            <strong>⚠ Warning:</strong> All tasks currently assigned to <strong>{member.fullName || member.userName}</strong> will <strong>lose their assignee</strong>. Instead, you can ban this member.
                                        </p>
                                    </div>
                                    {removeError && (
                                        <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: '#ef4444' }}>{removeError}</p>
                                    )}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={handleRemoveMember}
                                            disabled={removing}
                                            style={{
                                                flex: 1, padding: '8px',
                                                background: '#e11d48', color: 'white',
                                                border: 'none', borderRadius: '8px',
                                                fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                            }}
                                        >
                                            {removing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                            Confirm
                                        </button>
                                        <button
                                            onClick={() => { setShowDeleteConfirm(false); setRemoveError(null); }}
                                            disabled={removing}
                                            style={{
                                                flex: 1, padding: '8px',
                                                background: 'white', color: '#475569',
                                                border: '1.5px solid #cbd5e1', borderRadius: '8px',
                                                fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <style>{`
                @keyframes slideInPanel {
                    from { opacity: 0; transform: translateX(14px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

            {/* Full profile modal */}
            <Modal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} title="Task Summary" maxWidth="380px">
                {(() => {
                    const detail = projectDetails;
                    const avatarUrl = !avatarError && (detail?.avatarUrl || member.avatarUrl);
                    const taskColorMap: Record<string, { bg: string; color: string }> = {
                        'Completed':   { bg: '#ecfdf5', color: '#10b981' },
                        'InProgress':  { bg: '#eff6ff', color: '#3b82f6' },
                        'In Progress': { bg: '#eff6ff', color: '#3b82f6' },
                        'ToDo':        { bg: '#f8fafc', color: '#64748b' },
                        'To Do':       { bg: '#f8fafc', color: '#64748b' },
                        'Overdue':     { bg: '#fef2f2', color: '#ef4444' },
                        'Cancelled':   { bg: '#fef2f2', color: '#dc2626' },
                    };
                    const statusBadge: Record<number, { label: string; bg: string; color: string }> = {
                        1: { label: 'Active',   bg: '#ecfdf5', color: '#10b981' },
                        2: { label: 'Inactive', bg: '#fffbeb', color: '#f59e0b' },
                        3: { label: 'Banned',   bg: '#fef2f2', color: '#ef4444' },
                    };
                    const sb = statusBadge[detail?.status ?? member.status] ?? { label: 'Unknown', bg: '#f1f5f9', color: '#64748b' };
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {/* Top: avatar + name */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                <div style={{
                                    width: '52px', height: '52px', borderRadius: '50%',
                                    background: 'var(--primary-color)', color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.25rem', fontWeight: 800,
                                    border: '2px solid #e2e8f0', flexShrink: 0,
                                    overflow: 'hidden',
                                }}>
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt="" onError={() => setAvatarError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        (detail?.fullName || member.fullName || member.userName || 'U')[0].toUpperCase()
                                    )}
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                                        {detail?.fullName || member.fullName || member.userName}
                                    </h3>
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                        {roleMeta && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', background: roleMeta.bg, color: roleMeta.color, borderRadius: '20px', fontSize: '0.65rem', fontWeight: 700 }}>
                                                {roleMeta.icon} {roleMeta.label}
                                            </span>
                                        )}
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', background: sb.bg, color: sb.color, borderRadius: '20px', fontSize: '0.65rem', fontWeight: 700 }}>
                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor' }} />
                                            {sb.label}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Task overview */}
                            {loadingDetails ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem' }}>
                                    <Loader2 size={18} className="animate-spin" style={{ color: '#94a3b8' }} />
                                </div>
                            ) : (
                                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.75rem', border: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: detail?.taskCountsByStatus?.length ? '0.5rem' : 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <ClipboardList size={13} style={{ color: '#64748b' }} />
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tasks</span>
                                        </div>
                                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary-color)', lineHeight: 1 }}>
                                            {detail?.totalAssignedTasks ?? 0}
                                            <span style={{ fontSize: '0.63rem', fontWeight: 600, color: '#94a3b8', marginLeft: '3px' }}>assigned</span>
                                        </span>
                                    </div>
                                    {detail?.taskCountsByStatus?.length > 0 ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                                            {detail.taskCountsByStatus.map((ts: { status: string; count: number }) => {
                                                const s = taskColorMap[ts.status] || { bg: '#f1f5f9', color: '#64748b' };
                                                return (
                                                    <span key={ts.status} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px', background: s.bg, color: s.color, fontSize: '0.67rem', fontWeight: 700 }}>
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                                                        {ts.status}: {ts.count}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>No tasks assigned</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </Modal>

            {/* Status change confirm modal */}
            {pendingStatus !== null && (() => {
                const name = member.fullName || member.userName || 'this member';
                const isBannedTarget = selectedStatus === MemberStatus.Banned;

                type StatusMeta = {
                    title: string;
                    body: React.ReactNode;
                    variant: 'danger' | 'info' | 'success';
                    confirmText: string;
                };

                const meta: Record<number, StatusMeta> = {
                    [MemberStatus.Active]: isBannedTarget
                        ? {
                            title: 'Unban Member',
                            variant: 'success',
                            confirmText: 'Unban',
                            body: <p style={{ margin: 0, color: '#334155' }}>Lift the ban on <strong>{name}</strong>? They'll regain full access to the project.</p>,
                        }
                        : {
                            title: 'Reactivate Member',
                            variant: 'success',
                            confirmText: 'Set Active',
                            body: <p style={{ margin: 0, color: '#334155' }}>Set <strong>{name}</strong> back to Active? They'll be able to receive tasks and participate again.</p>,
                        },

                    [MemberStatus.Inactive]: {
                        title: 'Suspend Member',
                        variant: 'info',
                        confirmText: 'Set Inactive',
                        body: (
                            <>
                                <p style={{ margin: '0 0 8px', color: '#334155' }}>Set <strong>{name}</strong> as Inactive? Use this for temporary absences like leave or a short break.</p>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '0.85em' }}>Their unfinished tasks will be unassigned and reset to <strong>To Do</strong>. You can reactivate them at any time.</p>
                            </>
                        ),
                    },

                    [MemberStatus.Banned]: {
                        title: 'Ban Member',
                        variant: 'danger',
                        confirmText: 'Ban',
                        body: (
                            <>
                                <p style={{ margin: '0 0 8px', color: '#334155' }}>Ban <strong>{name}</strong> from this project? They'll lose all access immediately.</p>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '0.85em' }}>Only Lab Director of project can undo this. Use it for serious issues, not temporary absences.</p>
                            </>
                        ),
                    },
                };

                const m = meta[pendingStatus] ?? meta[MemberStatus.Active];
                return (
                    <ConfirmModal
                        isOpen
                        onClose={() => { setPendingStatus(null); setStatusError(null); }}
                        onConfirm={() => handleUpdateStatus(pendingStatus)}
                        title={m.title}
                        message={m.body}
                        confirmText={m.confirmText}
                        cancelText="Cancel"
                        variant={m.variant}
                    />
                );
            })()}
        </div>
    );
};

interface InfoRowProps {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    valueColor?: string;
    last?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, valueColor, last }) => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 0',
        borderBottom: last ? 'none' : '1px solid #f8fafc',
        gap: '10px',
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', flexShrink: 0 }}>
            {icon}
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94a3b8' }}>{label}</span>
        </div>
        <span style={{
            fontSize: '0.72rem', fontWeight: 600,
            color: valueColor || '#334155',
            textAlign: 'right', wordBreak: 'break-word',
            display: 'flex', alignItems: 'center',
        }}>
            {value}
        </span>
    </div>
);

export default MemberProfilePanel;
