import React, { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import { userService, membershipService, projectService } from '@/services';
import { Search, Loader2, UserPlus, AlertCircle, UserCheck, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ProjectRoleEnum } from '@/types/project';
import { useToastStore } from '@/store/slices/toastSlice';

interface AddMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    onSuccess: () => void;
    hasLeader: boolean;
    existingMemberIds?: string[];
    currentProjectRole?: number;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({
    isOpen,
    onClose,
    projectId,
    onSuccess,
    hasLeader,
    existingMemberIds = [],
    currentProjectRole
}) => {
    const { user: currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'Admin';
    const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [roles, setRoles] = useState<any[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [loadingRoles, setLoadingRoles] = useState(true);

    // Browse mode for member assignment
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');

    useEffect(() => {
        const fetchRoles = async () => {
            setLoadingRoles(true);
            try {
                const fetchedRoles = await projectService.getRoles();
                setRoles(fetchedRoles);
            } catch (err) {
                console.error("Failed to fetch roles:", err);
            } finally {
                setLoadingRoles(false);
            }
        };

        if (isOpen) {
            setSelectedRoleId(null); // Explicitly reset when opening
            setSelectedUsers([]);
            setError(null);
            setUserSearchQuery('');
            fetchRoles();
            fetchAllUsers();
        }
    }, [isOpen]);

    const fetchAllUsers = async () => {
        setLoadingUsers(true);
        try {
            const users = await userService.getAll();
            setAllUsers(users);
        } catch (err) {
            console.error("Failed to fetch all users:", err);
        } finally {
            setLoadingUsers(false);
        }
    };



    const handleAddBatchMembers = async () => {
        if (selectedUsers.length === 0 || !projectId) {
            setError('Please search and select at least one researcher to add.');
            return;
        }

        if (selectedUsers.length > 10) {
            setError('A single batch invitation is limited to 10 researchers.');
            return;
        }

        if (!selectedRoleId) {
            setError('Please assign a research role before adding the member.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const { addToast } = useToastStore.getState();
            const roleObj = roles.find(r => (r.id || r.projectRoleId || r.ProjectRoleID) === selectedRoleId);

            // Try to find a numeric role value (integer) in common fields
            let roleEnumVal = roleObj?.projectRole || roleObj?.role || roleObj?.enumValue || roleObj?.value;

            // Fallback: Map by name if the numeric ID isn't directly available
            if (roleEnumVal === undefined || roleEnumVal === null) {
                const name = roleObj?.name || '';
                if (name.includes('Director')) roleEnumVal = ProjectRoleEnum.LabDirector;
                else if (name.includes('Leader')) roleEnumVal = ProjectRoleEnum.Leader;
                else if (name.includes('Senior')) roleEnumVal = ProjectRoleEnum.SeniorResearcher;
                else roleEnumVal = ProjectRoleEnum.Member;
            }

            const payload = {
                projectId: projectId,
                userIds: selectedUsers.map(u => u.userId || u.id),
                projectRole: Number(roleEnumVal)
            };

            await membershipService.addMembersBatch(payload);
            
            // Show global success toast
            addToast(`Successfully added ${selectedUsers.length} researcher(s). You can add more or close this window when done.`, 'success');
            
            setSelectedUsers([]);
            setSelectedRoleId(null);
            onSuccess();
        } catch (err: any) {
            console.error(err);
            const msg = err?.response?.data?.message || err?.response?.data || 'Failed to add members to project.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleUserSelection = (user: any) => {
        const userId = user.userId || user.id;
        const exists = selectedUsers.find(u => (u.userId || u.id) === userId);

        if (exists) {
            setSelectedUsers(prev => prev.filter(u => (u.userId || u.id) !== userId));
        } else {
            if (selectedUsers.length >= 10) {
                setError('Limit reached: Maximum 10 people per role invitation.');
                return;
            }
            setSelectedUsers(prev => [...prev, user]);

            // Auto-select Leader role if project has no leader
            if (!hasLeader && !selectedRoleId) {
                const leaderRole = roles.find(r => r.name === 'Leader' || Number(r.id) === ProjectRoleEnum.Leader);
                if (leaderRole) setSelectedRoleId(leaderRole.id);
            }
            setError(null);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Project Member" maxWidth="780px">
            <div style={{ padding: '0 0.5rem' }}>
                {error && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: '#fff7ed',
                        border: '1px solid #ffedd5',
                        borderRadius: '10px',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: '#c2410c',
                        fontSize: '0.85rem'
                    }}>
                        <AlertCircle size={16} />
                        <span style={{ fontWeight: 600 }}>Error:</span>
                        <span style={{ opacity: 0.9 }}>{error}</span>
                    </div>
                )}

                {!hasLeader && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: '#fff7ed',
                        border: '1px solid #ffedd5',
                        borderRadius: '10px',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: '#c2410c',
                        fontSize: '0.85rem'
                    }}>
                        <AlertCircle size={16} />
                        <span style={{ fontWeight: 600 }}>Project Leader Required:</span>
                        <span style={{ opacity: 0.9 }}>Add a leader to manage research activities.</span>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '1.5rem', height: '420px' }}>

                    {/* LEFT COLUMN: Browse & Search */}
                    <div style={{ flex: '1.2', display: 'flex', flexDirection: 'column', borderRight: '1px solid #f1f5f9', paddingRight: '1.25rem' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search researchers..."
                                    value={userSearchQuery}
                                    onChange={(e) => setUserSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px 8px 34px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        outline: 'none',
                                        fontSize: '0.85rem',
                                        background: '#f8fafc'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            paddingRight: '4px'
                        }} className="custom-scrollbar">
                            {loadingUsers ? (
                                <div style={{ padding: '3rem 0', textAlign: 'center', color: '#64748b' }}>
                                    <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                                    <p style={{ fontSize: '0.8rem' }}>Loading...</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {allUsers
                                        .filter(u => {
                                            const role = Number(u.role);
                                            if (role === 1 || role === 2) return false;
                                            const q = userSearchQuery.toLowerCase();
                                            return (u.fullName || u.userName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                                        })
                                        .map(user => {
                                            const userId = user.userId || user.id;
                                            const isAlreadyIn = existingMemberIds.includes(userId);
                                            const isSelected = selectedUsers.some(u => (u.userId || u.id) === userId);

                                            return (
                                                <div
                                                    key={userId}
                                                    onClick={() => {
                                                        if (isAlreadyIn) return;
                                                        toggleUserSelection(user);
                                                    }}
                                                    style={{
                                                        padding: '8px 10px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        cursor: isAlreadyIn ? 'not-allowed' : 'pointer',
                                                        borderRadius: '8px',
                                                        background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                                                        border: `1px solid ${isSelected ? 'var(--primary-color)' : 'transparent'}`,
                                                        opacity: isAlreadyIn ? 0.4 : 1,
                                                        transition: 'all 0.15s',
                                                        position: 'relative'
                                                    }}
                                                    onMouseOver={(e) => { if (!isAlreadyIn && !isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                                                    onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '50%',
                                                        background: isSelected ? 'var(--primary-color)' : '#f1f5f9',
                                                        color: isSelected ? 'white' : 'var(--text-secondary)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.85rem', fontWeight: 600
                                                    }}>
                                                        {(user.fullName || user.userName || 'U')[0]}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.fullName || user.userName}</p>
                                                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
                                                    </div>
                                                    {isAlreadyIn ? (
                                                        <UserCheck size={14} style={{ color: '#94a3b8' }} />
                                                    ) : isSelected ? (
                                                        <div style={{ width: '16px', height: '16px', background: 'var(--primary-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                                            <UserCheck size={10} />
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Selection & Role */}
                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column', paddingLeft: '0.25rem' }}>
                        {/* Selected Batch List Summary */}
                        <div style={{
                            background: '#f8fafc',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '0.85rem',
                            marginBottom: '1rem',
                            maxHeight: '160px',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                                    Current Selected Member ({selectedUsers.length}/10)
                                </span>
                                {selectedUsers.length > 0 && (
                                    <button
                                        onClick={() => setSelectedUsers([])}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Clear Batch
                                    </button>
                                )}
                            </div>

                            <p style={{ margin: '0 0 10px 0', fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic' }}>
                                Limit: 10 members at a time. Invite more later.
                            </p>

                            <div style={{
                                flex: 1,
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                            }} className="custom-scrollbar">
                                {selectedUsers.length === 0 ? (
                                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center', padding: '15px 0', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>
                                        No researchers selected for this batch
                                    </div>
                                ) : (
                                    selectedUsers.map(user => (
                                        <div
                                            key={user.userId || user.id}
                                            style={{
                                                background: 'white',
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                animation: 'slideIn 0.2s ease-out'
                                            }}
                                        >
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                {user.fullName || user.userName}
                                            </span>
                                            <button
                                                onClick={() => toggleUserSelection(user)}
                                                style={{ padding: '4px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', marginLeft: '4px', display: 'flex', alignItems: 'center' }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Role Selection - ALWAYS VISIBLE */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <div style={{ marginBottom: '10px' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: !hasLeader ? 'var(--primary-color)' : '#475569', textTransform: 'uppercase' }}>
                                        Assign ROLE TO ALL selected
                                    </label>
                                    {selectedUsers.length > 1 && (
                                        <p style={{ margin: '4px 0 0', fontSize: '0.65rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                                            ⚠️ All {selectedUsers.length} people will get this role.
                                        </p>
                                    )}
                                </div>
                                {loadingRoles ? (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading roles...</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {roles
                                            .filter(role => {
                                                const roleId = Number(role.id);
                                                const isLD = role.name === 'Lab Director' || roleId === ProjectRoleEnum.LabDirector;
                                                const isLeader = role.name === 'Leader' || roleId === ProjectRoleEnum.Leader;
                                                const isSenior = role.name === 'Senior Researcher' || roleId === ProjectRoleEnum.SeniorResearcher;
                                                const isMember = role.name === 'Member' || roleId === ProjectRoleEnum.Member;

                                                // 1. Mandatory First Member = Leader
                                                if (!hasLeader) return isLeader;

                                                // 2. Admin oversight
                                                if (isAdmin) return true;

                                                // 3. Lab Directors don't invite other Lab Directors to specific projects
                                                if (isLD) return false;

                                                // 4. Permission Ceiling: Leader role can only assign Senior and Member
                                                if (Number(currentProjectRole) === ProjectRoleEnum.Leader) {
                                                    return isSenior || isMember;
                                                }

                                                // 5. Default Authorization (Lab Director/Owner): Can assign Leader, Senior, Member
                                                return true;
                                            })
                                            .map(role => {
                                                const roleId = role.id || role.projectRoleId || role.ProjectRoleID;
                                                return (
                                                    <div
                                                        key={roleId}
                                                        onClick={() => setSelectedRoleId(roleId)}
                                                        style={{
                                                            padding: '10px 12px',
                                                            borderRadius: '10px',
                                                            border: `1px solid ${selectedRoleId === roleId ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                            background: selectedRoleId === roleId ? 'rgba(99, 102, 241, 0.05)' : 'white',
                                                            cursor: 'pointer',
                                                            fontSize: '0.85rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            transition: 'all 0.15s',
                                                            boxShadow: selectedRoleId === roleId ? '0 2px 8px rgba(99, 102, 241, 0.1)' : 'none'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '18px', height: '18px', borderRadius: '50%',
                                                            border: `2px solid ${selectedRoleId === roleId ? 'var(--primary-color)' : '#cbd5e1'}`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            {selectedRoleId === roleId && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary-color)' }} />}
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 700, color: selectedRoleId === roleId ? 'var(--primary-color)' : 'var(--text-primary)' }}>{role.name}</div>
                                                            {!hasLeader && <div style={{ fontSize: '0.65rem', color: 'var(--primary-color)', opacity: 0.8 }}>Required for project activation</div>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        {!hasLeader && (
                                            <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <AlertCircle size={14} /> Critical Role Enforcement
                                                </p>
                                                <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                                    Every research project must have a designated Leader to oversee task management.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {error && (
                                    <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', color: '#ef4444', borderRadius: '8px', fontSize: '0.75rem', border: '1px solid #fee2e2' }}>
                                        {error}
                                    </div>
                                )}
                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}
                                    onClick={handleAddBatchMembers}
                                    disabled={submitting || selectedUsers.length === 0}
                                >
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                                    Send Batch Invitations ({selectedUsers.length})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Assign roles as needed.</p>
                    <button
                        className="btn btn-text"
                        onClick={onClose}
                        disabled={submitting}
                        style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}
                    >
                        Close
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </Modal>
    );
};

export default AddMemberModal;
