import React, { useState } from 'react';
import MainLayout from '@/layout/MainLayout';
import {
    UserPlus,
    Search,
    Mail,
    Shield,
    Activity,
    Users
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';

const Members: React.FC = () => {
    const { user } = useAuth();
    const [members] = useState([]);

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">
                {/* Page Header */}
                <div className="page-header">
                    <div>
                        <h1>Lab Members</h1>
                        <p>Manage team access, roles and laboratory permissions.</p>
                    </div>
                    <button className="btn btn-primary">
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
                        />
                    </div>
                </div>

                {/* Members Grid */}
                {members.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        {members.map((member: any) => (
                            <div key={member.id} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div className="avatar avatar-lg" style={{
                                        background: 'var(--accent-bg)',
                                        color: 'var(--accent-color)',
                                        borderRadius: 'var(--radius-md)',
                                        fontWeight: 700
                                    }}>
                                        {member.name.split(' ').map((n: string) => n[0]).join('')}
                                    </div>
                                </div>

                                <div>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem' }}>{member.name}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                        <Mail size={14} />
                                        {member.email}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <span className="badge badge-info" style={{ gap: '5px' }}>
                                        <Shield size={11} />
                                        {member.role}
                                    </span>
                                    <span className={`badge ${member.status === 'Active' ? 'badge-success' : 'badge-warning'}`} style={{ gap: '5px' }}>
                                        <Activity size={11} />
                                        {member.status}
                                    </span>
                                </div>

                                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Department: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{member.department}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <Users size={36} />
                        </div>
                        <h2>No members found</h2>
                        <p>Invite researchers to join your laboratory.</p>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default Members;
