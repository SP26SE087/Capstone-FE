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
} from 'lucide-react';

const Sidebar: React.FC = () => {
    const navItems = [
        { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
        { icon: <Briefcase size={20} />, label: 'My Projects', path: '/projects' },
        { icon: <CheckSquare size={20} />, label: 'Tasks', path: '/tasks' },
        { icon: <Calendar size={20} />, label: 'Schedules', path: '/schedules' },
        { icon: <Presentation size={20} />, label: 'Seminars', path: '/seminars' },
        { icon: <Users size={20} />, label: 'Members', path: '/members' },
        { icon: <BarChart2 size={20} />, label: 'Reports', path: '/reports' },
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
            </nav>


        </aside>
    );
};

export default Sidebar;
