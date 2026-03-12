import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@/layout/MainLayout';
import { projectService, milestoneService, membershipService } from '@/services';
import { Project, Milestone, ProjectMember } from '@/types';
import { getProjectStatusStyle } from '@/utils/projectUtils';
import {
    ArrowLeft,
    Calendar,
    BookOpen,
    Users,
    Globe
} from 'lucide-react';

const PublicProjectDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [project, setProject] = useState<Project | null>(null);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [members, setMembers] = useState<ProjectMember[]>([]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const [projectData, milestonesData, membersData, memberInfo] = await Promise.all([
                    projectService.getById(id),
                    milestoneService.getByProject(id),
                    membershipService.getProjectMembers(id),
                    projectService.getCurrentMember(id)
                ]);

                let actualProject = projectData;
                if (!actualProject) {
                    const publicProjects = await projectService.getPublic();
                    actualProject = publicProjects.find(p => p.id?.toLowerCase() === id.toLowerCase()) || null;
                }

                if (actualProject) {
                    actualProject.projectRole = memberInfo?.projectRole;
                }

                setProject(actualProject);
                setMilestones(milestonesData || []);
                setMembers(membersData || []);
            } catch (error) {
                console.error('Failed to fetch public project details:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
        window.scrollTo(0, 0);
    }, [id]);

    if (loading) {
        return (
            <MainLayout role="Visitor" userName="Guest" hideSidebar={true}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                    <div className="loader"></div>
                    <p style={{ marginLeft: '1rem' }}>Bringing project history to light...</p>
                </div>
            </MainLayout>
        );
    }

    if (!project) {
        return (
            <MainLayout role="Visitor" userName="Guest" hideSidebar={true}>
                <div style={{ textAlign: 'center', padding: '5rem' }}>
                    <h2>Project Not Found</h2>
                    <p>The project you are looking for might be private or does not exist.</p>
                    <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Catalog</button>
                </div>
            </MainLayout>
        );
    }

    const statusStyle = getProjectStatusStyle(project.status);

    return (
        <MainLayout role="Visitor" userName="Guest" hideSidebar={true}>
            <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '5rem' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        marginBottom: '2rem',
                        fontSize: '0.9rem',
                        fontWeight: 600
                    }}
                >
                    <ArrowLeft size={16} /> Back to Exploration
                </button>

                {/* Hero Showcase */}
                <header style={{ marginBottom: '3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <span style={{
                                padding: '4px 12px',
                                background: statusStyle.bg,
                                color: statusStyle.color,
                                borderRadius: '20px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                            }}>
                                {statusStyle.label}
                            </span>
                            <span style={{
                                padding: '4px 12px',
                                background: '#f1f5f9',
                                color: '#475569',
                                borderRadius: '20px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <Globe size={12} /> PUBLIC ACCESS
                            </span>
                        </div>
                        {project.projectRole && (
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate(`/projects/${id}`)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                                }}
                            >
                                <BookOpen size={18} /> Enter Project Workspace
                            </button>
                        )}
                    </div>

                    <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--primary-color)' }}>
                        {project.projectName || (project as any).name}
                    </h1>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                                {(project.nameProjectCreator || project.NameProjectCreator || 'A')[0]}
                            </div>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Principal Investigator</span>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{project.nameProjectCreator || project.NameProjectCreator || "Anonymous Researcher"}</span>
                            </div>
                        </div>
                        <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '2rem' }}>
                            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Timeline</span>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Calendar size={14} /> {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'TBD'} — {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'Present'}
                            </span>
                        </div>
                        <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '2rem' }}>
                            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Collaboration</span>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Users size={14} /> {project.membersCount || project.members?.length || 0} Researchers Active
                            </span>
                        </div>
                    </div>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '3rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                        {/* Abstract / Description */}
                        <section>
                            <h3 style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                                Research Abstract
                            </h3>
                            <p style={{ fontSize: '1.1rem', lineHeight: 1.8, color: '#334155' }}>
                                {project.projectDescription || (project as any).description || "Detailed documentation for this research endeavor is currently being processed by the lab administrators."}
                            </p>
                        </section>

                        {/* Public Milestones / Timeline */}
                        <section>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0 }}>Research Roadmap</h3>
                                <span style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600 }}>{milestones.length} Phases</span>
                            </div>
                            <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                                <div style={{ position: 'absolute', left: '7px', top: '0', bottom: '0', width: '2px', background: '#e2e8f0' }} />

                                {milestones.length > 0 ? milestones.sort((a, b) => new Date(a.startDate || '').getTime() - new Date(b.startDate || '').getTime()).map((m, idx) => (
                                    <div key={m.id} style={{ position: 'relative', marginBottom: '2.5rem' }}>
                                        <div style={{
                                            position: 'absolute',
                                            left: '-29px',
                                            top: '4px',
                                            width: '12px',
                                            height: '12px',
                                            borderRadius: '50%',
                                            background: idx === 0 ? 'var(--accent-color)' : 'white',
                                            border: `2px solid ${idx === 0 ? 'var(--accent-color)' : '#94a3b8'}`,
                                            zIndex: 2
                                        }} />
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                                                <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{m.name}</h4>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, background: '#f8fafc', padding: '2px 8px', borderRadius: '4px' }}>
                                                    {m.startDate ? new Date(m.startDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'TBD'}
                                                </span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569', lineHeight: 1.6 }}>
                                                {m.description || "Experimental phase implementation and data analysis."}
                                            </p>
                                        </div>
                                    </div>
                                )) : (
                                    <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                                        <p style={{ margin: 0, color: '#94a3b8' }}>Timeline is being finalized by the research team.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    <aside style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Research Contributors */}
                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                                <Users size={18} /> Research Team
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {members.length > 0 ? members.slice(0, 5).map((member, index) => (
                                    <div key={member.id || member.memberId || index} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            background: '#f1f5f9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            color: 'var(--primary-color)',
                                            border: '1px solid #e2e8f0'
                                        }}>
                                            {(member.fullName || member.userName || 'U')[0]}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{member.fullName || member.userName}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{member.roleName || member.projectRoleName}</div>
                                        </div>
                                    </div>
                                )) : (
                                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>Information restricted.</p>
                                )}
                                {members.length > 5 && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600, cursor: 'pointer', textAlign: 'center', marginTop: '5px' }}>
                                        + {members.length - 5} other contributors
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Research Fields */}
                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                <BookOpen size={18} /> Domains
                            </h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {project.researchFields && project.researchFields.length > 0 ? (
                                    project.researchFields.map(field => (
                                        <span key={field.id} style={{ padding: '6px 12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                                            {field.name}
                                        </span>
                                    ))
                                ) : (
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>General Research Area</span>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </MainLayout>
    );
};

export default PublicProjectDetails;
