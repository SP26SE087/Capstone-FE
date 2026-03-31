import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { userService, AddUserRequest, UpdateUserRequest } from '@/services/userService';

const SystemRoleMap: Record<number | string, string> = {
    1: 'Admin',
    2: 'Lab Director',
    3: 'Senior Researcher',
    4: 'Member',
    5: 'Guest',
    'Admin': 'Admin',
    'LabDirector': 'Lab Director',
    'Lab Director': 'Lab Director',
    'SeniorResearcher': 'Senior Researcher',
    'Senior Researcher': 'Senior Researcher',
    'Member': 'Member',
    'Guest': 'Guest',
};

const getRoleBadgeClass = (role: number | string): string => {
    const roleStr = String(role);
    if (roleStr === '1' || roleStr === 'Admin') return 'badge-danger';
    if (roleStr === '2' || roleStr === 'LabDirector' || roleStr === 'Lab Director') return 'badge-accent';
    if (roleStr === '3' || roleStr === 'SeniorResearcher' || roleStr === 'Senior Researcher') return 'badge-info';
    if (roleStr === '4' || roleStr === 'Member') return 'badge-success';
    return 'badge-muted';
};

const UserManagement: React.FC = () => {
    const { user } = useAuth();
    const currentUserId = String((user as any)?.userId || (user as any)?.id || '');

    // Data states
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const isAdmin = user?.role === 'Admin' || Number((user as any)?.role) === 1;
    const canAssignLabDirector = isAdmin || user?.role === 'LabDirector' || user?.role === 'Lab Director' || Number((user as any)?.role) === 2;

    // Add form
    const [showAddForm, setShowAddForm] = useState(false);
    const [addEmail, setAddEmail] = useState('');
    const [addFullName, setAddFullName] = useState('');
    const [addRole, setAddRole] = useState<number>(4);
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    // Detail / Edit panel
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editFullName, setEditFullName] = useState('');
    const [editRole, setEditRole] = useState<number>(4);
    const [editIsActive, setEditIsActive] = useState(true);
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const [editSuccess, setEditSuccess] = useState<string | null>(null);

    // Delete confirmation
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Pagination
    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ type, message });
    };

    useEffect(() => {
        fetchMembers();
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3200);
        return () => clearTimeout(timer);
    }, [toast]);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const data = await userService.getAll();
            setMembers(data);
            setError(null);
        } catch (err) {
            console.error('Error loading members:', err);
            setError('Failed to load user list. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return members;
        const query = searchQuery.toLowerCase();
        return members.filter(member =>
            (member.fullName || member.userName || '').toLowerCase().includes(query) ||
            (member.email || '').toLowerCase().includes(query) ||
            (SystemRoleMap[member.role] || '').toLowerCase().includes(query)
        );
    }, [members, searchQuery]);

    useEffect(() => {
        const total = filteredMembers.length;
        setTotalCount(total);
        const pages = Math.max(1, Math.ceil(Math.max(total, 1) / pageSize));
        setTotalPages(pages);
        if (pageIndex > pages) setPageIndex(pages);
    }, [filteredMembers, pageSize]);

    useEffect(() => {
        setPageIndex(1);
    }, [searchQuery]);

    const pagedMembers = useMemo(() => {
        const start = (pageIndex - 1) * pageSize;
        return filteredMembers.slice(start, start + pageSize);
    }, [filteredMembers, pageIndex, pageSize]);

    const showingFrom = totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1;
    const showingTo = totalCount === 0 ? 0 : Math.min(totalCount, showingFrom + pagedMembers.length - 1);

    const handlePageChange = (nextPage: number) => {
        if (nextPage < 1 || nextPage > totalPages) return;
        setPageIndex(nextPage);
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setPageIndex(1);
    };

    const getAvatarSources = (member: any, name: string) => {
        const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ef7e25&color=fff&bold=true`;
        const primary = member?.avatarUrl || member?.pictureUrl || member?.picture || member?.photoUrl;
        return { src: primary || fallback, fallback };
    };

    // ---- ADD USER ----
    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError(null);
        setAddLoading(true);

        try {
            const newUser = await userService.addUser({ email: addEmail, fullName: addFullName, role: addRole } as AddUserRequest);
            setMembers(prev => [...prev, newUser]);
            setAddEmail('');
            setAddFullName('');
            setAddRole(4);
            setShowAddForm(false);
            showToast('Đã thêm người dùng mới.', 'success');
        } catch (err: any) {
            const data = err.response?.data;
            let errorMessage = 'Failed to add user. Please try again.';
            if (data?.message) errorMessage = data.message;
            else if (typeof data === 'string') errorMessage = data;
            else if (!err.response) errorMessage = 'Cannot connect to server. Please ensure Backend is running.';
            setAddError(errorMessage);
            showToast(errorMessage, 'error');
        } finally {
            setAddLoading(false);
        }
    };

    // ---- DELETE USER ----
    const handleDeleteUser = async (userId: string) => {
        if (String(userId) === currentUserId) {
            showToast('Bạn không thể xóa chính bạn.', 'error');
            setDeleteConfirmId(null);
            return;
        }
        setDeleteLoading(true);
        try {
            await userService.deleteUser(userId);
            setMembers(prev => prev.filter(m => (m.userId || m.id) !== userId));
            setDeleteConfirmId(null);
            if (expandedUserId === userId) setExpandedUserId(null);
            if (editingUserId === userId) setEditingUserId(null);
            showToast('Đã xóa người dùng.', 'success');
        } catch (err: any) {
            console.error('Failed to delete user:', err);
            const msg = err.response?.data?.message || 'Failed to delete user. The user may have related data preventing deletion.';
            setDeleteConfirmId(null);
            showToast(msg, 'error');
        } finally {
            setDeleteLoading(false);
        }
    };

    // ---- EDIT USER ----
    const startEditing = (member: any) => {
        const userId = member.userId || member.id;
        setEditingUserId(userId);
        setEditFullName(member.fullName || member.userName || '');
        setEditRole(typeof member.role === 'number' ? member.role : 4);
        setEditIsActive(member.isActive !== false);
        setEditError(null);
        setEditSuccess(null);
        // Make sure detail panel is open
        setExpandedUserId(userId);
    };

    const cancelEditing = () => {
        setEditingUserId(null);
        setEditError(null);
        setEditSuccess(null);
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUserId) return;
        setEditLoading(true);
        setEditError(null);
        setEditSuccess(null);

        try {
            const updateData: UpdateUserRequest = {
                fullName: editFullName,
                role: editRole,
                isActive: editIsActive,
            };
            const updatedUser = await userService.updateUser(editingUserId, updateData);
            setMembers(prev => prev.map(m => {
                const uid = m.userId || m.id;
                if (uid === editingUserId) {
                    return { ...m, ...updatedUser, userId: uid };
                }
                return m;
            }));
            setEditSuccess('User updated successfully!');
            setTimeout(() => { setEditSuccess(null); setEditingUserId(null); }, 2000);
        } catch (err: any) {
            const data = err.response?.data;
            let errorMessage = 'Failed to update user.';
            if (data?.message) errorMessage = data.message;
            else if (typeof data === 'string') errorMessage = data;
            setEditError(errorMessage);
        } finally {
            setEditLoading(false);
        }
    };

    const toggleRow = (userId: string) => {
        if (expandedUserId === userId) {
            setExpandedUserId(null);
            setEditingUserId(null);
        } else {
            setExpandedUserId(userId);
            setEditingUserId(null);
            setEditError(null);
            setEditSuccess(null);
        }
    };

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">
                {toast && (
                    <div
                        className="card"
                        style={{
                            position: 'fixed', top: '80px', right: '24px', zIndex: 1100,
                            background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
                            color: toast.type === 'success' ? '#166534' : '#991b1b',
                            border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                            padding: '10px 14px', borderRadius: '10px', boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
                            minWidth: '240px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px'
                        }}
                    >
                        <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{toast.message}</span>
                        <button className="btn btn-ghost" style={{ color: 'inherit', padding: '4px 6px' }} onClick={() => setToast(null)}>x</button>
                    </div>
                )}

                <div className="page-header" style={{ marginBottom: '1.5rem', padding: '0 1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <h1 style={{ margin: 0 }}>User Management</h1>
                        <button
                            className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`}
                            style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 700 }}
                            onClick={() => { setShowAddForm(!showAddForm); setAddError(null); }}
                        >
                            {showAddForm ? 'Close form' : 'Add member'}
                        </button>
                    </div>
                </div>

                {showAddForm && (
                    <div className="um-add-form card">
                        <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 700 }}>Add New Member</h3>

                        {addError && (
                            <div className="um-alert um-alert-error">
                                {addError}
                            </div>
                        )}

                        <form onSubmit={handleAddUser} className="um-form-grid">
                            <div className="um-form-field">
                                <label>Email Address *</label>
                                <input
                                    required
                                    type="email"
                                    placeholder="user@example.com"
                                    value={addEmail}
                                    onChange={(e) => setAddEmail(e.target.value)}
                                    disabled={addLoading}
                                    className="form-input"
                                />
                            </div>
                            <div className="um-form-field">
                                <label>Full Name *</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Nguyen Van A"
                                    value={addFullName}
                                    onChange={(e) => setAddFullName(e.target.value)}
                                    disabled={addLoading}
                                    className="form-input"
                                />
                            </div>
                            <div className="um-form-field">
                                <label>Role *</label>
                                <select
                                    value={addRole}
                                    onChange={(e) => setAddRole(Number(e.target.value))}
                                    disabled={addLoading}
                                    className="form-input"
                                >
                                    {isAdmin && <option value={1}>Admin</option>}
                                    {canAssignLabDirector && <option value={2}>Lab Director</option>}
                                    <option value={3}>Senior Researcher</option>
                                    <option value={4}>Member</option>
                                    <option value={5}>Guest</option>
                                </select>
                            </div>
                            <div className="um-form-actions">
                                <button type="submit" disabled={addLoading} className="btn btn-primary">
                                    {addLoading ? 'Adding...' : 'Add User'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem 1.25rem' }}>
                    <div style={{ flex: 1 }}>
                        <input
                            type="text"
                            placeholder="Search by name, email, or role..."
                            className="form-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {loading && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                        <div className="spinner" />
                        <p>Loading users...</p>
                    </div>
                )}

                {!loading && error && (
                    <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
                        <p>{error}</p>
                        <button className="btn btn-primary" onClick={fetchMembers} style={{ marginTop: '1rem' }}>Retry</button>
                    </div>
                )}

                {!loading && !error && (
                    filteredMembers.length > 0 ? (
                        <>
                            <div className="um-table-wrapper card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table className="um-table">
                                    <thead>
                                        <tr>
                                            <th>Full Name</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Status</th>
                                            <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedMembers.map((member: any) => {
                                            const userId = member.userId || member.id;
                                            const name = member.fullName || member.userName || member.name || 'Unknown';
                                            const isExpanded = expandedUserId === userId;
                                            const isDeleting = deleteConfirmId === userId;
                                            const isEditing = editingUserId === userId;
                                            const isSelf = currentUserId && String(userId) === currentUserId;

                                            return (
                                                <React.Fragment key={userId}>
                                                    <tr
                                                        className={`um-row ${isExpanded ? 'um-row-expanded' : ''}`}
                                                        onClick={() => toggleRow(userId)}
                                                    >
                                                        <td>
                                                            <div style={{ fontWeight: 700 }}>{name}</div>
                                                        </td>
                                                        <td>
                                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{member.email}</span>
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${getRoleBadgeClass(member.role)}`}>
                                                                {SystemRoleMap[member.role] || member.role || 'Member'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${member.isActive !== false ? 'badge-success' : 'badge-muted'}`}>
                                                                {member.isActive !== false ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                                <button
                                                                    className="btn btn-ghost"
                                                                    style={{ color: 'var(--accent-color)', padding: '4px 10px' }}
                                                                    onClick={() => startEditing(member)}
                                                                    title="Edit"
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    className="btn btn-ghost"
                                                                    style={{ color: isSelf ? 'var(--text-muted)' : 'var(--danger)', padding: '4px 10px' }}
                                                                    disabled={isSelf}
                                                                    onClick={() => {
                                                                        if (isSelf) {
                                                                            showToast('Bạn không thể xóa chính bạn.', 'error');
                                                                            return;
                                                                        }
                                                                        setDeleteConfirmId(isDeleting ? null : userId);
                                                                    }}
                                                                    title={isSelf ? 'You cannot delete yourself' : 'Delete'}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {isDeleting && (
                                                        <tr className="um-confirm-row">
                                                            <td colSpan={6}>
                                                                <div className="um-confirm-bar">
                                                                    <span>Delete <strong>{name}</strong>? This action cannot be undone.</span>
                                                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                                        <button
                                                                            className="btn btn-secondary"
                                                                            style={{ padding: '4px 14px', fontSize: '0.8rem' }}
                                                                            onClick={() => setDeleteConfirmId(null)}
                                                                            disabled={deleteLoading}
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            className="btn"
                                                                            style={{ padding: '4px 14px', fontSize: '0.8rem', background: 'var(--danger)', color: 'white', border: 'none' }}
                                                                            onClick={() => handleDeleteUser(userId)}
                                                                            disabled={deleteLoading}
                                                                        >
                                                                            {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}

                                                    {isExpanded && (
                                                        <tr className="um-detail-row">
                                                            <td colSpan={6}>
                                                                <div className="um-detail-panel">
                                                                    {isEditing ? (
                                                                        <form onSubmit={handleUpdateUser}>
                                                                            <div className="um-detail-header">
                                                                                <div className="avatar avatar-lg avatar-accent" style={{ width: '64px', height: '64px', overflow: 'hidden' }}>
                                                                                    <img
                                                                                        src={avatar.src}
                                                                                        alt={name}
                                                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = avatar.fallback; }}
                                                                                    />
                                                                                </div>
                                                                                <div style={{ flex: 1 }}>
                                                                                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Edit User</h3>
                                                                                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{member.email}</p>
                                                                                </div>
                                                                            </div>

                                                                            {editError && (
                                                                                <div className="um-alert um-alert-error" style={{ marginTop: 0 }}>
                                                                                    {editError}
                                                                                </div>
                                                                            )}
                                                                            {editSuccess && (
                                                                                <div className="um-alert um-alert-success" style={{ marginTop: 0 }}>
                                                                                    {editSuccess}
                                                                                </div>
                                                                            )}

                                                                            <div className="um-edit-grid">
                                                                                <div className="um-form-field">
                                                                                    <label>Full Name</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        value={editFullName}
                                                                                        onChange={(e) => setEditFullName(e.target.value)}
                                                                                        disabled={editLoading}
                                                                                        className="form-input"
                                                                                        required
                                                                                    />
                                                                                </div>
                                                                                <div className="um-form-field">
                                                                                    <label>Role</label>
                                                                                    <select
                                                                                        value={editRole}
                                                                                        onChange={(e) => setEditRole(Number(e.target.value))}
                                                                                        disabled={editLoading}
                                                                                        className="form-input"
                                                                                    >
                                                                                        {isAdmin && <option value={1}>Admin</option>}
                                                                                        {canAssignLabDirector && <option value={2}>Lab Director</option>}
                                                                                        <option value={3}>Senior Researcher</option>
                                                                                        <option value={4}>Member</option>
                                                                                        <option value={5}>Guest</option>
                                                                                    </select>
                                                                                </div>
                                                                                <div className="um-form-field">
                                                                                    <label>Status</label>
                                                                                    <select
                                                                                        value={editIsActive ? 'true' : 'false'}
                                                                                        onChange={(e) => setEditIsActive(e.target.value === 'true')}
                                                                                        disabled={editLoading}
                                                                                        className="form-input"
                                                                                    >
                                                                                        <option value="true">Active</option>
                                                                                        <option value="false">Inactive</option>
                                                                                    </select>
                                                                                </div>
                                                                            </div>

                                                                            <div style={{ display: 'flex', gap: '10px', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
                                                                                <button
                                                                                    type="button"
                                                                                    className="btn btn-secondary"
                                                                                    onClick={cancelEditing}
                                                                                    disabled={editLoading}
                                                                                    style={{ padding: '6px 18px' }}
                                                                                >
                                                                                    Cancel
                                                                                </button>
                                                                                <button
                                                                                    type="submit"
                                                                                    className="btn btn-primary"
                                                                                    disabled={editLoading}
                                                                                    style={{ padding: '6px 18px' }}
                                                                                >
                                                                                    {editLoading ? 'Saving...' : 'Save Changes'}
                                                                                </button>
                                                                            </div>
                                                                        </form>
                                                                    ) : (
                                                                        <>
                                                                            <div className="um-detail-header">
                                                                                <div className="avatar avatar-lg avatar-accent" style={{ width: '64px', height: '64px', overflow: 'hidden' }}>
                                                                                    <img
                                                                                        src={avatar.src}
                                                                                        alt={name}
                                                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = avatar.fallback; }}
                                                                                    />
                                                                                </div>
                                                                                <div style={{ flex: 1 }}>
                                                                                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{name}</h3>
                                                                                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{member.email}</p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="um-detail-grid">
                                                                                <div className="um-detail-item">
                                                                                    <span className="um-detail-label">Role</span>
                                                                                    <span className={`badge ${getRoleBadgeClass(member.role)}`}>
                                                                                        {SystemRoleMap[member.role] || member.role || 'Member'}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="um-detail-item">
                                                                                    <span className="um-detail-label">Account Status</span>
                                                                                    <span className={`badge ${member.isActive !== false ? 'badge-success' : 'badge-muted'}`}>
                                                                                        {member.isActive !== false ? 'Active' : 'Inactive'}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="um-detail-item">
                                                                                    <span className="um-detail-label">Email</span>
                                                                                    <span>{member.email}</span>
                                                                                </div>
                                                                                {member.createdAt && (
                                                                                    <div className="um-detail-item">
                                                                                        <span className="um-detail-label">Created</span>
                                                                                        <span>{new Date(member.createdAt).toLocaleDateString('vi-VN')}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="card" style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Showing {showingFrom}-{showingTo} of {totalCount}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <button className="btn btn-secondary" disabled={pageIndex === 1} onClick={() => handlePageChange(pageIndex - 1)}>Previous</button>
                                    <span style={{ minWidth: '90px', textAlign: 'center' }}>Page {pageIndex}/{totalPages}</span>
                                    <button className="btn btn-secondary" disabled={pageIndex === totalPages} onClick={() => handlePageChange(pageIndex + 1)}>Next</button>
                                    <select className="form-input" value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))} style={{ width: '120px' }}>
                                        <option value={5}>5 / page</option>
                                        <option value={10}>10 / page</option>
                                        <option value={20}>20 / page</option>
                                    </select>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <h2>No users found</h2>
                            <p>{searchQuery ? `No results for "${searchQuery}"` : 'Add members to your lab.'}</p>
                        </div>
                    )
                )}
            </div>
        </MainLayout>
    );
};

export default UserManagement;
