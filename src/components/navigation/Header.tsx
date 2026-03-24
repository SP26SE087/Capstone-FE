import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import { User, Bell, Search, Library, FlaskConical, LogIn, LogOut, Settings, UserCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { SystemRoleEnum, SystemRoleMap } from '@/types/enums';

const Header: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, isAuthenticated, logout } = useAuth();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    // System Roles: Admin = 1, LabDirector = 2
    const isLabDirector = Number(user.role) === SystemRoleEnum.Admin || Number(user.role) === SystemRoleEnum.LabDirector;

    const workspaceRoutes = ['/dashboard', '/projects', '/tasks', '/meetings', '/members', '/bookings', '/admin', '/user-management'];
    const isInWorkspace = workspaceRoutes.some(route => location.pathname.startsWith(route));

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const navItems = [
        { label: 'Home Page', path: '/home', icon: <Library size={18} /> },
        { label: 'Work Researcher Space', path: '/dashboard', icon: <FlaskConical size={18} /> },
    ];

    const handleLogout = async () => {
        await logout();
        setShowUserMenu(false);
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
                        <button className="header-icon-btn">
                            <Bell size={20} />
                        </button>
                        
                        <div className="header-user-container" ref={menuRef} style={{ position: 'relative' }}>
                            <div 
                                className={`header-user ${showUserMenu ? 'active' : ''}`}
                                onClick={() => setShowUserMenu(!showUserMenu)}
                            >
                                <div className="header-user-info">
                                    <span className="header-user-name">{user.name}</span>
                                    <span className="header-user-role">{SystemRoleMap[user.role] || user.role}</span>
                                </div>
                                <div className="header-avatar">
                                    <User size={18} />
                                </div>
                            </div>

                            {showUserMenu && (
                                <div className="user-dropdown-menu card" style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 8px)',
                                    right: 0,
                                    width: '240px',
                                    padding: '8px',
                                    zIndex: 1002,
                                    boxShadow: 'var(--shadow-lg)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px'
                                }}>
                                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{user.name}</p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</p>
                                    </div>

                                    <Link to="/profile" className="dropdown-link" style={{ 
                                        display: 'flex', alignItems: 'center', gap: '10px', 
                                        padding: '10px 12px', borderRadius: '4px', fontSize: '0.875rem', color: 'var(--text-primary)'
                                    }}>
                                        <UserCircle size={18} style={{ color: 'var(--text-muted)' }} />
                                        <span>My Profile</span>
                                    </Link>

                                    {isLabDirector && (
                                        <Link to="/admin/resources" className="dropdown-link" style={{ 
                                            display: 'flex', alignItems: 'center', gap: '10px', 
                                            padding: '10px 12px', borderRadius: '4px', fontSize: '0.875rem', color: 'var(--text-primary)'
                                        }}>
                                            <Settings size={18} style={{ color: 'var(--text-muted)' }} />
                                            <span>Resource Management</span>
                                        </Link>
                                    )}

                                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                                    
                                    <button 
                                        onClick={handleLogout}
                                        className="dropdown-link" 
                                        style={{ 
                                            display: 'flex', alignItems: 'center', gap: '10px', width: '100%', border: 'none', background: 'none', cursor: 'pointer',
                                            padding: '10px 12px', borderRadius: '4px', fontSize: '0.875rem', color: '#ef4444', textAlign: 'left'
                                        }}
                                    >
                                        <LogOut size={18} />
                                        <span>Log Out</span>
                                    </button>
                                </div>
                            )}
                        </div>
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
        </header>
    );
};

export default Header;

