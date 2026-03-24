import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/layout/MainLayout';
import {
    UserPlus,
    Search,
    Mail,
    User,
    Shield,
    Loader2,
    Trash2,
    Users,
    X,
    AlertTriangle,
    Pencil,
    Save,
} from 'lucide-react';
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
    'SeniorResearcher': 'Senior Researcher',
    'Member': 'Member',
    'Guest': 'Guest',
};

const getRoleBadgeClass = (role: number | string): string => {
    const roleStr = String(role);
    if (roleStr === '1' || roleStr === 'Admin') return 'badge-danger';
    if (roleStr === '2' || roleStr === 'LabDirector') return 'badge-accent';
    if (roleStr === '3' || roleStr === 'SeniorResearcher') return 'badge-info';
    if (roleStr === '4' || roleStr === 'Member') return 'badge-success';
    return 'badge-muted';
};

const UserManagement: React.FC = () => {
    const { user } = useAuth();

    // Data states
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    // Add form
    const [showAddForm, setShowAddForm] = useState(false);
    const [addEmail, setAddEmail] = useState('');
    const [addFullName, setAddFullName] = useState('');
    const [addRole, setAddRole] = useState<number>(4);
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const [addSuccess, setAddSuccess] = useState<string | null>(null);

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

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const data = await userService.getAll();
            setMembers(data);
            setError(null);
        } catch (err) {
            console.error('Lỗi tải danh sách thành viên:', err);
            setError('Không thể tải danh sách người dùng. Vui lòng thử lại sau.');
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

    // ---- ADD USER ----
    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError(null);
        setAddSuccess(null);
        setAddLoading(true);

        try {
            const newUser = await userService.addUser({ email: addEmail, fullName: addFullName, role: addRole } as AddUserRequest);
            setMembers(prev => [...prev, newUser]);
            setAddEmail('');
            setAddFullName('');
            setAddRole(4);
            setAddSuccess(`Đã thêm thành viên "${addFullName}" thành công!`);
            setTimeout(() => setAddSuccess(null), 4000);
        } catch (err: any) {
            const data = err.response?.data;
            let errorMessage = 'Thêm người dùng thất bại. Vui lòng thử lại.';
            if (data?.message) errorMessage = data.message;
            else if (typeof data === 'string') errorMessage = data;
            else if (!err.response) errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra Backend đang chạy.';
            setAddError(errorMessage);
        } finally {
            setAddLoading(false);
        }
    };

    // ---- DELETE USER ----
    const handleDeleteUser = async (userId: string) => {
        setDeleteLoading(true);
        try {
            await userService.deleteUser(userId);
            setMembers(prev => prev.filter(m => (m.userId || m.id) !== userId));
            setDeleteConfirmId(null);
            if (expandedUserId === userId) setExpandedUserId(null);
            if (editingUserId === userId) setEditingUserId(null);
        } catch (err: any) {
            console.error('Xóa người dùng thất bại:', err);
            const msg = err.response?.data?.message || 'Xóa người dùng thất bại. Người dùng có thể có dữ liệu liên quan ngăn việc xóa.';
            setDeleteConfirmId(null);
            alert(msg);
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
            setEditSuccess('Cập nhật người dùng thành công!');
            setTimeout(() => { setEditSuccess(null); setEditingUserId(null); }, 2000);
        } catch (err: any) {
            const data = err.response?.data;
            let errorMessage = 'Cập nhật người dùng thất bại.';
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
                {/* Page Header */}
                <div className="page-header">
                    <div>
                        <h1>Quản lý người dùng</h1>
                        <p>Thêm, chỉnh sửa, tìm kiếm và quản lý tài khoản LabSync.</p>
                    </div>
                    <button
                        className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => { setShowAddForm(!showAddForm); setAddError(null); setAddSuccess(null); }}
                    >
                        {showAddForm ? <><X size={18} /> Đóng</> : <><UserPlus size={18} /> Thêm thành viên</>}
                    </button>
                </div>

                {/* Inline Add Form */}
                {showAddForm && (
                    <div className="um-add-form card">
                        <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserPlus size={18} style={{ color: 'var(--accent-color)' }} /> Thêm thành viên mới
                        </h3>

                        {addError && (
                            <div className="um-alert um-alert-error">
                                <AlertTriangle size={16} /> {addError}
                            </div>
                        )}
                        {addSuccess && (
                            <div className="um-alert um-alert-success">
                                ✓ {addSuccess}
                            </div>
                        )}

                        <form onSubmit={handleAddUser} className="um-form-grid">
                            <div className="um-form-field">
                                <label><Mail size={14} /> Địa chỉ Email *</label>
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
                                <label><User size={14} /> Họ và tên *</label>
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
                                <label><Shield size={14} /> Vai trò *</label>
                                <select
                                    value={addRole}
                                    onChange={(e) => setAddRole(Number(e.target.value))}
                                    disabled={addLoading}
                                    className="form-input"
                                >
                                    {user?.role === 'Admin' && <option value={1}>Admin</option>}
                                    {user?.role === 'Admin' && <option value={2}>Lab Director</option>}
                                    <option value={3}>Senior Researcher</option>
                                    <option value={4}>Member</option>
                                    <option value={5}>Guest</option>
                                </select>
                            </div>
                            <div className="um-form-actions">
                                <button type="submit" disabled={addLoading} className="btn btn-primary">
                                    {addLoading && <Loader2 size={16} className="animate-spin" />}
                                    {addLoading ? 'Đang thêm...' : 'Thêm người dùng'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Search Bar */}
                <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo tên, email hoặc vai trò..."
                            className="form-input"
                            style={{ paddingLeft: '40px' }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {filteredMembers.length} người dùng
                    </span>
                </div>

                {/* Loading */}
                {loading && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column', gap: '1rem' }}>
                        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary-color)' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>Đang tải danh sách...</p>
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
                        <p>{error}</p>
                        <button className="btn btn-primary" onClick={fetchMembers} style={{ marginTop: '1rem' }}>Thử lại</button>
                    </div>
                )}

                {/* Data Table */}
                {!loading && !error && (
                    filteredMembers.length > 0 ? (
                        <div className="um-table-wrapper card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table className="um-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '50px' }}></th>
                                        <th>Họ và tên</th>
                                        <th>Email</th>
                                        <th>Vai trò</th>
                                        <th>Trạng thái</th>
                                        <th style={{ width: '120px', textAlign: 'center' }}>Hành động</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMembers.map((member: any) => {
                                        const userId = member.userId || member.id;
                                        const name = member.fullName || member.userName || member.name || 'Không rõ';
                                        const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);
                                        const isExpanded = expandedUserId === userId;
                                        const isDeleting = deleteConfirmId === userId;
                                        const isEditing = editingUserId === userId;

                                        return (
                                            <React.Fragment key={userId}>
                                                <tr
                                                    className={`um-row ${isExpanded ? 'um-row-expanded' : ''}`}
                                                    onClick={() => toggleRow(userId)}
                                                >
                                                    <td>
                                                        <div className="avatar avatar-md avatar-accent" style={{ fontSize: '0.75rem' }}>
                                                            {initials}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{name}</div>
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
                                                            {member.isActive !== false ? 'Hoạt động' : 'Ngừng hoạt động'}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                            <button
                                                                className="btn btn-ghost"
                                                                style={{ color: 'var(--accent-color)', padding: '4px 8px' }}
                                                                onClick={() => startEditing(member)}
                                                                title="Chỉnh sửa"
                                                            >
                                                                <Pencil size={15} />
                                                            </button>
                                                            <button
                                                                className="btn btn-ghost"
                                                                style={{ color: 'var(--danger)', padding: '4px 8px' }}
                                                                onClick={() => setDeleteConfirmId(isDeleting ? null : userId)}
                                                                title="Xóa"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Delete Confirmation Row */}
                                                {isDeleting && (
                                                    <tr className="um-confirm-row">
                                                        <td colSpan={6}>
                                                            <div className="um-confirm-bar">
                                                                <AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                                                                <span>Xóa <strong>{name}</strong>? Hành động này không thể hoàn tác.</span>
                                                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                                    <button
                                                                        className="btn btn-secondary"
                                                                        style={{ padding: '4px 14px', fontSize: '0.8rem' }}
                                                                        onClick={() => setDeleteConfirmId(null)}
                                                                        disabled={deleteLoading}
                                                                    >
                                                                        Hủy
                                                                    </button>
                                                                    <button
                                                                        className="btn"
                                                                        style={{ padding: '4px 14px', fontSize: '0.8rem', background: 'var(--danger)', color: 'white', border: 'none' }}
                                                                        onClick={() => handleDeleteUser(userId)}
                                                                        disabled={deleteLoading}
                                                                    >
                                                                        {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                                        {deleteLoading ? ' Đang xóa...' : ' Xác nhận xóa'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}

                                                {/* Expanded Detail / Edit Panel */}
                                                {isExpanded && (
                                                    <tr className="um-detail-row">
                                                        <td colSpan={6}>
                                                            <div className="um-detail-panel">
                                                                {isEditing ? (
                                                                    /* ---- EDIT MODE ---- */
                                                                    <form onSubmit={handleUpdateUser}>
                                                                        <div className="um-detail-header">
                                                                            <div className="avatar avatar-lg avatar-accent" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
                                                                                {initials}
                                                                            </div>
                                                                            <div style={{ flex: 1 }}>
                                                                                <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                    <Pencil size={16} style={{ color: 'var(--accent-color)' }} /> Chỉnh sửa người dùng
                                                                                </h3>
                                                                                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{member.email}</p>
                                                                            </div>
                                                                        </div>

                                                                        {editError && (
                                                                            <div className="um-alert um-alert-error" style={{ marginTop: 0 }}>
                                                                                <AlertTriangle size={16} /> {editError}
                                                                            </div>
                                                                        )}
                                                                        {editSuccess && (
                                                                            <div className="um-alert um-alert-success" style={{ marginTop: 0 }}>
                                                                                ✓ {editSuccess}
                                                                            </div>
                                                                        )}

                                                                        <div className="um-edit-grid">
                                                                            <div className="um-form-field">
                                                                                <label><User size={14} /> Họ và tên</label>
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
                                                                                <label><Shield size={14} /> Vai trò</label>
                                                                                <select
                                                                                    value={editRole}
                                                                                    onChange={(e) => setEditRole(Number(e.target.value))}
                                                                                    disabled={editLoading}
                                                                                    className="form-input"
                                                                                >
                                                                                    {user?.role === 'Admin' && <option value={1}>Admin</option>}
                                                                                    {user?.role === 'Admin' && <option value={2}>Lab Director</option>}
                                                                                    <option value={3}>Senior Researcher</option>
                                                                                    <option value={4}>Member</option>
                                                                                    <option value={5}>Guest</option>
                                                                                </select>
                                                                            </div>
                                                                            <div className="um-form-field">
                                                                                <label>Trạng thái</label>
                                                                                <select
                                                                                    value={editIsActive ? 'true' : 'false'}
                                                                                    onChange={(e) => setEditIsActive(e.target.value === 'true')}
                                                                                    disabled={editLoading}
                                                                                    className="form-input"
                                                                                >
                                                                                    <option value="true">Hoạt động</option>
                                                                                    <option value="false">Ngừng hoạt động</option>
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
                                                                                Hủy
                                                                            </button>
                                                                            <button
                                                                                type="submit"
                                                                                className="btn btn-primary"
                                                                                disabled={editLoading}
                                                                                style={{ padding: '6px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                                            >
                                                                                {editLoading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                                                                {editLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                                                                            </button>
                                                                        </div>
                                                                    </form>
                                                                ) : (
                                                                    /* ---- VIEW MODE ---- */
                                                                    <>
                                                                        <div className="um-detail-header">
                                                                            <div className="avatar avatar-lg avatar-accent" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
                                                                                {initials}
                                                                            </div>
                                                                            <div style={{ flex: 1 }}>
                                                                                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{name}</h3>
                                                                                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{member.email}</p>
                                                                            </div>
                                                                            <button
                                                                                className="btn btn-outline"
                                                                                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                                                                                onClick={(e) => { e.stopPropagation(); startEditing(member); }}
                                                                            >
                                                                                <Pencil size={14} /> Chỉnh sửa
                                                                            </button>
                                                                        </div>
                                                                        <div className="um-detail-grid">
                                                                            <div className="um-detail-item">
                                                                                <span className="um-detail-label">Vai trò</span>
                                                                                <span className={`badge ${getRoleBadgeClass(member.role)}`}>
                                                                                    {SystemRoleMap[member.role] || member.role || 'Member'}
                                                                                </span>
                                                                            </div>
                                                                            <div className="um-detail-item">
                                                                                <span className="um-detail-label">Trạng thái tài khoản</span>
                                                                                <span className={`badge ${member.isActive !== false ? 'badge-success' : 'badge-muted'}`}>
                                                                                    {member.isActive !== false ? 'Hoạt động' : 'Ngừng hoạt động'}
                                                                                </span>
                                                                            </div>
                                                                            <div className="um-detail-item">
                                                                                <span className="um-detail-label"><Mail size={14} /> Email</span>
                                                                                <span>{member.email}</span>
                                                                            </div>
                                                                            {member.createdAt && (
                                                                                <div className="um-detail-item">
                                                                                    <span className="um-detail-label">Ngày tạo</span>
                                                                                    <span>{new Date(member.createdAt).toLocaleDateString('vi-VN')}</span>
                                                                                </div>
                                                                            )}
                                                                            {userId && (
                                                                                <div className="um-detail-item" style={{ gridColumn: '1 / -1' }}>
                                                                                    <span className="um-detail-label">User ID</span>
                                                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{userId}</span>
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
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <Users size={36} />
                            </div>
                            <h2>Không tìm thấy người dùng</h2>
                            <p>{searchQuery ? `Không có kết quả cho "${searchQuery}"` : 'Thêm thành viên vào phòng thí nghiệm.'}</p>
                        </div>
                    )
                )}
            </div>
        </MainLayout>
    );
};

export default UserManagement;
