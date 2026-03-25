import React, { useState, useEffect } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { projectService } from '@/services';
import { Project, ProjectStatus } from '@/types';
import { getProjectStatusStyle } from '@/utils/projectUtils';

import {
    Briefcase,
    Plus,
    Search,
    Filter,
    Calendar,
    Users,
    X
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';

const Projects: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'All'>('All');
    const [fieldFilter, setFieldFilter] = useState<string>('All');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(true);
            try {
                const data = await projectService.getAll();
                console.log('Fetched projects data:', data);
                setProjects(data || []);
            } catch (error) {
                console.error(`Failed to fetch projects:`, error);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, []);

    const filteredProjects = projects.filter(p => {
        const name = (p.projectName || (p as any).name || '').toLowerCase();
        const matchesSearch = name.includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
        const matchesField = fieldFilter === 'All' || p.researchFields?.some(f => f.name === fieldFilter);

        return matchesSearch && matchesStatus && matchesField;
    });

    const uniqueFields = Array.from(new Set(
        projects.flatMap(p => p.researchFields?.map(f => f.name) || [])
    )).filter(Boolean);

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">
                {/* Page Header */}
                <div className="page-header">
                    <div>
                        <h1>My Research Projects</h1>
                        <p>Discover and manage your active research initiatives.</p>
                    </div>
                    <button
                        onClick={() => navigate('/projects/new')}
                        className="btn btn-primary"
                    >
                        <Plus size={18} /> New Project
                    </button>
                </div>

                {/* Search & Filters */}
                <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search projects by name, code or field..."
                                className="form-input"
                                style={{ paddingLeft: '40px' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <Filter size={18} />
                            <span>Filters</span>
                            {(statusFilter !== 'All' || fieldFilter !== 'All') && (
                                <span style={{
                                    background: 'white',
                                    color: 'var(--accent-color)',
                                    borderRadius: '50%',
                                    width: '18px',
                                    height: '18px',
                                    fontSize: '0.7rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700
                                }}>
                                    {(statusFilter !== 'All' ? 1 : 0) + (fieldFilter !== 'All' ? 1 : 0)}
                                </span>
                            )}
                        </button>
                    </div>

                    {showFilters && (
                        <div style={{
                            marginTop: '1.25rem',
                            paddingTop: '1.25rem',
                            borderTop: '1px solid var(--border-color)',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1.5rem'
                        }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Filter by Status</label>
                                <select
                                    className="form-input"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value === 'All' ? 'All' : Number(e.target.value))}
                                >
                                    <option value="All">All Statuses</option>
                                    <option value={ProjectStatus.Active}>Active</option>
                                    <option value={ProjectStatus.Inactive}>Inactive</option>
                                    <option value={ProjectStatus.Archived}>Archived</option>
                                    <option value={ProjectStatus.Completed}>Completed</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Filter by Research Field</label>
                                <select
                                    className="form-input"
                                    value={fieldFilter}
                                    onChange={(e) => setFieldFilter(e.target.value)}
                                >
                                    <option value="All">All Fields</option>
                                    {uniqueFields.map(field => (
                                        <option key={field} value={field}>{field}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => {
                                        setStatusFilter('All');
                                        setFieldFilter('All');
                                        setSearchTerm('');
                                    }}
                                >
                                    <X size={14} /> Reset Filters
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Project Grid */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                        <p style={{ color: 'var(--text-secondary)' }}>Loading projects...</p>
                    </div>
                ) : filteredProjects.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                        {filteredProjects.map((project) => {
                            const statusStyle = getProjectStatusStyle(project.status);
                            const totalTasks = project.totalTasks ?? (project as any).TotalTasks ?? 0;
                            const completedTasks = project.completedTasks ?? (project as any).CompletedTasks ?? 0;
                            const progress = project.progress !== undefined
                                ? project.progress
                                : (totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0);

                            return (
                                <div
                                    key={project.projectId}
                                    className="card card-interactive"
                                    onClick={() => navigate(`/projects/${project.projectId}`)}
                                    style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{
                                            background: 'var(--accent-bg)',
                                            padding: '10px',
                                            borderRadius: 'var(--radius-md)',
                                            color: 'var(--accent-color)'
                                        }}>
                                            <Briefcase size={22} />
                                        </div>
                                        <span className="badge" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                                            {statusStyle.label}
                                        </span>
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 8px 0' }}>
                                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                                                {project.projectName || (project as any).name || 'Untitled Project'}
                                            </h3>
                                            {project.roleName && (
                                                <span className="badge badge-accent">{project.roleName}</span>
                                            )}
                                        </div>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '0.85rem',
                                            color: 'var(--text-secondary)',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            lineHeight: '1.5'
                                        }}>
                                            {project.projectDescription || (project as any).description || "No description provided."}
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {project.researchFields && project.researchFields.length > 0 ? (
                                            project.researchFields.slice(0, 2).map((rf, idx) => (
                                                <span key={idx} className="tag">{rf.name}</span>
                                            ))
                                        ) : (
                                            <span className="tag" style={{ borderStyle: 'dashed' }}>General Research</span>
                                        )}
                                        {project.researchFields && project.researchFields.length > 2 && (
                                            <span style={{ fontSize: '0.7rem', alignSelf: 'center', color: 'var(--text-muted)' }}>+{project.researchFields.length - 2} more</span>
                                        )}
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Overall Progress</span>
                                            <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{progress}%</span>
                                        </div>
                                        <div className="progress-bar-track">
                                            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                                        </div>
                                    </div>

                                    <div style={{
                                        marginTop: 'auto',
                                        paddingTop: '1rem',
                                        borderTop: '1px solid var(--border-color)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div className="avatar avatar-sm avatar-brand">
                                                {(project.nameProjectCreator || project.NameProjectCreator || 'A')[0]}
                                            </div>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                                {project.NameProjectCreator || project.nameProjectCreator || project.createdBy || "Anonymous"}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                <Calendar size={13} />
                                                <span>{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'TBD'}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                <Users size={13} />
                                                <span>{project.membersCount ?? project.members?.length ?? 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <Briefcase size={36} />
                        </div>
                        <h2>No projects found</h2>
                        <p>No projects found matching your filters.</p>
                        <button
                            onClick={() => navigate('/projects/new')}
                            className="btn btn-primary"
                        >
                            Create First Project
                        </button>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default Projects;
