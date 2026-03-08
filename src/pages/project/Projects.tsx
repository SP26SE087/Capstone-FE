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
    MoreVertical,
    Calendar,
    Users,
    X
} from 'lucide-react';

const Projects: React.FC = () => {
    const navigate = useNavigate();
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

    const user = { name: "Current User", role: "Researcher" };

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

    const getStatusStyle = (status: ProjectStatus) => {
        return getProjectStatusStyle(status);
    };

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div style={{ maxWidth: '1240px' }}>
                <header style={{
                    marginBottom: '2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                }}>
                    <div>
                        <h1>My Research Projects</h1>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                            Discover and manage your active research initiatives.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/projects/new')}
                        className="btn btn-primary"
                    >
                        <Plus size={18} /> New Project
                    </button>
                </header>

                <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                placeholder="Search projects by name, code or field..."
                                style={{
                                    width: '100%',
                                    padding: '10px 10px 10px 40px',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    fontSize: '0.9rem'
                                }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setShowFilters(!showFilters)}
                            style={{ gap: '8px' }}
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
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Filter by Status</label>
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
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Filter by Research Field</label>
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
                                    className="btn btn-outline"
                                    style={{ fontSize: '0.8rem', padding: '8px 12px' }}
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

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                        <p>Loading projects...</p>
                    </div>
                ) : filteredProjects.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                        {filteredProjects.map((project) => {
                            const statusStyle = getStatusStyle(project.status);
                            return (
                                <div
                                    key={project.id}
                                    className="card"
                                    onClick={() => navigate(`/projects/${project.id}`)}
                                    style={{
                                        padding: '1.5rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '1.25rem',
                                        border: '1px solid var(--border-color)',
                                        transition: 'transform 0.2s',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{
                                            background: 'var(--bg-secondary)',
                                            padding: '10px',
                                            borderRadius: '10px',
                                            color: 'var(--accent-color)'
                                        }}>
                                            <Briefcase size={22} />
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                background: statusStyle.bg,
                                                color: statusStyle.color,
                                                fontWeight: 600,
                                                textTransform: 'uppercase'
                                            }}>
                                                {statusStyle.label}
                                            </span>
                                            <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                                <MoreVertical size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 8px 0' }}>
                                            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                                                {project.projectName || (project as any).name || 'Untitled Project'}
                                            </h3>
                                            {project.roleName && (
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    padding: '3px 8px',
                                                    background: 'var(--bg-secondary)',
                                                    color: 'var(--accent-color)',
                                                    borderRadius: '4px',
                                                    fontWeight: 600
                                                }}>
                                                    {project.roleName}
                                                </span>
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
                                            {project.projectDescription || (project as any).description || "No description provided for this project."}
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {project.researchFields && project.researchFields.length > 0 ? (
                                            project.researchFields.slice(0, 2).map((rf, idx) => (
                                                <span key={idx} style={{
                                                    fontSize: '0.7rem',
                                                    padding: '4px 10px',
                                                    background: '#f1f5f9',
                                                    borderRadius: '6px',
                                                    color: '#475569',
                                                    fontWeight: 500
                                                }}>
                                                    {rf.name}
                                                </span>
                                            ))
                                        ) : (
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '4px 10px',
                                                background: '#f8fafc',
                                                borderRadius: '6px',
                                                color: 'var(--text-secondary)',
                                                border: '1px dashed var(--border-color)'
                                            }}>
                                                General Research
                                            </span>
                                        )}
                                        {project.researchFields && project.researchFields.length > 2 && (
                                            <span style={{ fontSize: '0.7rem', alignSelf: 'center', color: 'var(--text-secondary)' }}>+{project.researchFields.length - 2} more</span>
                                        )}
                                    </div>

                                    <div>
                                        {(() => {
                                            const progress = project.totalTasks && project.totalTasks > 0
                                                ? Math.round((project.completedTasks || 0) / project.totalTasks * 100)
                                                : 0;
                                            return (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Overall Progress</span>
                                                        <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{progress}%</span>
                                                    </div>
                                                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${progress}%`,
                                                            height: '100%',
                                                            background: 'linear-gradient(90deg, var(--accent-color), var(--primary-color))',
                                                            borderRadius: '3px',
                                                            transition: 'width 0.5s ease-out'
                                                        }} />
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    <div style={{
                                        marginTop: 'auto',
                                        paddingTop: '1.25rem',
                                        borderTop: '1px solid var(--border-color)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                background: 'var(--primary-color)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '0.65rem',
                                                fontWeight: 700
                                            }}>
                                                {(project.nameProjectCreator || project.NameProjectCreator || 'A')[0]}
                                            </div>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                                {project.NameProjectCreator || project.nameProjectCreator || project.createdBy || "Anonymous"}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                <Calendar size={14} />
                                                <span>Starts: {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'TBD'}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                <Users size={14} />
                                                <span>{project.membersCount ?? project.members?.length ?? 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                        <Briefcase size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                        <p>No projects found matching your filters.</p>
                        <button
                            onClick={() => navigate('/projects/new')}
                            className="btn btn-primary"
                            style={{ marginTop: '1rem' }}
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
