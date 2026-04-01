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
    const [errors, setErrors] = useState<{ email?: string; phone?: string; general?: string }>({});

    // Filter out Admin role from the list
    const availableRoles = Object.entries(SystemRoleMap)
        .filter(([key]) => {
            const numKey = Number(key);
            // Only include numeric keys (enums) and exclude Admin (1)
            return !isNaN(numKey) && numKey !== SystemRoleEnum.Admin;
        });

    const validate = () => {
        const newErrors: { email?: string; phone?: string } = {};
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            newErrors.email = 'Email is required';
        } else if (!emailRegex.test(email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        // Phone validation (optional but must be digits)
        if (phoneNumber && !/^\d+$/.test(phoneNumber)) {
            newErrors.phone = 'Phone number must contain only digits';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});
        
        if (!validate()) return;
        
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
            
            // Clear form
            setEmail('');
            setPhoneNumber('');
            setRole(SystemRoleEnum.Member);
            setErrors({});
            
            onSuccess();
        } catch (err: any) {
            console.error('Failed to invite member:', err);
            setErrors({ 
                general: err.response?.data?.message || 'Failed to invite member. Please check the information and try again.' 
            });
        } finally {
            setLoading(false);
        }
    };

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
                    Add New Member
                </h3>
                <button 
                    onClick={onCancel} 
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
            
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Email Field */}
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 600 }}>
                        <Mail size={14} style={{ color: 'var(--accent-color)' }} /> 
                        Email Address <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. researcher@university.edu"
                        style={{ 
                            width: '100%',
                            borderColor: errors.email ? 'var(--danger)' : undefined,
                            backgroundColor: errors.email ? 'rgba(239, 68, 68, 0.02)' : undefined
                        }}
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) setErrors({ ...errors, email: undefined });
                        }}
                    />
                    {errors.email && (
                        <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {errors.email}
                        </div>
                    )}
                </div>

                {/* Phone Number Field */}
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 600 }}>
                        <Phone size={14} style={{ color: 'var(--accent-color)' }} /> 
                        Phone Number
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 'auto' }}>Optional</span>
                    </label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 0123456789"
                        style={{ 
                            width: '100%',
                            borderColor: errors.phone ? 'var(--danger)' : undefined,
                            backgroundColor: errors.phone ? 'rgba(239, 68, 68, 0.02)' : undefined
                        }}
                        value={phoneNumber}
                        onChange={(e) => {
                            setPhoneNumber(e.target.value);
                            if (errors.phone) setErrors({ ...errors, phone: undefined });
                        }}
                    />
                    {errors.phone && (
                        <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '4px' }}>
                            {errors.phone}
                        </div>
                    )}
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Input digits only, no spaces or special characters.
                    </span>
                </div>

                {/* System Role Field */}
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 600 }}>
                        <Shield size={14} style={{ color: 'var(--accent-color)' }} /> 
                        Access Level <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <select
                        className="form-input"
                        style={{ width: '100%', cursor: 'pointer' }}
                        value={role}
                        onChange={(e) => setRole(Number(e.target.value))}
                        required
                    >
                        {availableRoles.map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                        ))}
                    </select>
                </div>

                {errors.general && (
                    <div style={{ 
                        padding: '0.75rem', 
                        backgroundColor: 'var(--danger-bg)', 
                        color: 'var(--danger)', 
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        borderLeft: '3px solid var(--danger)'
                    }}>
                        {errors.general}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button 
                        type="submit" 
                        className="btn btn-primary" 
                        disabled={loading}
                        style={{ width: '100%', padding: '0.75rem' }}
                    >
                        {loading ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <>Invite Researcher</>
                        )}
                    </button>
                    <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={onCancel}
                        disabled={loading}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};


export default InviteMemberForm;
