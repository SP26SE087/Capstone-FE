import React, { useState } from 'react';
import MainLayout from '@/layout/MainLayout';
import {
    UserPlus,
    Search,
    Mail,
    Shield,
    MoreVertical,
    Activity
} from 'lucide-react';

const Members: React.FC = () => {
    // Mock data for initial view
    const [members] = useState([
        { id: 1, name: 'Alex Rivera', email: 'alex.r@lab.edu', role: 'Lab Director', status: 'Active', department: 'AI & Robotics' },
        { id: 2, name: 'Sarah Chen', email: 's.chen@lab.edu', role: 'Senior Researcher', status: 'Active', department: 'Data Science' },
        { id: 3, name: 'Michael Brown', email: 'm.brown@lab.edu', role: 'PhD Student', status: 'Away', department: 'Machine Learning' },
        { id: 4, name: 'Elena Gilbert', email: 'e.gilbert@lab.edu', role: 'Research Assistant', status: 'Active', department: 'Computer Vision' },
    ]);

    const user = { name: "Alex Rivera", role: "Lab Director" };

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div style={{ maxWidth: '1240px' }}>
                <header style={{
                    marginBottom: '2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h1>Lab Members</h1>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Manage team access, roles and laboratory permissions.</p>
                    </div>
                    <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserPlus size={18} /> Invite Member
                    </button>
                </header>

                <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Search members by name, email or role..."
                            style={{
                                width: '100%',
                                padding: '10px 10px 10px 40px',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {members.map((member) => (
                        <div key={member.id} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{
                                    width: '50px',
                                    height: '50px',
                                    borderRadius: '12px',
                                    background: 'var(--bg-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--accent-color)',
                                    fontWeight: 600,
                                    fontSize: '1.2rem'
                                }}>
                                    {member.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                    <MoreVertical size={18} />
                                </button>
                            </div>

                            <div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>{member.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    <Mail size={14} />
                                    {member.email}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{
                                    fontSize: '0.75rem',
                                    padding: '4px 10px',
                                    background: '#eff6ff',
                                    color: '#2563eb',
                                    borderRadius: '20px',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <Shield size={12} />
                                    {member.role}
                                </span>
                                <span style={{
                                    fontSize: '0.75rem',
                                    padding: '4px 10px',
                                    background: member.status === 'Active' ? '#ecfdf5' : '#fff7ed',
                                    color: member.status === 'Active' ? '#10b981' : '#f59e0b',
                                    borderRadius: '20px',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <Activity size={12} />
                                    {member.status}
                                </span>
                            </div>

                            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Department: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{member.department}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </MainLayout>
    );
};

export default Members;
