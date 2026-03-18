import React, { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import { userService } from '@/services/userService';
import { Mail, Loader2 } from 'lucide-react';
import FaceRecognitionSection from './FaceRecognitionSection';

interface UserDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
    systemRoleMap: Record<number | string, string>;
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({ isOpen, onClose, userId, systemRoleMap }) => {
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && userId) {
            fetchUserDetails();
        } else {
            setUserData(null);
            setError(null);
        }
    }, [isOpen, userId]);

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

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="User Profile"
            maxWidth="550px"
        >
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                        userId={userData.userId || userData.id} 
                        userName={userData.fullName || userData.userName} 
                    />

                    {userData.userId && (
                         <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                            User ID: {userData.userId}
                         </div>
                    )}
                </div>
            ) : null}
        </Modal>
    );
};

export default UserDetailModal;
