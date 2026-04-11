import React, { useState, useEffect } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { projectService } from '@/services';
import { Project } from '@/types';
import { getProjectStatusStyle } from '@/utils/projectUtils';
import {
    Search,
    BookOpen,
    Calendar,
    ArrowRight,
    SearchX,
    TrendingUp
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';

const Home: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [publicProjects, setPublicProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeField, setActiveField] = useState<string>('All');

    useEffect(() => {
        const fetchPublicProjects = async () => {
            setLoading(true);
            try {
                const data = await projectService.getAll();
                setPublicProjects(data || []);
            } catch (error) {
                console.error('Failed to fetch projects:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchPublicProjects();
    }, []);

    const fields = ['All', 'Machine Learning', 'Data Science', 'Computer Vision', 'Robotics', 'IoT'];

    const filteredProjects = publicProjects.filter(p => {
        const name = (p.projectName || (p as any).name || '').toLowerCase();
        const description = (p.projectDescription || (p as any).description || '').toLowerCase();
        const creator = (p.NameProjectCreator || '').toLowerCase();
        const matchesSearch = name.includes(searchTerm.toLowerCase()) ||
            description.includes(searchTerm.toLowerCase()) ||
            creator.includes(searchTerm.toLowerCase());

        const matchesField = activeField === 'All' ||
            p.researchFields?.some(rf => rf.name === activeField);

        return matchesSearch && matchesField;
    });

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container" style={{ margin: '0 auto' }}>
                {/* Page Header */}
                <div className="page-header" style={{ marginBottom: '2.5rem' }}>
                    <div>
                        <h1>Project in Lab</h1>
                        <p>Explore the collective research repository and innovative breakthroughs.</p>
                    </div>
                </div>

                {/* Search Bar - Integrated style */}
                <div style={{
                    background: 'white',
                    padding: '6px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    maxWidth: '100%',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '2rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, padding: '0 15px' }}>
                        <Search color="var(--text-muted)" size={20} />
                        <input
                            type="text"
                            placeholder="Search by project name, creator, or topic..."
                            style={{
                                border: 'none',
                                padding: '12px',
                                width: '100%',
                                fontSize: '0.95rem',
                                outline: 'none',
                                color: 'var(--text-primary)',
                                fontFamily: 'inherit'
                            }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Filters Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                        {fields.map(field => (
                            <button
                                key={field}
                                onClick={() => setActiveField(field)}
                                className={`filter-chip ${activeField === field ? 'active' : ''}`}
                            >
                                {field}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <TrendingUp size={16} />
                        <span>Sort: Most Recent</span>
                    </div>
                </div>

                {/* Content Grid */}
                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="card" style={{ height: '300px', background: 'var(--surface-hover)', border: '1px dashed var(--border-color)' }} />
                        ))}
                    </div>
                ) : filteredProjects.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                        {filteredProjects.map(project => {
                            const statusStyle = getProjectStatusStyle(project.status);
                            return (
                                <div
                                    key={project.projectId}
                                    className="card card-interactive"
                                    onClick={() => navigate(`/projects/${project.projectId}`)}
                                    style={{ padding: 0, display: 'flex', flexDirection: 'column' }}
                                >
                                    <div style={{ padding: '1.5rem', flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                            <span className="badge" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                                                {statusStyle.label}
                                            </span>
                                            <BookOpen size={18} color="var(--text-muted)" />
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                            <h3 style={{ fontSize: '1.15rem', margin: 0, lineHeight: 1.3 }}>
                                                {project.projectName || (project as any).name}
                                            </h3>
                                            {project.roleName && (
                                                <span className="badge badge-accent" style={{ marginLeft: '8px' }}>
                                                    {project.roleName}
                                                </span>
                                            )}
                                        </div>

                                        <p style={{
                                            fontSize: '0.88rem',
                                            color: 'var(--text-secondary)',
                                            lineHeight: 1.6,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            marginBottom: '1.25rem'
                                        }}>
                                            {project.projectDescription || (project as any).description || "Detailed research project documentation and findings registry."}
                                        </p>

                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {project.researchFields?.slice(0, 3).map(rf => (
                                                <span key={rf.researchFieldId} className="tag">{rf.name}</span>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{
                                        padding: '1rem 1.5rem',
                                        background: 'var(--surface-hover)',
                                        borderTop: '1px solid var(--border-light)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div className="avatar avatar-sm avatar-brand">
                                                {(project.nameProjectCreator || project.NameProjectCreator || 'A')[0]}
                                            </div>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {project.nameProjectCreator || project.NameProjectCreator || "Anonymous Researcher"}
                                                </p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                                                    <Calendar size={11} />
                                                    <span>{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'TBD'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <ArrowRight size={18} color="var(--accent-color)" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <SearchX size={36} />
                        </div>
                        <h2>No projects found</h2>
                        <p>Try adjusting your search or filters to find what you're looking for.</p>
                        <button
                            onClick={() => { setSearchTerm(''); setActiveField('All'); }}
                            className="btn btn-secondary"
                        >
                            Reset all filters
                        </button>
                    </div>
                )}

                {/* Footer */}
                <div style={{
                    marginTop: '4rem',
                    padding: '3rem 0',
                    textAlign: 'center',
                    borderTop: '1px solid var(--border-color)'
                }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Are you an AiTA Lab researcher?
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="btn btn-outline"
                    >
                        Go to Researcher Workspace
                    </button>
                </div>
            </div>
        </MainLayout>
    );
};

export default Home;
