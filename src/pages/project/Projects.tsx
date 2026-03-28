import React, { useState, useEffect } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { projectService } from '@/services';
import { Project, ProjectStatus } from '@/types';
import { getProjectStatusStyle } from '@/utils/projectUtils';
import {
    Plus,
    Search,
    Calendar,
    Users,
    ClipboardList,
    TrendingUp
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const Projects: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'All'>('All');

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(true);
            try {
                const data = await projectService.getAll();
                setProjects(data || []);
            } catch (error) {
                console.error('Failed to fetch projects:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, []);

    const filteredProjects = projects.filter(p => {
        const name = (p.projectName || '').toLowerCase();
        const matchesSearch = name.includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">
                {/* Simplified Work Header */}
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>My Projects</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Management hub for your research initiatives and active workflows.</p>
                    </div>
                    <button
                        onClick={() => navigate('/projects/new')}
                        className="btn btn-primary"
                        style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 700 }}
                    >
                        <Plus size={18} /> New Project
                    </button>
                </div>

                {/* Focus Toolbar */}
                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    marginBottom: '2rem',
                    alignItems: 'center',
                    background: 'var(--surface-color)',
                    padding: '1rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Quick find project..."
                            className="form-input"
                            style={{
                                paddingLeft: '44px',
                                height: '44px',
                                border: 'none',
                                background: 'var(--surface-hover)',
                                borderRadius: '10px',
                                fontSize: '0.95rem'
                            }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {['All', ProjectStatus.Active, ProjectStatus.Completed].map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status as any)}
                                className={`filter-chip ${statusFilter === status ? 'active' : ''}`}
                                style={{ height: '44px', padding: '0 1.25rem', borderRadius: '10px' }}
                            >
                                {status === 'All' ? 'All' : status === ProjectStatus.Active ? 'Active' : 'Completed'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Project Focus Grid */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                    </div>
                ) : filteredProjects.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
                        {filteredProjects.map((project) => {
                            const statusStyle = getProjectStatusStyle(project.status);
                            const totalTasks = project.totalTasks || 0;
                            const completedTasks = project.completedTasks || 0;
                            const progress = project.progress !== undefined ? project.progress : (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);

                            // Helper for DD/MM/YYYY date formatting
                            const formatDate = (dateString?: string | null) => {
                                if (!dateString) return 'TBD';
                                const d = new Date(dateString);
                                if (isNaN(d.getTime()) || d.getFullYear() < 1970) return 'TBD';
                                return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                            };

                            // Defensive data access
                            const projectName = project.projectName || (project as any).name || (project as any).ProjectName || 'Untitled Project';
                            const projectDescription = project.projectDescription || (project as any).description || (project as any).ProjectDescription;
                            const creatorName = project.nameProjectCreator || project.NameProjectCreator || (project as any).creatorName || (project as any).CreatorName || "Lab Manager";

                            return (
                                <div
                                    key={project.projectId}
                                    className="card card-interactive"
                                    onClick={() => navigate(`/projects/${project.projectId}`)}
                                    style={{
                                        padding: '1.25rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '1rem',
                                        border: '1px solid var(--border-color)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}
                                >
                                    {/* Header: Project Name & Status */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                        <h3
                                            title={projectName}
                                            style={{
                                                fontSize: '1.25rem',
                                                margin: 0,
                                                fontWeight: 700,
                                                lineHeight: 1.3,
                                                color: 'var(--text-primary)',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                                flex: 1
                                            }}
                                        >
                                            {projectName}
                                        </h3>
                                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                            <span className="badge" style={{ background: statusStyle.bg, color: statusStyle.color, border: 'none', padding: '2px 8px', fontSize: '0.65rem', fontWeight: 600 }}>
                                                {statusStyle.label}
                                            </span>
                                            {project.roleName && (
                                                <span className="badge badge-accent" style={{ background: 'var(--accent-bg)', color: 'var(--accent-color)', padding: '2px 8px', fontSize: '0.65rem', fontWeight: 600 }}>
                                                    {project.roleName}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ownership & Timeline Summary */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background-color)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div className="avatar avatar-sm avatar-accent" style={{ width: '28px', height: '28px', fontSize: '0.7rem' }}>
                                                {creatorName[0]}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Created by</span>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{creatorName}</span>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', fontSize: '0.65rem', color: 'var(--accent-color)', fontWeight: 700, marginBottom: '2px' }}>
                                                <Calendar size={12} />
                                                TIMELINE
                                            </div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {formatDate(project.startDate)} - {formatDate(project.endDate)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <p style={{
                                        margin: '0.25rem 0',
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)',
                                        lineHeight: 1.5,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        height: '3.8rem',
                                        fontWeight: 500
                                    }}>
                                        {projectDescription || "No detailed research protocol or description provided for this work stream."}
                                    </p>

                                    {/* Milestone Progress */}
                                    <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                <ClipboardList size={14} style={{ color: 'var(--primary-color)' }} />
                                                Milestones
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-color)' }}>({progress}%)</span>
                                        </div>
                                        <div className="progress-bar-track" style={{ height: '6px', borderRadius: '3px', background: 'var(--border-light)', overflow: 'hidden' }}>
                                            <div className="progress-bar-fill" style={{ width: `${progress}%`, height: '100%', borderRadius: '3px' }} />
                                        </div>
                                    </div>

                                    {/* Footer: Team & Field Tags */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                            <Users size={14} />
                                            <span style={{ fontWeight: 700 }}>{project.membersCount || 0} Team Members</span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'flex-end', maxWidth: '160px' }}>
                                            {project.researchFields?.slice(0, 2).map(f => (
                                                <span key={f.researchFieldId} className="tag" style={{ margin: 0, fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{f.name}</span>
                                            ))}
                                            {project.researchFields && project.researchFields.length > 2 && (
                                                <span className="tag" style={{ margin: 0, fontSize: '0.65rem', padding: '2px 8px', background: 'var(--surface-hover)', borderRadius: '4px', fontWeight: 600 }}>
                                                    +{project.researchFields.length - 2}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="empty-state card" style={{ padding: '6rem 2rem', borderStyle: 'dashed' }}>
                        <TrendingUp size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                        <h2>Initialize Your Research</h2>
                        <p>No active projects found. Start by creating a workspace for your next breakthrough.</p>
                        <button
                            onClick={() => navigate('/projects/new')}
                            className="btn btn-primary"
                            style={{ marginTop: '1rem' }}
                        >
                            + Create Project
                        </button>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default Projects;
