import React, { useState } from 'react';
import { Mail, Phone, Shield, X, Loader2 } from 'lucide-react';
import { userService } from '@/services/userService';
import { SystemRoleEnum, SystemRoleMap } from '@/types/enums';

interface InviteMemberFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

const InviteMemberForm: React.FC<InviteMemberFormProps> = ({ onSuccess, onCancel }) => {
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [role, setRole] = useState<number>(SystemRoleEnum.Member);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter out Admin role from the list
    const availableRoles = Object.entries(SystemRoleMap)
        .filter(([key]) => {
            const numKey = Number(key);
            // Only include numeric keys (enums) and exclude Admin (1)
            return !isNaN(numKey) && numKey !== SystemRoleEnum.Admin;
        });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Using email part as a placeholder for fullName since the user didn't request a name field
            const fullName = email.split('@')[0];
            
            await userService.addUser({
                email,
                fullName,
                role,
                phoneNumber: phoneNumber || undefined
            });
            
            setEmail('');
            setPhoneNumber('');
            setRole(SystemRoleEnum.Member);
            
            onSuccess();
        } catch (err: any) {
            console.error('Failed to invite member:', err);
            setError(err.response?.data?.message || 'Failed to invite member. Please check the information and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card" style={{ 
            marginBottom: '2rem', 
            border: '1px solid var(--primary-color)', 
            backgroundColor: 'rgba(var(--primary-rgb), 0.02)',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary-color)' }}>Invite New Member</h3>
                <button 
                    onClick={onCancel} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    title="Close"
                >
                    <X size={20} />
                </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {/* Email Field */}
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Mail size={14} /> Email Address <span style={{ color: 'var(--error-color)' }}>*</span>
                        </label>
                        <input
                            type="email"
                            required
                            className="form-input"
                            placeholder="user@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {/* Phone Number Field */}
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Phone size={14} /> Phone Number
                        </label>
                        <input
                            type="tel"
                            className="form-input"
                            placeholder="0123456789"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                    </div>

                    {/* System Role Field */}
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Shield size={14} /> System Role <span style={{ color: 'var(--error-color)' }}>*</span>
                        </label>
                        <select
                            className="form-input"
                            value={role}
                            onChange={(e) => setRole(Number(e.target.value))}
                            required
                        >
                            {availableRoles.map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {error && (
                    <div style={{ 
                        padding: '0.75rem', 
                        backgroundColor: 'rgba(var(--error-rgb), 0.1)', 
                        color: 'var(--error-color)', 
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '1rem',
                        fontSize: '0.9rem'
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        className="btn btn-primary" 
                        disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : 'Send Invite'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default InviteMemberForm;
