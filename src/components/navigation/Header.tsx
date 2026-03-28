import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bell, LogIn, LogOut, Settings, UserCircle, FlaskConical } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { SystemRoleEnum, SystemRoleMap } from '@/types/enums';

const Header: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated, logout } = useAuth();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [imgError, setImgError] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    const isLabDirector = Number(user.role) === SystemRoleEnum.Admin || Number(user.role) === SystemRoleEnum.LabDirector;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await logout();
        setShowUserMenu(false);
    };

    return (
        <header className="top-header">
            <div className="header-left">
                <Link to="/dashboard" className="header-brand-link" style={{ textDecoration: 'none' }}>
                    <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="header-brand-icon" style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: 'var(--accent-color)'
                        }}>
                            <FlaskConical size={24} />
                        </div>
                        <h2 className="header-logo-text" style={{ 
                            margin: 0, 
                            lineHeight: 1,
                            display: 'flex',
                            alignItems: 'center'
                        }}>LabSync</h2>
                    </div>
                </Link>
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
                                <div className="header-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                                    {user.avatarUrl && !imgError ? (
                                        <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" onError={() => setImgError(true)} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, var(--accent-color), var(--accent-light))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem' }}>
                                            {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                                        </div>
                                    )}
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

