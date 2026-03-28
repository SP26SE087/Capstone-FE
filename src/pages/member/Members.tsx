import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/layout/MainLayout';
import {
    UserPlus,
    Search,
    Mail,
    Users,
    Loader2
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/services/userService';
import UserDetailModal from './UserDetailModal';
import { SystemRoleMap } from '@/types/enums';

const Members: React.FC = () => {
    const { user } = useAuth();
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                setLoading(true);
                const data = await userService.getAll();
                setMembers(data);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch members:', err);
                setError('Failed to load lab members. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

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
                <div className="page-header" style={{ marginBottom: '2.5rem' }}>
                    <div>
                        <h1>Lab Members</h1>
                        <p>Manage team access, roles and laboratory permissions.</p>
                    </div>
                    <button className="btn btn-primary" style={{ padding: '0.8rem 1.5rem' }}>
                        <UserPlus size={18} /> Invite Member
                    </button>
                </div>

                {/* Search */}
                <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search members by name, email or role..."
                            className="form-input"
                            style={{ paddingLeft: '40px' }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column', gap: '1rem' }}>
                        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary-color)' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>Loading lab members...</p>
                    </div>
                )}

                {/* Error State */}
                {!loading && error && (
                    <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--error-color)' }}>
                        <p>{error}</p>
                        <button className="btn btn-primary" onClick={() => window.location.reload()} style={{ marginTop: '1rem' }}>
                            Retry
                        </button>
                    </div>
                )}

                {/* Members Grid */}
                {!loading && !error && (
                    filteredMembers.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            {filteredMembers.map((member: any) => {
                                const name = member.fullName || member.userName || member.name || 'Unknown User';
                                return (
                                    <div 
                                        key={member.userId || member.id} 
                                        className="card card-interactive" 
                                        onClick={() => handleMemberClick(member.userId || member.id)}
                                    >
                                        <div className="card-body">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                                                <div className="avatar avatar-lg" style={{
                                                    background: 'var(--accent-bg)',
                                                    color: 'var(--accent-color)',
                                                    borderRadius: 'var(--radius-md)',
                                                    fontWeight: 700
                                                }}>
                                                    {name.split(' ').map((n: string) => n[0]).join('')}
                                                </div>
                                            </div>

                                            <div style={{ marginBottom: '1rem' }}>
                                                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem' }}>{name}</h3>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                    <Mail size={14} />
                                                    {member.email}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                <span className="badge badge-muted">
                                                    {SystemRoleMap[member.role] || member.role || 'Member'}
                                                </span>
                                                {member.status && (
                                                    <span className="badge badge-muted" style={{ opacity: 0.8 }}>
                                                        {member.status}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {member.department && (
                                            <div className="card-footer" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                <div>
                                                    Department: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{member.department}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <Users size={36} />
                            </div>
                            <h2>No members found</h2>
                            <p>{searchQuery ? `No members match "${searchQuery}"` : 'Invite researchers to join your laboratory.'}</p>
                        </div>
                    )
                )}

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
