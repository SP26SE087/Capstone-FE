import React, { useState, useEffect } from 'react';
import { Briefcase, Loader2, X, RefreshCw, Users } from 'lucide-react';
import { projectService } from '@/services/projectService';
import { useToastStore } from '@/store/slices/toastSlice';

interface UserProjectsPanelProps {
    email: string;
    userName: string;
    onClose: () => void;
}

const ROLE_COLOR: Record<number, { color: string; bg: string }> = {
    1: { color: '#6366f1', bg: '#eef2ff' }, // Member
    2: { color: '#0ea5e9', bg: '#f0f9ff' }, // Mentor
    3: { color: '#10b981', bg: '#ecfdf5' }, // Sub-Leader
    4: { color: '#f59e0b', bg: '#fffbeb' }, // Leader
};

const StatBox: React.FC<{ label: string; value: number; color: string; bg: string }> = ({ label, value, color, bg }) => (
    <div style={{
        flex: 1, padding: '8px 10px', borderRadius: '10px',
        background: bg, textAlign: 'center', minWidth: 0
    }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: '0.6rem', fontWeight: 600, color, opacity: 0.8, marginTop: '1px' }}>{label}</div>
    </div>
);

const UserProjectsPanel: React.FC<UserProjectsPanelProps> = ({ email, userName, onClose }) => {
    const [data, setData] = useState<Awaited<ReturnType<typeof projectService.getByUserEmail>> | null>(null);
    const [loading, setLoading] = useState(false);
    const { addToast } = useToastStore();

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const result = await projectService.getByUserEmail(email);
            setData(result);
        } catch {
            addToast('Failed to load projects.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (email) fetchProjects();
    }, [email]);

    return (
        <div className="card" style={{
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--card-bg)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.3s ease-out',
            height: '100%'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.875rem 1rem',
                borderBottom: '1px solid var(--border-light)',
                background: 'rgba(var(--primary-rgb), 0.01)',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Briefcase size={15} style={{ color: 'var(--primary-color)' }} />
                    <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                        Projects
                    </h3>
                    {data && (
                        <span style={{
                            fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px',
                            background: 'var(--primary-color)', color: '#fff', borderRadius: '10px'
                        }}>
                            {data.totalProjects}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={fetchProjects} title="Refresh" style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '4px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <RefreshCw size={14} />
                    </button>
                    <button onClick={onClose} title="Close" style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '4px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* User strip */}
            <div style={{
                padding: '8px 1rem', background: '#f8fafc',
                borderBottom: '1px solid var(--border-light)',
                fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0
            }}>
                <Users size={12} /> {userName}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {email}</span>
            </div>

            {/* Summary stats */}
            {data && (
                <div style={{
                    display: 'flex', gap: '6px', padding: '10px 1rem',
                    borderBottom: '1px solid var(--border-light)', flexShrink: 0
                }}>
                    <StatBox label="Active"    value={data.activeProjects}    color="#10b981" bg="#ecfdf5" />
                    <StatBox label="Inactive"  value={data.inactiveProjects}  color="#f59e0b" bg="#fffbeb" />
                    <StatBox label="Completed" value={data.completedProjects} color="#6366f1" bg="#eef2ff" />
                    <StatBox label="Archived"  value={data.archivedProjects}  color="#64748b" bg="#f1f5f9" />
                </div>
            )}

            {/* Project list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }} className="custom-scrollbar">
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary-color)' }} />
                    </div>
                ) : !data || data.projects.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '3rem 1rem',
                        color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 500
                    }}>
                        <Briefcase size={32} style={{ opacity: 0.3, marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
                        <div>No projects found</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {data.projects.map((project: any, idx: number) => {
                            const roleStyle = ROLE_COLOR[project.userRole] ?? { color: '#64748b', bg: '#f1f5f9' };
                            return (
                                <div key={idx} style={{
                                    padding: '10px 12px', borderRadius: '10px',
                                    border: '1px solid var(--border-light)',
                                    background: '#fff', display: 'flex', flexDirection: 'column', gap: '5px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                        <span style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                            {project.projectName || 'Unnamed'}
                                        </span>
                                        {project.userRoleName && (
                                            <span style={{
                                                fontSize: '0.63rem', fontWeight: 700, flexShrink: 0,
                                                padding: '2px 8px', borderRadius: '10px',
                                                background: roleStyle.bg, color: roleStyle.color
                                            }}>
                                                {project.userRoleName}
                                            </span>
                                        )}
                                    </div>
                                    {project.projectDescription && (
                                        <div style={{
                                            fontSize: '0.72rem', color: 'var(--text-secondary)',
                                            lineHeight: 1.4, fontWeight: 400
                                        }}>
                                            {project.projectDescription}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserProjectsPanel;
