import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Briefcase,
    CheckSquare,
    Users,
    Calendar,
    Terminal,
    Library
} from 'lucide-react';

const Sidebar: React.FC = () => {
    const navItems = [
        { icon: <Library size={20} />, label: 'Public Home', path: '/' },
        { type: 'divider', label: 'WORK RESEARCHER SPACE' },
        { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
        { icon: <Briefcase size={20} />, label: 'My Projects', path: '/projects' },
        { icon: <CheckSquare size={20} />, label: 'Tasks', path: '/tasks' },
        { icon: <Calendar size={20} />, label: 'Meetings', path: '/meetings' },
        { icon: <Users size={20} />, label: 'Members', path: '/members' },
    ];

    return (
        <aside className="sidebar">
            <div style={{ padding: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>AiTA Lab@FPTU</h2>
            </div>

            <nav style={{ padding: '1rem 0' }}>
                {navItems.map((item, index) => {
                    if (item.type === 'divider') {
                        return (
                            <div key={`divider-${index}`} style={{
                                padding: '1.5rem 2rem 0.5rem',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                color: 'rgba(255,255,255,0.4)',
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}>
                                {item.label}
                            </div>
                        );
                    }
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path || '/'}
                            style={({ isActive }) => ({
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '0.8rem 2rem',
                                color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
                                background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                                borderLeft: isActive ? '4px solid var(--accent-color)' : '4px solid transparent',
                                textDecoration: 'none',
                                fontSize: '0.9rem',
                                transition: 'all 0.2s'
                            })}
                        >
                            {item.icon}
                            {item.label}
                        </NavLink>
                    );
                })}
            </nav>

            <div style={{ position: 'absolute', bottom: '1rem', width: '100%' }}>
                <NavLink
                    to="/dev/login"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '0.8rem 2rem',
                        color: 'rgba(255,255,255,0.4)',
                        textDecoration: 'none',
                        fontSize: '0.8rem'
                    }}
                >
                    <Terminal size={16} />
                    Dev Token Manager
                </NavLink>
            </div>
        </aside>
    );
};

export default Sidebar;
