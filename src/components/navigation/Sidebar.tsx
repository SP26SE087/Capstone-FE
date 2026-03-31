import React from 'react';
import { NavLink } from 'react-router-dom';
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
    FileSearch,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const Sidebar: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user && (Number(user.role) === 1 || user.role === 'Admin');
    const isLabDirector = user && (Number(user.role) === 2 || user.role === 'LabDirector');
    const isMemberOrSenior = user && (Number(user.role) === 3 || Number(user.role) === 4 || user.role === 'Member' || user.role === 'Senior');

    const navItems = [
        { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
        { icon: <Briefcase size={20} />, label: 'My Projects', path: '/projects' },
        { icon: <CheckSquare size={20} />, label: 'Tasks', path: '/tasks' },
        ...(isMemberOrSenior ? [{ icon: <FileText size={20} />, label: 'PaperSubmissions', path: '/papers' }] : []),
        { icon: <Users size={20} />, label: 'Members', path: '/members' },
        { icon: <BarChart2 size={20} />, label: 'Reports', path: '/reports' },
        { icon: <Box size={20} />, label: 'Booking Resource', path: '/bookings' },
        { icon: <Calendar size={20} />, label: 'Schedules', path: '/schedules' },
        { icon: <Presentation size={20} />, label: 'Seminars', path: '/seminars' },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-brand">
                    <div className="sidebar-brand-icon">
                        <FlaskConical size={20} />
                    </div>
                    <div>
                        <h2 className="sidebar-title">Researcher Space</h2>
                        <span className="sidebar-subtitle">AiTA Lab@FPTU</span>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-section-label">WORKSPACE</div>
                {navItems.map((item) => (
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

                {(isAdmin || isLabDirector) && (
                    <>
                        <div className="sidebar-section-label" style={{ marginTop: '0.5rem' }}>ADMINISTRATION</div>
                        {isAdmin && (
                            <NavLink
                                to="/user-management"
                                className={({ isActive }) =>
                                    `sidebar-link ${isActive ? 'active' : ''}`
                                }
                            >
                                <span className="sidebar-link-icon"><UserCog size={20} /></span>
                                <span className="sidebar-link-label">User Management</span>
                            </NavLink>
                        )}
                        {isLabDirector && (
                            <NavLink
                                to="/paper-review"
                                className={({ isActive }) =>
                                    `sidebar-link ${isActive ? 'active' : ''}`
                                }
                            >
                                <span className="sidebar-link-icon"><FileSearch size={20} /></span>
                                <span className="sidebar-link-label">Paper Review</span>
                            </NavLink>
                        )}
                    </>
                )}
            </nav>
        </aside>
    );
};

export default Sidebar;
