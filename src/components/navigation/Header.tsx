import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { User, Bell, Search, Library, FlaskConical, LogIn, LogOut, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import UserFormModal from '@/features/users/UserFormModal';

const Header: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, isAuthenticated, logout } = useAuth();
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);

    const workspaceRoutes = ['/dashboard', '/projects', '/tasks', '/meetings', '/members'];
    const isInWorkspace = workspaceRoutes.some(route => location.pathname.startsWith(route));

    const navItems = [
        { label: 'Home Page', path: '/home', icon: <Library size={18} /> },
        { label: 'Work Researcher Space', path: '/dashboard', icon: <FlaskConical size={18} /> },
    ];

    const handleLogout = async () => {
        await logout();
    };

    return (
        <header className="top-header">
            <div className="header-left">
                <div className="header-brand">
                    <h2 className="header-logo-text">AiTA Lab</h2>
                </div>

                <nav className="header-nav">
                    {navItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'}
                            className={({ isActive }) => {
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
                {isAuthenticated ? (
                    <>
                        {(user?.role === 'Admin' || user?.role === 'LabDirector') && (
                            <button 
                                className="header-icon-btn" 
                                onClick={() => setIsUserModalOpen(true)}
                                title="Add New User"
                                style={{ color: 'var(--primary-color)' }}
                            >
                                <UserPlus size={20} />
                            </button>
                        )}
                        <button className="header-icon-btn">
                            <Bell size={20} />
                        </button>
                        <div className="header-user">
                            <div className="header-user-info">
                                <span className="header-user-name">{user.name}</span>
                                <span className="header-user-role">{user.role}</span>
                            </div>
                            <div className="header-avatar">
                                <User size={18} />
                            </div>
                        </div>
                        <button
                            className="header-icon-btn"
                            onClick={handleLogout}
                            title="Đăng xuất"
                            style={{ marginLeft: '4px', color: '#ef4444' }}
                        >
                            <LogOut size={18} />
                        </button>
                    </>
                ) : (
                    <button
                        className="btn btn-primary"
                        onClick={() => navigate('/login')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 20px', fontSize: '0.85rem',
                        }}
                    >
                        <LogIn size={16} />
                        Đăng nhập
                    </button>
                )}
            </div>
            
            <UserFormModal 
                isOpen={isUserModalOpen} 
                onClose={() => setIsUserModalOpen(false)} 
                onSuccess={() => {
                    // Optional: show a success toast or dispatch an event that user was added
                }}
            />
        </header>
    );
};

export default Header;
