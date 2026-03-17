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

import { useAuth } from '@/hooks/useAuth';

function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

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
        { label: 'Active Projects', value: stats?.totalActiveProjects ?? 0, icon: <BarChart3 size={20} />, color: 'var(--accent-color)', bg: 'var(--accent-bg)' },
        { label: 'Pending Tasks', value: stats?.pendingTasksCount ?? 0, icon: <Clock size={20} />, color: 'var(--info)', bg: 'var(--info-bg)' },
        { label: 'Completed (Month)', value: stats?.completedTasksThisMonth ?? 0, icon: <CheckCircle2 size={20} />, color: 'var(--success)', bg: 'var(--success-bg)' },
        { label: 'Due Soon', value: stats?.approachingDeadlinesCount ?? 0, icon: <AlertCircle size={20} />, color: 'var(--danger)', bg: 'var(--danger-bg)' },
        { label: 'Resources', value: stats?.availableResourcesCount ?? 0, icon: <Layout size={20} />, color: 'var(--text-secondary)', bg: 'var(--border-light)' },
    ];

    const canCreateProject = user.role === 'Lab Director' || user.role === 'Admin';

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">
                {/* Page Header */}
                <div className="page-header">
                    <div>
                        <h1>Lab Dashboard</h1>
                        <p>Overview of lab activities and prioritized priorities.</p>
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
                </div>

                {/* Stat Widgets */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '2rem'
                }}>
                    {statWidgets.map((stat, index) => (
                        <div key={index} className="card stat-widget" style={{ opacity: loading ? 0.7 : 1 }}>
                            <div className="stat-widget-icon" style={{ background: stat.bg, color: stat.color }}>
                                {stat.icon}
                            </div>
                            <div>
                                <p className="stat-widget-label">{stat.label}</p>
                                <p className="stat-widget-value">
                                    {loading ? '...' : stat.value}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Content Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* My Projects */}
                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h3 style={{ margin: 0 }}>My Projects</h3>
                                <Link to="/projects" style={{ fontSize: '0.85rem' }}>
                                    View All Projects
                                </Link>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                                {loading ? (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>
                                        <p style={{ color: 'var(--text-secondary)' }}>Fetching your workspace...</p>
                                    </div>
                                ) : projects.length > 0 ? (
                                    projects.slice(0, 3).map((proj, index) => {
                                        const totalTasks = proj.totalTasks ?? (proj as any).TotalTasks ?? 0;
                                        const completedTasks = proj.completedTasks ?? (proj as any).CompletedTasks ?? 0;
                                        const progress = proj.progress !== undefined 
                                            ? proj.progress 
                                            : (totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0);

                                        return (
                                            <div
                                                key={proj.id || index}
                                                onClick={() => navigate(`/projects/${proj.id}`)}
                                                className="card card-interactive"
                                                style={{ marginBottom: 0 }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                    <span className="badge badge-muted">
                                                        #{(proj.id || '').substring(0, 6).toUpperCase()}
                                                    </span>
                                                    <span className="badge" style={{
                                                        background: getProjectStatusStyle(proj.status).bg,
                                                        color: getProjectStatusStyle(proj.status).color
                                                    }}>
                                                        {getProjectStatusStyle(proj.status).label}
                                                    </span>
                                                </div>

                                                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem' }}>
                                                    {proj.projectName || (proj as any).name || 'Untitled Project'}
                                                </h3>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                    <div className="avatar avatar-sm avatar-brand">
                                                        {(proj.nameProjectCreator || proj.NameProjectCreator || 'A')[0]}
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                                        {proj.NameProjectCreator || proj.nameProjectCreator || proj.createdBy || "Anonymous"}
                                                    </span>
                                                </div>

                                                <p style={{
                                                    margin: '0 0 1rem',
                                                    fontSize: '0.85rem',
                                                    color: 'var(--text-secondary)',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    lineHeight: '1.5'
                                                }}>
                                                    {proj.projectDescription || (proj as any).description || "No description provided."}
                                                </p>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>Progress</span>
                                                    <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{progress}%</span>
                                                </div>
                                                <div className="progress-bar-track">
                                                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="empty-state" style={{ gridColumn: '1/-1', padding: '2rem' }}>
                                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>You are not involved in any active projects yet.</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Priority Tasks */}
                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h3 style={{ margin: 0 }}>Priority Tasks</h3>
                                <Link to="/tasks" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    View All <ArrowUpRight size={14} />
                                </Link>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {loading ? (
                                    <p style={{ color: 'var(--text-secondary)' }}>Loading tasks...</p>
                                ) : tasks.length > 0 ? (
                                    tasks.slice(0, 4).map((task) => (
                                        <div key={task.id} style={{
                                            padding: '0.9rem 1rem',
                                            background: 'var(--surface-hover)',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--border-color)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}>
                                            <div>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                                                    {task.id.substring(0, 8).toUpperCase()}
                                                </span>
                                                <p style={{ margin: '3px 0', fontSize: '0.9rem', fontWeight: 500 }}>{task.name}</p>
                                                <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                    <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</span>
                                                    <span>•</span>
                                                    <span>Priority: {task.priority}</span>
                                                </div>
                                            </div>
                                            <span className="badge badge-muted">{TaskStatus[task.status]}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ color: 'var(--text-secondary)' }}>No priority tasks found.</p>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <section className="card">
                            <h3 style={{ marginBottom: '1rem' }}>Upcoming Seminar</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ borderLeft: '3px solid var(--accent-color)', paddingLeft: '1rem' }}>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Weekly Lab Meeting</p>
                                    <p style={{ margin: '4px 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Oct 10, 09:00 AM - Room 402</p>
                                </div>
                                <div style={{ borderLeft: '3px solid var(--border-color)', paddingLeft: '1rem' }}>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Ethics in AI Seminar</p>
                                    <p style={{ margin: '4px 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Oct 15, 02:00 PM - Online</p>
                                </div>
                            </div>
                        </section>

                        <section className="card" style={{ background: 'var(--primary-color)', color: 'white', border: 'none' }}>
                            <h4 style={{ color: 'white', marginBottom: '0.75rem' }}>System Notice</h4>
                            <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>
                                Lab resources for GPU servers are currently at {stats?.availableResourcesCount ?? '--'}% capacity.
                            </p>
                            <button className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
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
