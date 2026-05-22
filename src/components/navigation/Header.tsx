import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Bell, LogIn, LogOut, UserCircle, FlaskConical,
    CheckCheck, Trash2, X, Forward,
    AlertTriangle, Eye, Info, Camera,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { SystemRoleMap, SystemRoleEnum } from '@/types/enums';
import { notificationService, Notification } from '@/services/notificationService';
import ForwardToMemberModal from './ForwardToMemberModal';
import * as signalR from '@microsoft/signalr';

// ── Helpers ───────────────────────────────────────────────────────────────────

const relativeTime = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'Just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// type 8 = CameraUnknownDetected (amber), type 9 = CameraActionRequest (blue), else indigo
const notiMeta = (type?: number): { icon: React.ReactNode; color: string; bg: string } => {
    if (type === 8)  return { icon: <AlertTriangle size={13} />, color: '#d97706', bg: '#fef3c7' };
    if (type === 9)  return { icon: <Eye size={13} />,           color: '#0284c7', bg: '#e0f2fe' };
    if (type === 10) return { icon: <Camera size={13} />,        color: '#7c3aed', bg: '#ede9fe' };
    return             { icon: <Info size={13} />,               color: '#6366f1', bg: '#eef2ff' };
};

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

    // Forward-to-member modal state
    const [forwardNotif, setForwardNotif] = useState<Notification | null>(null);

    const isDirectorOrAdmin = isAuthenticated && (
        Number(user?.role) === SystemRoleEnum.LabDirector ||
        Number(user?.role) === SystemRoleEnum.Admin
    );

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

    // ── SignalR real-time push ────────────────────────────────────────────────
    useEffect(() => {
        if (!isAuthenticated) return;
        const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
        if (!token) return;

        const apiBase = (import.meta.env.VITE_API_BASE_URL as string || 'https://api.labsyncs.com').replace(/\/$/, '');
        const connection = new signalR.HubConnectionBuilder()
            .withUrl(`${apiBase}/hubs/notifications`, {
                accessTokenFactory: () => localStorage.getItem('token') || sessionStorage.getItem('token') || '',
            })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        connection.on('notificationCreated', (notif: Notification) => {
            setNotifications(prev => [notif, ...prev]);
            setUnreadCount(prev => prev + 1);
        });

        connection.start().catch(() => { /* silently fail — polling is fallback */ });

        return () => { connection.stop(); };
    }, [isAuthenticated]);

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
        <>
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
                            <button
                                className="header-icon-btn"
                                onClick={handleOpenNoti}
                                style={{ position: 'relative' }}
                                aria-label="Notifications"
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span style={{
                                        position: 'absolute', top: '2px', right: '2px',
                                        background: '#ef4444', color: 'white',
                                        borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700,
                                        minWidth: '17px', height: '17px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        lineHeight: 1, padding: '0 4px',
                                        boxShadow: '0 0 0 2px white',
                                    }}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {showNotiPanel && (
                                <div style={{
                                    position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                                    width: 400, maxHeight: 540,
                                    background: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 16,
                                    boxShadow: '0 20px 60px -10px rgba(0,0,0,0.18), 0 4px 16px -4px rgba(0,0,0,0.08)',
                                    display: 'flex', flexDirection: 'column',
                                    overflow: 'hidden',
                                    zIndex: 1002,
                                    animation: 'notiSlideIn 0.18s ease-out',
                                }}>
                                    {/* ── Panel header ── */}
                                    <div style={{
                                        padding: '14px 16px 12px',
                                        borderBottom: '1px solid #f1f5f9',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        flexShrink: 0,
                                        background: 'white',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Notifications</span>
                                            {unreadCount > 0 && (
                                                <span style={{
                                                    background: '#ef4444', color: 'white',
                                                    borderRadius: 999, fontSize: '0.65rem', fontWeight: 700,
                                                    padding: '1px 7px', lineHeight: '18px',
                                                }}>
                                                    {unreadCount}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                            {unreadCount > 0 && (
                                                <button
                                                    onClick={handleMarkAllAsRead}
                                                    title="Mark all as read"
                                                    style={{
                                                        background: 'none', border: '1px solid #e2e8f0', cursor: 'pointer',
                                                        color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4,
                                                        fontSize: '0.75rem', fontWeight: 600,
                                                        padding: '4px 8px', borderRadius: 8,
                                                        transition: 'background 0.15s',
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f3ff')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                                >
                                                    <CheckCheck size={13} /> Mark all read
                                                </button>
                                            )}
                                            {notifications.length > 0 && (
                                                <button
                                                    onClick={handleDeleteAll}
                                                    title="Delete all"
                                                    style={{
                                                        background: 'none', border: '1px solid #fecaca',
                                                        cursor: 'pointer', color: '#ef4444',
                                                        display: 'flex', alignItems: 'center',
                                                        padding: '4px 7px', borderRadius: 8,
                                                        transition: 'background 0.15s',
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── List ── */}
                                    <div style={{ overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                                        {notiLoading ? (
                                            /* Skeleton */
                                            <div style={{ padding: '8px 0' }}>
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f1f5f9', flexShrink: 0 }} />
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            <div style={{ height: 12, borderRadius: 6, background: '#f1f5f9', width: '60%' }} />
                                                            <div style={{ height: 10, borderRadius: 6, background: '#f8fafc', width: '85%' }} />
                                                            <div style={{ height: 9, borderRadius: 6, background: '#f8fafc', width: '35%' }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : notifications.length === 0 ? (
                                            <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Bell size={22} style={{ color: '#94a3b8' }} />
                                                </div>
                                                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem', color: '#475569' }}>You're all caught up!</p>
                                                <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>No new notifications at the moment.</p>
                                            </div>
                                        ) : notifications.map(noti => {
                                            const meta = notiMeta(noti.type);
                                            return (
                                                <div
                                                    key={noti.id}
                                                    style={{
                                                        padding: '11px 14px',
                                                        display: 'flex', gap: 11, alignItems: 'flex-start',
                                                        borderBottom: '1px solid #f8fafc',
                                                        background: noti.isRead ? 'transparent' : 'rgba(99,102,241,0.04)',
                                                        borderLeft: noti.isRead ? '3px solid transparent' : `3px solid ${meta.color}`,
                                                        transition: 'background 0.15s',
                                                        cursor: 'default',
                                                        position: 'relative',
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = noti.isRead ? 'transparent' : 'rgba(99,102,241,0.04)')}
                                                >
                                                    {/* Type icon or image */}
                                                    {noti.imageUrl ? (
                                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                                            <img
                                                                src={noti.imageUrl}
                                                                alt="detection"
                                                                style={{
                                                                    width: 44, height: 44, borderRadius: 10,
                                                                    objectFit: 'cover',
                                                                    border: `2px solid ${meta.bg}`,
                                                                    display: 'block',
                                                                }}
                                                            />
                                                            <span style={{
                                                                position: 'absolute', bottom: -4, right: -4,
                                                                width: 18, height: 18, borderRadius: '50%',
                                                                background: meta.color, color: 'white',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                boxShadow: '0 0 0 2px white',
                                                            }}>
                                                                {meta.icon}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div style={{
                                                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                                            background: meta.bg, color: meta.color,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        }}>
                                                            {meta.icon}
                                                        </div>
                                                    )}

                                                    {/* Content */}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        {noti.title && (
                                                            <p style={{
                                                                margin: 0, fontSize: '0.82rem',
                                                                fontWeight: noti.isRead ? 500 : 700,
                                                                color: '#0f172a',
                                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                            }}>
                                                                {noti.title}
                                                            </p>
                                                        )}
                                                        <p style={{
                                                            margin: '2px 0 0', fontSize: '0.775rem',
                                                            color: '#64748b', lineHeight: 1.45,
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: 'vertical',
                                                            overflow: 'hidden',
                                                        }}>
                                                            {noti.message}
                                                        </p>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                                            {noti.location && (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                                                    fontSize: '0.68rem', fontWeight: 600,
                                                                    color: meta.color, background: meta.bg,
                                                                    padding: '1px 6px', borderRadius: 999,
                                                                }}>
                                                                    📍 {noti.location}
                                                                </span>
                                                            )}
                                                            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                                                                {relativeTime(noti.createdAtUtc)}
                                                            </span>
                                                            {!noti.isRead && (
                                                                <span style={{
                                                                    width: 6, height: 6, borderRadius: '50%',
                                                                    background: meta.color, display: 'inline-block',
                                                                }} />
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                                                        {noti.type === 8 && noti.imageUrl && isDirectorOrAdmin && (
                                                            <button
                                                                onClick={() => { setForwardNotif(noti); setShowNotiPanel(false); }}
                                                                title="Forward to a member"
                                                                style={{
                                                                    background: '#fef3c7', border: 'none', cursor: 'pointer',
                                                                    color: '#d97706', padding: '4px', borderRadius: 6,
                                                                    display: 'flex', alignItems: 'center',
                                                                    transition: 'background 0.15s',
                                                                }}
                                                                onMouseEnter={e => (e.currentTarget.style.background = '#fde68a')}
                                                                onMouseLeave={e => (e.currentTarget.style.background = '#fef3c7')}
                                                            >
                                                                <Forward size={13} />
                                                            </button>
                                                        )}
                                                        {!noti.isRead && (
                                                            <button
                                                                onClick={() => handleMarkAsRead(noti.id)}
                                                                title="Mark as read"
                                                                style={{
                                                                    background: '#eef2ff', border: 'none', cursor: 'pointer',
                                                                    color: '#6366f1', padding: '4px', borderRadius: 6,
                                                                    display: 'flex', alignItems: 'center',
                                                                    transition: 'background 0.15s',
                                                                }}
                                                                onMouseEnter={e => (e.currentTarget.style.background = '#e0e7ff')}
                                                                onMouseLeave={e => (e.currentTarget.style.background = '#eef2ff')}
                                                            >
                                                                <CheckCheck size={13} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDeleteNotification(noti.id)}
                                                            title="Delete"
                                                            style={{
                                                                background: 'none', border: 'none', cursor: 'pointer',
                                                                color: '#cbd5e1', padding: '4px', borderRadius: 6,
                                                                display: 'flex', alignItems: 'center',
                                                                transition: 'all 0.15s',
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#cbd5e1'; }}
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
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
                        Sign In
                    </button>
                )}
            </div>
        </header>

        {/* Forward-to-member modal */}
        {forwardNotif && forwardNotif.imageUrl && (
            <ForwardToMemberModal
                isOpen={true}
                imageUrl={forwardNotif.imageUrl}
                onClose={() => setForwardNotif(null)}
                onForwarded={(_name) => {
                    setForwardNotif(null);
                }}
            />
        )}
        </>
    );
};

export default Header;

