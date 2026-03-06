import React, { useState, useEffect } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { projectService } from '@/services';
import { Project, ProjectStatus } from '@/types';
import {
    Briefcase,
    Plus,
    Search,
    Filter,
    MoreVertical,
    Calendar,
    Users,
    Layers
} from 'lucide-react';

const Projects: React.FC = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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

    const user = { name: "Alex Rivera", role: "Lab Director" };

    const filteredProjects = projects.filter(p => {
        const name = p.projectName || (p as any).name || '';
        return name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const getStatusStyle = (status: ProjectStatus) => {
        switch (status) {
            case ProjectStatus.Active: return { color: '#0288d1', bg: '#e1f5fe' };
            case ProjectStatus.Pending: return { color: '#f57c00', bg: '#fff3e0' };
            case ProjectStatus.Completed: return { color: '#10b981', bg: '#ecfdf5' };
            case ProjectStatus.Archived: return { color: '#6b7280', bg: '#f3f4f6' };
            case ProjectStatus.Suspended: return { color: '#e63946', bg: '#fef2f2' };
            default: return { color: '#6b7280', bg: '#f3f4f6' };
        }
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
                        <h1>Projects Catalog</h1>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Discover and manage all research projects in the lab.</p>
                    </div>
                    <button
                        onClick={() => navigate('/projects/new')}
                        className="btn btn-primary"
                    >
                        <Plus size={18} /> New Project
                    </button>
                </header>

                <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
                    <button className="btn btn-secondary">
                        <Filter size={18} /> Filters
                    </button>
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
                                                {ProjectStatus[project.status]}
                                            </span>
                                            <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                                <MoreVertical size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem' }}>
                                            {project.projectName || (project as any).name || 'Untitled Project'}
                                        </h3>
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
                                                    padding: '2px 8px',
                                                    background: '#f1f5f9',
                                                    borderRadius: '4px',
                                                    color: '#475569'
                                                }}>
                                                    {rf.name}
                                                </span>
                                            ))
                                        ) : (
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>General Research</span>
                                        )}
                                        {project.researchFields && project.researchFields.length > 2 && (
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>+{project.researchFields.length - 2} more</span>
                                        )}
                                    </div>

                                    <div style={{
                                        marginTop: 'auto',
                                        paddingTop: '1.25rem',
                                        borderTop: '1px solid var(--border-color)',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '1rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            <Calendar size={14} />
                                            <span>Starts: {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'TBD'}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            <Users size={14} />
                                            <span>Active Team</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                        <Layers size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                        <p>No projects found matching your search.</p>
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
