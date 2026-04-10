import React, { useState, useEffect } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { userService, ProfileResponse } from '@/services/userService';
import { SystemRoleMap } from '@/types/enums';
import {
    Eye, Edit3, Save, User, Mail, Shield, Calendar,
    Loader2, CheckCircle, AlertTriangle, Phone,
    Link as LinkIcon, GraduationCap, RefreshCw, Info
} from 'lucide-react';

const ProfilePage: React.FC = () => {
    const { user: authUser, refreshUser } = useAuth();

    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [imgError, setImgError] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [editData, setEditData] = useState({ fullName: '', studentId: '', phoneNumber: '', orcid: '', googleScholarUrl: '', githubUrl: '' });
    const [fieldErrors, setFieldErrors] = useState({ studentId: '', phoneNumber: '', orcid: '', googleScholarUrl: '', githubUrl: '' });

    // Keep backward-compat alias used in JSX below
    const studentIdError = fieldErrors.studentId;
    const setStudentIdError = (v: string) => setFieldErrors(prev => ({ ...prev, studentId: v }));

    const validate = {
        studentId: (v: string) => v && !/^[A-Za-z]{2}\d{4}$/.test(v) ? 'Format: 2 letters + 4 digits (e.g. SE1234)' : '',
        phoneNumber: (v: string) => v && !/^\+?[\d\s\-().]{7,20}$/.test(v) ? 'Invalid phone number' : '',
        orcid: (v: string) => v && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(v) ? 'Format: xxxx-xxxx-xxxx-xxxx' : '',
        googleScholarUrl: (v: string) => v && !/^https?:\/\/(www\.)?scholar\.google\.[a-z.]+\//.test(v) ? 'Must be a valid Google Scholar URL' : '',
        githubUrl: (v: string) => v && !/^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+/.test(v) ? 'Must be a valid GitHub profile URL' : '',
    };

    const setError = (field: keyof typeof fieldErrors, v: string) =>
        setFieldErrors(prev => ({ ...prev, [field]: v }));


    useEffect(() => { fetchProfile(); }, []);
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const data = await userService.getProfile();
            setProfile(data);
            setEditData({
                fullName: data.fullName || '',
                studentId: data.studentId || '',
                phoneNumber: data.phoneNumber || '',
                orcid: data.orcid || '',
                googleScholarUrl: data.googleScholarUrl || '',
                githubUrl: data.githubUrl || ''
            });
        } catch (error) {
            setToast({ message: 'Failed to load profile data.', type: 'error' });
        } finally { setLoading(false); }
    };

    const handleSave = async () => {
        const hasChanges =
            editData.fullName.trim() !== (profile?.fullName || '') ||
            editData.studentId.trim() !== (profile?.studentId || '') ||
            editData.phoneNumber.trim() !== (profile?.phoneNumber || '') ||
            editData.orcid.trim() !== (profile?.orcid || '') ||
            editData.googleScholarUrl.trim() !== (profile?.googleScholarUrl || '') ||
            editData.githubUrl.trim() !== (profile?.githubUrl || '');

        if (!hasChanges) {
            setIsEditMode(false);
            return;
        }

        const errors = {
            studentId: validate.studentId(editData.studentId.trim()),
            phoneNumber: validate.phoneNumber(editData.phoneNumber.trim()),
            orcid: validate.orcid(editData.orcid.trim()),
            googleScholarUrl: validate.googleScholarUrl(editData.googleScholarUrl.trim()),
            githubUrl: validate.githubUrl(editData.githubUrl.trim()),
        };
        setFieldErrors(errors);
        if (Object.values(errors).some(Boolean)) return;

        setSubmitting(true);
        try {
            await userService.updateProfile({
                fullName: editData.fullName.trim() || undefined,
                studentId: editData.studentId.trim() || null,
                phoneNumber: editData.phoneNumber.trim() || null,
                orcid: editData.orcid.trim() || null,
                googleScholarUrl: editData.googleScholarUrl.trim() || null,
                githubUrl: editData.githubUrl.trim() || null
            });
            setToast({ message: 'Profile updated successfully!', type: 'success' });
            setIsEditMode(false);
            refreshUser();
            fetchProfile();
        } catch (error: any) {
            setToast({ message: error.response?.data?.message || 'Update failed.', type: 'error' });
        } finally { setSubmitting(false); }
    };

    const handleCancelEdit = () => {
        setEditData({
            fullName: profile?.fullName || '',
            studentId: profile?.studentId || '',
            phoneNumber: profile?.phoneNumber || '',
            orcid: profile?.orcid || '',
            googleScholarUrl: profile?.googleScholarUrl || '',
            githubUrl: profile?.githubUrl || ''
        });
        setFieldErrors({ studentId: '', phoneNumber: '', orcid: '', googleScholarUrl: '', githubUrl: '' });
        setIsEditMode(false);
    };

    const initials = (profile?.fullName || authUser.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const memberSince = profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    const roleLabel = SystemRoleMap[profile?.role ?? authUser.role] || 'Member';

    if (loading) {
        return (
            <MainLayout role={authUser.role} userName={authUser.name}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--accent-color)' }} />
                        <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading profile...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout role={authUser.role} userName={authUser.name}>
            <div className="page-container" style={{ margin: '0 auto' }}>
                {/* Toast */}
                {toast && (
                    <div style={{
                        position: 'fixed', top: '80px', right: '1.5rem', zIndex: 2000,
                        padding: '1rem 1.5rem', borderRadius: '12px',
                        background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                        color: toast.type === 'success' ? '#166534' : '#991b1b',
                        display: 'flex', alignItems: 'center', gap: '10px', boxShadow: 'var(--shadow-lg)',
                        fontSize: '0.9rem', fontWeight: 600, animation: 'slideInRight 0.3s'
                    }}>
                        {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                        {toast.message}
                    </div>
                )}

                {/* Page Header */}
                <div className="page-header">
                    <div>
                        <h1>User Profile</h1>
                        <p>Manage your identity and research credentials</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', background: '#e2e8f0', padding: '4px', borderRadius: '12px' }}>
                            <button onClick={handleCancelEdit} className={`tab-btn ${!isEditMode ? 'active' : ''}`}><Eye size={16} /> View</button>
                            <button onClick={() => setIsEditMode(true)} className={`tab-btn ${isEditMode ? 'active' : ''}`}><Edit3 size={16} /> Edit</button>
                        </div>
                        {isEditMode && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn btn-secondary" onClick={handleCancelEdit} disabled={submitting}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleSave} disabled={submitting}>
                                    {submitting ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                                    {submitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Identity Card — avatar, name, meta, + Google notice */}
                    <div className="card" style={{ padding: '2rem', marginBottom: 0 }}>
                        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

                            {/* Avatar */}
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{
                                    width: '96px', height: '96px', borderRadius: '50%',
                                    background: profile?.avatarUrl ? 'none' : 'linear-gradient(135deg, var(--accent-color), var(--accent-light))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontSize: '2rem', fontWeight: 800, overflow: 'hidden',
                                    border: '4px solid white', boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
                                }}>
                                    {profile?.avatarUrl && !imgError ? (
                                        <img src={profile.avatarUrl} alt="Me" referrerPolicy="no-referrer"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={() => setImgError(true)} />
                                    ) : initials}
                                </div>
                                <div style={{
                                    position: 'absolute', bottom: '4px', right: '4px',
                                    width: '14px', height: '14px', borderRadius: '50%',
                                    background: '#10b981', border: '3px solid white'
                                }} />
                            </div>

                            {/* Identity info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h2 style={{ margin: '0 0 8px 0', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                                    {profile?.fullName || authUser.name}
                                </h2>
                                <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    {profile?.email || authUser.email}
                                </p>

                                {/* Badges row */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        padding: '4px 12px', borderRadius: '20px',
                                        background: 'var(--accent-bg)', color: 'var(--accent-color)',
                                        fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em'
                                    }}>
                                        <Shield size={11} /> {roleLabel}
                                    </span>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        padding: '4px 12px', borderRadius: '20px',
                                        background: '#f0fdf4', color: '#16a34a',
                                        fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em'
                                    }}>
                                        <CheckCircle size={11} /> Active
                                    </span>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        padding: '4px 12px', borderRadius: '20px',
                                        background: '#f1f5f9', color: '#475569',
                                        fontSize: '0.75rem', fontWeight: 600
                                    }}>
                                        <Calendar size={11} /> Joined {memberSince}
                                    </span>
                                </div>

                                {/* Google Workspace notice — prominent, right below name */}
                                <div style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                                    padding: '10px 14px', borderRadius: '10px',
                                    background: '#eff6ff', border: '1px solid #bfdbfe',
                                    maxWidth: '520px'
                                }}>
                                    <Info size={15} style={{ color: '#3b82f6', marginTop: '1px', flexShrink: 0 }} />
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#1e40af', lineHeight: 1.6, fontWeight: 500 }}>
                                        Authentication is provided via Google Workspace. To update your password or profile picture, please use your Google primary account settings.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content grid: Basic Info + Research Profiles */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '1.5rem',
                        alignItems: 'start'
                    }}>
                        {/* Basic Info */}
                        <div className="card" style={{ padding: '1.75rem', marginBottom: 0 }}>
                            <h4 style={{
                                margin: '0 0 1.5rem 0', fontSize: '0.75rem', fontWeight: 700,
                                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em'
                            }}>
                                Basic Information
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                                {/* Full Name */}
                                <FieldRow
                                    icon={<User size={14} />}
                                    label="Full Name"
                                    editable={isEditMode}
                                    editHint
                                >
                                    {isEditMode ? (
                                        <StyledInput
                                            value={editData.fullName}
                                            placeholder="Your full name"
                                            onChange={v => setEditData({ ...editData, fullName: v })}
                                        />
                                    ) : (
                                        <FieldValue>{profile?.fullName || '—'}</FieldValue>
                                    )}
                                </FieldRow>

                                {/* Email */}
                                <FieldRow
                                    icon={<Mail size={14} />}
                                    label="Email Address"
                                    badge="Google Account"
                                >
                                    <FieldValue muted={isEditMode}>{profile?.email || authUser.email || '—'}</FieldValue>
                                </FieldRow>

                                {/* Student ID */}
                                <FieldRow
                                    icon={<GraduationCap size={14} />}
                                    label="Student ID"
                                    editable={isEditMode}
                                    editHint
                                >
                                    {isEditMode ? (
                                        <>
                                            <StyledInput
                                                value={editData.studentId}
                                                placeholder="e.g. SE1234"
                                                error={!!studentIdError}
                                                onChange={v => {
                                                    setEditData({ ...editData, studentId: v });
                                                    setStudentIdError(v.trim() && !/^[A-Za-z]{2}\d{4}$/.test(v.trim()) ? 'Format: 2 letters + 4 digits (e.g. SE1234)' : '');
                                                }}
                                            />
                                            {studentIdError && (
                                                <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600, marginTop: '4px' }}>{studentIdError}</div>
                                            )}
                                        </>
                                    ) : (
                                        <FieldValue>{profile?.studentId || '—'}</FieldValue>
                                    )}
                                </FieldRow>

                                {/* Phone */}
                                <FieldRow
                                    icon={<Phone size={14} />}
                                    label="Phone Number"
                                    editable={isEditMode}
                                    editHint
                                >
                                    {isEditMode ? (
                                        <>
                                            <StyledInput
                                                type="tel"
                                                value={editData.phoneNumber}
                                                placeholder="e.g. +84 912 345 678"
                                                error={!!fieldErrors.phoneNumber}
                                                onChange={v => {
                                                    setEditData({ ...editData, phoneNumber: v });
                                                    setError('phoneNumber', validate.phoneNumber(v.trim()));
                                                }}
                                            />
                                            {fieldErrors.phoneNumber && <ErrorHint>{fieldErrors.phoneNumber}</ErrorHint>}
                                        </>
                                    ) : (
                                        <FieldValue>{profile?.phoneNumber || '—'}</FieldValue>
                                    )}
                                </FieldRow>

                            </div>
                        </div>

                        {/* Research Profiles */}
                        <div className="card" style={{ padding: '1.75rem', marginBottom: 0 }}>
                            <h4 style={{
                                margin: '0 0 1.5rem 0', fontSize: '0.75rem', fontWeight: 700,
                                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em'
                            }}>
                                Research Profiles
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                                {/* ORCID */}
                                <FieldRow
                                    icon={<LinkIcon size={14} />}
                                    label="ORCID"
                                    editable={isEditMode}
                                    editHint
                                >
                                    {isEditMode ? (
                                        <>
                                            <StyledInput
                                                value={editData.orcid}
                                                placeholder="xxxx-xxxx-xxxx-xxxx"
                                                error={!!fieldErrors.orcid}
                                                onChange={v => {
                                                    setEditData({ ...editData, orcid: v });
                                                    setError('orcid', validate.orcid(v.trim()));
                                                }}
                                            />
                                            {fieldErrors.orcid && <ErrorHint>{fieldErrors.orcid}</ErrorHint>}
                                        </>
                                    ) : profile?.orcid ? (
                                        <a href={`https://orcid.org/${profile.orcid}`} target="_blank" rel="noreferrer" style={{
                                            display: 'inline-block', fontSize: '0.95rem', fontWeight: 600,
                                            color: 'var(--primary-color)', padding: '10px 0', textDecoration: 'none'
                                        }}>
                                            {profile.orcid}
                                        </a>
                                    ) : (
                                        <FieldValue>—</FieldValue>
                                    )}
                                </FieldRow>

                                {/* Google Scholar */}
                                <FieldRow
                                    icon={<GraduationCap size={14} />}
                                    label="Google Scholar"
                                    editable={isEditMode}
                                    editHint
                                >
                                    {isEditMode ? (
                                        <>
                                            <StyledInput
                                                type="url"
                                                value={editData.googleScholarUrl}
                                                placeholder="https://scholar.google.com/..."
                                                error={!!fieldErrors.googleScholarUrl}
                                                onChange={v => {
                                                    setEditData({ ...editData, googleScholarUrl: v });
                                                    setError('googleScholarUrl', validate.googleScholarUrl(v.trim()));
                                                }}
                                            />
                                            {fieldErrors.googleScholarUrl && <ErrorHint>{fieldErrors.googleScholarUrl}</ErrorHint>}
                                        </>
                                    ) : profile?.googleScholarUrl ? (
                                        <a href={profile.googleScholarUrl} target="_blank" rel="noreferrer" style={{
                                            display: 'block', fontSize: '0.95rem', fontWeight: 600,
                                            color: 'var(--primary-color)', padding: '10px 0', textDecoration: 'none',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}>
                                            {profile.googleScholarUrl}
                                        </a>
                                    ) : (
                                        <FieldValue>—</FieldValue>
                                    )}
                                </FieldRow>

                                {/* GitHub */}
                                <FieldRow
                                    icon={<LinkIcon size={14} />}
                                    label="GitHub"
                                    editable={isEditMode}
                                    editHint
                                >
                                    {isEditMode ? (
                                        <>
                                            <StyledInput
                                                type="url"
                                                value={editData.githubUrl}
                                                placeholder="https://github.com/username"
                                                error={!!fieldErrors.githubUrl}
                                                onChange={v => {
                                                    setEditData({ ...editData, githubUrl: v });
                                                    setError('githubUrl', validate.githubUrl(v.trim()));
                                                }}
                                            />
                                            {fieldErrors.githubUrl && <ErrorHint>{fieldErrors.githubUrl}</ErrorHint>}
                                        </>
                                    ) : profile?.githubUrl ? (
                                        <a href={profile.githubUrl} target="_blank" rel="noreferrer" style={{
                                            display: 'block', fontSize: '0.95rem', fontWeight: 600,
                                            color: 'var(--primary-color)', padding: '10px 0', textDecoration: 'none',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}>
                                            {profile.githubUrl}
                                        </a>
                                    ) : (
                                        <FieldValue>—</FieldValue>
                                    )}
                                </FieldRow>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .tab-btn {
                    padding: 8px 18px; border: none; background: transparent; cursor: pointer;
                    font-size: 0.85rem; font-weight: 700; color: var(--text-secondary);
                    display: flex; align-items: center; gap: 8px; border-radius: 8px; transition: all 0.2s;
                }
                .tab-btn.active { background: white; color: var(--accent-color); box-shadow: var(--shadow-sm); }
                @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
                .animate-spin { animation: spin 1.2s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </MainLayout>
    );
};

/* ── Small helper components ── */

const FieldRow: React.FC<{
    icon: React.ReactNode;
    label: string;
    badge?: string;
    editable?: boolean;
    editHint?: boolean;
    children: React.ReactNode;
}> = ({ icon, label, badge, editable, editHint, children }) => (
    <div>
        <label style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px'
        }}>
            {icon} {label}
            {badge && (
                <span style={{
                    fontSize: '0.6rem', padding: '2px 8px', borderRadius: '4px',
                    background: '#f1f5f9', color: '#64748b', fontWeight: 600, textTransform: 'none'
                }}>{badge}</span>
            )}
            {editable && editHint && (
                <span style={{ color: 'var(--accent-color)', fontSize: '0.6rem', fontWeight: 600, textTransform: 'none' }}>editable</span>
            )}
        </label>
        {children}
    </div>
);

const ErrorHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600, marginTop: '4px' }}>{children}</div>
);

const FieldValue: React.FC<{ muted?: boolean; children: React.ReactNode }> = ({ muted, children }) => (
    <p style={{
        margin: 0, fontSize: '0.95rem', fontWeight: 600,
        color: muted ? 'var(--text-muted)' : 'var(--text-primary)',
        padding: '10px 0'
    }}>
        {children}
    </p>
);

const StyledInput: React.FC<{
    value: string;
    placeholder?: string;
    type?: string;
    error?: boolean;
    onChange: (v: string) => void;
}> = ({ value, placeholder, type = 'text', error, onChange }) => (
    <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="form-input"
        style={{
            width: '100%', padding: '10px 14px', fontSize: '0.95rem',
            borderRadius: '10px', border: `1px solid ${error ? '#ef4444' : 'var(--border-color)'}`,
            outline: 'none', fontWeight: 600, background: '#f8fafc',
            transition: 'border-color 0.2s', boxSizing: 'border-box'
        }}
        onFocus={e => e.target.style.borderColor = error ? '#ef4444' : 'var(--accent-color)'}
        onBlur={e => e.target.style.borderColor = error ? '#ef4444' : 'var(--border-color)'}
    />
);

export default ProfilePage;
