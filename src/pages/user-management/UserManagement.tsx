import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { userService, AddUserRequest } from '@/services/userService';
import {
    Users, Shield, CheckCircle, XCircle, Eye, EyeOff,
    Search, Edit2, Power, UserPlus, Mail, Calendar,
    ChevronDown, ChevronRight, Loader2, AlertTriangle, X
} from 'lucide-react';

const getRoleBadgeConfig = (role: number | string) => {
    const roleStr = String(role);
    if (roleStr === '1' || roleStr === 'Admin') return { label: 'Admin', color: '#ef4444', bg: '#fef2f2' };
    if (roleStr === '2' || roleStr === 'Lab Director') return { label: 'Lab Director', color: '#e8720c', bg: 'rgba(232, 114, 12, 0.08)' };
    if (roleStr === '3' || roleStr === 'Senior Researcher') return { label: 'Senior Researcher', color: '#3b82f6', bg: '#eff6ff' };
    return { label: 'Member', color: '#10b981', bg: '#ecfdf5' };
};

const UserManagement: React.FC = () => {
    const { user } = useAuth();
    const currentUserId = String((user as any)?.userId || (user as any)?.id || '');
    const isAdmin = user?.role === 'Admin' || Number((user as any)?.role) === 1;

    // Data states
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [activeRoleFilter, setActiveRoleFilter] = useState<number | 'all'>('all');
    const [showEmails, setShowEmails] = useState(false); // Privacy toggle

    // UI States
    const [showAddForm, setShowAddForm] = useState(false);
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    // Form states
    const [formData, setFormData] = useState({ email: '', fullName: '', role: 4 });
    const [editData, setEditData] = useState({ fullName: '', role: 4, isActive: true });

    // Pagination
    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ type, message });
    };

    useEffect(() => { loadMembers(); }, []);
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(timer);
    }, [toast]);

    const loadMembers = async () => {
        try {
            setLoading(true); setError(null);
            const data = await userService.getAll();
            setMembers(data);
        } catch (err) {
            console.error('Error loading members:', err);
            setError((err as any)?.message || 'Failed to load user list. Please ensure the backend is running.');
        } finally {
            setLoading(false);
        }
    };

    const filteredMembers = useMemo(() => {
        let result = members;
        if (activeRoleFilter !== 'all') {
            result = result.filter(m => Number(m.role) === activeRoleFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(m =>
                (m.fullName || '').toLowerCase().includes(q) ||
                (m.email || '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [members, searchQuery, activeRoleFilter]);

    // Stats
    const stats = {
        total: members.length,
        admins: members.filter(m => Number(m.role) === 1).length,
        active: members.filter(m => m.isActive !== false).length,
        inactive: members.filter(m => m.isActive === false).length
    };

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
    const pagedMembers = filteredMembers.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);
    const showingFrom = filteredMembers.length === 0 ? 0 : (pageIndex - 1) * pageSize + 1;
    const showingTo = Math.min(filteredMembers.length, pageIndex * pageSize);

    const maskEmail = (email: string) => {
        if (showEmails) return email;
        const [user, domain] = (email || '').split('@');
        if (!user || !domain) return '***@***';
        return `${user.substring(0, 2)}***@${domain}`;
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoadingId('new');
        try {
            const newUser = await userService.addUser(formData as AddUserRequest);
            setMembers(prev => [...prev, newUser]);
            setFormData({ email: '', fullName: '', role: 4 });
            setShowAddForm(false);
            showToast('User added successfully.');
        } catch (err: any) {
            showToast(err.response?.data?.message || 'Failed to add user.', 'error');
        } finally { setActionLoadingId(null); }
    };

    const handleToggleStatus = async (m: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const uid = m.userId || m.id;
        if (String(uid) === currentUserId) return showToast('Cannot deactivate yourself.', 'error');

        setActionLoadingId(String(uid));
        try {
            const nextActive = m.isActive === false;
            await userService.updateUser(uid, { isActive: nextActive });
            setMembers(prev => prev.map(u => (u.userId || u.id) === uid ? { ...u, isActive: nextActive } : u));
            showToast(`User ${nextActive ? 'activated' : 'deactivated'} successfully.`);
        } catch (err) { showToast('Update status failed.', 'error'); }
        finally { setActionLoadingId(null); }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUserId) return;
        setActionLoadingId(editingUserId);
        try {
            const updated = await userService.updateUser(editingUserId, editData);
            setMembers(prev => prev.map(u => (u.userId || u.id) === editingUserId ? { ...u, ...updated } : u));
            setEditingUserId(null);
            showToast('User updated successfully.');
        } catch (err) { showToast('Update failed.', 'error'); }
        finally { setActionLoadingId(null); }
    };

    const startEditing = (m: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const uid = m.userId || m.id;
        setExpandedUserId(uid);
        setEditingUserId(uid);
        setEditData({ fullName: m.fullName, role: Number(m.role), isActive: m.isActive !== false });
    };

    return (
        <MainLayout>
            <div className="page-container" style={{ margin: '0 auto' }}>
                {/* Toast Notification */}
                {toast && (
                    <div style={{
                        position: 'fixed', top: '80px', right: '24px', zIndex: 1100,
                        background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
                        color: toast.type === 'success' ? '#166534' : '#991b1b',
                        border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                        padding: '12px 20px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600
                    }}>
                        {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                        {toast.message}
                    </div>
                )}

                {/* Page Header */}
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>User Management</h1>
                        <p>Manage laboratory members, roles and access permissions.</p>
                    </div>
                    <button
                        className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ borderRadius: '12px', height: '48px', padding: '0 1.5rem' }}
                        onClick={() => setShowAddForm(!showAddForm)}
                    >
                        {showAddForm ? <X size={20} /> : <UserPlus size={20} />}
                        {showAddForm ? 'Close Form' : 'Add Member'}
                    </button>
                </div>

                {/* Stat Widgets */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                    {[
                        { label: 'Total Users', value: stats.total, icon: <Users size={22} />, color: '#6366f1', bg: '#eef2ff' },
                        { label: 'Admins', value: stats.admins, icon: <Shield size={22} />, color: '#ef4444', bg: '#fef2f2' },
                        { label: 'Active', value: stats.active, icon: <CheckCircle size={22} />, color: '#10b981', bg: '#ecfdf5' },
                        { label: 'Disabled', value: stats.inactive, icon: <XCircle size={22} />, color: '#94a3b8', bg: '#f1f5f9' },
                    ].map((s, i) => (
                        <div key={i} className="card stat-widget" style={{ marginBottom: 0 }}>
                            <div className="stat-widget-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                            <div>
                                <p className="stat-widget-label">{s.label}</p>
                                <p className="stat-widget-value">{loading ? '...' : s.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add User Form */}
                {showAddForm && (
                    <div className="card" style={{ padding: '1.75rem', border: '1px solid var(--accent-color)', background: 'var(--accent-bg)' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1.25rem' }}>Add New Member</h3>
                        <form onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Email Address</label>
                                <input className="form-input" required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Full Name</label>
                                <input className="form-input" required type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Role</label>
                                <select className="form-input" value={formData.role} onChange={e => setFormData({ ...formData, role: Number(e.target.value) })}>
                                    <option value={4}>Member</option>
                                    <option value={3}>Senior Researcher</option>
                                    <option value={2}>Lab Director</option>
                                    {isAdmin && <option value={1}>Admin</option>}
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ height: '42px' }} disabled={actionLoadingId === 'new'}>
                                {actionLoadingId === 'new' ? <Loader2 size={18} className="spin" /> : 'Save Member'}
                            </button>
                        </form>
                    </div>
                )}

                {/* Toolbar */}
                <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
                        <input
                            className="form-input"
                            style={{ paddingLeft: '40px' }}
                            placeholder="Find by name or email..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[
                            { id: 'all', label: 'All Roles' },
                            { id: 1, label: 'Admin' },
                            { id: 2, label: 'Director' },
                            { id: 3, label: 'Senior' },
                            { id: 4, label: 'Member' },
                        ].map(role => (
                            <button
                                key={role.id}
                                onClick={() => setActiveRoleFilter(role.id as any)}
                                className={`filter-chip ${activeRoleFilter === role.id ? 'active' : ''}`}
                            >
                                {role.label}
                            </button>
                        ))}
                    </div>
                    <button
                        className="btn btn-ghost"
                        style={{ marginLeft: 'auto', gap: '8px', color: showEmails ? 'var(--accent-color)' : 'var(--text-muted)' }}
                        onClick={() => setShowEmails(!showEmails)}
                        title={showEmails ? 'Hide sensitive data' : 'Show full emails'}
                    >
                        {showEmails ? <EyeOff size={18} /> : <Eye size={18} />}
                        {showEmails ? 'Mask Emails' : 'Show Emails'}
                    </button>
                </div>

                {/* Error / Loading */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--accent-color)', margin: '0 auto' }} />
                        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading members...</p>
                    </div>
                ) : error ? (
                    <div className="card" style={{ textAlign: 'center', color: 'var(--danger)', padding: '3rem' }}>
                        <AlertTriangle size={40} style={{ margin: '0 auto 1rem' }} />
                        <h3>{error}</h3>
                        <button className="btn btn-primary" onClick={loadMembers} style={{ marginTop: '1rem' }}>Retry</button>
                    </div>
                ) : filteredMembers.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '5rem 0', borderStyle: 'dashed' }}>
                        <Users size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>No members found matching your search.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {pagedMembers.map(m => {
                            const uid = m.userId || m.id;
                            const isSelf = String(uid) === currentUserId;
                            const isExpanded = expandedUserId === uid;
                            const isEditing = editingUserId === uid;
                            const roleCfg = getRoleBadgeConfig(m.role);
                            const isActive = m.isActive !== false;

                            return (
                                <div key={uid} className="card" style={{
                                    padding: 0, overflow: 'hidden',
                                    borderLeft: `4px solid ${isExpanded ? 'var(--accent-color)' : 'transparent'}`,
                                    transition: 'all 0.2s'
                                }}>
                                    {/* Card Row */}
                                    <div
                                        onClick={() => setExpandedUserId(isExpanded ? null : uid)}
                                        style={{ display: 'flex', alignItems: 'center', padding: '1.25rem 1.5rem', cursor: 'pointer', gap: '1.25rem' }}
                                        onMouseOver={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{ color: 'var(--text-muted)' }}>{isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>{m.fullName}</p>
                                                {isSelf && <span style={{ fontSize: '0.65rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#64748b' }}>YOU</span>}
                                            </div>
                                            <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Mail size={12} /> {maskEmail(m.email)}
                                            </p>
                                        </div>

                                        <span className="badge" style={{ background: roleCfg.bg, color: roleCfg.color, fontWeight: 700, borderRadius: '8px' }}>
                                            {roleCfg.label}
                                        </span>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '90px', justifyContent: 'flex-end' }}>
                                            <span style={{
                                                width: '10px', height: '10px', borderRadius: '50%',
                                                background: isActive ? '#10b981' : '#cbd5e1',
                                                boxShadow: isActive ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none'
                                            }} />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isActive ? '#059669' : '#94a3b8' }}>
                                                {isActive ? 'Active' : 'Disabled'}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                                            <button className="btn btn-ghost" style={{ padding: '8px' }} onClick={e => startEditing(m, e)} title="Edit Details"><Edit2 size={16} /></button>
                                            <button
                                                className="btn btn-ghost"
                                                style={{ padding: '8px', color: isSelf ? '#e2e8f0' : (isActive ? '#ef4444' : '#10b981') }}
                                                disabled={isSelf || actionLoadingId === String(uid)}
                                                onClick={e => handleToggleStatus(m, e)}
                                                title={isActive ? 'Deactivate User' : 'Activate User'}
                                            >
                                                {actionLoadingId === String(uid) ? <Loader2 size={16} className="spin" /> : <Power size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Detail Panel */}
                                    {isExpanded && (
                                        <div style={{ borderTop: '1px solid var(--border-color)', background: '#f8fafc', padding: '1.75rem' }}>
                                            {isEditing ? (
                                                <form onSubmit={handleUpdateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                                    <div style={{ gridColumn: '1 / -1' }}>
                                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Full Name</label>
                                                        <input className="form-input" value={editData.fullName} onChange={e => setEditData({ ...editData, fullName: e.target.value })} />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Role</label>
                                                        <select className="form-input" value={editData.role} onChange={e => setEditData({ ...editData, role: Number(e.target.value) })}>
                                                            <option value={4}>Member</option>
                                                            <option value={3}>Senior Researcher</option>
                                                            <option value={2}>Lab Director</option>
                                                            {isAdmin && <option value={1}>Admin</option>}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</label>
                                                        <select className="form-input" value={editData.isActive ? 'true' : 'false'} onChange={e => setEditData({ ...editData, isActive: e.target.value === 'true' })}>
                                                            <option value="true">Active</option>
                                                            <option value="false">Inactive</option>
                                                        </select>
                                                    </div>
                                                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
                                                        <button type="button" className="btn btn-secondary" onClick={() => setEditingUserId(null)}>Cancel</button>
                                                        <button type="submit" className="btn btn-primary" disabled={actionLoadingId === String(uid)}>
                                                            {actionLoadingId === String(uid) ? <Loader2 size={16} className="spin" /> : 'Update Member'}
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                                    <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                                        <p style={{ margin: '0 0 6px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Full Email</p>
                                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{maskEmail(m.email)}</p>
                                                    </div>

                                                    <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                                        <p style={{ margin: '0 0 6px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Account Created</p>
                                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                                                            {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {!loading && filteredMembers.length > pageSize && (
                    <div className="card" style={{ marginTop: '1.5rem', padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Showing <strong>{showingFrom}</strong> – <strong>{showingTo}</strong> of {filteredMembers.length}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button className="btn btn-secondary" disabled={pageIndex === 1} onClick={() => setPageIndex(pageIndex - 1)}>Prev</button>
                            <span style={{ fontSize: '0.9rem', padding: '0 10px' }}>Page {pageIndex} of {totalPages}</span>
                            <button className="btn btn-secondary" disabled={pageIndex === totalPages} onClick={() => setPageIndex(pageIndex + 1)}>Next</button>
                            <select className="form-input" style={{ width: '100px', marginLeft: '10px' }} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPageIndex(1); }}>
                                <option value={5}>5 / pg</option>
                                <option value={10}>10 / pg</option>
                                <option value={20}>20 / pg</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                .filter-chip {
                    padding: 8px 16px; border: 1px solid var(--border-color); border-radius: 10px; background: white;
                    font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); cursor: pointer; transition: all 0.2s;
                }
                .filter-chip:hover { border-color: var(--accent-color); color: var(--accent-color); }
                .filter-chip.active { background: var(--accent-color); color: white; border-color: var(--accent-color); box-shadow: 0 4px 10px rgba(232, 114, 12, 0.2); }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </MainLayout>
    );
};

export default UserManagement;
