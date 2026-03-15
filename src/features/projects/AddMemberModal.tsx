import React, { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import { userService, membershipService, projectService } from '@/services';
import { Search, Mail, Loader2, UserPlus, CheckCircle2, AlertCircle } from 'lucide-react';

interface AddMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    onSuccess: () => void;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ isOpen, onClose, projectId, onSuccess }) => {
    const [email, setEmail] = useState('');
    const [searching, setSearching] = useState(false);
    const [foundUser, setFoundUser] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [roles, setRoles] = useState<any[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [loadingRoles, setLoadingRoles] = useState(true);

    useEffect(() => {
        const fetchRoles = async () => {
            setLoadingRoles(true);
            try {
                const fetchedRoles = await projectService.getRoles();
                setRoles(fetchedRoles);
                if (fetchedRoles.length > 0) {
                    // Default to first role - typically 'Member'
                    const memberRole = fetchedRoles.find((r: any) => r.name === 'Member') || fetchedRoles[0];
                    setSelectedRoleId(memberRole.id);
                }
            } catch (err) {
                console.error("Failed to fetch roles:", err);
            } finally {
                setLoadingRoles(false);
            }
        };

        if (isOpen) {
            fetchRoles();
        }
    }, [isOpen]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        setSearching(true);
        setError(null);
        setFoundUser(null);

        try {
            const user = await userService.getByEmail(email.trim());
            console.log("Found user:", user);
            if (user) {
                setFoundUser(user);
            } else {
                setError('User not found with this email.');
            }
        } catch (err: any) {
            console.error(err);
            setError('User not found or an error occurred during search.');
        } finally {
            setSearching(false);
        }
    };

    const handleAddMember = async () => {
        if (!foundUser || !projectId || !selectedRoleId) return;

        setSubmitting(true);
        setError(null);

        try {
            const payload = {
                userId: foundUser.userId || foundUser.id,
                projectId: projectId,
                projectRoleId: selectedRoleId
            };
            
            await membershipService.addMember(payload);
            setFoundUser(null);
            setEmail('');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            const msg = err?.response?.data?.message || err?.response?.data || 'Failed to add member to project.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Member to Project">
            <div style={{ padding: '0.5rem' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    Search for a researcher by their email address to invite them to this project workspace.
                </p>

                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '2rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="email"
                            placeholder="Enter researcher's email..."
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px 10px 40px',
                                borderRadius: 'var(--radius-md)',
                                border: '1.5px solid var(--border-color)',
                                outline: 'none',
                                fontSize: '0.95rem'
                            }}
                            required
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="btn btn-primary" 
                        disabled={searching || !email.trim()}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '110px', justifyContent: 'center' }}
                    >
                        {searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                        Search
                    </button>
                </form>

                {error && (
                    <div style={{ 
                        padding: '1rem', 
                        background: '#fef2f2', 
                        color: '#ef4444', 
                        borderRadius: 'var(--radius-md)', 
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '0.9rem',
                        border: '1px solid #fee2e2'
                    }}>
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                {foundUser && (
                    <div style={{ 
                        background: '#f8fafc', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: 'var(--radius-lg)', 
                        padding: '1.5rem',
                        marginBottom: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '1.5rem' }}>
                            <div style={{ 
                                width: '56px', height: '56px', borderRadius: '50%', 
                                background: 'var(--primary-color)', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.5rem', fontWeight: 600
                            }}>
                                {(foundUser.fullName || foundUser.userName || 'U')[0]}
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{foundUser.fullName || foundUser.userName}</h3>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{foundUser.email}</p>
                            </div>
                            <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 700 }}>
                                <CheckCircle2 size={16} /> FOUND
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                Assign Project Role
                            </label>
                            {loadingRoles ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '1rem', color: 'var(--text-muted)' }}>
                                    <Loader2 size={18} className="animate-spin" /> Loading roles...
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    {roles.map(role => (
                                        <div 
                                            key={role.id}
                                            onClick={() => setSelectedRoleId(role.id)}
                                            style={{
                                                padding: '12px',
                                                borderRadius: 'var(--radius-md)',
                                                border: `2px solid ${selectedRoleId === role.id ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                background: selectedRoleId === role.id ? 'rgba(99, 102, 241, 0.05)' : 'white',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px'
                                            }}
                                        >
                                            <div style={{ 
                                                width: '18px', height: '18px', borderRadius: '50%', 
                                                border: `2px solid ${selectedRoleId === role.id ? 'var(--primary-color)' : '#cbd5e1'}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {selectedRoleId === role.id && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary-color)' }} />}
                                            </div>
                                            <span style={{ fontSize: '0.9rem', fontWeight: selectedRoleId === role.id ? 600 : 400 }}>{role.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '1rem' }}>
                            <button 
                                className="btn btn-primary" 
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                onClick={handleAddMember}
                                disabled={submitting || !selectedRoleId}
                            >
                                {submitting ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                                Add to Project Team
                            </button>
                            <button 
                                className="btn btn-outline" 
                                style={{ flex: 1 }}
                                onClick={() => { setFoundUser(null); setError(null); }}
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: foundUser ? '0' : '1rem' }}>
                    <button 
                        className="btn btn-text" 
                        onClick={onClose}
                        disabled={submitting || searching}
                    >
                        Close
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </Modal>
    );
};

export default AddMemberModal;
