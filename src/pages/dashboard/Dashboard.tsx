import { useState, useEffect } from 'react';
import MainLayout from '@/layout/MainLayout';
import {
    BarChart3,
    Clock,
    CheckCircle2,
    AlertCircle,
    ArrowUpRight,
    Plus,
    Layout
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { TaskStatus, DashboardStats, Project, Task } from '@/types';
import { dashboardService, projectService, taskService } from '@/services';
import { getProjectStatusStyle } from '@/utils/projectUtils';

function Dashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    // These would normally come from a global state/store after login
    const user = {
        name: "Current User",
        role: "Researcher"
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [statsData, projectsData, tasksData] = await Promise.all([
                    dashboardService.getStats(),
                    projectService.getAll(),
                    taskService.getPriorityTasks()
                ]);
                setStats(statsData);
                setProjects(projectsData || []);
                setTasks(tasksData || []);
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const statWidgets = [
        { label: 'Active Projects', value: stats?.totalActiveProjects ?? 0, icon: <BarChart3 size={20} />, color: '#01497c' },
        { label: 'Pending Tasks', value: stats?.pendingTasksCount ?? 0, icon: <Clock size={20} />, color: '#2a6f97' },
        { label: 'Completed (Month)', value: stats?.completedTasksThisMonth ?? 0, icon: <CheckCircle2 size={20} />, color: '#10b981' },
        { label: 'Due Soon', value: stats?.approachingDeadlinesCount ?? 0, icon: <AlertCircle size={20} />, color: '#e63946' },
        { label: 'Resources', value: stats?.availableResourcesCount ?? 0, icon: <Layout size={20} />, color: '#8e9aaf' },
    ];

    const canCreateProject = user.role === 'Lab Director' || user.role === 'Admin';

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div style={{ maxWidth: '1240px' }}>
                <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1>Lab Dashboard</h1>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Overview of lab activities and prioritized priorities.</p>
                    </div>
                    {canCreateProject && (
                        <button
                            onClick={() => navigate('/projects/new')}
                            className="btn btn-primary"
                        >
                            <Plus size={18} />
                            New Project
                        </button>
                    )}
                </header>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1.25rem',
                    marginBottom: '2.5rem'
                }}>
                    {statWidgets.map((stat, index) => (
                        <div key={index} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem', position: 'relative', opacity: loading ? 0.7 : 1 }}>
                            <div style={{
                                background: `${stat.color}15`,
                                color: stat.color,
                                padding: '10px',
                                borderRadius: '10px'
                            }}>
                                {stat.icon}
                            </div>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{stat.label}</p>
                                <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                                    {loading ? '...' : stat.value}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* My Projects Section */}
                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0 }}>My Projects</h3>
                                <Link to="/projects" style={{ fontSize: '0.85rem', color: 'var(--accent-color)' }}>
                                    View All Projects
                                </Link>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                                {loading ? (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>
                                        <div className="loader" style={{ margin: '0 auto' }}></div>
                                        <p>Fetching your workspace...</p>
                                    </div>
                                ) : projects.length > 0 ? (
                                    projects.slice(0, 3).map((proj, index) => {
                                        const progress = proj.totalTasks && proj.totalTasks > 0
                                            ? Math.round((proj.completedTasks || 0) / proj.totalTasks * 100)
                                            : 0;

                                        return (
                                            <div
                                                key={proj.id || index}
                                                onClick={() => navigate(`/projects/${proj.id}`)}
                                                style={{
                                                    padding: '1.25rem',
                                                    background: '#fff',
                                                    borderRadius: '12px',
                                                    border: '1px solid var(--border-color)',
                                                    transition: 'all 0.2s ease',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                                }}
                                                onMouseOver={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.05)';
                                                }}
                                                onMouseOut={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                                                }}
                                            >
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            color: 'var(--text-secondary)',
                                                            fontWeight: 700,
                                                            background: '#f1f5f9',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px'
                                                        }}>
                                                            #{(proj.id || '').substring(0, 6).toUpperCase()}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            padding: '4px 10px',
                                                            borderRadius: '20px',
                                                            background: getProjectStatusStyle(proj.status).bg,
                                                            color: getProjectStatusStyle(proj.status).color,
                                                            fontWeight: 600,
                                                            textTransform: 'uppercase'
                                                        }}>{getProjectStatusStyle(proj.status).label}</span>
                                                    </div>
                                                    <div style={{ marginBottom: '1rem' }}>
                                                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem' }}>
                                                            {proj.projectName || (proj as any).name || 'Untitled Project'}
                                                        </h3>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                            <div style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                borderRadius: '50%',
                                                                background: 'var(--primary-color)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: 'white',
                                                                fontSize: '0.6rem',
                                                                fontWeight: 700
                                                            }}>
                                                                {(proj.nameProjectCreator || proj.NameProjectCreator || 'A')[0]}
                                                            </div>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                                                {proj.NameProjectCreator || proj.nameProjectCreator || proj.createdBy || "Anonymous"}
                                                            </span>
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
                                                            {proj.projectDescription || (proj as any).description || "No description provided for this project."}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                                                        <span style={{ color: 'var(--text-secondary)' }}>Research Progress</span>
                                                        <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>
                                                            {progress}%
                                                        </span>
                                                    </div>
                                                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${progress}%`,
                                                            height: '100%',
                                                            background: 'linear-gradient(90deg, var(--accent-color), var(--primary-color))',
                                                            borderRadius: '3px'
                                                        }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })

                                ) : (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>You are not involved in any active projects yet.</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0 }}>Priority Tasks</h3>
                                <Link to="/tasks" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-color)' }}>
                                    View All <ArrowUpRight size={14} />
                                </Link>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {loading ? (
                                    <p>Loading tasks...</p>
                                ) : tasks.length > 0 ? (
                                    tasks.slice(0, 4).map((task) => (
                                        <div key={task.id} style={{
                                            padding: '1rem',
                                            background: '#f8f9fa',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}>
                                            <div>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 600 }}>{task.id.substring(0, 8).toUpperCase()}</span>
                                                <p style={{ margin: '4px 0', fontSize: '0.95rem', fontWeight: 500 }}>{task.name}</p>
                                                <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                    <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</span>
                                                    <span>•</span>
                                                    <span>Priority: {task.priority}</span>
                                                </div>
                                            </div>
                                            <div style={{
                                                padding: '4px 12px',
                                                background: '#fff',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '20px',
                                                fontSize: '0.8rem'
                                            }}>
                                                {TaskStatus[task.status]}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ color: 'var(--text-secondary)' }}>No priority tasks found.</p>
                                )}
                            </div>
                        </section>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <section className="card">
                            <h3 style={{ marginBottom: '1.25rem' }}>Upcoming Seminar</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ borderLeft: '3px solid var(--accent-color)', paddingLeft: '1rem' }}>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Weekly Lab Meeting</p>
                                    <p style={{ margin: '4px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Oct 10, 09:00 AM - Room 402</p>
                                </div>
                                <div style={{ borderLeft: '3px solid #dee2e6', paddingLeft: '1rem' }}>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Ethics in AI Seminar</p>
                                    <p style={{ margin: '4px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Oct 15, 02:00 PM - Online</p>
                                </div>
                            </div>
                        </section>

                        <section className="card" style={{ background: 'var(--primary-color)', color: 'white' }}>
                            <h4 style={{ color: 'white', marginBottom: '0.75rem' }}>System Notice</h4>
                            <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>Lab resources for GPU servers are currently at {stats?.availableResourcesCount ?? '--'}% capacity.</p>
                            <button className="btn btn-primary" style={{
                                marginTop: '1rem',
                                width: '100%',
                            }}>
                                Book Resource
                            </button>
                        </section>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}

export default Dashboard;
