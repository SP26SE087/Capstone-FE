import React, { useState, useEffect } from 'react';
import { userService } from '@/services/userService';
import { Mail, Loader2, X } from 'lucide-react';
import FaceRecognitionSection from './FaceRecognitionSection';

interface UserDetailModalProps {
    onClose: () => void;
    userId: string | null;
    systemRoleMap: Record<number | string, string>;
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({ onClose, userId, systemRoleMap }) => {
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

    const studentId = String(
        userData?.studentId ??
        userData?.StudentId ??
        userData?.studentID ??
        userData?.student_id ??
        ''
    ).trim();

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
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        <div style={{
                            width: '80px', height: '80px', borderRadius: 'var(--radius-md)',
                            background: 'var(--accent-bg)', color: 'var(--accent-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '2rem', fontWeight: 800
                        }}>
                            {(userData.fullName || userData.userName || 'U')[0]}
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{userData.fullName || userData.userName}</h2>
                            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>{userData.email}</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: 0, background: 'var(--background-color)', border: 'none' }}>
                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                System Role
                            </label>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {systemRoleMap[userData.role] || userData.role || 'Member'}
                            </div>
                        </div>
                        <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: 0, background: 'var(--background-color)', border: 'none' }}>
                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                Account Status
                            </label>
                            <div style={{ fontWeight: 600, color: 'var(--success)' }}>Active</div>
                        </div>
                    </div>

                    <div style={{
                        padding: '1.25rem',
                        background: 'white',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ color: 'var(--text-muted)' }}><Mail size={18} /></div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Email Address</div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{userData.email}</div>
                            </div>
                        </div>
                    </div>

                    <FaceRecognitionSection
                        studentId={studentId}
                        userName={userData.fullName || userData.userName}
                    />
                </div>
            ) : null}
        </div>
    );
};

export default UserDetailModal;
