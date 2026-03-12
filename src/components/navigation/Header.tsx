import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { User, Bell, Search, Library, FlaskConical } from 'lucide-react';

interface HeaderProps {
    role: string;
    userName: string;
}

const Header: React.FC<HeaderProps> = ({ role, userName }) => {
    const location = useLocation();

    // Determine if the current page is within the workspace
    const workspaceRoutes = ['/dashboard', '/projects', '/tasks', '/meetings', '/members'];
    const isInWorkspace = workspaceRoutes.some(route => location.pathname.startsWith(route));

    const navItems = [
        { label: 'Home Page', path: '/', icon: <Library size={18} /> },
        { label: 'Work Researcher Space', path: '/dashboard', icon: <FlaskConical size={18} /> },
    ];

    return (
        <header className="top-header">
            <div className="header-left">
                {/* Logo / Brand */}
                <div className="header-brand">
                    <h2 className="header-logo-text">AiTA Lab</h2>
                </div>

                {/* Navigation Links */}
                <nav className="header-nav">
                    {navItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'}
                            className={({ isActive }) => {
                                // For workspace link, highlight if we're on any workspace route
                                const active = item.path === '/'
                                    ? isActive
                                    : isInWorkspace;
                                return `header-nav-link ${active ? 'active' : ''}`;
                            }}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
            </div>

            <div className="header-center">
                {/* Search Bar */}
                <div className="header-search">
                    <Search size={16} className="header-search-icon" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="header-search-input"
                    />
                </div>
            </div>

            <div className="header-right">
                {/* Right Side Actions */}
                <button className="header-icon-btn">
                    <Bell size={20} />
                </button>
                <div className="header-user">
                    <div className="header-user-info">
                        <span className="header-user-name">{userName}</span>
                        <span className="header-user-role">{role}</span>
                    </div>
                    <div className="header-avatar">
                        <User size={18} />
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
