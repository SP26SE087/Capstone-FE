import React, { useState } from 'react';
import { X, UserPlus, Mail, User, Shield, Loader2 } from 'lucide-react';
import { userService } from '@/services/userService';
import { useAuth } from '@/hooks/useAuth';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<number>(4); // Default to Member (4)
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            await userService.addUser({ email, fullName, role });
            
            // Show toast or success message here if toast is available globally
            
            // Reset and close
            setEmail('');
            setFullName('');
            setRole(4);
            setIsLoading(false);
            if (onSuccess) onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Add user error:', err.response?.data || err);
            
            const data = err.response?.data;
            const status = err.response?.status;
            let errorMessage = 'Failed to add user. Please try again.';
            
            if (status === 401) {
                errorMessage = 'Your session has expired or you are not authorized. Please log out and log in again.';
            } else if (data && data.message) {
                errorMessage = data.message;
            } else if (typeof data === 'string' && data.length > 0) {
                errorMessage = data;
            } else if (!err.response) {
                errorMessage = 'Connection refused. Please ensure the Backend (UserService) is running on port 7268.';
            }
            
            setError(errorMessage);
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
        }}>
            <div style={{
                background: 'white',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '500px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.25rem 2rem',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#fff',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            padding: '10px',
                            background: 'var(--primary-color)',
                            borderRadius: '12px',
                            color: 'white',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                        }}>
                            <UserPlus size={20} />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' }}>
                            Add New User
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ border: 'none', background: '#f8fafc', cursor: 'pointer', color: '#64748b', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form id="add-user-form" onSubmit={handleSubmit} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {error && (
                        <div style={{ padding: '1rem', background: '#fef2f2', color: '#ef4444', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600 }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Mail size={14} /> Email Address *
                        </label>
                        <input
                            required
                            type="email"
                            placeholder="user@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                            style={{
                                padding: '0.85rem 1.15rem',
                                borderRadius: '12px',
                                border: '1.5px solid #e2e8f0',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                                background: isLoading ? '#f8fafc' : 'white',
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <User size={14} /> Full Name *
                        </label>
                        <input
                            required
                            type="text"
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            disabled={isLoading}
                            style={{
                                padding: '0.85rem 1.15rem',
                                borderRadius: '12px',
                                border: '1.5px solid #e2e8f0',
                                fontSize: '1rem',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                                background: isLoading ? '#f8fafc' : 'white',
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Shield size={14} /> System Role *
                        </label>
                        <select
                            value={role}
                            onChange={(e) => setRole(Number(e.target.value))}
                            disabled={isLoading}
                            style={{ padding: '0.85rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: isLoading ? '#f8fafc' : 'white', cursor: isLoading ? 'default' : 'pointer', fontWeight: 600, outline: 'none' }}
                        >
                            {user?.role === 'Admin' && <option value={1}>Admin</option>}
                            {user?.role === 'Admin' && <option value={2}>Lab Director</option>}
                            <option value={3}>Senior Researcher</option>
                            <option value={4}>Member</option>
                            <option value={5}>Guest</option>
                        </select>
                    </div>
                </form>

                {/* Footer */}
                <div style={{
                    padding: '1.5rem 2rem',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '14px',
                    background: '#f8fafc'
                }}>
                    <button type="button" onClick={onClose} disabled={isLoading} className="btn btn-secondary" style={{ padding: '0.75rem 1.75rem', borderRadius: '12px' }}>
                        Cancel
                    </button>
                    <button type="submit" form="add-user-form" disabled={isLoading} className="btn btn-primary" style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                        {isLoading ? 'Adding...' : 'Add User'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserFormModal;
