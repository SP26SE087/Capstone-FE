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
    TrendingUp,
    Library
} from 'lucide-react';

const Home: React.FC = () => {
    const navigate = useNavigate();
    const [publicProjects, setPublicProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeField, setActiveField] = useState<string>('All');

    useEffect(() => {
        const fetchPublicProjects = async () => {
            setLoading(true);
            try {
                const data = await projectService.getPublic();
                setPublicProjects(data || []);
            } catch (error) {
                console.error('Failed to fetch public projects:', error);
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

    const user = { name: "Guest User", role: "Researcher" };

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Hero Section */}
                <section style={{
                    padding: '3rem 2rem',
                    background: 'linear-gradient(135deg, #012a4a 0%, #01497c 100%)',
                    borderRadius: '24px',
                    color: 'white',
                    marginBottom: '3rem',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'relative', zIndex: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '12px' }}>
                                <Library size={24} color="#60a5fa" />
                            </div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                Research Repository
                            </span>
                        </div>
                        <h1 style={{ color: 'white', fontSize: '2.5rem', marginBottom: '1rem', lineHeight: 1.2 }}>
                            Explore the Frontiers of <br /> Lab Innovation
                        </h1>
                        <p style={{ fontSize: '1.1rem', color: '#bfdbfe', maxWidth: '600px', marginBottom: '2rem', lineHeight: 1.6 }}>
                            Discover publicly shared research projects, collaborative initiatives, and scientific breakthroughs
                            from the AiTA Lab community.
                        </p>

                        <div style={{
                            background: 'white',
                            padding: '6px',
                            borderRadius: '16px',
                            display: 'flex',
                            maxWidth: '700px',
                            boxShadow: '0 15px 30px rgba(0,0,0,0.2)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', flex: 1, padding: '0 15px' }}>
                                <Search color="#64748b" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search by project name, creator, or topic..."
                                    style={{
                                        border: 'none',
                                        padding: '12px',
                                        width: '100%',
                                        fontSize: '1rem',
                                        outline: 'none',
                                        color: '#1e293b'
                                    }}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button className="btn btn-primary" style={{ padding: '0 25px', borderRadius: '12px' }}>
                                Find Projects
                            </button>
                        </div>
                    </div>

                    {/* Decorative Elements */}
                    <div style={{
                        position: 'absolute',
                        right: '-50px',
                        top: '-50px',
                        width: '300px',
                        height: '300px',
                        background: 'radial-gradient(circle, rgba(96,165,250,0.1) 0%, transparent 70%)',
                        zIndex: 1
                    }} />
                </section>

                {/* Filters Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                        {fields.map(field => (
                            <button
                                key={field}
                                onClick={() => setActiveField(field)}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: '50px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    border: '1px solid',
                                    transition: 'all 0.2s',
                                    background: activeField === field ? '#01497c' : 'white',
                                    color: activeField === field ? 'white' : '#64748b',
                                    borderColor: activeField === field ? '#01497c' : '#e2e8f0'
                                }}
                            >
                                {field}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.9rem' }}>
                        <TrendingUp size={16} />
                        <span>Sort: Most Recent</span>
                    </div>
                </div>

                {/* Content Grid */}
                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="card" style={{ height: '300px', background: '#f8fafc', border: '1px dashed #e2e8f0' }} />
                        ))}
                    </div>
                ) : filteredProjects.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem' }}>
                        {filteredProjects.map(project => {
                            const statusStyle = getProjectStatusStyle(project.status);
                            return (
                                <div
                                    key={project.id}
                                    className="card project-card"
                                    onClick={() => navigate(`/explore/projects/${project.id}`)}
                                    style={{
                                        cursor: 'pointer',
                                        transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-8px)';
                                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                                    }}
                                >
                                    <div style={{ padding: '1.5rem', flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                            <span style={{
                                                fontSize: '0.65rem',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                background: statusStyle.bg,
                                                color: statusStyle.color,
                                                fontWeight: 700,
                                                textTransform: 'uppercase'
                                            }}>
                                                {statusStyle.label}
                                            </span>
                                            <BookOpen size={18} color="#94a3b8" />
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                            <h3 style={{ fontSize: '1.25rem', margin: 0, lineHeight: 1.3 }}>
                                                {project.projectName || (project as any).name}
                                            </h3>
                                            {project.roleName && (
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    padding: '3px 8px',
                                                    background: 'var(--accent-color)',
                                                    color: 'white',
                                                    borderRadius: '4px',
                                                    fontWeight: 600,
                                                    marginLeft: '8px',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {project.roleName}
                                                </span>
                                            )}
                                        </div>

                                        <p style={{
                                            fontSize: '0.9rem',
                                            color: '#64748b',
                                            lineHeight: 1.6,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            marginBottom: '1.5rem'
                                        }}>
                                            {project.projectDescription || (project as any).description || "Detailed research project documentation and findings registry."}
                                        </p>

                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {project.researchFields?.slice(0, 3).map(rf => (
                                                <span key={rf.id} style={{
                                                    fontSize: '0.7rem',
                                                    background: '#f1f5f9',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    color: '#475569',
                                                    fontWeight: 500
                                                }}>
                                                    {rf.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{
                                        padding: '1.25rem 1.5rem',
                                        background: '#f8fafc',
                                        borderTop: '1px solid #f1f5f9',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                background: '#01497c',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '0.8rem',
                                                fontWeight: 700
                                            }}>
                                                {(project.nameProjectCreator || project.NameProjectCreator || 'A')[0]}
                                            </div>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                                                    {project.nameProjectCreator || project.NameProjectCreator || "Anonymous Researcher"}
                                                </p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                    <Calendar size={12} />
                                                    <span>{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'TBD'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <ArrowRight size={18} color="#01497c" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            background: '#f1f5f9',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.5rem'
                        }}>
                            <SearchX size={40} color="#94a3b8" />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '0.5rem' }}>No projects found</h2>
                        <p style={{ color: '#64748b' }}>Try adjusting your search or filters to find what you're looking for.</p>
                        <button
                            onClick={() => { setSearchTerm(''); setActiveField('All'); }}
                            className="btn btn-secondary"
                            style={{ marginTop: '1.5rem' }}
                        >
                            Reset all filters
                        </button>
                    </div>
                )}

                {/* Footer simple link for researchers */}
                <div style={{
                    marginTop: '5rem',
                    padding: '3rem 0',
                    textAlign: 'center',
                    borderTop: '1px solid #e2e8f0'
                }}>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>
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
