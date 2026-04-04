import React, { useState, useEffect } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { userService, ProfileResponse } from '@/services/userService';
import { SystemRoleMap } from '@/types/enums';
import {
    Eye,
    Edit3,
    Save,
    User,
    Mail,
    Shield,
    Calendar,
    Loader2,
    CheckCircle,
    AlertTriangle,
    X,
    Phone,
    Link,
    GraduationCap,
    Github
} from 'lucide-react';

const ProfilePage: React.FC = () => {
    const { user: authUser, refreshUser } = useAuth();

    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [imgError, setImgError] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Edit state
    const [editData, setEditData] = useState({ fullName: '', phoneNumber: '', orcid: '', googleScholarUrl: '', githubUrl: '' });

    useEffect(() => {
        fetchProfile();
    }, []);

    // Auto-dismiss toast
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
                phoneNumber: data.phoneNumber || '', 
                orcid: data.orcid || '', 
                googleScholarUrl: data.googleScholarUrl || '', 
                githubUrl: data.githubUrl || '' 
            });
        } catch (error) {
            console.error('Failed to load profile:', error);
            setToast({ message: 'Failed to load profile data.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const hasChanges = 
            editData.phoneNumber.trim() !== (profile?.phoneNumber || '') ||
            editData.orcid.trim() !== (profile?.orcid || '') ||
            editData.googleScholarUrl.trim() !== (profile?.googleScholarUrl || '') ||
            editData.githubUrl.trim() !== (profile?.githubUrl || '');
            
        if (!hasChanges) {
            setIsEditMode(false);
            return;
        }
        setSubmitting(true);
        try {
            await userService.updateProfile({ 
                phoneNumber: editData.phoneNumber.trim() || null,
                orcid: editData.orcid.trim() || null,
                googleScholarUrl: editData.googleScholarUrl.trim() || null,
                githubUrl: editData.githubUrl.trim() || null
            });
            setToast({ message: 'Profile updated successfully!', type: 'success' });
            setIsEditMode(false);

            // Refresh auth user state
            refreshUser();

            fetchProfile();
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || 'Failed to update profile.';
            setToast({ message: msg, type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        setEditData({ 
            fullName: profile?.fullName || '',
            phoneNumber: profile?.phoneNumber || '',
            orcid: profile?.orcid || '',
            googleScholarUrl: profile?.googleScholarUrl || '',
            githubUrl: profile?.githubUrl || ''
        });
        setIsEditMode(false);
    };

    const avatarUrl = profile?.avatarUrl;
    const initials = (profile?.fullName || authUser.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const memberSince = profile?.createdAt
        ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : '—';
    const roleLabel = SystemRoleMap[profile?.role ?? authUser.role] || 'Member';

    if (loading) {
        return (
            <MainLayout role={authUser.role} userName={authUser.name}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                    <div className="spinner"></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout role={authUser.role} userName={authUser.name}>
            <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1rem 0' }}>

                {/* Toast */}
                {toast && (
                    <div style={{
                        position: 'fixed', top: '80px', right: '24px', zIndex: 2000,
                        padding: '14px 20px', borderRadius: '12px',
                        background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                        color: toast.type === 'success' ? '#166534' : '#991b1b',
                        display: 'flex', alignItems: 'center', gap: '10px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                        fontSize: '0.875rem', fontWeight: 600,
                        animation: 'slideInRight 0.3s ease-out'
                    }}>
                        {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                        {toast.message}
                        <button onClick={() => setToast(null)} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'inherit', opacity: 0.6, marginLeft: '8px', display: 'flex'
                        }}>
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Page Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>My Profile</h1>
                        <p style={{ margin: '6px 0 0', fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            View and manage your personal information
                        </p>
                    </div>

                    {/* View / Edit Toggle */}
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                        <button
                            onClick={() => { if (isEditMode) handleCancel(); }}
                            style={{
                                padding: '6px 16px', borderRadius: '7px', border: 'none',
                                background: !isEditMode ? 'white' : 'transparent',
                                color: !isEditMode ? 'var(--primary-color)' : 'var(--text-secondary)',
                                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                boxShadow: !isEditMode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s', fontSize: '0.85rem'
                            }}
                        >
                            <Eye size={16} /> View
                        </button>
                        <button
                            onClick={() => setIsEditMode(true)}
                            style={{
                                padding: '6px 16px', borderRadius: '7px', border: 'none',
                                background: isEditMode ? 'white' : 'transparent',
                                color: isEditMode ? 'var(--primary-color)' : 'var(--text-secondary)',
                                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                boxShadow: isEditMode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s', fontSize: '0.85rem'
                            }}
                        >
                            <Edit3 size={16} /> Edit
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', alignItems: 'start' }}>

                    {/* LEFT — Profile Card */}
                    <div className="card" style={{ padding: '2.5rem', borderRadius: '16px' }}>

                        {/* Avatar + Identity Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '1.5rem',
                            paddingBottom: '2rem', borderBottom: '1px solid var(--border-color)',
                            marginBottom: '2rem'
                        }}>
                            {/* Avatar */}
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{
                                    width: '88px', height: '88px', borderRadius: '50%',
                                    background: (avatarUrl && !imgError) ? 'none' : 'linear-gradient(135deg, var(--accent-color), var(--accent-light))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontSize: '1.75rem', fontWeight: 800,
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 14px rgba(232, 114, 12, 0.25)',
                                    border: '3px solid white',
                                    outline: '2px solid var(--accent-color)'
                                }}>
                                    {avatarUrl && !imgError ? (
                                        <img
                                            src={avatarUrl}
                                            alt="Profile"
                                            referrerPolicy="no-referrer"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={() => setImgError(true)}
                                        />
                                    ) : initials}
                                </div>
                                {/* Online indicator */}
                                <div style={{
                                    position: 'absolute', bottom: '4px', right: '4px',
                                    width: '14px', height: '14px', borderRadius: '50%',
                                    background: '#10b981', border: '3px solid white'
                                }} />
                            </div>

                            {/* Identity */}
                            <div style={{ flex: 1 }}>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    {profile?.fullName || authUser.name}
                                </h2>
                                <div style={{ marginTop: '10px' }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '4px 12px', borderRadius: '20px',
                                        background: 'var(--accent-bg)', color: 'var(--accent-color)',
                                        fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                                        letterSpacing: '0.03em'
                                    }}>
                                        <Shield size={12} />
                                        {roleLabel}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Info Fields */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

                            {/* Full Name */}
                            <div>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px'
                                }}>
                                    <User size={14} /> Full Name
                                </label>
                                <p style={{
                                    margin: 0, fontSize: '0.95rem', fontWeight: 600,
                                    color: isEditMode ? 'var(--text-muted)' : 'var(--text-primary)',
                                    padding: '10px 0'
                                }}>
                                    {profile?.fullName || '—'}
                                </p>
                            </div>

                            {/* Email */}
                            <div>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px'
                                }}>
                                    <Mail size={14} /> Email Address
                                    <span style={{
                                        fontSize: '0.6rem', padding: '2px 8px', borderRadius: '4px',
                                        background: '#f1f5f9', color: '#64748b', fontWeight: 600, textTransform: 'none'
                                    }}>Google Account</span>
                                </label>
                                <p style={{
                                    margin: 0, fontSize: '0.95rem', fontWeight: 500,
                                    color: isEditMode ? 'var(--text-muted)' : 'var(--text-primary)',
                                    padding: '10px 0'
                                }}>
                                    {profile?.email || authUser.email || '—'}
                                </p>
                            </div>

                            {/* Phone Number */}
                            <div>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px'
                                }}>
                                    <Phone size={14} /> Phone Number
                                    {isEditMode && <span style={{ color: 'var(--accent-color)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'none' }}>(editable)</span>}
                                </label>
                                {isEditMode ? (
                                    <input
                                        type="tel"
                                        value={editData.phoneNumber}
                                        onChange={(e) => setEditData({ ...editData, phoneNumber: e.target.value })}
                                        className="form-input"
                                        style={{
                                            width: '100%', padding: '10px 14px', fontSize: '0.95rem',
                                            borderRadius: '10px', border: '1px solid var(--border-color)',
                                            outline: 'none', fontWeight: 600,
                                            transition: 'border-color 0.2s',
                                            background: '#f8fafc'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
                                        onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                                    />
                                ) : (
                                    <p style={{
                                        margin: 0, fontSize: '0.95rem', fontWeight: 600,
                                        color: 'var(--text-primary)', padding: '10px 0'
                                    }}>
                                        {profile?.phoneNumber || '—'}
                                    </p>
                                )}
                            </div>

                            {/* Role */}
                            <div>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px'
                                }}>
                                    <Shield size={14} /> System Role
                                    <span style={{
                                        fontSize: '0.6rem', padding: '2px 8px', borderRadius: '4px',
                                        background: '#f1f5f9', color: '#64748b', fontWeight: 600, textTransform: 'none'
                                    }}>Assigned by Admin</span>
                                </label>
                                <p style={{
                                    margin: 0, fontSize: '0.95rem', fontWeight: 600,
                                    color: isEditMode ? 'var(--text-muted)' : 'var(--text-primary)',
                                    padding: '10px 0'
                                }}>
                                    {roleLabel}
                                </p>
                            </div>

                            {/* Member Since */}
                            <div>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px'
                                }}>
                                    <Calendar size={14} /> Member Since
                                </label>
                                <p style={{
                                    margin: 0, fontSize: '0.95rem', fontWeight: 500,
                                    color: isEditMode ? 'var(--text-muted)' : 'var(--text-primary)',
                                    padding: '10px 0'
                                }}>
                                    {memberSince}
                                </p>
                            </div>

                            {/* ORCID */}
                            <div>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px'
                                }}>
                                    <Link size={14} /> ORCID
                                    {isEditMode && <span style={{ color: 'var(--accent-color)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'none' }}>(editable)</span>}
                                </label>
                                {isEditMode ? (
                                    <input
                                        type="text"
                                        value={editData.orcid}
                                        onChange={(e) => setEditData({ ...editData, orcid: e.target.value })}
                                        placeholder="xxxx-xxxx-xxxx-xxxx"
                                        className="form-input"
                                        style={{
                                            width: '100%', padding: '10px 14px', fontSize: '0.95rem',
                                            borderRadius: '10px', border: '1px solid var(--border-color)',
                                            outline: 'none', fontWeight: 600,
                                            transition: 'border-color 0.2s',
                                            background: '#f8fafc'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
                                        onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                                    />
                                ) : (
                                    profile?.orcid ? (
                                        <a href={`https://orcid.org/${profile.orcid}`} target="_blank" rel="noreferrer" style={{
                                            display: 'inline-block', fontSize: '0.95rem', fontWeight: 600,
                                            color: 'var(--primary-color)', padding: '10px 0', textDecoration: 'none'
                                        }}>
                                            {profile.orcid}
                                        </a>
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', padding: '10px 0' }}>—</p>
                                    )
                                )}
                            </div>

                            {/* Google Scholar URL */}
                            <div>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px'
                                }}>
                                    <GraduationCap size={14} /> Google Scholar
                                    {isEditMode && <span style={{ color: 'var(--accent-color)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'none' }}>(editable)</span>}
                                </label>
                                {isEditMode ? (
                                    <input
                                        type="url"
                                        value={editData.googleScholarUrl}
                                        onChange={(e) => setEditData({ ...editData, googleScholarUrl: e.target.value })}
                                        className="form-input"
                                        placeholder="https://scholar.google.com/..."
                                        style={{
                                            width: '100%', padding: '10px 14px', fontSize: '0.95rem',
                                            borderRadius: '10px', border: '1px solid var(--border-color)',
                                            outline: 'none', fontWeight: 600,
                                            transition: 'border-color 0.2s',
                                            background: '#f8fafc'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
                                        onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                                    />
                                ) : (
                                    profile?.googleScholarUrl ? (
                                        <a href={profile.googleScholarUrl} target="_blank" rel="noreferrer" style={{
                                            display: 'block', fontSize: '0.95rem', fontWeight: 600,
                                            color: 'var(--primary-color)', padding: '10px 0', textDecoration: 'none',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}>
                                            {profile.googleScholarUrl}
                                        </a>
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', padding: '10px 0' }}>—</p>
                                    )
                                )}
                            </div>

                            {/* GitHub URL */}
                            <div>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px'
                                }}>
                                    <Github size={14} /> GitHub
                                    {isEditMode && <span style={{ color: 'var(--accent-color)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'none' }}>(editable)</span>}
                                </label>
                                {isEditMode ? (
                                    <input
                                        type="url"
                                        value={editData.githubUrl}
                                        onChange={(e) => setEditData({ ...editData, githubUrl: e.target.value })}
                                        className="form-input"
                                        placeholder="https://github.com/..."
                                        style={{
                                            width: '100%', padding: '10px 14px', fontSize: '0.95rem',
                                            borderRadius: '10px', border: '1px solid var(--border-color)',
                                            outline: 'none', fontWeight: 600,
                                            transition: 'border-color 0.2s',
                                            background: '#f8fafc'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
                                        onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                                    />
                                ) : (
                                    profile?.githubUrl ? (
                                        <a href={profile.githubUrl} target="_blank" rel="noreferrer" style={{
                                            display: 'block', fontSize: '0.95rem', fontWeight: 600,
                                            color: 'var(--primary-color)', padding: '10px 0', textDecoration: 'none',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}>
                                            {profile.githubUrl}
                                        </a>
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', padding: '10px 0' }}>—</p>
                                    )
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT — Sidebar */}
                    <div style={{ position: 'sticky', top: '5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Account Summary Card */}
                        <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                            <h4 style={{
                                margin: '0 0 1.25rem 0', fontSize: '0.8rem', fontWeight: 700,
                                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em'
                            }}>
                                Account Summary
                            </h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '12px', borderRadius: '10px', background: 'var(--accent-bg)',
                                }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        background: 'var(--accent-color)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', color: 'white'
                                    }}>
                                        <Shield size={18} />
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Current Role</p>
                                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-color)' }}>{roleLabel}</p>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '12px', borderRadius: '10px', background: '#f0fdf4',
                                }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        background: '#10b981', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', color: 'white'
                                    }}>
                                        <CheckCircle size={18} />
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Account Status</p>
                                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#10b981' }}>Active</p>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '12px', borderRadius: '10px', background: 'var(--info-bg)',
                                }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '10px',
                                        background: 'var(--info)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', color: 'white'
                                    }}>
                                        <Calendar size={18} />
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Joined</p>
                                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--info)' }}>{memberSince}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {isEditMode ? (
                                <>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSave}
                                        disabled={submitting}
                                        style={{
                                            width: '100%', padding: '12px', display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', gap: '8px', borderRadius: '10px', fontWeight: 700,
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                        {submitting ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={handleCancel}
                                        disabled={submitting}
                                        style={{
                                            width: '100%', padding: '12px', display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', gap: '8px', borderRadius: '10px', fontWeight: 600,
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <div style={{
                                    padding: '16px', borderRadius: '12px',
                                    background: 'var(--surface-hover)', border: '1px solid var(--border-color)'
                                }}>
                                    <p style={{
                                        margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)',
                                        lineHeight: 1.6, fontWeight: 500
                                    }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>Authentication:</strong> Your account
                                        is managed through Google OAuth. Role changes require Admin authorization.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </MainLayout>
    );
};

export default ProfilePage;
