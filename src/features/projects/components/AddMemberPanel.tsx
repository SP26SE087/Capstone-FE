import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, UserPlus, AlertCircle, UserCheck, Crown, Shield, Users, User } from 'lucide-react';
import { userService, membershipService, projectService } from '@/services';
import { useAuth } from '@/hooks/useAuth';
import { ProjectRoleEnum } from '@/types/project';
import { SystemRoleMap } from '@/types/enums';

interface AddMemberPanelProps {
    projectId: string;
    hasLeader: boolean;
    existingMemberIds: string[];
    currentProjectRole?: number;
    onSuccess: () => void;
    onClose: () => void;
}

const ROLE_META: Record<number, { icon: React.ReactNode; color: string; bg: string }> = {
    [ProjectRoleEnum.Leader]: {
        icon: <Crown size={14} />,
        color: '#d97706',
        bg: '#fffbeb',
    },
    [ProjectRoleEnum.LabDirector]: {
        icon: <Shield size={14} />,
        color: '#7c3aed',
        bg: '#f5f3ff',
    },
    [ProjectRoleEnum.SeniorResearcher]: {
        icon: <Users size={14} />,
        color: '#0284c7',
        bg: '#f0f9ff',
    },
    [ProjectRoleEnum.Member]: {
        icon: <User size={14} />,
        color: '#64748b',
        bg: '#f1f5f9',
    },
};

const AddMemberPanel: React.FC<AddMemberPanelProps> = ({
    projectId,
    hasLeader,
    existingMemberIds,
    currentProjectRole,
    onSuccess,
    onClose,
}) => {
    const { user: currentUser } = useAuth();
    const isAdmin = currentUser && (Number(currentUser.role) === 1 || currentUser.role === 'Admin');

    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');

    const [roles, setRoles] = useState<any[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(true);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Fetch roles and users on mount
    useEffect(() => {
        const fetchRoles = async () => {
            setLoadingRoles(true);
            try {
                const fetchedRoles = await projectService.getRoles();
                setRoles(fetchedRoles);
                // Auto-select default role
                const displayRoles = isAdmin
                    ? fetchedRoles
                    : fetchedRoles.filter((r: any) => r.name !== 'Lab Director' && Number(r.id) !== ProjectRoleEnum.LabDirector);
                if (!hasLeader) {
                    const leaderRole = displayRoles.find((r: any) => r.name === 'Leader' || Number(r.id) === ProjectRoleEnum.Leader);
                    if (leaderRole) setSelectedRoleId(leaderRole.id);
                } else {
                    const memberRole = displayRoles.find((r: any) => r.name === 'Member') || displayRoles[0];
                    if (memberRole) setSelectedRoleId(memberRole.id);
                }
            } catch (err) {
                console.error('Failed to fetch roles:', err);
            } finally {
                setLoadingRoles(false);
            }
        };

        const fetchUsers = async () => {
            setLoadingUsers(true);
            try {
                const users = await userService.getAll();
                setAllUsers(users);
            } catch (err) {
                console.error('Failed to fetch users:', err);
            } finally {
                setLoadingUsers(false);
            }
        };

        fetchRoles();
        fetchUsers();
    }, []);

    const filteredUsers = allUsers.filter(u => {
        const role = Number(u.role);
        if (role === 1) return false; // skip Admin system role
        if (u.isActive === false) return false; // skip inactive users
        const q = userSearchQuery.toLowerCase();
        return (
            (u.fullName || u.userName || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        );
    });

    const visibleRoles = roles.filter(role => {
        const roleId = Number(role.id);
        const isLD = role.name === 'Lab Director' || roleId === ProjectRoleEnum.LabDirector;
        const isLeader = role.name === 'Leader' || roleId === ProjectRoleEnum.Leader;
        const isSenior = role.name === 'Senior Researcher' || roleId === ProjectRoleEnum.SeniorResearcher;
        const isMember = role.name === 'Member' || roleId === ProjectRoleEnum.Member;

        if (!hasLeader) return isLeader;
        if (isAdmin) return true;
        if (isLD) return false;
        if (Number(currentProjectRole) === ProjectRoleEnum.Leader) return isSenior || isMember;
        return isLeader || isSenior || isMember;
    });

    // Map system role → project role by name (API IDs may be GUIDs, not numeric enums)
    const resolveProjectRoleForUser = (user: any): string | null => {
        const sysRole = Number(user.role);
        if (sysRole === 2) {
            // Lab Director system role → Lab Director project role
            const matched = roles.find((r: any) =>
                r.name === 'Lab Director' || Number(r.id) === ProjectRoleEnum.LabDirector
            );
            if (matched) return matched.id;
        }
        const targetName = sysRole === 3 ? 'Senior Researcher' : 'Member';
        const matched = roles.find((r: any) =>
            r.name === targetName ||
            Number(r.id) === (sysRole === 3 ? ProjectRoleEnum.SeniorResearcher : ProjectRoleEnum.Member)
        );
        return matched ? matched.id : (roles.find((r: any) => r.name === 'Member')?.id ?? null);
    };

    const handleSelectUser = (user: any) => {
        setSelectedUser(user);
        setError(null);
        if (!hasLeader) {
            const leaderRole = roles.find(r => r.name === 'Leader' || Number(r.id) === ProjectRoleEnum.Leader);
            if (leaderRole) setSelectedRoleId(leaderRole.id);
        } else {
            const autoRoleId = resolveProjectRoleForUser(user);
            if (autoRoleId) setSelectedRoleId(autoRoleId);
        }
    };

    const handleAddMember = async () => {
        if (!selectedUser || !projectId || !selectedRoleId) return;
        setSubmitting(true);
        setError(null);
        try {
            await membershipService.addMember({
                email: selectedUser.email,
                projectId,
                projectRoleId: selectedRoleId,
            });
            const addedName = selectedUser.fullName || selectedUser.userName || 'Member';
            setSuccessMessage(`${addedName} has been added to the project.`);
            setSelectedUser(null);
            setTimeout(() => setSuccessMessage(null), 3000);
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Failed to add member.');
        } finally {
            setSubmitting(false);
        }
    };

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: 'rgba(99,102,241,0.1)', color: 'var(--primary-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <UserPlus size={15} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Add Member</h4>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#94a3b8', padding: '4px', borderRadius: '6px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                    <X size={16} />
                </button>
            </div>

            {/* Leader warning */}
            {!hasLeader && (
                <div style={{
                    margin: '0.75rem 1rem 0',
                    padding: '0.6rem 0.75rem',
                    background: '#fff7ed',
                    border: '1px solid #ffedd5',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    color: '#c2410c',
                    fontSize: '0.78rem',
                }}>
                    <AlertCircle size={14} style={{ marginTop: '1px', flexShrink: 0 }} />
                    <div>
                        <span style={{ fontWeight: 700 }}>Leader required. </span>
                        <span style={{ opacity: 0.85 }}>Assign a Project Leader before adding other roles.</span>
                    </div>
                </div>
            )}

            {/* User search */}
            <div style={{ padding: '0.75rem 1rem 0' }}>
                <div style={{ position: 'relative' }}>
                    <Search size={14} style={{
                        position: 'absolute', left: '10px', top: '50%',
                        transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none',
                    }} />
                    <input
                        type="text"
                        placeholder="Search researchers..."
                        value={userSearchQuery}
                        onChange={e => setUserSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '7px 10px 7px 30px',
                            borderRadius: '8px',
                            border: '1.5px solid #e2e8f0',
                            outline: 'none',
                            fontSize: '0.82rem',
                            background: '#f8fafc',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>
            </div>

            {/* User list */}
            <div style={{
                flex: 1, overflowY: 'auto', padding: '0.5rem 1rem',
                maxHeight: '220px',
            }} className="custom-scrollbar">
                {loadingUsers ? (
                    <div style={{ padding: '2rem 0', textAlign: 'center', color: '#94a3b8' }}>
                        <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 6px', opacity: 0.5 }} />
                        <p style={{ fontSize: '0.75rem', margin: 0 }}>Loading...</p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div style={{ padding: '1.5rem 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
                        No researchers found.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {filteredUsers.map(user => {
                            const uid = user.userId || user.id;
                            const userEmail = user.email || '';

                            // Compare by email to avoid exposing userId
                            const isAlreadyIn = !!userEmail && existingMemberIds.some(
                                e => e && e.toLowerCase() === userEmail.toLowerCase()
                            );
                            const isSelected = !isAlreadyIn && selectedUser &&
                                (selectedUser.userId === uid || selectedUser.id === uid);

                            return (
                                <div
                                    key={uid}
                                    onClick={() => { if (!isAlreadyIn) handleSelectUser(user); }}
                                    style={{
                                        padding: '7px 10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '9px',
                                        cursor: isAlreadyIn ? 'default' : 'pointer',
                                        borderRadius: '8px',
                                        background: isAlreadyIn
                                            ? '#f8fafc'
                                            : isSelected ? 'rgba(99,102,241,0.06)' : 'transparent',
                                        border: `1px solid ${isSelected ? 'var(--primary-color)' : 'transparent'}`,
                                        transition: 'all 0.12s',
                                        pointerEvents: isAlreadyIn ? 'none' : 'auto',
                                    }}
                                    onMouseOver={e => { if (!isAlreadyIn && !isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                                    onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = isAlreadyIn ? '#f8fafc' : 'transparent'; }}
                                >
                                    <div style={{
                                        width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                                        background: isAlreadyIn ? '#e2e8f0' : isSelected ? 'var(--primary-color)' : '#f1f5f9',
                                        color: isAlreadyIn ? '#94a3b8' : isSelected ? 'white' : '#64748b',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.8rem', fontWeight: 700,
                                    }}>
                                        {isAlreadyIn
                                            ? <UserCheck size={14} />
                                            : (user.fullName || user.userName || 'U')[0].toUpperCase()
                                        }
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <p style={{
                                                margin: 0, fontSize: '0.82rem', fontWeight: 600,
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                color: isAlreadyIn ? '#94a3b8' : '#1e293b',
                                            }}>
                                                {user.fullName || user.userName}
                                            </p>
                                            {user.role && (
                                                <span style={{
                                                    fontSize: '0.6rem', fontWeight: 700,
                                                    color: '#7c3aed', background: '#f5f3ff',
                                                    padding: '1px 5px', borderRadius: '4px',
                                                    whiteSpace: 'nowrap', flexShrink: 0,
                                                }}>
                                                    {SystemRoleMap[Number(user.role)] || user.role}
                                                </span>
                                            )}
                                        </div>
                                        <p style={{
                                            margin: 0, fontSize: '0.7rem', color: '#94a3b8',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {user.email}
                                        </p>
                                    </div>
                                    {isAlreadyIn && (
                                        <span style={{
                                            fontSize: '0.65rem', fontWeight: 700,
                                            color: '#94a3b8', background: '#e2e8f0',
                                            padding: '2px 6px', borderRadius: '4px',
                                            whiteSpace: 'nowrap', flexShrink: 0,
                                        }}>
                                            In project
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: '#f1f5f9', margin: '0 1rem' }} />

            {/* Success notification */}
            {successMessage && (
                <div style={{
                    margin: '0 1rem 0',
                    padding: '0.6rem 0.75rem',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: '#15803d',
                    animation: 'slideInPanel 0.15s ease-out',
                }}>
                    <UserCheck size={14} style={{ flexShrink: 0 }} />
                    {successMessage}
                </div>
            )}

            {/* Role selection + confirm */}
            <div style={{ padding: '0.75rem 1rem 1rem' }}>
                {!selectedUser ? (
                    <div style={{
                        padding: '1rem',
                        background: '#f8fafc',
                        borderRadius: '10px',
                        border: '1px dashed #cbd5e1',
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontSize: '0.78rem',
                    }}>
                        <UserPlus size={20} style={{ margin: '0 auto 6px', opacity: 0.35 }} />
                        <p style={{ margin: 0 }}>Select a researcher above</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Selected user card */}
                        <div style={{
                            padding: '8px 10px',
                            background: '#f8fafc',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                        }}>
                            <div style={{
                                width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                                background: 'var(--primary-color)', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.88rem', fontWeight: 700,
                            }}>
                                {(selectedUser.fullName || selectedUser.userName || 'U')[0].toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                    margin: 0, fontSize: '0.85rem', fontWeight: 700,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                    {selectedUser.fullName || selectedUser.userName}
                                </p>
                                <p style={{
                                    margin: 0, fontSize: '0.7rem', color: '#64748b',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                    {selectedUser.email}
                                </p>
                            </div>
                            <button
                                onClick={() => { setSelectedUser(null); setError(null); }}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#94a3b8', padding: '2px', flexShrink: 0,
                                    display: 'flex', alignItems: 'center',
                                }}
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {/* Role selection (Leader-adding flow) or auto-assigned role display */}
                        {!hasLeader ? (
                            <div>
                                <p style={{
                                    margin: '0 0 6px',
                                    fontSize: '0.68rem', fontWeight: 700,
                                    textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em',
                                }}>
                                    Mandatory Role
                                </p>
                                {loadingRoles ? (
                                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Loading roles...</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {visibleRoles.map(role => {
                                            const roleId = Number(role.id);
                                            const meta = ROLE_META[roleId] || { icon: <User size={14} />, color: '#64748b', bg: '#f1f5f9' };
                                            const isChecked = selectedRoleId === role.id;
                                            return (
                                                <div
                                                    key={role.id}
                                                    onClick={() => setSelectedRoleId(role.id)}
                                                    style={{
                                                        padding: '8px 10px',
                                                        borderRadius: '8px',
                                                        border: `1.5px solid ${isChecked ? 'var(--primary-color)' : '#e2e8f0'}`,
                                                        background: isChecked ? 'rgba(99,102,241,0.05)' : 'white',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '9px',
                                                        transition: 'all 0.12s',
                                                    }}
                                                >
                                                    <div style={{
                                                        width: '26px', height: '26px', borderRadius: '7px',
                                                        background: isChecked ? meta.bg : '#f8fafc',
                                                        color: isChecked ? meta.color : '#94a3b8',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        flexShrink: 0, transition: 'all 0.12s',
                                                    }}>
                                                        {meta.icon}
                                                    </div>
                                                    <span style={{
                                                        fontSize: '0.82rem',
                                                        fontWeight: isChecked ? 700 : 500,
                                                        color: isChecked ? '#1e293b' : '#475569',
                                                        flex: 1,
                                                    }}>
                                                        {role.name}
                                                    </span>
                                                    <div style={{
                                                        width: '14px', height: '14px', borderRadius: '50%',
                                                        border: `2px solid ${isChecked ? 'var(--primary-color)' : '#cbd5e1'}`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        flexShrink: 0,
                                                    }}>
                                                        {isChecked && (
                                                            <div style={{
                                                                width: '6px', height: '6px', borderRadius: '50%',
                                                                background: 'var(--primary-color)',
                                                            }} />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                                            * First member must be Project Leader.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (() => {
                            const assignedRole = roles.find((r: any) => r.id === selectedRoleId);
                            const assignedRoleId = assignedRole ? Number(assignedRole.id) : null;
                            const meta = assignedRoleId ? (ROLE_META[assignedRoleId] || { icon: <User size={14} />, color: '#64748b', bg: '#f1f5f9' }) : null;
                            return (
                                <div style={{
                                    padding: '8px 10px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #e2e8f0',
                                    background: '#f8fafc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '9px',
                                }}>
                                    {meta && (
                                        <div style={{
                                            width: '26px', height: '26px', borderRadius: '7px',
                                            background: meta.bg, color: meta.color,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            {meta.icon}
                                        </div>
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                                            Project Role
                                        </p>
                                        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                                            {assignedRole?.name || 'Member'}
                                        </p>
                                    </div>
                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic' }}>auto-assigned</span>
                                </div>
                            );
                        })()}

                        {/* Error */}
                        {error && (
                            <div style={{
                                padding: '0.5rem 0.75rem',
                                background: '#fef2f2', color: '#ef4444',
                                borderRadius: '8px', fontSize: '0.75rem',
                                border: '1px solid #fee2e2',
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}>
                                <AlertCircle size={13} style={{ flexShrink: 0 }} />
                                {error}
                            </div>
                        )}

                        {/* Confirm button */}
                        <button
                            onClick={handleAddMember}
                            disabled={submitting || !selectedRoleId}
                            style={{
                                width: '100%',
                                padding: '9px',
                                background: submitting || !selectedRoleId ? '#e2e8f0' : 'var(--primary-color)',
                                color: submitting || !selectedRoleId ? '#94a3b8' : 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: submitting || !selectedRoleId ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                                transition: 'all 0.15s',
                            }}
                        >
                            {submitting
                                ? <><Loader2 size={15} className="animate-spin" /> Adding...</>
                                : <><UserPlus size={15} /> Confirm & Add</>
                            }
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes slideInPanel {
                    from { opacity: 0; transform: translateX(16px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default AddMemberPanel;
