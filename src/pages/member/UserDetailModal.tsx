import React, { useState, useEffect } from 'react';
import { userService } from '@/services/userService';
import { formatProjectDate } from '@/utils/projectUtils';
import { Mail, Loader2, X, Phone, BookOpen, GraduationCap, ClipboardList, Clock, CheckCircle, XCircle, ExternalLink, Trash2, Briefcase } from 'lucide-react';
import ConfirmModal from '@/components/common/ConfirmModal';
import { useToastStore } from '@/store/slices/toastSlice';

interface UserDetailModalProps {
    onClose: () => void;
    userId: string | null;
    systemRoleMap: Record<number | string, string>;
    currentUserId?: string;
    currentUserEmail?: string;
    onCheckLog: (email: string, studentId: string, userName: string) => void;
    isCheckLogOpen: boolean;
    isLabDirector?: boolean;
    onDeleted?: () => void;
    onViewProjects?: (email: string, userName: string) => void;
    isProjectPanelOpen?: boolean;
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({ onClose, userId, systemRoleMap, currentUserId, currentUserEmail, onCheckLog, isCheckLogOpen, isLabDirector, onDeleted, onViewProjects, isProjectPanelOpen }) => {
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const { addToast } = useToastStore();

    useEffect(() => {
        if (userId) { fetchUserDetails(); return; }
        setUserData(null);
        setError(null);
    }, [userId]);

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

                    {/* ── Actions ── */}
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
                                    background: isProjectPanelOpen ? '#6366f1' : 'var(--surface-hover)',
                                    color: isProjectPanelOpen ? '#fff' : 'var(--text-primary)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Briefcase size={14} />
                                {isProjectPanelOpen ? 'Viewing Projects' : 'View Projects'}
                            </button>
                        )}
                    </div>

                    {isLabDirector && !isSelfProfile && (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={deleting}
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
