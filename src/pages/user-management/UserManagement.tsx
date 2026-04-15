import React, { useState, useEffect, useMemo, useRef } from 'react';
import AppSelect from '@/components/common/AppSelect';
import { validateSpecialChars } from '@/utils/validation';
import { useToastStore } from '@/store/slices/toastSlice';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { userService, AddUserRequest } from '@/services/userService';
import {
    Users, Shield, CheckCircle, XCircle, Eye, EyeOff,
    Search, Edit2, Power, UserPlus, Mail, Calendar,
    Loader2, AlertTriangle, X
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
    const { addToast } = useToastStore();

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [activeRoleFilter, setActiveRoleFilter] = useState<number | 'all'>('all');
    const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [showEmails, setShowEmails] = useState(false); // Privacy toggle

    // Reset to page 1 whenever the filter changes
    useEffect(() => { setPageIndex(1); }, [searchQuery, activeRoleFilter, activeStatusFilter]);

    // UI States
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);

    const editingUserIdRef = useRef<string | null>(null);

    // Form states
    const [formData, setFormData] = useState({ email: '', fullName: '', role: 4 });
    const [editData, setEditData] = useState({
        role: 4,
        isActive: true,
        studentId: '',
        orcid: '',
        googleScholarUrl: '',
        githubUrl: ''
    });
    const [fieldErrors, setFieldErrors] = useState({ studentId: '', orcid: '', googleScholarUrl: '', githubUrl: '' });

    const validate = {
        studentId: (v: string) => v && !/^[A-Za-z]{2}\d{4}$/.test(v) ? 'Format: 2 letters + 4 digits (e.g. SE1234)' : '',
        orcid: (v: string) => v && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(v) ? 'Format: xxxx-xxxx-xxxx-xxxx' : '',
        googleScholarUrl: (v: string) => v && !/^https?:\/\/(www\.)?scholar\.google\.[a-z.]+\//.test(v) ? 'Must be a valid Google Scholar URL' : '',
        githubUrl: (v: string) => v && !/^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+/.test(v) ? 'Must be a valid GitHub profile URL' : '',
    };

    const setFieldError = (field: keyof typeof fieldErrors, v: string) =>
        setFieldErrors(prev => ({ ...prev, [field]: v }));

    // Pagination
    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        addToast(message, type);
    };

    useEffect(() => { loadMembers(); }, []);
    useEffect(() => { editingUserIdRef.current = editingUserId; }, [editingUserId]);

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
        if (activeStatusFilter !== 'all') {
            result = result.filter(m =>
                activeStatusFilter === 'active' ? m.isActive !== false : m.isActive === false
            );
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(m =>
                (m.fullName || '').toLowerCase().includes(q) ||
                (m.email || '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [members, searchQuery, activeRoleFilter, activeStatusFilter]);

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
    const selectedMember = selectedUserId ? (members.find(m => String(m.userId || m.id) === selectedUserId) ?? null) : null;

    const maskEmail = (email: string) => {
        if (showEmails) return email;
        const [user, domain] = (email || '').split('@');
        if (!user || !domain) return '***@***';
        return `${user.substring(0, 2)}***@${domain}`;
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        const fullNameErr = validateSpecialChars(formData.fullName);
        if (fullNameErr) { showToast(`Full name: ${fullNameErr}`, 'error'); return; }
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

    const handleToggleStatus = async (m: any, e?: React.MouseEvent) => {
        e?.stopPropagation();
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

        const errors = {
            studentId: validate.studentId(editData.studentId.trim()),
            orcid: validate.orcid(editData.orcid.trim()),
            googleScholarUrl: validate.googleScholarUrl(editData.googleScholarUrl.trim()),
            githubUrl: validate.githubUrl(editData.githubUrl.trim()),
        };
        setFieldErrors(errors);
        if (Object.values(errors).some(Boolean)) return;

        setActionLoadingId(editingUserId);
        try {
            const payload: any = {
                role: editData.role,
                isActive: editData.isActive,
                studentId: editData.studentId.trim() || undefined,
                orcid: editData.orcid.trim() || undefined,
                googleScholarUrl: editData.googleScholarUrl.trim() || undefined,
                githubUrl: editData.githubUrl.trim() || undefined,
            };
            const updated = await userService.updateUser(editingUserId, payload);
            setMembers(prev => prev.map(u => (u.userId || u.id) === editingUserId ? { ...u, ...updated } : u));
            setEditingUserId(null);
            setFieldErrors({ studentId: '', orcid: '', googleScholarUrl: '', githubUrl: '' });
            showToast('User updated successfully.');
        } catch (err) { showToast('Update failed.', 'error'); }
        finally { setActionLoadingId(null); }
    };

    const startEditing = async (m: any, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const uid = m.userId || m.id;
        const uidStr = String(uid);
        setSelectedUserId(uidStr);
        setEditingUserId(uid);
        setFieldErrors({ studentId: '', orcid: '', googleScholarUrl: '', githubUrl: '' });

        // Prefill quick values immediately, then fetch full user details (if available)
        setEditData(prev => ({
            ...prev,
            role: Number(m.role),
            isActive: m.isActive !== false,
            studentId: m.studentId || '',
            orcid: m.orcid || '',
            googleScholarUrl: m.googleScholarUrl || '',
            githubUrl: m.githubUrl || ''
        }));

        setDetailsLoadingId(uidStr);
        try {
            const detail = await userService.getById(uidStr);
            if (editingUserIdRef.current !== uidStr) return;
            setEditData(prev => ({
                ...prev,
                role: Number(detail?.role ?? m.role),
                isActive: detail?.isActive !== false,
                studentId: detail?.studentId || detail?.StudentId || prev.studentId || '',
                orcid: detail?.orcid || detail?.Orcid || prev.orcid || '',
                googleScholarUrl: detail?.googleScholarUrl || detail?.GoogleScholarUrl || prev.googleScholarUrl || '',
                githubUrl: detail?.githubUrl || detail?.GithubUrl || prev.githubUrl || ''
            }));
        } catch (err) {
            // Non-blocking: allow editing with list-provided values
            console.warn('Failed to fetch user details for edit:', err);
        } finally {
            setDetailsLoadingId(null);
        }
    };

    return (
        <MainLayout>
            <div className="page-container" style={{ margin: '0 auto' }}>
                {/* Toast Notification */}
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
                                <AppSelect
                                    value={String(formData.role)}
                                    onChange={val => setFormData({ ...formData, role: Number(val) })}
                                    options={[
                                        { value: '4', label: 'Member' },
                                        { value: '3', label: 'Senior Researcher' },
                                        { value: '2', label: 'Lab Director' },
                                        ...(isAdmin ? [{ value: '1', label: 'Admin' }] : []),
                                    ]}
                                />
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
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[
                            { id: 'all', label: 'All Status' },
                            { id: 'active', label: 'Active' },
                            { id: 'inactive', label: 'Inactive' },
                        ].map(s => (
                            <button
                                key={s.id}
                                onClick={() => setActiveStatusFilter(s.id as any)}
                                className={`filter-chip ${activeStatusFilter === s.id ? 'active' : ''}`}
                            >
                                {s.label}
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

                {/* Table + Side Panel */}
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
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
                        ) : (
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border-color)' }}>
                                        <tr>
                                            <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Name</th>
                                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</th>
                                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</th>
                                            <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMembers.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                    No members found matching your search.
                                                </td>
                                            </tr>
                                        ) : pagedMembers.map(m => {
                                            const uid = m.userId || m.id;
                                            const uidStr = String(uid);
                                            const isSelf = uidStr === currentUserId;
                                            const isSelected = selectedUserId === uidStr;
                                            const roleCfg = getRoleBadgeConfig(m.role);
                                            const isActive = m.isActive !== false;

                                            return (
                                                <tr
                                                    key={uid}
                                                    onClick={() => setSelectedUserId(isSelected ? null : uidStr)}
                                                    style={{
                                                        borderBottom: '1px solid var(--border-color)',
                                                        cursor: 'pointer',
                                                        background: isSelected ? 'var(--accent-bg)' : 'transparent',
                                                        borderLeft: isSelected ? '3px solid var(--accent-color)' : '3px solid transparent',
                                                        transition: 'background 0.15s',
                                                    }}
                                                    onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                                                    onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <td style={{ padding: '0.9rem 1.25rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{
                                                                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                                                                background: roleCfg.bg, color: roleCfg.color,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '0.75rem', fontWeight: 800, border: `1.5px solid ${roleCfg.color}22`,
                                                                overflow: 'hidden'
                                                            }}>
                                                                {m.avatarUrl
                                                                    ? <img src={m.avatarUrl} alt={m.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    : (m.fullName || m.email || '?')[0].toUpperCase()
                                                                }
                                                            </div>
                                                            <div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>{m.fullName}</span>
                                                                    {isSelf && <span style={{ fontSize: '0.6rem', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', color: '#64748b', fontWeight: 700 }}>YOU</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <Mail size={12} /> {maskEmail(m.email)}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.9rem 1rem' }}>
                                                        <span style={{ background: roleCfg.bg, color: roleCfg.color, padding: '3px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '0.72rem' }}>
                                                            {roleCfg.label}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.9rem 1rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{
                                                                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                                                                background: isActive ? '#10b981' : '#cbd5e1',
                                                                boxShadow: isActive ? '0 0 6px rgba(16,185,129,0.4)' : 'none',
                                                            }} />
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isActive ? '#059669' : '#94a3b8' }}>
                                                                {isActive ? 'Active' : 'Disabled'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {!loading && filteredMembers.length > 0 && (
                            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    Showing {showingFrom}–{showingTo} of {filteredMembers.length} users
                                </span>
                                {totalPages > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
                                        <button disabled={pageIndex === 1} onClick={() => setPageIndex(pageIndex - 1)} className="btn btn-outline" style={{ padding: '4px 14px', fontSize: '0.85rem', opacity: pageIndex === 1 ? 0.45 : 1 }}>Prev</button>
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            {[...Array(totalPages)].map((_, i) => (
                                                <button key={i + 1} onClick={() => setPageIndex(i + 1)} className={`btn ${pageIndex === i + 1 ? 'btn-primary' : 'btn-text'}`} style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', minWidth: 'unset' }}>{i + 1}</button>
                                            ))}
                                        </div>
                                        <button disabled={pageIndex === totalPages} onClick={() => setPageIndex(pageIndex + 1)} className="btn btn-outline" style={{ padding: '4px 14px', fontSize: '0.85rem', opacity: pageIndex === totalPages ? 0.45 : 1 }}>Next</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* User Detail Panel */}
                    {selectedMember && (() => {
                        const m = selectedMember;
                        const uid = m.userId || m.id;
                        const uidStr = String(uid);
                        const isSelf = uidStr === currentUserId;
                        const roleCfg = getRoleBadgeConfig(m.role);
                        const isActive = m.isActive !== false;
                        const isEditing = editingUserId === uid;
                        const initial = (m.fullName || m.email || '?')[0].toUpperCase();

                        return (
                            <div style={{
                                width: '360px', flexShrink: 0, position: 'sticky', top: '1rem',
                                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px',
                                boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
                                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                                maxHeight: 'calc(100vh - 6rem)',
                            }}>
                                {/* Panel Header */}
                                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px', background: 'white', flexShrink: 0 }}>
                                    <Users size={18} style={{ color: 'var(--primary-color)' }} />
                                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', flex: 1, color: '#1e293b' }}>User Profile</h4>
                                    <button
                                        onClick={() => { setSelectedUserId(null); setEditingUserId(null); }}
                                        style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: '6px', borderRadius: '50%', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Panel Body */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="custom-scrollbar">
                                    {/* Avatar + identity */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', paddingBottom: '1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                                        <div style={{
                                            width: '72px', height: '72px', borderRadius: '50%',
                                            background: roleCfg.bg, color: roleCfg.color,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.75rem', fontWeight: 800,
                                            border: `3px solid white`, boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                                            outline: `3px solid ${roleCfg.color}33`,
                                            overflow: 'hidden'
                                        }}>
                                            {m.avatarUrl
                                                ? <img src={m.avatarUrl} alt={m.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : initial
                                            }
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginBottom: '6px' }}>
                                                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{m.fullName}</span>
                                                {isSelf && <span style={{ fontSize: '0.62rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#64748b', fontWeight: 700 }}>YOU</span>}
                                            </div>
                                            <span style={{ background: roleCfg.bg, color: roleCfg.color, padding: '3px 12px', borderRadius: '6px', fontWeight: 700, fontSize: '0.72rem' }}>
                                                {roleCfg.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Info tiles */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div style={{ background: 'white', padding: '0.875rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                            <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}><Mail size={11} /> Email</label>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', wordBreak: 'break-all' }}>{maskEmail(m.email)}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            <div style={{ flex: 1, background: 'white', padding: '0.875rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Status</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isActive ? '#10b981' : '#cbd5e1', boxShadow: isActive ? '0 0 6px rgba(16,185,129,0.4)' : 'none' }} />
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isActive ? '#059669' : '#94a3b8' }}>{isActive ? 'Active' : 'Disabled'}</span>
                                                </div>
                                            </div>
                                            <div style={{ flex: 1, background: 'white', padding: '0.875rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}><Calendar size={11} /> Joined</label>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions or Edit Form */}
                                    {isEditing ? (
                                        <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {detailsLoadingId === uidStr && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.82rem' }}>
                                                    <Loader2 size={15} className="spin" /> Loading details...
                                                </div>
                                            )}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Role</label>
                                                    <AppSelect
                                                        value={String(editData.role)}
                                                        onChange={val => setEditData({ ...editData, role: Number(val) })}
                                                        options={[
                                                            { value: '4', label: 'Member' },
                                                            { value: '3', label: 'Senior Researcher' },
                                                            { value: '2', label: 'Lab Director' },
                                                            ...(isAdmin ? [{ value: '1', label: 'Admin' }] : []),
                                                        ]}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</label>
                                                    <AppSelect
                                                        value={editData.isActive ? 'true' : 'false'}
                                                        onChange={val => setEditData({ ...editData, isActive: val === 'true' })}
                                                        options={[
                                                            { value: 'true', label: 'Active' },
                                                            { value: 'false', label: 'Inactive' },
                                                        ]}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Student ID</label>
                                                <input
                                                    className="form-input"
                                                    type="text"
                                                    value={editData.studentId}
                                                    onChange={e => {
                                                        setEditData({ ...editData, studentId: e.target.value });
                                                        setFieldError('studentId', validate.studentId(e.target.value));
                                                    }}
                                                    placeholder="e.g. SE1234"
                                                    style={{ borderColor: fieldErrors.studentId ? '#ef4444' : undefined }}
                                                />
                                                {fieldErrors.studentId && <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>{fieldErrors.studentId}</p>}
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ORCID</label>
                                                <input
                                                    className="form-input"
                                                    type="text"
                                                    value={editData.orcid}
                                                    onChange={e => {
                                                        setEditData({ ...editData, orcid: e.target.value });
                                                        setFieldError('orcid', validate.orcid(e.target.value));
                                                    }}
                                                    placeholder="xxxx-xxxx-xxxx-xxxx"
                                                    style={{ borderColor: fieldErrors.orcid ? '#ef4444' : undefined }}
                                                />
                                                {fieldErrors.orcid && <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>{fieldErrors.orcid}</p>}
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Google Scholar URL</label>
                                                <input
                                                    className="form-input"
                                                    type="url"
                                                    value={editData.googleScholarUrl}
                                                    onChange={e => {
                                                        setEditData({ ...editData, googleScholarUrl: e.target.value });
                                                        setFieldError('googleScholarUrl', validate.googleScholarUrl(e.target.value));
                                                    }}
                                                    placeholder="https://scholar.google.com/..."
                                                    style={{ borderColor: fieldErrors.googleScholarUrl ? '#ef4444' : undefined }}
                                                />
                                                {fieldErrors.googleScholarUrl && <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>{fieldErrors.googleScholarUrl}</p>}
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>GitHub URL</label>
                                                <input
                                                    className="form-input"
                                                    type="url"
                                                    value={editData.githubUrl}
                                                    onChange={e => {
                                                        setEditData({ ...editData, githubUrl: e.target.value });
                                                        setFieldError('githubUrl', validate.githubUrl(e.target.value));
                                                    }}
                                                    placeholder="https://github.com/..."
                                                    style={{ borderColor: fieldErrors.githubUrl ? '#ef4444' : undefined }}
                                                />
                                                {fieldErrors.githubUrl && <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>{fieldErrors.githubUrl}</p>}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '0.25rem' }}>
                                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setEditingUserId(null); setFieldErrors({ studentId: '', orcid: '', googleScholarUrl: '', githubUrl: '' }); }}>Cancel</button>
                                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={actionLoadingId === uidStr}>
                                                    {actionLoadingId === uidStr ? <Loader2 size={15} className="spin" /> : 'Save Changes'}
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <button
                                                className="btn btn-primary"
                                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                                onClick={() => startEditing(m)}
                                            >
                                                <Edit2 size={15} /> Edit User
                                            </button>
                                            <button
                                                style={{
                                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                    padding: '8px 16px', borderRadius: '10px', fontWeight: 700, fontSize: '0.875rem', cursor: (isSelf || !!actionLoadingId) ? 'not-allowed' : 'pointer',
                                                    background: isSelf ? '#f1f5f9' : (isActive ? '#fef2f2' : '#f0fdf4'),
                                                    color: isSelf ? '#94a3b8' : (isActive ? '#ef4444' : '#10b981'),
                                                    border: `1px solid ${isSelf ? '#e2e8f0' : (isActive ? '#fecaca' : '#bbf7d0')}`,
                                                    opacity: (isSelf || !!actionLoadingId) ? 0.6 : 1,
                                                }}
                                                disabled={isSelf || !!actionLoadingId}
                                                onClick={() => handleToggleStatus(m)}
                                            >
                                                {actionLoadingId === uidStr ? <Loader2 size={15} className="spin" /> : <Power size={15} />}
                                                {isActive ? 'Deactivate User' : 'Activate User'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                </div>
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
