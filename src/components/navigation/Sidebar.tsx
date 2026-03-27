import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Briefcase,
    CheckSquare,
    Users,
    Calendar,
    BarChart2,
    Presentation,
    Box,
    UserCog,
    FileText,
    FileSearch,
    Library
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const Sidebar: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'Admin' || user?.role === 'LabDirector';

    const navItems = [
        { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
        { icon: <Library size={20} />, label: 'Project in Lab', path: '/home' },
        { icon: <Briefcase size={20} />, label: 'My Projects', path: '/projects' },
        { icon: <CheckSquare size={20} />, label: 'Tasks', path: '/tasks' },
        { icon: <FileText size={20} />, label: 'Papers', path: '/papers' },
        { icon: <Users size={20} />, label: 'Members', path: '/members' },
        { icon: <BarChart2 size={20} />, label: 'Reports', path: '/reports' },
        { icon: <Box size={20} />, label: 'Booking Resource', path: '/bookings' },
        { icon: <Calendar size={20} />, label: 'Schedules', path: '/schedules' },
        { icon: <Presentation size={20} />, label: 'Seminars', path: '/seminars' },
    ];

    return (
        <aside className="sidebar">
            <nav className="sidebar-nav">
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

                {isAdmin && (
                    <>
                        <div className="sidebar-section-label" style={{ marginTop: '0.5rem' }}>ADMINISTRATION</div>
                        <NavLink
                            to="/user-management"
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                        >
                            <span className="sidebar-link-icon"><UserCog size={20} /></span>
                            <span className="sidebar-link-label">User Management</span>
                        </NavLink>
                        <NavLink
                            to="/paper-review"
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                        >
                            <span className="sidebar-link-icon"><FileSearch size={20} /></span>
                            <span className="sidebar-link-label">Paper Review</span>
                        </NavLink>
                    </>
                )}
            </nav>
        </aside>
    );
};

export default Sidebar;
