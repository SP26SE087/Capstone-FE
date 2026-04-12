import React, { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import { userService, membershipService, projectService } from '@/services';
import { Search, Loader2, UserPlus, AlertCircle, UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ProjectRoleEnum } from '@/types/project';

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
    const isAdmin = currentUser && (Number(currentUser.role) === 1 || currentUser.role === 'Admin');
    const [foundUser, setFoundUser] = useState<any>(null);
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
                if (fetchedRoles.length > 0) {
                    // Default to first role - typically 'Member'
                    const displayRoles = isAdmin ? fetchedRoles : fetchedRoles.filter((r: any) => r.name !== 'Lab Director' && Number(r.id) !== ProjectRoleEnum.LabDirector);
                    const memberRole = displayRoles.find((r: any) => r.name === 'Member') || displayRoles[0];
                    if (memberRole) setSelectedRoleId(memberRole.id);
                }
            } catch (err) {
                console.error("Failed to fetch roles:", err);
            } finally {
                setLoadingRoles(false);
            }
        };

        if (isOpen) {
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



    const handleAddMember = async () => {
        if (!foundUser || !projectId || !selectedRoleId) return;

        setSubmitting(true);
        setError(null);

        try {
            const payload = {
                email: foundUser.email,
                projectId: projectId,
                projectRoleId: selectedRoleId
            };
            
            await membershipService.addMember(payload);
            setFoundUser(null);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            const msg = err?.response?.data?.message || err?.response?.data || 'Failed to add member to project.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Project Member" maxWidth="780px">
            <div style={{ padding: '0 0.5rem' }}>
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
                                            const isAlreadyIn = existingMemberIds.includes(user.userId || user.id);
                                            const isSelected = (foundUser?.userId === (user.userId || user.id) || foundUser?.id === (user.userId || user.id));
                                            
                                            return (
                                            <div 
                                                key={user.userId || user.id}
                                                onClick={() => {
                                                    if (isAlreadyIn) return;
                                                    setFoundUser(user);
                                                    if (!hasLeader) {
                                                        const leaderRole = roles.find(r => r.name === 'Leader' || Number(r.id) === ProjectRoleEnum.Leader);
                                                        if (leaderRole) setSelectedRoleId(leaderRole.id);
                                                    }
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
                                                    transition: 'all 0.15s'
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
                                                {isAlreadyIn && <UserCheck size={14} style={{ color: '#94a3b8' }} />}
                                            </div>
                                        );})
                                    }
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Selection & Role */}
                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
                        {!foundUser ? (
                            <div style={{ 
                                flex: 1, 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                background: '#f8fafc',
                                borderRadius: '12px',
                                border: '1px dashed #cbd5e1',
                                color: '#94a3b8',
                                padding: '1.5rem',
                                textAlign: 'center'
                            }}>
                                <UserPlus size={32} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                                <p style={{ fontSize: '0.8rem', fontWeight: 500 }}>Select a researcher</p>
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ 
                                    background: '#f8fafc', 
                                    border: '1px solid var(--border-color)', 
                                    borderRadius: '12px', 
                                    padding: '1rem',
                                    marginBottom: '1rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                        <div style={{ 
                                            width: '40px', height: '40px', borderRadius: '50%', 
                                            background: 'var(--primary-color)', color: 'white',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1rem', fontWeight: 700
                                        }}>
                                            {(foundUser.fullName || foundUser.userName || 'U')[0]}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{foundUser.fullName || foundUser.userName}</h3>
                                            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{foundUser.email}</p>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>
                                            {!hasLeader ? 'Mandatory Role' : 'Role'}
                                        </label>
                                        {loadingRoles ? (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading roles...</div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {roles
                                                    .filter(role => {
                                                        const roleId = Number(role.id);
                                                        const isLD = role.name === 'Lab Director' || roleId === ProjectRoleEnum.LabDirector;
                                                        const isLeader = role.name === 'Leader' || roleId === ProjectRoleEnum.Leader;
                                                        const isSenior = role.name === 'Senior Researcher' || roleId === ProjectRoleEnum.SeniorResearcher;
                                                        const isMember = role.name === 'Member' || roleId === ProjectRoleEnum.Member;
                                                        
                                                        // Rule 1: Special case - If no leader exists, ONLY show Leader role
                                                        // This rule is paramount (usually for Lab Director setting up project)
                                                        if (!hasLeader) return isLeader;

                                                        // Rule 2: Admin can see everything
                                                        if (isAdmin) return true;

                                                        // Rule 3: Non-admins never see/assign Lab Director role in this modal
                                                        if (isLD) return false;

                                                        // Rule 4: "Leader" role (current user) can only assign Senior (2) and Member (3)
                                                        if (Number(currentProjectRole) === ProjectRoleEnum.Leader) {
                                                            return isSenior || isMember;
                                                        }

                                                        // Default: Others (Lab Director) can see Leader, Senior, Member
                                                        return true;
                                                    })
                                                    .map(role => (
                                                    <div 
                                                        key={role.id}
                                                        onClick={() => setSelectedRoleId(role.id)}
                                                        style={{
                                                            padding: '8px 10px',
                                                            borderRadius: '8px',
                                                            border: `1px solid ${selectedRoleId === role.id ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                            background: selectedRoleId === role.id ? 'rgba(99, 102, 241, 0.05)' : 'white',
                                                            cursor: 'pointer',
                                                            fontSize: '0.85rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        <div style={{ 
                                                            width: '14px', height: '14px', borderRadius: '50%', 
                                                            border: `1.5px solid ${selectedRoleId === role.id ? 'var(--primary-color)' : '#cbd5e1'}`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}>
                                                            {selectedRoleId === role.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-color)' }} />}
                                                        </div>
                                                        <span style={{ fontWeight: 600 }}>{role.name}</span>
                                                    </div>
                                                ))}
                                                {!hasLeader && (
                                                    <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                                                        * First member must be designated as Project Leader.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
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
                                        onClick={handleAddMember}
                                        disabled={submitting || !selectedRoleId}
                                    >
                                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                                        Add Member
                                    </button>
                                    <button 
                                        className="btn btn-text" 
                                        style={{ width: '100%', padding: '6px', color: '#64748b', fontSize: '0.8rem' }}
                                        onClick={() => { setFoundUser(null); setError(null); }}
                                        disabled={submitting}
                                    >
                                        Deselect
                                    </button>
                                </div>
                            </div>
                        )}
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
