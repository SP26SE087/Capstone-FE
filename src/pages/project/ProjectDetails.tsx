import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@/layout/MainLayout';
import { projectService, milestoneService, membershipService, taskService } from '@/services';
import ProjectSidebar from '@/components/navigation/ProjectSidebar';
import { Project, ProjectStatus, Milestone, Task } from '@/types';
import {
    Calendar,
    Users,
    CheckCircle2,
    Clock,
    ArrowLeft,
    MoreVertical,
    Target,
    Plus,
    AlertCircle,
    ChevronRight,
    UserPlus,
    Settings
} from 'lucide-react';

const ProjectDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [project, setProject] = useState<Project | null>(null);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'members' | 'tasks'>('overview');

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const [projectData, milestonesData, membersData, tasksData] = await Promise.all([
                    projectService.getById(id),
                    milestoneService.getByProject(id),
                    membershipService.getProjectMembers(id),
                    taskService.getByProject(id)
                ]);

                setProject(projectData);
                setMilestones(milestonesData);
                setMembers(membersData);
                setTasks(tasksData);
            } catch (error) {
                console.error('Failed to fetch project workspace data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (loading) {
        return (
            <MainLayout role="Lab Director" userName="Alex Rivera">
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <div className="loader" style={{ margin: '2rem auto' }}></div>
                    <p>Entering project space...</p>
                </div>
            </MainLayout>
        );
    }

    if (!project) {
        return (
            <MainLayout role="Lab Director" userName="Alex Rivera">
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
                    <h2>Project Not Found</h2>
                    <p>The project workspace you're looking for doesn't exist or you don't have access.</p>
                    <button onClick={() => navigate('/projects')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                        Back to Projects
                    </button>
                </div>
            </MainLayout>
        );
    }

    const user = { name: "Alex Rivera", role: "Lab Director" };

    const getStatusStyle = (status: ProjectStatus) => {
        switch (status) {
            case ProjectStatus.Active: return { color: '#0288d1', bg: '#e1f5fe' };
            case ProjectStatus.Pending: return { color: '#f57c00', bg: '#fff3e0' };
            case ProjectStatus.Completed: return { color: '#10b981', bg: '#ecfdf5' };
            default: return { color: '#6b7280', bg: '#f3f4f6' };
        }
    };

    return (
        <MainLayout
            role={user.role}
            userName={user.name}
            customSidebar={
                <ProjectSidebar
                    projectId={id || ''}
                    projectName={project.projectName}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            }
        >
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Workspace Header */}
                <div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '1.5rem 2rem',
                    border: '1px solid var(--border-color)',
                    marginBottom: '2rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                }}>
                    <button
                        onClick={() => navigate('/projects')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            marginBottom: '1rem',
                            fontSize: '0.85rem'
                        }}
                    >
                        <ArrowLeft size={14} /> Back to Catalog
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                background: 'linear-gradient(135deg, var(--primary-color), var(--accent-color))',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 700,
                                fontSize: '1.5rem'
                            }}>
                                {project.projectName.charAt(0)}
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                    <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{project.projectName}</h1>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        background: getStatusStyle(project.status).bg,
                                        color: getStatusStyle(project.status).color,
                                        fontWeight: 600,
                                        textTransform: 'uppercase'
                                    }}>{ProjectStatus[project.status]}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> Established {new Date(project.startDate || '').toLocaleDateString()}</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={14} /> {members.length} Active Researchers</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn btn-primary" onClick={() => navigate(`/projects/edit/${id}`)}>
                                <Settings size={18} style={{ marginRight: '8px' }} />
                                Manage Project
                            </button>
                        </div>
                    </div>
                </div>

                {/* Workspace Content */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '2rem' }}>
                    <div style={{ minWidth: 0 }}>
                        {activeTab === 'overview' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <section className="card">
                                    <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Project Description</h3>
                                    <p style={{ lineHeight: 1.7, color: '#4b5563' }}>{project.projectDescription || "No detailed description available for this research project."}</p>

                                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                                        <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>RESEARCH FIELDS</h4>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {project.researchFields?.map((field, index) => (
                                                <span key={field.id || index} style={{
                                                    padding: '6px 12px',
                                                    background: '#f8fafc',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '20px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 500
                                                }}>
                                                    {field.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </section>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <section className="card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Recent Activity</h3>
                                            <button style={{ border: 'none', background: 'none', color: 'var(--accent-color)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>View All</button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            {[1, 2, 3].map(idx => (
                                                <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f5f9' }} />
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: '0.85rem' }}><strong>User {idx}</strong> updated task <strong>Research Design</strong></p>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>2 hours ago</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="card">
                                        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Upcoming Milestones</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {milestones.length > 0 ? milestones.slice(0, 3).map((m, i) => (
                                                <div key={m.id || i} style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
                                                    <div style={{ padding: '8px', background: '#ebf5ff', borderRadius: '8px', color: '#0369a1' }}>
                                                        <Target size={16} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{m.name}</p>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(m.dueDate).toLocaleDateString()}</p>
                                                    </div>
                                                    <ChevronRight size={14} color="#94a3b8" />
                                                </div>
                                            )) : <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No milestones set.</p>}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}

                        {activeTab === 'milestones' && (
                            <section className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                    <h3 style={{ margin: 0 }}>Project Roadmap</h3>
                                    <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                                        <Plus size={16} /> New Milestone
                                    </button>
                                </div>
                                <div style={{ position: 'relative', paddingLeft: '30px' }}>
                                    <div style={{ position: 'absolute', left: '10px', top: '0', bottom: '0', width: '2px', background: '#f1f5f9' }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                        {milestones.length > 0 ? milestones.map((m, i) => (
                                            <div key={m.id || i} style={{ position: 'relative' }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    left: '-26px',
                                                    top: '0',
                                                    width: '14px',
                                                    height: '14px',
                                                    borderRadius: '50%',
                                                    background: 'var(--accent-color)',
                                                    border: '3px solid white',
                                                    boxShadow: '0 0 0 2px #f1f5f9'
                                                }} />
                                                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                        <h4 style={{ margin: 0 }}>{m.name}</h4>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{new Date(m.dueDate).toLocaleDateString()}</span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{m.description || "Project phase achievement goal."}</p>
                                                </div>
                                            </div>
                                        )) : (
                                            <div style={{ padding: '3rem', textAlign: 'center' }}>
                                                <p>No milestones created for this project yet.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeTab === 'members' && (
                            <section className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                    <h3 style={{ margin: 0 }}>Research Team</h3>
                                    <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <UserPlus size={18} /> Invite Member
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                    {members.length > 0 ? members.map((member, index) => (
                                        <div key={member.id || index} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Users size={20} color="var(--accent-color)" />
                                            </div>
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 600 }}>{member.userName || 'Member Name'}</p>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{member.roleName || 'Researcher'}</p>
                                            </div>
                                            <button style={{ marginLeft: 'auto', border: 'none', background: 'none' }}><MoreVertical size={16} /></button>
                                        </div>
                                    )) : <p>Loading team members...</p>}
                                </div>
                            </section>
                        )}

                        {activeTab === 'tasks' && (
                            <section>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <h3 style={{ margin: 0 }}>Project Tasks</h3>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => navigate(`/tasks/new?projectId=${id}`)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        <Plus size={18} /> Add Task
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                    {/* Simplified Kanban-ish view or just task list */}
                                    {tasks.length > 0 ? tasks.map((task, index) => (
                                        <div key={task.id || index} className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #cbd5e1' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>T-{task.id.substring(0, 4).toUpperCase()}</span>
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: task.priority === 3 ? '#fee2e2' : '#f1f5f9',
                                                    color: task.priority === 3 ? '#ef4444' : '#64748b',
                                                    fontWeight: 700
                                                }}>
                                                    {task.priority === 3 ? 'HIGH' : 'NORMAL'}
                                                </span>
                                            </div>
                                            <h4 style={{ margin: '0 0 10px 0' }}>{task.name}</h4>
                                            <p style={{ margin: '0 0 15px 0', fontSize: '0.8rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{task.description}</p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    <Calendar size={14} />
                                                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                                                </div>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e2e8f0' }} />
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem' }}>
                                            <CheckCircle2 size={40} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                            <p>No tasks found for this project workplace.</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Sidebar Stats */}
                    <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <section className="card" style={{ padding: '1.25rem' }}>
                            <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem' }}>Overall Progress</h3>
                            <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 1.5rem' }}>
                                <svg width="120" height="120" viewBox="0 0 120 120">
                                    <circle cx="60" cy="60" r="54" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                                    <circle cx="60" cy="60" r="54" fill="none" stroke="var(--accent-color)" strokeWidth="10" strokeDasharray="339.29" strokeDashoffset={339.29 * (1 - 0.45)} strokeLinecap="round" />
                                </svg>
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>45%</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Tasks Done</span>
                                    <span>{tasks.filter(t => t.status === 5).length}/{tasks.length}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Milestones</span>
                                    <span>{milestones.length} active</span>
                                </div>
                            </div>
                        </section>

                        <section className="card" style={{ padding: '1.25rem' }}>
                            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Active Member</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {members.slice(0, 5).map((m, index) => (
                                    <div key={m.id || index} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                                            {m.userName?.charAt(0) || 'U'}
                                        </div>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{m.userName}</span>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginLeft: 'auto' }} />
                                    </div>
                                ))}
                            </div>
                        </section>
                    </aside>
                </div>
            </div>
        </MainLayout>
    );
};

export default ProjectDetails;
