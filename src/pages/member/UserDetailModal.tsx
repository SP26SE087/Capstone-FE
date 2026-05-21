import React, { useState, useEffect } from 'react';
import { userService } from '@/services/userService';
import { formatProjectDate } from '@/utils/projectUtils';
import { Mail, Loader2, X, Phone, BookOpen, GraduationCap, ClipboardList, Clock, CheckCircle, XCircle, ExternalLink, Trash2, Briefcase, Pencil, Save, ShieldCheck } from 'lucide-react';
import ConfirmModal from '@/components/common/ConfirmModal';
import { useToastStore } from '@/store/slices/toastSlice';
import { SystemRoleEnum } from '@/types/enums';
import { validateSpecialChars } from '@/utils/validation';

interface UserDetailModalProps {
    onClose: () => void;
    userId: string | null;
    systemRoleMap: Record<number | string, string>;
    currentUserId?: string;
    currentUserEmail?: string;
    currentUserRole?: number | string;
    onCheckLog: (email: string, studentId: string, userName: string) => void;
    isCheckLogOpen: boolean;
    isLabDirector?: boolean;
    onDeleted?: () => void;
    onUpdated?: () => void;
    onViewProjects?: (email: string, userName: string) => void;
    isProjectPanelOpen?: boolean;
    onLabTime?: (userId: string, userName: string) => void;
    isLabTimePanelOpen?: boolean;
}

const normalizeRoleToken = (role: unknown) => String(role ?? '').trim().toLowerCase().replace(/\s+/g, '');

const UserDetailModal: React.FC<UserDetailModalProps> = ({ onClose, userId, systemRoleMap, currentUserId, currentUserEmail, currentUserRole, onCheckLog, isCheckLogOpen, isLabDirector, onDeleted, onUpdated, onViewProjects, isProjectPanelOpen, onLabTime, isLabTimePanelOpen }) => {
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showActivateConfirm, setShowActivateConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [activating, setActivating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ fullName: '', studentId: '', phoneNumber: '', orcid: '', googleScholarUrl: '', githubUrl: '' });
    const [fieldErrors, setFieldErrors] = useState({ fullName: '', studentId: '', phoneNumber: '', orcid: '', googleScholarUrl: '', githubUrl: '' });
    const [saving, setSaving] = useState(false);

    // ── Role change state ──
    const [isChangingRole, setIsChangingRole] = useState(false);
    const [pendingRole, setPendingRole] = useState<number | null>(null);
    const [showRoleConfirm, setShowRoleConfirm] = useState(false);
    const [roleChanging, setRoleChanging] = useState(false);

    // (Lab Time is now handled by UserLabTimePanel in the parent)

    const validate = {
        fullName: (v: string) => validateSpecialChars(v) ? `Full name: ${validateSpecialChars(v)}` : '',
        studentId: (v: string) => v && !/^[A-Za-z]{2}\d{6}$/.test(v) ? 'Format: 2 letters + 6 digits (e.g. SE123456)' : '',
        phoneNumber: (v: string) => v && !/^(\+[1-9]\d{6,14}|0\d{9})$/.test(v) ? 'Invalid phone (e.g. 0912345678 or +84912345678)' : '',
        orcid: (v: string) => v && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(v) ? 'Format: xxxx-xxxx-xxxx-xxxx' : '',
        googleScholarUrl: (v: string) => v && !/^https?:\/\/(www\.)?scholar\.google\.[a-z.]+\//.test(v) ? 'Must be a valid Google Scholar URL' : '',
        githubUrl: (v: string) => v && !/^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+/.test(v) ? 'Must be a valid GitHub profile URL' : '',
    };

    const setFieldError = (field: keyof typeof fieldErrors, v: string) =>
        setFieldErrors(prev => ({ ...prev, [field]: v }));
    const { addToast } = useToastStore();

    useEffect(() => {
        if (userId) { fetchUserDetails(); setIsEditing(false); setIsChangingRole(false); setPendingRole(null); return; }
        setUserData(null);
        setError(null);
    }, [userId]);

    useEffect(() => {
        if (userData) {
            setEditForm({
                fullName: userData.fullName || userData.userName || '',
                studentId: String(userData.studentId ?? userData.StudentId ?? ''),
                phoneNumber: userData.phoneNumber || userData.PhoneNumber || '',
                orcid: userData.orcid || userData.Orcid || '',
                googleScholarUrl: userData.googleScholarUrl || userData.GoogleScholarUrl || '',
                githubUrl: userData.githubUrl || userData.GithubUrl || '',
            });
        }
    }, [userData]);

    const fetchUserDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await userService.getById(userId!);
            setUserData(data);
        } catch (err) {
            setError('Could not load user details.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        const uid = userData?.userId || userData?.id;
        if (!uid) return;
        const errors = {
            fullName: validate.fullName(editForm.fullName.trim()),
            studentId: validate.studentId(editForm.studentId.trim()),
            phoneNumber: validate.phoneNumber(editForm.phoneNumber.trim()),
            orcid: validate.orcid(editForm.orcid.trim()),
            googleScholarUrl: validate.googleScholarUrl(editForm.googleScholarUrl.trim()),
            githubUrl: validate.githubUrl(editForm.githubUrl.trim()),
        };
        setFieldErrors(errors);
        if (Object.values(errors).some(Boolean)) return;
        setSaving(true);
        try {
            await userService.updateUser(uid, {
                fullName: editForm.fullName.trim() || undefined,
                studentId: editForm.studentId.trim() || undefined,
                phoneNumber: editForm.phoneNumber.trim() || undefined,
                orcid: editForm.orcid.trim() || undefined,
                googleScholarUrl: editForm.googleScholarUrl.trim() || undefined,
                githubUrl: editForm.githubUrl.trim() || undefined,
            });
            addToast('Profile updated successfully.', 'success');
            setIsEditing(false);
            onUpdated?.();
            await fetchUserDetails();
        } catch (err: any) {
            addToast(err?.response?.data?.message || err?.message || 'Failed to update profile.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleChangeRole = async () => {
        const uid = userData?.userId || userData?.id;
        if (!uid || pendingRole === null) return;
        setRoleChanging(true);
        try {
            await userService.updateUser(uid, { role: pendingRole });
            addToast('Role updated successfully.', 'success');
            setShowRoleConfirm(false);
            setIsChangingRole(false);
            setPendingRole(null);
            onUpdated?.();
            await fetchUserDetails();
        } catch (err: any) {
            addToast(err?.response?.data?.message || err?.message || 'Failed to update role.', 'error');
        } finally {
            setRoleChanging(false);
        }
    };

    const handleDeactivate = async () => {
        const selectedId = String(userData?.userId || userData?.id || '').trim().toLowerCase();
        const selectedEmail = String(userData?.email || '').trim().toLowerCase();
        const myId = String(currentUserId || '').trim().toLowerCase();
        const myEmail = String(currentUserEmail || '').trim().toLowerCase();
        const isSelf = (selectedId && myId && selectedId === myId) || (selectedEmail && myEmail && selectedEmail === myEmail);
        if (isSelf) {
            setShowDeleteConfirm(false);
            addToast('You cannot deactivate your own account.', 'error');
            return;
        }
        const userId = userData?.userId || userData?.id;
        if (!userId) return;
        setDeleting(true);
        try {
            await userService.updateUser(userId, { isActive: false });
            addToast('Member deactivated successfully.', 'success');
            setShowDeleteConfirm(false);
            onDeleted?.();
            onClose();
        } catch (err: any) {
            setShowDeleteConfirm(false);
            const msg = err?.response?.data?.message || err?.message || 'Failed to deactivate user.';
            addToast(msg, 'error');
        } finally {
            setDeleting(false);
        }
    };

    const handleActivate = async () => {
        const userId = userData?.userId || userData?.id;
        if (!userId) return;
        setActivating(true);
        try {
            await userService.updateUser(userId, { isActive: true });
            addToast('Member activated successfully.', 'success');
            onUpdated?.();
            await fetchUserDetails();
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to activate user.';
            addToast(msg, 'error');
        } finally {
            setActivating(false);
        }
    };

    if (!userId) return null;

    const name = userData?.fullName || userData?.userName || '';
    const initials = name.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
    const isActive = userData?.isActive === true || userData?.status === 1;
    const roleName = systemRoleMap[userData?.role] || userData?.role || 'Member';
    const studentId = String(userData?.studentId ?? userData?.StudentId ?? userData?.studentID ?? userData?.student_id ?? '').trim();
    const selectedId = String(userData?.userId || userData?.id || '').trim().toLowerCase();
    const selectedEmail = String(userData?.email || '').trim().toLowerCase();
    const myId = String(currentUserId || '').trim().toLowerCase();
    const myEmail = String(currentUserEmail || '').trim().toLowerCase();
    const isSelfProfile = (selectedId && myId && selectedId === myId) || (selectedEmail && myEmail && selectedEmail === myEmail);
    const normalizedCurrentRole = normalizeRoleToken(currentUserRole);
    const canCurrentUserEdit =
        Boolean(isLabDirector) ||
        Number(currentUserRole) === SystemRoleEnum.LabDirector ||
        normalizedCurrentRole === 'labdirector';

    const targetRoleRaw = userData?.role ?? userData?.Role;
    const targetRoleNameRaw = userData?.roleName ?? userData?.RoleName;
    const normalizedTargetRole = normalizeRoleToken(targetRoleRaw);
    const normalizedTargetRoleName = normalizeRoleToken(targetRoleNameRaw);
    const isTargetPrivileged =
        Number(targetRoleRaw) === SystemRoleEnum.Admin ||
        normalizedTargetRole === 'admin' ||
        normalizedTargetRoleName === 'admin';

    const canEditProfile = canCurrentUserEdit && !isSelfProfile && !isTargetPrivileged;

    return (
        <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            overflow: 'hidden',
            background: 'var(--card-bg)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.25s ease-out'
        }}>
            {/* ── Hero ── */}
            <div style={{
                background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%)',
                padding: '1.25rem 1.25rem 1rem',
                position: 'relative'
            }}>
                {/* Close */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '10px', right: '10px',
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)', border: 'none',
                        color: '#fff', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                >
                    <X size={15} />
                </button>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                        <Loader2 className="animate-spin" size={28} style={{ color: '#fff' }} />
                    </div>
                ) : error ? null : userData ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        {/* Avatar */}
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '14px',
                            background: 'rgba(255,255,255,0.25)',
                            border: '2px solid rgba(255,255,255,0.5)',
                            color: '#fff', fontSize: '1.2rem', fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, overflow: 'hidden'
                        }}>
                            {(userData.avatarUrl || userData.AvatarUrl) ? (
                                <img
                                    src={userData.avatarUrl || userData.AvatarUrl}
                                    alt={name}
                                    referrerPolicy="no-referrer"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : initials}
                        </div>

                        {/* Name + role */}
                        <div style={{ minWidth: 0 }}>
                            <h2 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                                {name || 'Unknown'}
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{
                                    fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)',
                                    background: 'rgba(255,255,255,0.2)', padding: '2px 8px',
                                    borderRadius: '999px', border: '1px solid rgba(255,255,255,0.3)'
                                }}>
                                    {roleName}
                                </span>
                                {isActive ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.62rem', fontWeight: 700, color: '#bbf7d0', background: 'rgba(16,185,129,0.25)', padding: '2px 7px', borderRadius: '999px' }}>
                                        <CheckCircle size={9} /> Active
                                    </span>
                                ) : (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.62rem', fontWeight: 700, color: '#fca5a5', background: 'rgba(239,68,68,0.25)', padding: '2px 7px', borderRadius: '999px' }}>
                                        <XCircle size={9} /> Inactive
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* ── Body ── */}
            {error ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)' }}>
                    <p style={{ marginBottom: '1rem' }}>{error}</p>
                    <button className="btn btn-secondary" onClick={fetchUserDetails}>Retry</button>
                </div>
            ) : userData ? (
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }} className="custom-scrollbar">

                    {isEditing ? (
                        /* ── Edit Form ── */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{
                                background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
                                border: '1px solid #e2e8f0',
                                borderRadius: '14px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    padding: '10px 12px',
                                    borderBottom: '1px solid #e2e8f0',
                                    background: '#f8fafc'
                                }}>
                                    <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>
                                        Edit Profile
                                    </p>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                                        Update member information and research links
                                    </p>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' }}>
                                    {([
                                        { key: 'fullName', label: 'Full Name', placeholder: 'Full name' },
                                        { key: 'studentId', label: 'Student ID', placeholder: 'e.g. SE123456' },
                                        { key: 'phoneNumber', label: 'Phone', placeholder: 'e.g. 0912345678' },
                                        { key: 'orcid', label: 'ORCID', placeholder: 'xxxx-xxxx-xxxx-xxxx' },
                                        { key: 'googleScholarUrl', label: 'Scholar URL', placeholder: 'Google Scholar link' },
                                        { key: 'githubUrl', label: 'GitHub URL', placeholder: 'GitHub profile link' },
                                    ] as const).map(({ key, label, placeholder }) => (
                                        <div key={key} style={{
                                            padding: '8px 10px',
                                            border: `1px solid ${fieldErrors[key] ? '#fecaca' : '#e2e8f0'}`,
                                            background: fieldErrors[key] ? '#fef2f2' : '#ffffff',
                                            borderRadius: '10px'
                                        }}>
                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                {label}
                                            </label>
                                            <input
                                                value={editForm[key]}
                                                onChange={e => {
                                                    const v = e.target.value;
                                                    setEditForm(f => ({ ...f, [key]: v }));
                                                    setFieldError(key, validate[key](v.trim()));
                                                }}
                                                placeholder={placeholder}
                                                style={{
                                                    width: '100%',
                                                    fontSize: '0.78rem',
                                                    border: `1px solid ${fieldErrors[key] ? '#fca5a5' : '#cbd5e1'}`,
                                                    borderRadius: '8px',
                                                    padding: '8px 10px',
                                                    background: '#f8fafc',
                                                    color: 'var(--text-primary)',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            {fieldErrors[key] && (
                                                <p style={{ margin: '6px 0 0 0', fontSize: '0.68rem', color: '#dc2626', fontWeight: 700 }}>{fieldErrors[key]}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                    style={{ flex: 1, padding: '9px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 800, background: '#2563eb', color: '#fff', boxShadow: '0 6px 16px rgba(37,99,235,0.25)' }}
                                >
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {saving ? 'Saving…' : 'Save Changes'}
                                </button>
                                <button
                                    onClick={() => { setIsEditing(false); setFieldErrors({ fullName: '', studentId: '', phoneNumber: '', orcid: '', googleScholarUrl: '', githubUrl: '' }); }}
                                    disabled={saving}
                                    style={{ flex: 1, padding: '9px', borderRadius: '10px', border: '1px solid #cbd5e1', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, background: '#f8fafc', color: '#334155' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                        {/* ── Contact section ── */}
                        <Section label="Contact">
                            <Field icon={<Mail size={12} />} label="Email" value={userData.email} />
                            <Field icon={<Phone size={12} />} label="Phone" value={userData.phoneNumber || userData.PhoneNumber} />
                        </Section>

                        {/* ── Academic section ── */}
                        <Section label="Academic">
                            <Field icon={<GraduationCap size={12} />} label="Student ID" value={studentId || null} />
                            <Field icon={<BookOpen size={12} />} label="ORCID" value={userData.orcid || userData.Orcid} />
                            <Field icon={<BookOpen size={12} />} label="Google Scholar" value={userData.googleScholarUrl || userData.GoogleScholarUrl} link />
                            <Field icon={<BookOpen size={12} />} label="GitHub" value={userData.githubUrl || userData.GithubUrl} link />
                        </Section>

                        {/* ── Dates section ── */}
                        <Section label="Activity">
                            <Field icon={<Clock size={12} />} label="Joined" value={formatProjectDate(userData.createdAt, '—')} />
                            <Field icon={<Clock size={12} />} label="Updated" value={formatProjectDate(userData.updatedAt, '—')} />
                        </Section>
                        </>
                    )}

                    {/* ── Actions ── */}
                    {!isEditing && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <button
                            onClick={() => onCheckLog(userData.email, studentId, name)}
                            style={{
                                width: '100%', padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                fontSize: '0.78rem', fontWeight: 700,
                                background: isCheckLogOpen ? 'var(--primary-color)' : 'var(--surface-hover)',
                                color: isCheckLogOpen ? '#fff' : 'var(--text-primary)',
                                transition: 'all 0.2s'
                            }}
                        >
                            <ClipboardList size={14} />
                            {isCheckLogOpen ? 'Viewing Check Log' : 'Check Log'}
                        </button>

                        {onViewProjects && (
                            <button
                                onClick={() => onViewProjects(userData.email, name)}
                                style={{
                                    width: '100%', padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    fontSize: '0.78rem', fontWeight: 700,
                                    background: isProjectPanelOpen ? 'var(--primary-color)' : 'var(--surface-hover)',
                                    color: isProjectPanelOpen ? '#fff' : 'var(--text-primary)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Briefcase size={14} />
                                {isProjectPanelOpen ? 'Viewing Projects' : 'View Projects'}
                            </button>
                        )}

                        {/* Lab Time button */}
                        {onLabTime && (() => {
                            const targetUserId = userData?.userId || userData?.id;
                            return (
                                <button
                                    onClick={() => onLabTime(targetUserId, name)}
                                    style={{
                                        width: '100%', padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        fontSize: '0.78rem', fontWeight: 700,
                                        background: isLabTimePanelOpen ? 'var(--primary-color)' : 'var(--surface-hover)',
                                        color: isLabTimePanelOpen ? '#fff' : 'var(--text-primary)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Clock size={14} />
                                    {isLabTimePanelOpen ? 'Viewing Lab Time' : 'Lab Time'}
                                </button>
                            );
                        })()}

                        {canEditProfile && (
                            <button
                                onClick={() => setIsEditing(true)}
                                style={{
                                    width: '100%', padding: '8px', borderRadius: '10px', border: '1.5px solid #bfdbfe', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    fontSize: '0.78rem', fontWeight: 700,
                                    background: '#eff6ff', color: '#2563eb', transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; }}
                            >
                                <Pencil size={14} />
                                Edit Profile
                            </button>
                        )}

                        {/* ── Change Role button (Lab Director only, not self, not Admin target) ── */}
                        {canEditProfile && !isChangingRole && (
                            <button
                                onClick={() => { setIsChangingRole(true); setPendingRole(userData?.role ?? null); }}
                                style={{
                                    width: '100%', padding: '8px', borderRadius: '10px', border: '1.5px solid #d8b4fe', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    fontSize: '0.78rem', fontWeight: 700,
                                    background: '#faf5ff', color: '#7c3aed', transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#ede9fe'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#faf5ff'; }}
                            >
                                <ShieldCheck size={14} />
                                Change Role
                            </button>
                        )}

                        {/* ── Inline role selector ── */}
                        {canEditProfile && isChangingRole && (() => {
                            const ROLE_OPTIONS = [
                                { value: 2, label: 'Lab Director',      color: '#7c3aed', bg: '#faf5ff', border: '#d8b4fe' },
                                { value: 3, label: 'Senior Researcher', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
                                { value: 4, label: 'Member',            color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
                                { value: 5, label: 'Guest',             color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
                            ];
                            const selectedOpt = ROLE_OPTIONS.find(o => o.value === pendingRole);
                            return (
                                <div style={{
                                    border: '1.5px solid #d8b4fe',
                                    borderRadius: '12px',
                                    background: '#faf5ff',
                                    overflow: 'hidden',
                                    animation: 'fadeIn 0.2s ease-out'
                                }}>
                                    {/* Header */}
                                    <div style={{
                                        padding: '8px 12px',
                                        borderBottom: '1px solid #e9d5ff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <ShieldCheck size={13} color="#7c3aed" />
                                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Change Role</span>
                                        </div>
                                        <button
                                            onClick={() => { setIsChangingRole(false); setPendingRole(null); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>

                                    {/* Role options */}
                                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {ROLE_OPTIONS.map(opt => {
                                            const isCurrent = opt.value === (userData?.role ?? null);
                                            const isSelected = opt.value === pendingRole;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setPendingRole(opt.value)}
                                                    style={{
                                                        width: '100%', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                                                        border: `1.5px solid ${isSelected ? opt.border : isCurrent ? '#e2e8f0' : 'transparent'}`,
                                                        background: isSelected ? opt.bg : isCurrent ? '#f8fafc' : 'transparent',
                                                        transition: 'all 0.15s'
                                                    }}
                                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f3e8ff'; }}
                                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isCurrent ? '#f8fafc' : 'transparent'; }}
                                                >
                                                    {/* Radio dot */}
                                                    <span style={{
                                                        width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                                                        border: `2px solid ${isSelected ? opt.color : '#cbd5e1'}`,
                                                        background: isSelected ? opt.color : 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        {isSelected && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />}
                                                    </span>
                                                    <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? opt.color : '#334155' }}>
                                                        {opt.label}
                                                    </span>
                                                    {isCurrent && (
                                                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b', background: '#e2e8f0', padding: '1px 6px', borderRadius: 99 }}>current</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Footer actions */}
                                    <div style={{ padding: '8px', borderTop: '1px solid #e9d5ff', display: 'flex', gap: 6 }}>
                                        <button
                                            onClick={() => { setIsChangingRole(false); setPendingRole(null); }}
                                            style={{
                                                flex: 1, padding: '7px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                                background: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#475569'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (pendingRole !== null && pendingRole !== userData?.role) {
                                                    setShowRoleConfirm(true);
                                                }
                                            }}
                                            disabled={pendingRole === null || pendingRole === userData?.role}
                                            style={{
                                                flex: 1, padding: '7px', borderRadius: '8px', border: 'none',
                                                cursor: (pendingRole === null || pendingRole === userData?.role) ? 'not-allowed' : 'pointer',
                                                fontSize: '0.75rem', fontWeight: 700,
                                                background: (pendingRole === null || pendingRole === userData?.role) ? '#e2e8f0' : '#7c3aed',
                                                color: (pendingRole === null || pendingRole === userData?.role) ? '#94a3b8' : '#fff',
                                                transition: 'all 0.15s',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5
                                            }}
                                        >
                                            <ShieldCheck size={12} />
                                            Apply Role
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                    )}

                    {isLabDirector && !isSelfProfile && !isEditing && (
                        isActive ? (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={deleting || activating}
                                style={{
                                    width: '100%', padding: '8px', borderRadius: '10px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    fontSize: '0.78rem', fontWeight: 700, marginTop: '6px',
                                    background: '#fef2f2', color: '#ef4444',
                                    border: '1.5px solid #fecaca', transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; }}
                            >
                                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Deactivate Member
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowActivateConfirm(true)}
                                disabled={activating || deleting}
                                style={{
                                    width: '100%', padding: '8px', borderRadius: '10px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    fontSize: '0.78rem', fontWeight: 700, marginTop: '6px',
                                    background: '#ecfdf5', color: '#16a34a',
                                    border: '1.5px solid #86efac', transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#ecfdf5'; }}
                            >
                                {activating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                Activate Member
                            </button>
                        )
                    )}
                </div>
            ) : null}

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeactivate}
                title="Deactivate Member"
                message={`Deactivate ${name || 'this user'}? They will no longer be able to access the system.`}
                confirmText="Deactivate"
                cancelText="Cancel"
                variant="danger"
            />

            <ConfirmModal
                isOpen={showActivateConfirm}
                onClose={() => setShowActivateConfirm(false)}
                onConfirm={async () => {
                    setShowActivateConfirm(false);
                    await handleActivate();
                }}
                title="Activate Member"
                message={`Activate ${name || 'this user'}? They will be able to access the system again.`}
                confirmText="Activate"
                cancelText="Cancel"
                variant="success"
            />

            {/* ── Role Change Confirm Modal ── */}
            {showRoleConfirm && (() => {
                const ROLE_LABELS: Record<number, { label: string; color: string; bg: string; border: string }> = {
                    2: { label: 'Lab Director',      color: '#7c3aed', bg: '#faf5ff', border: '#d8b4fe' },
                    3: { label: 'Senior Researcher', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
                    4: { label: 'Member',            color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
                    5: { label: 'Guest',             color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
                };
                const fromMeta = ROLE_LABELS[userData?.role] ?? { label: roleName, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
                const toMeta   = ROLE_LABELS[pendingRole!] ?? { label: String(pendingRole), color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
                return (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(15, 23, 42, 0.55)',
                        backdropFilter: 'blur(4px)',
                        animation: 'fadeIn 0.18s ease-out'
                    }} onClick={() => setShowRoleConfirm(false)}>
                        <div
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: '#fff',
                                borderRadius: '20px',
                                width: '100%',
                                maxWidth: '420px',
                                margin: '0 16px',
                                boxShadow: '0 25px 60px rgba(15, 23, 42, 0.22), 0 4px 16px rgba(124,58,237,0.12)',
                                overflow: 'hidden',
                                animation: 'slideUp 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)'
                            }}
                        >
                            {/* Modal top accent */}
                            <div style={{ height: 5, background: 'linear-gradient(90deg, #7c3aed 0%, #a855f7 50%, #6366f1 100%)' }} />

                            {/* Header */}
                            <div style={{ padding: '20px 22px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 14,
                                        background: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)',
                                        border: '1.5px solid #d8b4fe',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <ShieldCheck size={20} color="#7c3aed" />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>Confirm Role Change</h3>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>This action will take effect immediately</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowRoleConfirm(false)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, marginTop: -2 }}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div style={{ padding: '16px 22px' }}>
                                {/* Member info */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 12px', borderRadius: 12,
                                    background: '#f8fafc', border: '1px solid #e2e8f0',
                                    marginBottom: 16
                                }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10,
                                        background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%)',
                                        color: '#fff', fontWeight: 800, fontSize: '0.9rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, overflow: 'hidden'
                                    }}>
                                        {(userData?.avatarUrl || userData?.AvatarUrl) ? (
                                            <img src={userData.avatarUrl || userData.AvatarUrl} alt={name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : initials}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || 'Unknown'}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userData?.email}</div>
                                    </div>
                                </div>

                                {/* Role transition */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
                                    {/* From */}
                                    <div style={{
                                        flex: 1, padding: '8px 12px', borderRadius: 10, textAlign: 'center',
                                        background: fromMeta.bg, border: `1.5px solid ${fromMeta.border}`
                                    }}>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>From</div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: fromMeta.color }}>{fromMeta.label}</div>
                                    </div>
                                    {/* Arrow */}
                                    <div style={{ fontSize: '1.2rem', color: '#7c3aed', fontWeight: 800, flexShrink: 0 }}>→</div>
                                    {/* To */}
                                    <div style={{
                                        flex: 1, padding: '8px 12px', borderRadius: 10, textAlign: 'center',
                                        background: toMeta.bg, border: `2px solid ${toMeta.border}`,
                                        boxShadow: `0 0 0 3px ${toMeta.border}55`
                                    }}>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>To</div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: toMeta.color }}>{toMeta.label}</div>
                                    </div>
                                </div>

                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', textAlign: 'center', lineHeight: 1.6 }}>
                                    Are you sure you want to change <strong>{name || 'this member'}</strong>'s role?
                                    <br />This will immediately affect their access permissions.
                                </p>
                            </div>

                            {/* Footer */}
                            <div style={{ padding: '0 22px 20px', display: 'flex', gap: 10 }}>
                                <button
                                    onClick={() => setShowRoleConfirm(false)}
                                    disabled={roleChanging}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: 12,
                                        border: '1.5px solid #e2e8f0', background: '#f8fafc',
                                        cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#475569'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleChangeRole}
                                    disabled={roleChanging}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: 12, border: 'none',
                                        cursor: roleChanging ? 'not-allowed' : 'pointer',
                                        fontSize: '0.82rem', fontWeight: 800,
                                        background: roleChanging ? '#ede9fe' : 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
                                        color: roleChanging ? '#a78bfa' : '#fff',
                                        boxShadow: roleChanging ? 'none' : '0 8px 20px rgba(124,58,237,0.35)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => { if (!roleChanging) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    {roleChanging ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                    {roleChanging ? 'Updating…' : 'Confirm Change'}
                                </button>
                            </div>
                        </div>

                        <style>{`
                            @keyframes slideUp {
                                from { opacity: 0; transform: translateY(24px) scale(0.96); }
                                to   { opacity: 1; transform: translateY(0)   scale(1);    }
                            }
                        `}</style>
                    </div>
                );
            })()}
        </div>
    );
};

/* ── Helpers ── */
const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div style={{ background: 'var(--background-color)', borderRadius: '10px', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
        <div style={{ padding: '5px 10px', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', background: 'var(--surface-hover)' }}>
            {label}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {children}
        </div>
    </div>
);

const Field: React.FC<{ icon: React.ReactNode; label: string; value: string | null | undefined; link?: boolean }> = ({ icon, label, value, link }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderBottom: '1px solid var(--border-light)', minWidth: 0 }}>
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: '70px', flexShrink: 0 }}>{label}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
            {value ? (
                link ? (
                    <a href={value} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: '0.75rem', color: 'var(--primary-color)', display: 'inline-flex', alignItems: 'center', gap: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                        <ExternalLink size={10} style={{ flexShrink: 0 }} />
                    </a>
                ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{value}</span>
                )
            ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
            )}
        </div>
    </div>
);

export default UserDetailModal;
