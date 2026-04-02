import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/layout/MainLayout';
import {
    UserPlus,
    Search,
    Mail,
    Users,
    Loader2,
    X
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/services/userService';
import UserDetailModal from './UserDetailModal';
import InviteMemberForm from './components/InviteMemberForm';
import { SystemRoleEnum, SystemRoleMap } from '@/types/enums';
import { useToastStore } from '@/store/slices/toastSlice';

const Members: React.FC = () => {
    const { user } = useAuth();
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isInviteFormOpen, setIsInviteFormOpen] = useState(false);

    const isLabDirector = user.role === 'Lab Director' || 
                         user.role === 'LabDirector' || 
                         Number(user.role) === SystemRoleEnum.LabDirector;
    
    const { addToast } = useToastStore();

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const data = await userService.getAll();
            setMembers(data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch members:', err);
            setError((err as any).message || 'Failed to load lab members.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, []);

    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return members;
        
        const query = searchQuery.toLowerCase();
        return members.filter(member => 
            (member.fullName || member.userName || '').toLowerCase().includes(query) ||
            (member.email || '').toLowerCase().includes(query) ||
            (member.role || '').toLowerCase().includes(query)
        );
    }, [members, searchQuery]);

    const handleMemberClick = (userId: string) => {
        setSelectedUserId(userId);
        setIsModalOpen(true);
    };

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">
                {/* Page Header */}
                <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                        <h1>Lab Members</h1>
                        <p>Manage team access, roles and laboratory permissions.</p>
                    </div>
                </div>

                {/* Search and Action — Horizontal Right/Left Alignment */}
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: '1.5rem', 
                    marginBottom: '2rem' 
                }}>
                    <div className="card" style={{ flex: 1, margin: 0, display: 'flex', alignItems: 'center', padding: '0.75rem 1.25rem' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search members by name, email or role..."
                                className="form-input"
                                style={{ 
                                    paddingLeft: '40px', 
                                    width: '100%',
                                    border: 'none', 
                                    background: 'transparent', 
                                    boxShadow: 'none',
                                    outline: 'none'
                                }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {isLabDirector && (
                        <div style={{ flexShrink: 0 }}>
                            <button 
                                className="btn btn-primary" 
                                style={{ 
                                    height: '52px',
                                    minWidth: '160px',
                                    padding: '0 1.5rem', 
                                    boxShadow: 'var(--shadow-sm)',
                                    backgroundColor: isInviteFormOpen ? 'var(--secondary-color)' : 'var(--accent-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px'
                                }}
                                onClick={() => setIsInviteFormOpen(!isInviteFormOpen)}
                            >
                                {isInviteFormOpen ? <X size={20} /> : <UserPlus size={20} />} 
                                {isInviteFormOpen ? 'Close' : 'Invite Member'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Main Content Area: List + Form */}
                <div style={{ 
                    display: 'flex', 
                    gap: isInviteFormOpen ? '2.5rem' : '0', 
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    {/* Left Column: Members List (70% when open) */}
                    <div style={{ 
                        flex: isInviteFormOpen ? '0 0 70%' : '0 100%', 
                        maxWidth: isInviteFormOpen ? '70%' : '100%',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                        {/* Status indicators (loading/error) */}
                        {loading && (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
                                <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-color)' }} />
                            </div>
                        )}

                        {/* Members List with Scroll Container */}
                        {!loading && !error && (
                            <div 
                                className="custom-scrollbar"
                                style={{ 
                                    display: 'grid',
                                    gridTemplateColumns: '1fr',
                                    gap: '0.75rem',
                                    maxHeight: 'calc(100vh - 350px)',
                                    overflowY: 'auto',
                                    paddingRight: '6px'
                                }}
                            >
                                {filteredMembers.length > 0 ? (
                                    filteredMembers.map((member: any) => {
                                        const name = member.fullName || member.userName || member.name || 'Unknown User';
                                        const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
                                        
                                        return (
                                            <div 
                                                key={member.userId || member.id} 
                                                className="card card-interactive" 
                                                onClick={() => handleMemberClick(member.userId || member.id)}
                                                style={{ 
                                                    padding: '0.75rem 1.5rem', 
                                                    margin: 0,
                                                    display: 'grid',
                                                    gridTemplateColumns: '48px 1fr auto',
                                                    alignItems: 'center',
                                                    gap: '1.5rem',
                                                    borderRadius: 'var(--radius-md)'
                                                }}
                                            >
                                                {/* Column 1: Avatar (Left Aligned) */}
                                                <div className="avatar" style={{
                                                    background: 'var(--accent-bg)',
                                                    color: 'var(--accent-color)',
                                                    borderRadius: 'var(--radius-md)',
                                                    fontWeight: 700,
                                                    width: '48px',
                                                    height: '48px',
                                                    fontSize: '1rem'
                                                }}>
                                                    {initials}
                                                </div>

                                                {/* Column 2: Identity Info (Left Aligned) */}
                                                <div style={{ minWidth: 0, textAlign: 'left' }}>
                                                    <h3 style={{ margin: '0 0 2px 0', fontSize: '0.95rem', fontWeight: 600 }}>{name}</h3>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                                        <Mail size={12} />
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {member.email}
                                                        </span>
                                                        {member.department && <span style={{ color: 'var(--text-muted)' }}>• {member.department}</span>}
                                                    </div>
                                                </div>

                                                {/* Column 3: Role & Status (Right Aligned) */}
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
                                                    <span className="badge badge-muted" style={{ fontWeight: 600, fontSize: '0.7rem' }}>
                                                        {SystemRoleMap[member.role] || member.role || 'Member'}
                                                    </span>
                                                    {member.status && (
                                                        <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>
                                                            {member.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="empty-state">
                                        <Users size={36} />
                                        <h2>No members found</h2>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Invite Form (30%) */}
                    <div style={{ 
                        flex: isInviteFormOpen ? '0 0 30%' : '0 0 0',
                        maxWidth: isInviteFormOpen ? '30%' : '0',
                        transform: isInviteFormOpen ? 'translateX(0)' : 'translateX(50px)',
                        opacity: isInviteFormOpen ? 1 : 0,
                        visibility: isInviteFormOpen ? 'visible' : 'hidden',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        zIndex: 10
                    }}>
                        <InviteMemberForm 
                            onSuccess={() => {
                                fetchMembers();
                                addToast('Member invited successfully!', 'success');
                            }}
                            onCancel={() => setIsInviteFormOpen(false)}
                        />
                    </div>
                </div>

                <UserDetailModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    userId={selectedUserId}
                    systemRoleMap={SystemRoleMap}
                />
            </div>
        </MainLayout>
    );
};

export default Members;
