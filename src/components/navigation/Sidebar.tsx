import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
    LayoutDashboard,
    Briefcase,
    CheckSquare,
    Users,
    Calendar,
    FlaskConical,
    BarChart2,
    Presentation,
    Box,
    UserCog,
    FileText,
    FolderKanban,
    Server,
    UserCheck,
    ContactRound,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const Sidebar: React.FC = () => {
    const { user } = useAuth();
    const role = String(user?.role ?? '');
    const isAdmin = Number(role) === 1 || role === 'Admin';
    const isLabDirector = Number(role) === 2 || role === 'LabDirector' || role === 'Lab Director';
    const isMemberOrSenior = Number(role) === 3 || Number(role) === 4 || role === 'Member' || role === 'Senior' || role === 'SeniorResearcher' || role === 'Senior Researcher';

    const closeAINote = () => window.dispatchEvent(new CustomEvent('closeAINote'));

    const workspaceItems = [
        { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard', onNavClick: undefined as (() => void) | undefined },
        { icon: <FolderKanban size={20} />, label: "Lab's Projects", path: '/lab-projects', onNavClick: undefined },
        { icon: <Briefcase size={20} />, label: 'My Projects', path: '/projects', onNavClick: undefined },
        { icon: <CheckSquare size={20} />, label: 'Tasks', path: '/tasks', onNavClick: undefined },
        { icon: <Users size={20} />, label: 'Members', path: '/members', onNavClick: undefined },
        { icon: <BarChart2 size={20} />, label: 'Reports', path: '/reports', onNavClick: undefined },
        { icon: <FileText size={20} />, label: 'Paper Submission', path: '/papers', onNavClick: undefined },
        { icon: <Calendar size={20} />, label: 'Schedules', path: '/schedules', onNavClick: closeAINote },
        { icon: <UserCheck size={20} />, label: 'Register Visitors', path: '/visitor-registrations', onNavClick: undefined },
        { icon: <Presentation size={20} />, label: 'Seminars', path: '/seminars', onNavClick: closeAINote },
        { icon: <Box size={20} />, label: 'Booking Resource', path: '/bookings', onNavClick: undefined },
    ];

    const adminItems = [
        { icon: <UserCog size={20} />, label: 'User Management', path: '/user-management' },
        { icon: <Server size={20} />, label: 'Compute Servers', path: '/admin/compute' },
        { icon: <ContactRound size={20} />, label: 'Contactors', path: '/admin/contactors' },
    ];

    const mainItems = workspaceItems;

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <Link to="/" className="sidebar-brand" style={{ textDecoration: 'none' }}>
                    <div className="sidebar-brand-icon">
                        <FlaskConical size={20} />
                    </div>
                    <div>
                        <h2 className="sidebar-title">Researcher Space</h2>
                        <span className="sidebar-subtitle">AiTA Lab@FPTU</span>
                    </div>
                </Link>
            </div>

            <nav className="sidebar-nav">
                {(isMemberOrSenior || isLabDirector) && (
                    <>
                        <div className="sidebar-section-label">WORKSPACE</div>
                        {mainItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={item.onNavClick}
                                className={({ isActive }) =>
                                    `sidebar-link ${isActive ? 'active' : ''}`
                                }
                            >
                                <span className="sidebar-link-icon">{item.icon}</span>
                                <span className="sidebar-link-label">{item.label}</span>
                            </NavLink>
                        ))}
                    </>
                )}

                {isLabDirector && (
                    <>
                        <div className="sidebar-section-label">MANAGEMENT</div>
                        <NavLink
                            to="/admin/contactors"
                            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                        >
                            <span className="sidebar-link-icon"><ContactRound size={20} /></span>
                            <span className="sidebar-link-label">Contactors</span>
                        </NavLink>
                    </>
                )}

                {isAdmin && (
                    <>
                        <div className="sidebar-section-label">WORKSPACE</div>
                        {adminItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `sidebar-link ${isActive ? 'active' : ''}`
                                }
                            >
                                <span className="sidebar-link-icon">{item.icon}</span>
                                <span className="sidebar-link-label">{item.label}</span>
                            </NavLink>
                        ))}
                    </>
                )}

            </nav>

            <div style={{
                padding: '1rem 1.25rem',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
            }}>
                <Link to="/" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'none' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-color)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                    Homepage
                </Link>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Link to="/privacy" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'none' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-color)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                        Privacy Policy
                    </Link>
                    <span style={{ fontSize: '0.7rem', color: 'var(--border-color)' }}>·</span>
                    <Link to="/terms" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'none' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-color)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                        Terms of Service
                    </Link>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
