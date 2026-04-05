import React, { useState, useEffect } from 'react';
import { userService } from '@/services/userService';
import { Mail, Loader2, X, Phone, BookOpen, Github, GraduationCap, ClipboardList, Clock, CheckCircle, XCircle } from 'lucide-react';
import FaceRecognitionSection from './FaceRecognitionSection';

interface UserDetailModalProps {
    onClose: () => void;
    userId: string | null;
    systemRoleMap: Record<number | string, string>;
    onScanFace: (studentId: string, userName: string) => void;
    onCheckLog: (email: string, studentId: string, userName: string) => void;
    isCheckLogOpen: boolean;
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({ onClose, userId, systemRoleMap, onScanFace, onCheckLog, isCheckLogOpen }) => {
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (userId) {
            fetchUserDetails();
            return;
        }
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
            console.error('Failed to fetch user details:', err);
            setError('Could not load user details.');
        } finally {
            setLoading(false);
        }
    };

    if (!userId) return null;

    return (
        <div className="card" style={{
            marginBottom: '2rem',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--card-bg)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            animation: 'fadeIn 0.3s ease-out',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div className="card-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-light)',
                background: 'rgba(var(--primary-rgb), 0.01)'
            }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                    User Profile
                </h3>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: '4px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    title="Close"
                >
                    <X size={18} />
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary-color)' }} />
                </div>
            ) : error ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--error-color)' }}>
                    <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>
                    <button className="btn btn-secondary" onClick={fetchUserDetails}>Retry</button>
                </div>
            ) : userData ? (
                <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
                    {/* Avatar + name row */}
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div style={{
                            width: '52px', height: '52px', borderRadius: 'var(--radius-md)',
                            background: 'var(--accent-bg)', color: 'var(--accent-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.1rem', fontWeight: 800, flexShrink: 0,
                            overflow: 'hidden'
                        }}>
                            {(userData.avatarUrl || userData.AvatarUrl) ? (
                                <img
                                    src={userData.avatarUrl || userData.AvatarUrl}
                                    alt={userData.fullName || 'avatar'}
                                    referrerPolicy="no-referrer"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.parentElement as HTMLElement).textContent = (userData.fullName || userData.userName || 'U')[0]; }}
                                />
                            ) : (
                                (userData.fullName || userData.userName || 'U')[0]
                            )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>{userData.fullName || userData.userName}</h2>
                            <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userData.email}</p>
                        </div>
                    </div>

                    {/* Status badges row */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-muted" style={{ fontSize: '0.65rem', fontWeight: 700 }}>
                            {systemRoleMap[userData.role] || userData.role || 'Member'}
                        </span>
                        {(userData.isActive === true || userData.status === 1) ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.65rem', fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '2px 8px', borderRadius: '999px' }}>
                                <CheckCircle size={10} /> Active
                            </span>
                        ) : (userData.isActive === false || userData.status === 0) ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.65rem', fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: '999px' }}>
                                <XCircle size={10} /> Inactive
                            </span>
                        ) : null}
                    </div>

                    {/* Fields grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {([
                            { icon: <Mail size={13} />, label: 'Email', value: userData.email },
                            { icon: <Phone size={13} />, label: 'Phone', value: userData.phoneNumber || userData.PhoneNumber },
                            { icon: <GraduationCap size={13} />, label: 'Student ID', value: userData.studentId || userData.StudentId || userData.studentID || userData.student_id },
                            { icon: <BookOpen size={13} />, label: 'ORCID', value: userData.orcid || userData.Orcid },
                            { icon: <BookOpen size={13} />, label: 'Google Scholar', value: userData.googleScholarUrl || userData.GoogleScholarUrl },
                            { icon: <Github size={13} />, label: 'GitHub', value: userData.githubUrl || userData.GithubUrl },
                            { icon: <Clock size={13} />, label: 'Joined', value: userData.createdAt ? new Date(userData.createdAt).toLocaleDateString('vi-VN') : null },
                            { icon: <Clock size={13} />, label: 'Updated', value: userData.updatedAt ? new Date(userData.updatedAt).toLocaleDateString('vi-VN') : null },
                        ] as { icon: React.ReactNode; label: string; value: string | null | undefined }[]).map((field, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                                padding: '0.4rem 0.625rem',
                                background: 'var(--background-color)',
                                borderRadius: 'var(--radius-sm)',
                                minWidth: 0
                            }}>
                                <span style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '1px' }}>{field.icon}</span>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1px' }}>{field.label}</div>
                                    {field.value ? (
                                        (field.label === 'Google Scholar' || field.label === 'GitHub') ? (
                                            <a href={field.value} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary-color)', wordBreak: 'break-all' }}>
                                                {field.value}
                                            </a>
                                        ) : (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{field.value}</div>
                                        )
                                    ) : (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>—</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Check Log button */}
                    <button
                        className="btn btn-secondary"
                        onClick={() => onCheckLog(userData.email, String(userData.studentId || userData.StudentId || userData.studentID || userData.student_id || ''), userData.fullName || userData.userName)}
                        style={{
                            width: '100%', gap: '6px', fontSize: '0.75rem', padding: '6px',
                            color: isCheckLogOpen ? 'var(--primary-color)' : 'var(--text-primary)',
                            border: isCheckLogOpen ? '1px solid var(--primary-color)' : undefined
                        }}
                    >
                        <ClipboardList size={14} /> {isCheckLogOpen ? 'Viewing Check Log' : 'Check Log'}
                    </button>

                    <FaceRecognitionSection
                        studentId={String(
                            userData?.studentId ?? userData?.StudentId ??
                            userData?.studentID ?? userData?.student_id ?? ''
                        ).trim()}
                        userName={userData.fullName || userData.userName}
                        onScanFace={onScanFace}
                    />
                </div>
            ) : null}
        </div>
    );
};

export default UserDetailModal;
