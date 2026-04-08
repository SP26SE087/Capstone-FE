import React, { useState, useEffect } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { userService, ProfileResponse } from '@/services/userService';
import { SystemRoleMap } from '@/types/enums';
import {
    Eye, Edit3, Save, User, Mail, Shield, Calendar,
    Loader2, CheckCircle, AlertTriangle, Phone,
    Link as LinkIcon, GraduationCap, Github, RefreshCw
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
    const [editData, setEditData] = useState({ fullName: '', studentId: '', phoneNumber: '', orcid: '', googleScholarUrl: '', githubUrl: '' });
    const [studentIdError, setStudentIdError] = useState('');

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

        const sid = editData.studentId.trim();
        if (sid && !/^[A-Za-z]{2}\d{4}$/.test(sid)) {
            setStudentIdError('Student ID must be in format CCXXXX (2 letters + 4 digits, e.g. SE1234).');
            return;
        }
        setStudentIdError('');

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

                {/* header */}
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
                                <button className="btn btn-secondary" onClick={handleCancelEdit} disabled={submitting}>
                                    Cancel
                                </button>
                                <button className="btn btn-primary" onClick={handleSave} disabled={submitting}>
                                    {submitting ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                                    {submitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '2rem',
                    alignItems: 'start'
                }}>
                    {/* Main Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Avatar & Info Card */}
                        <div className="card" style={{ padding: '2rem', marginBottom: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                                <div style={{ position: 'relative' }}>
                                    <div style={{
                                    width: '100px', height: '100px', borderRadius: '50%',
                                    background: profile?.avatarUrl ? 'none' : 'linear-gradient(135deg, var(--accent-color), var(--accent-light))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontSize: '2rem', fontWeight: 800, overflow: 'hidden',
                                    border: '4px solid white', boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                                    }}>
                                    {profile?.avatarUrl && !imgError ? (
                                        <img src={profile.avatarUrl} alt="Me" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgError(true)} />
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
                                    {isEditMode && <span style={{ color: 'var(--accent-color)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'none' }}>(editable)</span>}
                                </label>
                                {isEditMode ? (
                                    <input
                                        type="text"
                                        value={editData.fullName}
                                        onChange={(e) => setEditData({ ...editData, fullName: e.target.value })}
                                        className="form-input"
                                        placeholder="Your full name"
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
                                        {profile?.fullName || '—'}
                                    </p>
                                )}
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

                            {/* Student ID */}
                            <div>
                                <label style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px'
                                }}>
                                    <GraduationCap size={14} /> Student ID
                                    {isEditMode && <span style={{ color: 'var(--accent-color)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'none' }}>(editable)</span>}
                                </label>
                                {isEditMode ? (
                                    <>
                                        <input
                                            type="text"
                                            value={editData.studentId}
                                            onChange={(e) => {
                                                setEditData({ ...editData, studentId: e.target.value });
                                                const v = e.target.value.trim();
                                                setStudentIdError(v && !/^[A-Za-z]{2}\d{4}$/.test(v) ? 'Format: 2 letters + 4 digits (e.g. SE1234)' : '');
                                            }}
                                            className="form-input"
                                            placeholder="e.g. SE1234"
                                            style={{
                                                width: '100%', padding: '10px 14px', fontSize: '0.95rem',
                                                borderRadius: '10px', border: `1px solid ${studentIdError ? '#ef4444' : 'var(--border-color)'}`,
                                                outline: 'none', fontWeight: 600,
                                                transition: 'border-color 0.2s',
                                                background: '#f8fafc'
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = studentIdError ? '#ef4444' : 'var(--accent-color)'}
                                            onBlur={(e) => e.target.style.borderColor = studentIdError ? '#ef4444' : 'var(--border-color)'}
                                        />
                                        {studentIdError && (
                                            <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600, marginTop: '4px' }}>
                                                {studentIdError}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p style={{
                                        margin: 0, fontSize: '0.95rem', fontWeight: 600,
                                        color: 'var(--text-primary)', padding: '10px 0'
                                    }}>
                                        {profile?.studentId || '—'}
                                    </p>
                                )}
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
                                    <LinkIcon size={14} /> ORCID
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

                        {/* Account Metadata */}
                        <div className="card" style={{ padding: '1.5rem', marginBottom: 0 }}>
                            <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: '1.25rem', letterSpacing: '0.05em' }}>Account Metadata</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                    <div style={{ padding: '8px', background: 'var(--accent-bg)', color: 'var(--accent-color)', borderRadius: '10px' }}><Shield size={20} /></div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>System Role</p>
                                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{roleLabel}</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                    <div style={{ padding: '8px', background: '#ecfdf5', color: '#10b981', borderRadius: '10px' }}><CheckCircle size={20} /></div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Account Status</p>
                                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#10b981' }}>Active</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                    <div style={{ padding: '8px', background: '#eff6ff', color: '#3b82f6', borderRadius: '10px' }}><Calendar size={20} /></div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Member Since</p>
                                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{memberSince}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--surface-hover)', border: '1px dashed var(--border-color)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                Authentication is provided via Google Workspace. To update your password or profile picture, please use your Google primary account settings.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                .tab-btn {
                    padding: 8px 18px; border: none; background: transparent; cursor: pointer;
                    font-size: 0.85rem; font-weight: 700; color: var(--text-secondary);
                    display: flex; alignItems: center; gap: 8px; border-radius: 8px; transition: all 0.2s;
                }
                .tab-btn.active { background: white; color: var(--accent-color); box-shadow: var(--shadow-sm); }
                @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
                .animate-spin { animation: spin 1.2s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </MainLayout>
    );
};

export default ProfilePage;
