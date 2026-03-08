import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '@/layout/MainLayout';
import { projectService, milestoneService, membershipService, taskService } from '@/services';
import ProjectSidebar from '@/components/navigation/ProjectSidebar';
import { Project, ProjectStatus, Milestone, Task, TaskStatus } from '@/types';
import { getProjectStatusStyle } from '@/utils/projectUtils';


import {
    Users,
    UserPlus,
    Settings,
    AlertCircle,
    Clock,
    ShieldAlert,
    Plus,
    Activity
} from 'lucide-react';
import { ProjectRoleEnum } from '@/types/project';
import MilestoneItem from '@/components/milestone/MilestoneItem';
import TaskItem from '@/components/task/TaskItem';
import KanbanBoard from '@/features/tasks/KanbanBoard';

const ProjectDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [project, setProject] = useState<Project | null>(null);
    const [currentMember, setCurrentMember] = useState<any>(null);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);

    const location = useLocation();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'home' | 'milestones' | 'members' | 'tasks'>(location.state?.activeTab || 'home');
    const [taskView, setTaskView] = useState<'list' | 'board'>('board');

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                // 1. Get detailed member info first to check if user has access
                const memberInfo = await projectService.getCurrentMember(id);
                console.log("Current Member Info:", memberInfo);

                // 2. Check if user is a member of this project
                if (!memberInfo || !memberInfo.projectRole) {
                    console.log("User is not a member of this project, redirecting to explore view");
                    navigate(`/explore/projects/${id}`, { replace: true });
                    return;
                }

                setCurrentMember(memberInfo);

                // 3. Get Project Detail
                const projectData = await projectService.getById(id);

                if (!projectData) {
                    setProject(null);
                    setLoading(false);
                    return;
                }

                setProject(projectData);

                // 4. Fetch the rest of the workspace data
                const [milestonesData, membersData, tasksData] = await Promise.all([
                    milestoneService.getByProject(id),
                    membershipService.getProjectMembers(id),
                    taskService.getByProject(id)
                ]);

                setMilestones(projectData.milestones?.length ? projectData.milestones : milestonesData);
                setMembers(projectData.members?.length ? projectData.members : membersData);
                setTasks(projectData.tasks?.length ? projectData.tasks : tasksData);
            } catch (error) {
                console.error('Failed to fetch project workspace data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, navigate]);

    const refetchTasks = async () => {
        if (!id) return;
        try {
            const tasksData = await taskService.getByProject(id);
            setTasks(tasksData);
        } catch (error) {
            console.error('Failed to refetch tasks:', error);
        }
    };

    const user = {
        id: "mock-user-id",
        name: "Current User",
        role: "Researcher"
    };

    // Base permissions on projectRole from getCurrentMember or projectData
    const projectRoleValue = currentMember?.projectRole || project?.projectRole;

    const isAdmin = user.role === 'Admin';
    const canManageProject = isAdmin ||
        (Number(projectRoleValue) === ProjectRoleEnum.Leader) ||
        (Number(projectRoleValue) === ProjectRoleEnum.LabDirector);

    if (loading) {
        return (
            <MainLayout
                role={user.role}
                userName={user.name}
                customSidebar={<ProjectSidebar projectId={id || ''} projectName={project?.projectName || (project as any)?.name || location.state?.projectName || 'Project Workspace'} activeTab={activeTab} onTabChange={setActiveTab} roleName={currentMember?.roleName || currentMember?.projectRoleName || project?.roleName} />}
            >
                <div style={{ padding: '0' }}>
                    <div style={{
                        background: 'white',
                        borderBottom: '1px solid var(--border-color)',
                        padding: '1.5rem 2rem',
                        margin: '-1.5rem -2rem 2rem',
                        opacity: 0.7
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#f1f5f9' }}></div>
                            <div>
                                <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#e2e8f0' }}>
                                    {location.state?.projectName || 'Loading Project...'}
                                </h1>
                                <div style={{ height: '16px', width: '150px', background: '#f8fafc', marginTop: '8px' }}></div>
                            </div>
                        </div>
                    </div>
                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                        <div className="loader" style={{ margin: '0 auto' }}></div>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (!project) {
        return (
            <MainLayout role="Researcher" userName="Current User">
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



    const getStatusStyle = (status: ProjectStatus) => {
        return getProjectStatusStyle(status);
    };

    return (
        <MainLayout
            role={user.role}
            userName={user.name}
            customSidebar={<ProjectSidebar projectId={id || ''} projectName={project.projectName} activeTab={activeTab} onTabChange={(tab: any) => setActiveTab(tab)} roleName={currentMember?.roleName || currentMember?.projectRoleName || project?.roleName} />}
        >
            <div style={{ padding: '0' }}>
                {/* Internal Header */}
                <div style={{
                    background: 'white',
                    borderBottom: '1px solid var(--border-color)',
                    padding: '1.5rem 2rem',
                    margin: '-1.5rem -2rem 2rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '16px',
                                background: 'linear-gradient(135deg, var(--primary-color) 0%, #4f46e5 100%)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '1.5rem'
                            }}>
                                {(project.projectName || (project as any).name || 'P').charAt(0)}
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                    <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{project.projectName || (project as any).name || 'Untitled Project'}</h1>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        padding: '4px 10px',
                                        borderRadius: '20px',
                                        background: getStatusStyle(project.status).bg,
                                        color: getStatusStyle(project.status).color,
                                        fontWeight: 600,
                                        textTransform: 'uppercase'
                                    }}>{getStatusStyle(project.status).label}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={14} />
                                        {project.createdAt ? `Created ${new Date(project.createdAt).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Established N/A'}
                                        {project.NameProjectCreator && ` by ${project.NameProjectCreator}`}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={14} /> {members.length} Active Members</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            {canManageProject && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => navigate(`/projects/edit/${id}`)}
                                    style={{
                                        opacity: project.status === ProjectStatus.Archived && !isAdmin ? 0.7 : 1,
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Settings size={18} style={{ marginRight: '8px' }} />
                                    {project.status === ProjectStatus.Archived && !isAdmin ? 'View Configuration' : 'Configuration Project'}
                                </button>
                            )}
                            <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center' }}>
                                <Activity size={18} style={{ marginRight: '8px' }} /> Export Reports
                            </button>
                        </div>
                    </div>
                </div>

                {project.status === ProjectStatus.Archived && (
                    <div style={{
                        margin: '0 2rem 1.5rem',
                        padding: '1rem 1.5rem',
                        background: '#fff7ed',
                        border: '1px solid',
                        borderColor: '#ffedd5',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        color: '#c2410c'
                    }}>
                        <ShieldAlert size={20} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                            This project is <strong>Archived</strong>.
                            Workspace is archived for historical preservation.
                            {isAdmin ? ' Since you are an ADMIN, you still have full access.' : ' Configuration and activities are locked.'}
                        </span>
                    </div>
                )}

                {/* Workspace Content */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '2rem' }}>
                    <div style={{ minWidth: 0 }}>
                        {activeTab === 'home' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <section className="card">
                                    <div style={{ flex: 2 }}>
                                        <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</h4>
                                        <p style={{ margin: 0, lineHeight: '1.7', color: '#475569' }}>
                                            {project.projectDescription || "No description provided."}
                                        </p>
                                    </div>
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
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Recent Tasks</h4>
                                            <button
                                                className="btn btn-text"
                                                style={{ fontSize: '0.8rem' }}
                                                onClick={() => setActiveTab('tasks')}
                                            >View All</button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {tasks.slice(0, 3).map(task => (
                                                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', padding: '8px', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: task.status === TaskStatus.Completed ? '#10b981' : '#0ea5e9' }} />
                                                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.name}</span>
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</span>
                                                </div>
                                            ))}
                                            {tasks.length === 0 && <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>No recent research tasks.</p>}
                                        </div>
                                    </section>

                                    <section className="card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Milestones</h4>
                                            <button className="btn btn-text" style={{ fontSize: '0.8rem' }} onClick={() => setActiveTab('milestones')}>Roadmap</button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {milestones.slice(0, 3).map(m => (
                                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', padding: '8px', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                                                    <Activity size={14} style={{ color: 'var(--accent-color)' }} />
                                                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                                                </div>
                                            ))}
                                            {milestones.length === 0 && <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>No milestones defined yet.</p>}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}

                        {activeTab === 'milestones' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h2 style={{ margin: 0 }}>Research Roadmap</h2>
                                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Visualizing the phases and critical path of this project.</p>
                                    </div>
                                    <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Plus size={18} /> Add Milestone
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {milestones.length > 0 ? milestones.map(milestone => (
                                        <MilestoneItem key={milestone.id} milestone={milestone} />
                                    )) : (
                                        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                                            <p style={{ color: 'var(--text-secondary)' }}>No milestones have been defined for this research project.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'members' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h2 style={{ margin: 0 }}>Research Team</h2>
                                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Manage contributors and roles within this project.</p>
                                    </div>
                                    <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <UserPlus size={18} /> Add Member
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                    {members.length > 0 ? members.map((member, index) => (
                                        <div key={member.id || member.memberId || index} className="card" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '1.25rem' }}>
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '50%',
                                                background: '#f1f5f9',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1.1rem',
                                                fontWeight: 600,
                                                color: 'var(--primary-color)'
                                            }}>{(member.fullName || member.userName)?.charAt(0) || 'U'}</div>
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ margin: 0, fontSize: '1rem' }}>{member.fullName || member.userName}</h4>
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{member.roleName || member.projectRoleName}</p>
                                            </div>
                                            <div style={{
                                                padding: '4px 8px',
                                                background: member.status === 1 ? '#ecfdf5' : member.status === 2 ? '#fef2f2' : '#fee2e2',
                                                color: member.status === 1 ? '#10b981' : member.status === 2 ? '#f59e0b' : '#ef4444',
                                                borderRadius: '6px',
                                                fontSize: '0.7rem',
                                                fontWeight: 700
                                            }}>{member.status === 1 ? 'ACTIVE' : member.status === 2 ? 'INACTIVE' : 'BANNED'}</div>
                                        </div>
                                    )) : (
                                        <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
                                            <p style={{ color: 'var(--text-secondary)' }}>No members have been added to this research project yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'tasks' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h2 style={{ margin: 0 }}>Research Activities</h2>
                                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Track experimentation, analysis, and documentation progress.</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div style={{
                                            display: 'flex',
                                            padding: '4px',
                                            background: '#f1f5f9',
                                            borderRadius: '8px'
                                        }}>
                                            <button
                                                onClick={() => setTaskView('board')}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    background: taskView === 'board' ? 'white' : 'transparent',
                                                    color: taskView === 'board' ? 'var(--accent-color)' : 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    boxShadow: taskView === 'board' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                                                }}
                                            >Board</button>
                                            <button
                                                onClick={() => setTaskView('list')}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    background: taskView === 'list' ? 'white' : 'transparent',
                                                    color: taskView === 'list' ? 'var(--accent-color)' : 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    boxShadow: taskView === 'list' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                                                }}
                                            >List</button>
                                        </div>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => setTaskView('board')}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                opacity: project.status === ProjectStatus.Archived && !isAdmin ? 0.5 : 1,
                                                cursor: project.status === ProjectStatus.Archived && !isAdmin ? 'not-allowed' : 'pointer'
                                            }}
                                            disabled={project.status === ProjectStatus.Archived && !isAdmin}
                                        >
                                            <Plus size={18} /> New Activity
                                        </button>
                                    </div>
                                </div>

                                {tasks.length > 0 ? (
                                    taskView === 'board' ? (
                                        <KanbanBoard
                                            tasks={tasks}
                                            projectMembers={members}
                                            projectId={id || ''}
                                            onTaskCreated={refetchTasks}
                                        />
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                                            {tasks.map(task => (
                                                <TaskItem key={task.id} task={task} />
                                            ))}
                                        </div>
                                    )
                                ) : (
                                    <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                                        <p style={{ color: 'var(--text-secondary)' }}>No active research activities found in this workspace.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar Stats */}
                    <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <section className="card" style={{ padding: '1.25rem' }}>
                            <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem' }}>Overall Progress</h3>
                            {(() => {
                                const total = tasks.length;
                                const completed = tasks.filter(t => t.status === TaskStatus.Completed).length;
                                const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                                const dashOffset = 339.29 * (1 - percentage / 100);

                                return (
                                    <>
                                        <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 1.5rem' }}>
                                            <svg width="120" height="120" viewBox="0 0 120 120">
                                                <circle cx="60" cy="60" r="54" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                                                <circle cx="60" cy="60" r="54" fill="none" stroke="var(--accent-color)" strokeWidth="10" strokeDasharray="339.29" strokeDashoffset={dashOffset} strokeLinecap="round" />
                                            </svg>
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                                <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{percentage}%</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Tasks Done</span>
                                                <span>{completed}/{total}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Milestones</span>
                                                <span>{milestones.length} active</span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </section>

                        <section className="card" style={{ padding: '1.25rem' }}>
                            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Active Member</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {members.slice(0, 5).map((m, index) => (
                                    <div key={m.id || m.memberId || index} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                                            {(m.fullName || m.userName)?.charAt(0) || 'U'}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{m.fullName || m.userName}</span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{m.roleName || m.projectRoleName}</span>
                                        </div>
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
