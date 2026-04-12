import { useState, useEffect } from 'react';
import MainLayout from '@/layout/MainLayout';
import {
    BarChart3,
    Clock,
    CheckCircle2,
    AlertCircle,
    ArrowUpRight,
    Layers,
    Calendar,
    Presentation,
    ClipboardList,
    BookOpen,
    FileText,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { TaskStatus, DashboardStats, Project, Task } from '@/types';
import { dashboardService, projectService, taskService } from '@/services';
import { getProjectStatusStyle } from '@/utils/projectUtils';
import { useAuth } from '@/hooks/useAuth';
import seminarService from '@/services/seminarService';
import { SeminarMeetingResponse } from '@/types/seminar';

function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [seminars, setSeminars] = useState<SeminarMeetingResponse[]>([]);
    const [loading, setLoading] = useState(true);



    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [statsData, projectsData, tasksData, seminarData] = await Promise.all([
                    dashboardService.getStats(),
                    projectService.getAll(),
                    taskService.getPriorityTasks(),
                    seminarService.getInvitedSeminarMeetings().catch(() => [] as SeminarMeetingResponse[])
                ]);
                setStats(statsData);
                setProjects(projectsData || []);
                setTasks(tasksData || []);

                const now = new Date();
                const upcoming = (seminarData || [])
                    .filter((s: SeminarMeetingResponse) => new Date(`${s.meetingDate}T${s.startTime}`) >= now)
                    .sort((a: SeminarMeetingResponse, b: SeminarMeetingResponse) =>
                        new Date(`${a.meetingDate}T${a.startTime}`).getTime() -
                        new Date(`${b.meetingDate}T${b.startTime}`).getTime()
                    );
                setSeminars(upcoming);
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);


    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 18) return 'Good afternoon';
        return 'Good evening';
    };

    const statCards = [
        { label: 'Active Projects', value: stats?.totalActiveProjects ?? 0, Icon: BarChart3, accent: 'var(--accent-color)', bg: 'var(--accent-bg)' },
        { label: 'Pending Tasks', value: stats?.pendingTasksCount ?? 0, Icon: Clock, accent: 'var(--info)', bg: 'var(--info-bg)' },
        { label: 'Completed (Month)', value: stats?.completedTasksThisMonth ?? 0, Icon: CheckCircle2, accent: 'var(--success)', bg: 'var(--success-bg)' },
        { label: 'Due Soon', value: stats?.approachingDeadlinesCount ?? 0, Icon: AlertCircle, accent: 'var(--danger)', bg: 'var(--danger-bg)' },
        { label: 'Available Resources', value: stats?.availableResourcesCount ?? 0, Icon: Layers, accent: 'var(--text-secondary)', bg: 'var(--border-light)' },
    ];

    const isReviewer = Number(user.role) === 1 || Number(user.role) === 2 ||
        user.role === 'Admin' || user.role === 'Lab Director' || user.role === 'LabDirector';

    const quickLinks = [
        { label: 'Schedule', Icon: Calendar, path: '/schedules', color: 'var(--info)' },
        { label: 'Seminars', Icon: Presentation, path: '/seminars', color: 'var(--accent-color)' },
        { label: 'Reports', Icon: ClipboardList, path: '/reports', color: 'var(--success)' },
        { label: 'Bookings', Icon: Layers, path: '/bookings', color: 'var(--warning)' },
        { label: 'Papers', Icon: FileText, path: isReviewer ? '/paper-review' : '/papers', color: 'var(--danger)' },
        { label: 'Projects', Icon: BookOpen, path: '/projects', color: 'var(--primary-color)' },
    ];

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">
                {/* Page Header */}
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>{getGreeting()}, {user.name?.split(' ')[0] || 'Researcher'}</h1>
                        <p>Here's what's happening in your lab today.</p>
                    </div>
                </div>

                {/* Stats Row */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.75rem'
                }}>
                    {statCards.map(({ label, value, Icon, accent, bg }, i) => (
                        <div
                            key={i}
                            className="card"
                            style={{
                                padding: '1.1rem 1.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                borderLeft: `3px solid ${accent}`
                            }}
                        >
                            <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: 'var(--radius-md)',
                                background: bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: accent,
                                flexShrink: 0
                            }}>
                                <Icon size={20} />
                            </div>
                            <div>
                                <p style={{
                                    margin: 0,
                                    fontSize: '0.7rem',
                                    color: 'var(--text-secondary)',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    {label}
                                </p>
                                <p style={{
                                    margin: '2px 0 0',
                                    fontSize: '1.8rem',
                                    fontWeight: 800,
                                    color: 'var(--text-primary)',
                                    lineHeight: 1
                                }}>
                                    {loading ? '–' : value}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Content Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                    {/* Left Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>My Projects</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Link
                                        to="/projects"
                                        style={{
                                            fontSize: '0.82rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            color: 'var(--accent-color)',
                                            textDecoration: 'none',
                                            fontWeight: 600
                                        }}
                                    >
                                        View All <ArrowUpRight size={14} />
                                    </Link>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                                {loading ? (
                                    [1, 2].map(i => (
                                        <div key={i} style={{
                                            height: 150,
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--surface-hover)',
                                            border: '1px dashed var(--border-color)'
                                        }} />
                                    ))
                                ) : projects.length > 0 ? (
                                    projects.slice(0, 4).map((proj, index) => {
                                        const pid = proj.projectId || (proj as any).id || (proj as any).ProjectID;
                                        const totalTasks = proj.totalTasks ?? (proj as any).TotalTasks ?? 0;
                                        const completedTasks = proj.completedTasks ?? (proj as any).CompletedTasks ?? 0;
                                        const progress = proj.progress !== undefined
                                            ? proj.progress
                                            : (totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0);
                                        const statusStyle = getProjectStatusStyle(proj.status);

                                        return (
                                            <div
                                                key={pid || index}
                                                onClick={() => pid && navigate(`/projects/${pid}`)}
                                                className="card card-interactive"
                                                style={{
                                                    margin: 0,
                                                    padding: '1.1rem',
                                                    cursor: 'pointer',
                                                    border: '1px solid var(--border-color)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.5rem'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>
                                                        #{(proj.projectId || '').substring(0, 6).toUpperCase()}
                                                    </span>
                                                    <span className="badge" style={{
                                                        background: statusStyle.bg,
                                                        color: statusStyle.color,
                                                        fontSize: '0.65rem'
                                                    }}>
                                                        {statusStyle.label}
                                                    </span>
                                                </div>
                                                <h4 style={{
                                                    margin: 0,
                                                    fontSize: '0.92rem',
                                                    fontWeight: 700,
                                                    lineHeight: 1.35,
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}>
                                                    {proj.projectName || (proj as any).name || 'Untitled Project'}
                                                </h4>
                                                <p style={{
                                                    margin: 0,
                                                    fontSize: '0.78rem',
                                                    color: 'var(--text-secondary)',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    fontWeight: 500,
                                                    lineHeight: 1.45
                                                }}>
                                                    {proj.projectDescription || (proj as any).description || 'No description provided.'}
                                                </p>
                                                <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                                                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Progress</span>
                                                        <span style={{ fontWeight: 800, color: 'var(--accent-color)' }}>{progress}%</span>
                                                    </div>
                                                    <div className="progress-bar-track" style={{ height: '4px' }}>
                                                        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{
                                        gridColumn: '1/-1',
                                        textAlign: 'center',
                                        padding: '2.5rem 1rem',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        <BookOpen size={32} style={{ opacity: 0.25, marginBottom: '0.75rem' }} />
                                        <p style={{ margin: 0, fontWeight: 500 }}>You're not involved in any active projects yet.</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Priority Tasks */}
                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Priority Tasks</h3>
                                <Link
                                    to="/tasks"
                                    style={{
                                        fontSize: '0.82rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        color: 'var(--accent-color)',
                                        textDecoration: 'none',
                                        fontWeight: 600
                                    }}
                                >
                                    View All <ArrowUpRight size={14} />
                                </Link>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <style>{`@keyframes pulseDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}`}</style>
                                {loading ? (
                                    [1, 2, 3].map(i => (
                                        <div key={i} style={{
                                            height: 64,
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'var(--surface-hover)',
                                            border: '1px dashed var(--border-color)'
                                        }} />
                                    ))
                                ) : tasks.length > 0 ? (
                                    tasks.slice(0, 5).map((task, index) => {
                                        const daysUntilDue = task.dueDate
                                            ? (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                                            : null;
                                        const isNearDeadline = daysUntilDue !== null &&
                                            task.status !== TaskStatus.Completed &&
                                            task.status !== TaskStatus.Submitted &&
                                            daysUntilDue <= 3;

                                        return (
                                            <div
                                                key={task.taskId || `task-${index}`}
                                                onClick={() => navigate(`/tasks?selectedId=${task.taskId}`)}
                                                style={{
                                                    padding: '0.85rem 1rem',
                                                    background: 'var(--surface-hover)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: `1px solid ${isNearDeadline ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    position: 'relative',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-color)')}
                                                onMouseLeave={e => (e.currentTarget.style.borderColor = isNearDeadline ? 'rgba(239,68,68,0.3)' : 'var(--border-color)')}
                                            >
                                                {isNearDeadline && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: -4,
                                                        right: -4,
                                                        width: 10,
                                                        height: 10,
                                                        borderRadius: '50%',
                                                        background: '#ef4444',
                                                        border: '2px solid white',
                                                        boxShadow: '0 0 6px #ef4444',
                                                        animation: 'pulseDot 1s ease-in-out infinite',
                                                        zIndex: 2
                                                    }} />
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{
                                                        margin: '0 0 3px',
                                                        fontSize: '0.88rem',
                                                        fontWeight: 600,
                                                        color: 'var(--text-primary)',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {task.name}
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB') : 'No date'}</span>
                                                        <span>·</span>
                                                        <span>P{task.priority}</span>
                                                    </div>
                                                </div>
                                                <span className="badge badge-muted" style={{ marginLeft: '1rem', flexShrink: 0 }}>
                                                    {TaskStatus[task.status]}
                                                </span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p style={{ margin: 0, color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem' }}>
                                        No priority tasks found.
                                    </p>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Quick Access */}
                        <section className="card">
                            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>Quick Access</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                                {quickLinks.map(({ label, Icon, path, color }) => (
                                    <button
                                        key={path}
                                        onClick={() => navigate(path)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.55rem',
                                            padding: '0.7rem 0.85rem',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--surface-hover)',
                                            cursor: 'pointer',
                                            fontSize: '0.82rem',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                            transition: 'all 0.2s ease',
                                            textAlign: 'left'
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.borderColor = color;
                                            e.currentTarget.style.color = color;
                                            e.currentTarget.style.background = 'white';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                            e.currentTarget.style.color = 'var(--text-primary)';
                                            e.currentTarget.style.background = 'var(--surface-hover)';
                                        }}
                                    >
                                        <Icon size={15} style={{ color, flexShrink: 0 }} />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Upcoming Seminars */}
                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Upcoming Seminars</h3>
                                <Link
                                    to="/seminars"
                                    style={{
                                        fontSize: '0.82rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        color: 'var(--accent-color)',
                                        textDecoration: 'none',
                                        fontWeight: 600
                                    }}
                                >
                                    All <ArrowUpRight size={14} />
                                </Link>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {loading ? (
                                    [1, 2].map(i => (
                                        <div key={i} style={{
                                            height: 66,
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'var(--surface-hover)',
                                            border: '1px dashed var(--border-color)'
                                        }} />
                                    ))
                                ) : seminars.length > 0 ? (
                                    seminars.slice(0, 4).map((seminar, i) => {
                                        const isNext = i === 0;
                                        const date = new Date(seminar.meetingDate);
                                        return (
                                            <div
                                                key={seminar.seminarMeetingId}
                                                style={{
                                                    padding: '0.85rem 1rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    borderLeft: `3px solid ${isNext ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                                    border: `1px solid ${isNext ? 'rgba(232,114,12,0.3)' : 'var(--border-color)'}`,
                                                    borderLeftWidth: '3px',
                                                    background: isNext ? 'var(--accent-bg)' : 'var(--surface-hover)'
                                                }}
                                            >
                                                <p style={{
                                                    margin: '0 0 3px',
                                                    fontWeight: 700,
                                                    fontSize: '0.88rem',
                                                    color: 'var(--text-primary)',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    {seminar.title || 'Lab Seminar'}
                                                </p>
                                                <p style={{
                                                    margin: 0,
                                                    fontSize: '0.78rem',
                                                    color: 'var(--text-secondary)',
                                                    fontWeight: 500
                                                }}>
                                                    {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                    {' · '}{seminar.startTime?.substring(0, 5)}
                                                    {seminar.location ? ` · ${seminar.location}` : ''}
                                                </p>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '1.75rem 1rem', color: 'var(--text-muted)' }}>
                                        <Presentation size={28} style={{ opacity: 0.25, display: 'block', margin: '0 auto 0.5rem' }} />
                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>No upcoming seminars.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </div>

        </MainLayout>
    );
}

export default Dashboard;
