import React, { useState, useEffect } from 'react';
import {
    X, Mail, Calendar, ShieldCheck, UserCheck, Settings,
    Loader2, Check, Trash2, User, Crown, Shield, Users, AlertTriangle,
} from 'lucide-react';
import { membershipService, projectService, userService } from '@/services';
import { ProjectRoleEnum } from '@/types/project';
import ConfirmModal from '@/components/common/ConfirmModal';
import { useToastStore } from '@/store/slices/toastSlice';

interface MemberProfilePanelProps {
    member: any;
    projectId: string;
    currentUser: any;
    currentUserProjectRole?: number;
    canManage: boolean;
    onSuccess: () => void;
    onClose: () => void;
}

const SystemRoleMap: Record<number, string> = {
    1: 'Admin',
    2: 'Lab Director',
    3: 'Senior Researcher',
    4: 'Member',
    5: 'Guest',
};

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

    useEffect(() => {
        if (!member) return;
        setShowDeleteConfirm(false);
        setPendingStatus(null);
        setUpdateError(null);
        setStatusError(null);
        setRemoveError(null);
        setSelectedRoleId(member.projectRoleId || member.roleId || '');
        setSelectedStatus(member?.status ?? 1);
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
            const [userData, memberData] = await Promise.all([
                userService.getById(userId),
                membershipService.getMemberById(memberId),
            ]);
            setSystemDetails(userData);
            setProjectDetails(memberData);
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
            setStatusError(err.message || 'Failed to update status.');
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

    const isTargetLabDirector =
        Number(member.projectRole) === ProjectRoleEnum.LabDirector ||
        member.projectRoleName === 'Lab Director' ||
        member.roleName === 'Lab Director' ||
        Number(projectDetails?.projectRole) === ProjectRoleEnum.LabDirector ||
        systemDetails?.role === 2;

    const isTargetLeader =
        Number(member.projectRole) === ProjectRoleEnum.Leader ||
        member.projectRoleName === 'Leader' ||
        member.roleName === 'Leader' ||
        Number(projectDetails?.projectRole) === ProjectRoleEnum.Leader;

    const canEdit =
        canManage &&
        !isSelf &&
        (isAdmin ||
            (isCurrentUserLD && !isTargetLabDirector) ||
            (isCurrentUserLeader && !isTargetLabDirector && !isTargetLeader));

    const projectRoleId =
        projectDetails?.projectRole
            ? Number(projectDetails.projectRole)
            : Number(member.projectRole);
    const roleMeta = ProjectRoleMap[projectRoleId];

    const joinDate = member.joinDate || member.joinedDate;

    const visibleRoles = roles.filter(role => {
        const roleId = Number(role.id);
        const name = role.name;
        if (isAdmin) return true;
        if (name === 'Lab Director' || roleId === ProjectRoleEnum.LabDirector) return false;
        if (isCurrentUserLeader) {
            return (
                roleId === ProjectRoleEnum.Member ||
                roleId === ProjectRoleEnum.SeniorResearcher ||
                name === 'Member' ||
                name === 'Senior Researcher'
            );
        }
        return true;
    });

    const originalRoleId = member.projectRoleId || member.roleId || '';
    const roleChanged = selectedRoleId !== originalRoleId && selectedRoleId !== '';

    return (
        <div
            style={{
                width: '360px',
                flexShrink: 0,
                background: 'white',
                borderRadius: '16px',
                border: '1.5px solid #e2e8f0',
                boxShadow: '0 8px 24px rgba(0,0,0,0.07)',
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
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fafbfc',
            }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                    Member Profile
                </h4>
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

            <div style={{ overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                {/* Avatar + identity */}
                <div style={{
                    padding: '1.5rem 1.25rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    background: 'linear-gradient(180deg, #f8fafc 0%, white 100%)',
                    borderBottom: '1px solid #f1f5f9',
                }}>
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '50%',
                        background: 'var(--primary-color)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.75rem', fontWeight: 800,
                        boxShadow: '0 6px 18px rgba(99,102,241,0.22)',
                        border: '3px solid white',
                        marginBottom: '0.75rem',
                        flexShrink: 0,
                    }}>
                        {(member.fullName || member.userName || 'U')[0].toUpperCase()}
                    </div>

                    <h3 style={{
                        margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: 700, color: '#1e293b',
                        lineHeight: 1.3,
                    }}>
                        {member.fullName || member.userName}
                    </h3>

                    {/* Project role badge */}
                    {roleMeta && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '3px 10px',
                            background: roleMeta.bg, color: roleMeta.color,
                            borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                            marginBottom: '0.5rem',
                        }}>
                            {roleMeta.icon} {roleMeta.label}
                        </div>
                    )}

                    {/* Status badge */}
                    {(() => {
                        const badgeMap: Record<number, { label: string; bg: string; color: string }> = {
                            1: { label: 'Active',   bg: '#ecfdf5', color: '#10b981' },
                            2: { label: 'Inactive', bg: '#fffbeb', color: '#f59e0b' },
                            3: { label: 'Banned',   bg: '#fef2f2', color: '#ef4444' },
                        };
                        const b = badgeMap[selectedStatus] ?? { label: 'Unknown', bg: '#f1f5f9', color: '#64748b' };
                        return (
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                padding: '2px 8px', background: b.bg, color: b.color,
                                borderRadius: '20px', fontSize: '0.65rem', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.04em',
                            }}>
                                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor' }} />
                                {b.label}
                            </div>
                        );
                    })()}

                    {isSelf && (
                        <div style={{
                            marginTop: '0.75rem',
                            padding: '6px 12px',
                            background: '#eff6ff',
                            borderRadius: '8px',
                            border: '1px solid #dbeafe',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            color: '#1e40af', fontSize: '0.75rem', fontWeight: 600,
                        }}>
                            <User size={13} /> Your Profile
                        </div>
                    )}
                </div>

                {/* Info rows */}
                <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0' }}>
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
                        icon={<UserCheck size={14} />}
                        label="System Role"
                        value={
                            loadingDetails
                                ? <Loader2 size={13} className="animate-spin" style={{ color: '#94a3b8' }} />
                                : (systemDetails?.role ? SystemRoleMap[systemDetails.role] : member.roleName || 'N/A')
                        }
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

                {/* Admin controls */}
                {canEdit && (
                    <>
                        <div style={{ height: '1px', background: '#f1f5f9', margin: '0 1.25rem' }} />
                        <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
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
                                    <select
                                        value={selectedRoleId}
                                        onChange={e => setSelectedRoleId(e.target.value)}
                                        disabled={loadingRoles || updating}
                                        style={{
                                            flex: 1, padding: '8px 10px',
                                            borderRadius: '8px',
                                            border: `1.5px solid ${roleChanged ? 'var(--primary-color)' : '#e2e8f0'}`,
                                            outline: 'none', fontSize: '0.82rem',
                                            background: 'white', cursor: 'pointer',
                                            color: '#1e293b',
                                        }}
                                    >
                                        {visibleRoles.map(role => (
                                            <option key={role.id} value={role.id}>{role.name}</option>
                                        ))}
                                    </select>
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

                            {/* Status change */}
                            <div style={{ marginBottom: '0.75rem' }}>
                                <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                                    Member Status
                                </p>
                                <div style={{ display: 'flex', gap: '6px', marginBottom: pendingStatus !== null ? '0.6rem' : 0 }}>
                                    {([{ value: 1, label: 'Active', color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7' },
                                       { value: 2, label: 'Inactive', color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d' },
                                       { value: 3, label: 'Banned', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' },
                                    ] as const).map(opt => (
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
                            </div>

                            {/* Remove member */}
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

            {/* Status change confirm modal */}
            {pendingStatus !== null && (() => {
                const meta: Record<number, { label: string; variant: 'danger' | 'info' | 'success'; confirmText: string }> = {
                    1: { label: 'Active',   variant: 'success', confirmText: 'Set Active'   },
                    2: { label: 'Inactive', variant: 'info',    confirmText: 'Set Inactive' },
                    3: { label: 'Banned',   variant: 'danger',  confirmText: 'Ban Member'   },
                };
                const m = meta[pendingStatus] ?? meta[1];
                return (
                    <ConfirmModal
                        isOpen
                        onClose={() => { setPendingStatus(null); setStatusError(null); }}
                        onConfirm={() => handleUpdateStatus(pendingStatus)}
                        title={`Change status to ${m.label}`}
                        message={`Are you sure you want to set ${member.fullName || member.userName} as ${m.label}?`}
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
        padding: '9px 0',
        borderBottom: last ? 'none' : '1px solid #f8fafc',
        gap: '12px',
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#94a3b8', flexShrink: 0 }}>
            {icon}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>{label}</span>
        </div>
        <span style={{
            fontSize: '0.82rem', fontWeight: 600,
            color: valueColor || '#334155',
            textAlign: 'right', wordBreak: 'break-word',
            display: 'flex', alignItems: 'center',
        }}>
            {value}
        </span>
    </div>
);

export default MemberProfilePanel;
