import React, { useState, useEffect } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { userService, ProfileResponse } from '@/services/userService';
import { SystemRoleMap } from '@/types/enums';
import {
    Eye, Edit3, Save, User, Mail, Shield, Calendar,
    Loader2, CheckCircle, AlertTriangle, Phone,
    Link as LinkIcon, GraduationCap, Github, ExternalLink, RefreshCw
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
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
        setFormErrors({});
        if (!editData.fullName.trim()) return setFormErrors({ fullName: 'Full name is required.' });
        setSubmitting(true);
        try {
            await userService.updateProfile({ ...editData, fullName: editData.fullName.trim() });
            setToast({ message: 'Profile updated successfully!', type: 'success' });
            setIsEditMode(false);
            
            // Sync with local auth
            const stored = localStorage.getItem('auth_user');
            if (stored) {
                const parsed = JSON.parse(stored);
                parsed.fullName = editData.fullName.trim();
                localStorage.setItem('auth_user', JSON.stringify(parsed));
                refreshUser();
            }
            fetchProfile();
        } catch (error: any) {
            let handled = false;
            if (error.response?.data) {
                const data = error.response.data;
                const errObj = data.errors || data.Errors;
                if (errObj && Object.keys(errObj).length > 0) {
                    const newErrors: Record<string, string> = {};
                    Object.keys(errObj).forEach(key => {
                        const mappedKey = key.charAt(0).toLowerCase() + key.slice(1);
                        newErrors[mappedKey] = String(errObj[key][0]);
                    });
                    setFormErrors(newErrors);
                    handled = true;
                } else if (data.message || data.Message) {
                    setToast({ message: data.message || data.Message, type: 'error' });
                    handled = true;
                }
            }
            if (!handled) {
                setToast({ message: error.message || 'Update failed.', type: 'error' });
            }
        } finally { setSubmitting(false); }
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
                    <div style={{ display: 'flex', background: '#e2e8f0', padding: '4px', borderRadius: '12px' }}>
                        <button onClick={() => setIsEditMode(false)} className={`tab-btn ${!isEditMode ? 'active' : ''}`}><Eye size={16} /> View</button>
                        <button onClick={() => setIsEditMode(true)} className={`tab-btn ${isEditMode ? 'active' : ''}`}><Edit3 size={16} /> Edit</button>
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
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <h2 style={{ margin: 0, fontSize: '1.75rem' }}>{profile?.fullName}</h2>
                                    <p style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                        <Mail size={16} /> {profile?.email}
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="profile-label"><User size={14} /> Full Name</label>
                                    {isEditMode ? (
                                        <>
                                            <input className="form-input" value={editData.fullName} onChange={e => setEditData({ ...editData, fullName: e.target.value })} style={formErrors.fullName ? { borderColor: '#dc2626' } : {}} />
                                            {formErrors.fullName && <span style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{formErrors.fullName}</span>}
                                        </>
                                    ) : (
                                        <p className="profile-value">{profile?.fullName}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="profile-label"><Phone size={14} /> Phone Number</label>
                                    {isEditMode ? (
                                        <>
                                            <input className="form-input" value={editData.phoneNumber} onChange={e => setEditData({ ...editData, phoneNumber: e.target.value.replace(/[^0-9]/g, '') })} style={formErrors.phoneNumber ? { borderColor: '#dc2626' } : {}} />
                                            {formErrors.phoneNumber && <span style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{formErrors.phoneNumber}</span>}
                                        </>
                                    ) : (
                                        <p className="profile-value">{profile?.phoneNumber || '—'}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="profile-label">ORCID</label>
                                    {isEditMode ? (
                                        <>
                                            <input className="form-input" value={editData.orcid} onChange={e => setEditData({ ...editData, orcid: e.target.value.replace(/[^0-9\-xX]/g, '') })} placeholder="xxxx-xxxx-xxxx-xxxx" style={formErrors.orcid ? { borderColor: '#dc2626' } : {}} />
                                            {formErrors.orcid && <span style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{formErrors.orcid}</span>}
                                        </>
                                    ) : (
                                        profile?.orcid ? (
                                            <a href={`https://orcid.org/${profile.orcid}`} target="_blank" rel="noreferrer" className="link-chip"><LinkIcon size={14} /> {profile.orcid}</a>
                                        ) : <p className="profile-value">—</p>
                                    )}
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="profile-label"><GraduationCap size={14} /> Google Scholar</label>
                                    {isEditMode ? (
                                        <>
                                            <input className="form-input" value={editData.googleScholarUrl} onChange={e => setEditData({ ...editData, googleScholarUrl: e.target.value })} placeholder="https://scholar.google.com" style={formErrors.googleScholarUrl ? { borderColor: '#dc2626' } : {}} />
                                            {formErrors.googleScholarUrl && <span style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{formErrors.googleScholarUrl}</span>}
                                        </>
                                    ) : (
                                        profile?.googleScholarUrl ? (
                                            <a href={profile.googleScholarUrl} target="_blank" rel="noreferrer" className="link-chip"><ExternalLink size={14} /> View scholar profile</a>
                                        ) : <p className="profile-value">—</p>
                                    )}
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="profile-label"><Github size={14} /> GitHub Profile</label>
                                    {isEditMode ? (
                                        <>
                                            <input className="form-input" value={editData.githubUrl} onChange={e => setEditData({ ...editData, githubUrl: e.target.value })} placeholder="https://github.com/username" style={formErrors.githubUrl ? { borderColor: '#dc2626' } : {}} />
                                            {formErrors.githubUrl && <span style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{formErrors.githubUrl}</span>}
                                        </>
                                    ) : (
                                        profile?.githubUrl ? (
                                            <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="link-chip"><Github size={14} /> View GitHub</a>
                                        ) : <p className="profile-value">—</p>
                                    )}
                                </div>
                            </div>

                            {isEditMode && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '2rem' }}>
                                    <button className="btn btn-secondary" onClick={() => setIsEditMode(false)} disabled={submitting}>Cancel</button>
                                    <button className="btn btn-primary" onClick={handleSave} disabled={submitting}>
                                        {submitting ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                                        {submitting ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="card" style={{ padding: '1.5rem', marginBottom: 0 }}>
                            <h4 style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: '1.25rem', letterSpacing: '0.05em' }}>Account Metadata</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-bg)', color: 'var(--accent-color)', borderRadius: '10px', flexShrink: 0 }}><Shield size={20} /></div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Role</p>
                                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{roleLabel}</p>
                                    </div>
                                </div>
                                {/* <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                    <div style={{ padding: '8px', background: '#ecfdf5', color: '#10b981', borderRadius: '10px' }}><CheckCircle size={20} /></div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Account Status</p>
                                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#10b981' }}>Active</p>
                                    </div>
                                </div> */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', color: '#3b82f6', borderRadius: '10px', flexShrink: 0 }}><Calendar size={20} /></div>
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
                .profile-label { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; }
                .profile-value { margin: 0; padding: 10px 14px; background: var(--surface-hover); border-radius: 10px; font-weight: 600; color: var(--text-primary); border: 1px solid var(--border-light); }
                .link-chip { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: var(--accent-bg); color: var(--accent-color); border-radius: 10px; font-weight: 700; font-size: 0.85rem; transition: all 0.2s; border: 1px solid transparent; }
                .link-chip:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(232, 114, 12, 0.15); border-color: var(--accent-color); }
                @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
                .animate-spin { animation: spin 1.2s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </MainLayout>
    );
};

export default ProfilePage;
