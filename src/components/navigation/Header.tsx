import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bell, LogIn, LogOut, UserCircle, FlaskConical, CheckCheck, Trash2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { SystemRoleMap } from '@/types/enums';
import { notificationService, Notification } from '@/services/notificationService';

const Header: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated, logout } = useAuth();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [imgError, setImgError] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const notiRef = useRef<HTMLDivElement>(null);

    const [showNotiPanel, setShowNotiPanel] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notiLoading, setNotiLoading] = useState(false);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const count = await notificationService.getUnreadCount();
            setUnreadCount(count);
        } catch {
            // silently fail
        }
    }, []);

    const fetchNotifications = useCallback(async () => {
        setNotiLoading(true);
        try {
            const result = await notificationService.getNotifications(0, 20);
            setNotifications(result.items);
        } catch {
            setNotifications([]);
        } finally {
            setNotiLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 60000);
        return () => clearInterval(interval);
    }, [isAuthenticated, fetchUnreadCount]);

    const handleOpenNoti = () => {
        const next = !showNotiPanel;
        setShowNotiPanel(next);
        if (next) fetchNotifications();
    };

    const handleMarkAsRead = async (id: string) => {
        await notificationService.markAsRead(id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const handleMarkAllAsRead = async () => {
        await notificationService.markAllAsRead();
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
    };

    const handleDeleteNotification = async (id: string) => {
        const noti = notifications.find(n => n.id === id);
        await notificationService.deleteNotification(id);
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (noti && !noti.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const handleDeleteAll = async () => {
        await notificationService.deleteAllNotifications();
        setNotifications([]);
        setUnreadCount(0);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
            if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
                setShowNotiPanel(false);
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
                        <div ref={notiRef} style={{ position: 'relative' }}>
                            <button className="header-icon-btn" onClick={handleOpenNoti} style={{ position: 'relative' }}>
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span style={{
                                        position: 'absolute', top: '4px', right: '4px',
                                        background: '#ef4444', color: 'white',
                                        borderRadius: '50%', fontSize: '0.65rem', fontWeight: 700,
                                        minWidth: '16px', height: '16px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        lineHeight: 1, padding: '0 3px',
                                    }}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {showNotiPanel && (
                                <div className="card" style={{
                                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                                    width: '360px', maxHeight: '480px', zIndex: 1002,
                                    boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column',
                                    overflow: 'hidden',
                                }}>
                                    {/* Header */}
                                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Notifications</span>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {unreadCount > 0 && (
                                                <button onClick={handleMarkAllAsRead} title="Đánh dấu tất cả đã đọc" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', padding: '2px 6px', borderRadius: '4px' }}>
                                                    <CheckCheck size={14} /> Mark all read
                                                </button>
                                            )}
                                            {notifications.length > 0 && (
                                                <button onClick={handleDeleteAll} title="Delete all" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', padding: '2px 6px', borderRadius: '4px' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* List */}
                                    <div style={{ overflowY: 'auto', flex: 1 }}>
                                        {notiLoading ? (
                                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</div>
                                        ) : notifications.length === 0 ? (
                                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No notifications</div>
                                        ) : notifications.map(noti => (
                                            <div key={noti.id} style={{
                                                padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
                                                background: noti.isRead ? 'transparent' : 'var(--accent-bg, rgba(99,102,241,0.06))',
                                                display: 'flex', gap: '10px', alignItems: 'flex-start',
                                            }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    {noti.title && <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: noti.isRead ? 400 : 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{noti.title}</p>}
                                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: noti.title ? '2px' : 0 }}>{noti.message}</p>
                                                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(noti.createdAtUtc).toLocaleString('en-GB')}</p>
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                    {!noti.isRead && (
                                                        <button onClick={() => handleMarkAsRead(noti.id)} title="Mark as read" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)', padding: '2px', borderRadius: '4px' }}>
                                                            <CheckCheck size={14} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleDeleteNotification(noti.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', borderRadius: '4px' }}>
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        
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

