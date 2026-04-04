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

    // Detail / Edit panel
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editFullName, setEditFullName] = useState('');
    const [editRole, setEditRole] = useState<number>(4);
    const [editIsActive, setEditIsActive] = useState(true);
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // Quick status update
    const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);

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
            setError((err as any).message || 'Failed to load user list.');
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
        const primary =
            member?.avatarUrl ||
            member?.AvatarUrl ||
            member?.avatar ||
            member?.Avatar ||
            member?.pictureUrl ||
            member?.PictureUrl ||
            member?.pictureURL ||
            member?.picture ||
            member?.photoUrl ||
            member?.PhotoUrl ||
            member?.photoURL ||
            member?.imageUrl ||
            member?.ImageUrl ||
            member?.googleAvatarUrl ||
            member?.GoogleAvatarUrl ||
            member?.profilePictureUrl ||
            member?.ProfilePictureUrl ||
            member?.profileImageUrl ||
            member?.ProfileImageUrl;
        return { src: primary || fallback, fallback };
    };

    // ---- VALIDATION HELPERS ----
    const validateEmail = (email: string): string | null => {
        if (!email?.trim()) return 'Email is required.';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return 'Email format is invalid.';
        return null;
    };

    const validateFullName = (name: string): string | null => {
        if (!name?.trim()) return 'Full name is required.';
        if (name.trim().length < 2) return 'Full name must be at least 2 characters.';
        if (name.trim().length > 100) return 'Full name cannot exceed 100 characters.';
        return null;
    };

    const validateRole = (role: number): string | null => {
        if (![1, 2, 3, 4].includes(role)) return 'Role is invalid.';
        if (role === 2 && !isAdmin) return 'Only Admin can assign the Lab Director role.';
        return null;
    };

    const validateAddFormInputs = (): boolean => {
        const emailErr = validateEmail(addEmail);
        if (emailErr) {
            showToast(emailErr, 'error');
            return false;
        }
        const nameErr = validateFullName(addFullName);
        if (nameErr) {
            showToast(nameErr, 'error');
            return false;
        }
        const roleErr = validateRole(addRole);
        if (roleErr) {
            showToast(roleErr, 'error');
            return false;
        }
        return true;
    };

    const validateEditFormInputs = (): boolean => {
        const nameErr = validateFullName(editFullName);
        if (nameErr) {
            setEditError(nameErr);
            return false;
        }
        const roleErr = validateRole(editRole);
        if (roleErr) {
            setEditError(roleErr);
            return false;
        }
        return true;
    };

    const getDetailedErrorMessage = (err: any): string => {
        const status = err?.response?.status;
        const data = err?.response?.data;
        const serverMessage = data?.message || data || err?.message || '';
        const messageText = String(serverMessage);
        const isDuplicateEmail = /email/i.test(messageText) && /(already exists|đã tồn tại|exists in the system|already registered)/i.test(messageText);
        const normalizedMessage = String(serverMessage)
            .replace(/\u0027/g, "'")
            .replace(/\u0111\u00e3 t\u1ed3n t\u1ea1i trong h\u1ec7 th\u1ed1ng\.?/i, 'already exists in the system.')
            .replace(/đã tồn tại trong hệ thống\.?/gi, 'already exists in the system.')
            .replace(/Lỗi server\.?/gi, 'Server error.')
            .replace(/Vui lòng thử lại sau\.?/gi, 'Please try again later.');

        switch (status) {
            case 400:
                return `Invalid data: ${normalizedMessage || 'Please check the input.'}`;
            case 401:
                return 'Your session has expired. Please sign in again.';
            case 403:
                return 'You do not have permission to perform this action.';
            case 404:
                return 'The user does not exist or has already been deleted.';
            case 409:
                return 'This email is already registered. Please use a different email.';
            case 500:
                if (isDuplicateEmail) {
                    return 'This email is already registered. Please use a different email.';
                }
                return normalizedMessage ? `Server error: ${normalizedMessage}` : 'Server error. Please try again later.';
            default:
                if (isDuplicateEmail) {
                    return 'This email is already registered. Please use a different email.';
                }
                return normalizedMessage || 'Something went wrong. Please try again.';
        }
    };

    // ---- ADD USER ----
    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateAddFormInputs()) return;

        setAddLoading(true);

        try {
            const newUser = await userService.addUser({ email: addEmail, fullName: addFullName, role: addRole } as AddUserRequest);
            
            if (!newUser?.userId || !newUser?.email) {
                throw new Error('Invalid server response: missing userId or email.');
            }

            setMembers(prev => [...prev, newUser]);
            setAddEmail('');
            setAddFullName('');
            setAddRole(4);
            setShowAddForm(false);
            showToast('User added successfully.', 'success');
        } catch (err: any) {
            const errorMessage = !err.response
                ? 'Cannot reach the server. Please check that the backend is running.'
                : getDetailedErrorMessage(err);
            showToast(errorMessage, 'error');
        } finally {
            setAddLoading(false);
        }
    };

    const handleToggleUserStatus = async (member: any) => {
        const userId = String(member.userId || member.id || '');
        if (!userId) return;

        if (userId === currentUserId) {
            showToast('You cannot change your own account status.', 'error');
            return;
        }

        const currentIsActive = member.isActive !== false;
        const nextIsActive = !currentIsActive;
        const actionLabel = nextIsActive ? 'activate' : 'deactivate';
        const confirmed = window.confirm(`Are you sure you want to ${actionLabel} this user?`);
        if (!confirmed) return;

        setStatusLoadingId(userId);
        try {
            const updatedUser = await userService.updateUser(userId, { isActive: nextIsActive });
            setMembers(prev => prev.map(m => {
                const uid = m.userId || m.id;
                if (String(uid) === userId) {
                    return {
                        ...m,
                        ...updatedUser,
                        userId: uid,
                        isActive: updatedUser?.isActive ?? nextIsActive,
                    };
                }
                return m;
            }));

            if (editingUserId === userId) {
                setEditIsActive(nextIsActive);
            }

            showToast(nextIsActive ? 'User activated successfully.' : 'User deactivated successfully.', 'success');
        } catch (err: any) {
            const errorMessage = !err.response
                ? 'Cannot reach the server.'
                : getDetailedErrorMessage(err);
            showToast(errorMessage, 'error');
        } finally {
            setStatusLoadingId(null);
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
        // Make sure detail panel is open
        setExpandedUserId(userId);
    };

    const cancelEditing = () => {
        setEditingUserId(null);
        setEditError(null);
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUserId) return;

        if (!validateEditFormInputs()) return;

        setEditLoading(true);
        setEditError(null);

        try {
            const updateData: UpdateUserRequest = {
                role: editRole,
                isActive: editIsActive,
            };
            const updatedUser = await userService.updateUser(editingUserId, updateData);
            
            if (!updatedUser?.userId) {
                throw new Error('Invalid server response: missing userId.');
            }

            setMembers(prev => prev.map(m => {
                const uid = m.userId || m.id;
                if (uid === editingUserId) {
                    return { ...m, ...updatedUser, userId: uid };
                }
                return m;
            }));
            showToast('User information updated successfully.', 'success');
            setEditingUserId(null);
        } catch (err: any) {
            const errorMessage = !err.response
                ? 'Cannot reach the server. Please check that the backend is running.'
                : getDetailedErrorMessage(err);
            setEditError(errorMessage);
            showToast(errorMessage, 'error');
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
                            onClick={() => { setShowAddForm(!showAddForm); }}
                        >
                            {showAddForm ? 'Close form' : 'Add member'}
                        </button>
                    </div>
                </div>

                {showAddForm && (
                    <div className="um-add-form card">
                        <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 700 }}>Add New Member</h3>

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
                                            const isEditing = editingUserId === userId;
                                            const isSelf = Boolean(currentUserId) && String(userId) === currentUserId;
                                            const isStatusLoading = statusLoadingId === String(userId);
                                            const avatar = getAvatarSources(member, name);

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
                                                                    style={{
                                                                        color: isSelf
                                                                            ? 'var(--text-muted)'
                                                                            : (member.isActive !== false ? 'var(--danger)' : 'var(--success)'),
                                                                        padding: '4px 10px'
                                                                    }}
                                                                    disabled={isSelf || isStatusLoading}
                                                                    onClick={() => handleToggleUserStatus(member)}
                                                                    title={
                                                                        isSelf
                                                                            ? 'You cannot change your own status'
                                                                            : (member.isActive !== false ? 'Deactivate user' : 'Activate user')
                                                                    }
                                                                >
                                                                    {isStatusLoading
                                                                        ? 'Updating...'
                                                                        : (member.isActive !== false ? 'Deactivate' : 'Activate')}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>

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
                                                                                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{editFullName}</h3>
                                                                                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{member.email}</p>
                                                                                </div>
                                                                            </div>

                                                                            {editError && (
                                                                                <div className="um-alert um-alert-error" style={{ marginTop: 0 }}>
                                                                                    {editError}
                                                                                </div>
                                                                            )}
                                                                            <div className="um-edit-grid">
                                                                                <div className="um-form-field">
                                                                                    <label>Full Name</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        value={editFullName}
                                                                                        readOnly
                                                                                        disabled={true}
                                                                                        className="form-input"
                                                                                        style={{ backgroundColor: '#f8fafc', cursor: 'not-allowed' }}
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
                                                                                    <span className="um-detail-value">{member.email}</span>
                                                                                </div>
                                                                                {member.createdAt && (
                                                                                    <div className="um-detail-item">
                                                                                        <span className="um-detail-label">Created</span>
                                                                                        <span className="um-detail-value">{new Date(member.createdAt).toLocaleDateString('en-US')}</span>
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
