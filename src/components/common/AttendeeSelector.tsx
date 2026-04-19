import React, { useState, useEffect, useMemo } from 'react';
import { userService, membershipService } from '@/services';
import {
    Users,
    Briefcase,
    Mail,
    Plus,
    X,
    Search,
    Check,
    Loader2
} from 'lucide-react';

export interface SelectedAttendee {
    email: string;
    name?: string;
    source: 'user' | 'project' | 'manual';
}

interface AttendeeSelectorProps {
    selectedAttendees: SelectedAttendee[];
    onChange: (attendees: SelectedAttendee[]) => void;
    projectsMap: Record<string, string>;
    /** Emails to hide from the picker entirely — e.g. already-selected presenters or the meeting creator */
    excludeEmails?: string[];
    /** When true, the selected-chips block at the top is not rendered */
    hideSelected?: boolean;
}

type TabMode = 'users' | 'project' | 'manual';

const AttendeeSelector: React.FC<AttendeeSelectorProps> = ({
    selectedAttendees,
    onChange,
    projectsMap,
    excludeEmails = [],
    hideSelected = false
}) => {
    const [activeMode, setActiveMode] = useState<TabMode>('users');

    // Users tab
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [userSearch, setUserSearch] = useState('');

    // Project tab
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [projectMembers, setProjectMembers] = useState<any[]>([]);
    const [projectMembersLoading, setProjectMembersLoading] = useState(false);

    // Manual tab
    const [manualInputs, setManualInputs] = useState<string[]>(['']);

    // Load all users
    useEffect(() => {
        const loadUsers = async () => {
            setUsersLoading(true);
            try {
                const data = await userService.getAll();
                setAllUsers(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error('Failed to load users:', e);
            } finally {
                setUsersLoading(false);
            }
        };
        loadUsers();
    }, []);

    // Load project members when project selected
    useEffect(() => {
        if (!selectedProjectId) {
            setProjectMembers([]);
            return;
        }
        const loadMembers = async () => {
            setProjectMembersLoading(true);
            try {
                const data = await membershipService.getProjectMembers(selectedProjectId);
                setProjectMembers(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error('Failed to load project members:', e);
            } finally {
                setProjectMembersLoading(false);
            }
        };
        loadMembers();
    }, [selectedProjectId]);

    const excludeSet = useMemo(() =>
        new Set(excludeEmails.map(e => e.toLowerCase()))
    , [excludeEmails]);

    const filteredUsers = useMemo(() => {
        const base = allUsers.filter(u => !excludeSet.has((u.email || '').toLowerCase()));
        if (!userSearch.trim()) return base;
        const q = userSearch.toLowerCase();
        return base.filter(u =>
            (u.fullName || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        );
    }, [allUsers, userSearch, excludeSet]);

    const isSelected = (email: string) =>
        selectedAttendees.some(a => a.email.toLowerCase() === email.toLowerCase());

    const toggleUser = (email: string, name: string, source: 'user' | 'project') => {
        if (isSelected(email)) {
            onChange(selectedAttendees.filter(a => a.email.toLowerCase() !== email.toLowerCase()));
        } else {
            onChange([...selectedAttendees, { email, name, source }]);
        }
    };

    const addManualEmail = (email: string) => {
        const trimmed = email.trim();
        if (!trimmed || isSelected(trimmed)) return;
        onChange([...selectedAttendees, { email: trimmed, source: 'manual' }]);
    };

    const handleManualInputChange = (idx: number, val: string) => {
        const updated = [...manualInputs];
        updated[idx] = val;
        setManualInputs(updated);
    };

    const handleManualAdd = (idx: number) => {
        const email = manualInputs[idx]?.trim();
        if (!email) return;
        addManualEmail(email);
        const updated = [...manualInputs];
        updated[idx] = '';
        setManualInputs(updated);
    };

    const handleAddMoreInput = () => {
        setManualInputs([...manualInputs, '']);
    };

    const handleRemoveInput = (idx: number) => {
        if (manualInputs.length <= 1) return;
        setManualInputs(manualInputs.filter((_, i) => i !== idx));
    };

    const removeAttendee = (email: string) => {
        onChange(selectedAttendees.filter(a => a.email.toLowerCase() !== email.toLowerCase()));
    };

    const tabBtnStyle = (active: boolean): React.CSSProperties => ({
        padding: '8px 14px',
        borderRadius: '8px',
        border: active ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
        background: active ? 'var(--accent-bg)' : '#fff',
        color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s'
    });

    return (
        <div style={{
            background: 'var(--background-color)',
            borderRadius: '12px',
            border: '1px solid var(--border-light)',
            padding: '14px',
        }}>
            {/* Selected Attendees Chips */}
            {!hideSelected && selectedAttendees.length > 0 && (
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    marginBottom: '12px',
                    padding: '10px',
                    background: '#fff',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)'
                }}>
                    {selectedAttendees.map(a => (
                        <span key={a.email} style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '16px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: a.source === 'user' ? '#eff6ff' : a.source === 'project' ? '#ecfdf5' : '#f5f3ff',
                            color: a.source === 'user' ? '#3b82f6' : a.source === 'project' ? '#10b981' : '#6366f1',
                            border: `1px solid ${a.source === 'user' ? '#bfdbfe' : a.source === 'project' ? '#bbf7d0' : '#c7d2fe'}`
                        }}>
                            {a.name ? `${a.name}` : a.email}
                            <button
                                onClick={() => removeAttendee(a.email)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: 'inherit',
                                    opacity: 0.7
                                }}
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, alignSelf: 'center' }}>
                        {selectedAttendees.length} selected
                    </span>
                </div>
            )}

            {/* Mode Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: excludeEmails.length > 0 ? '8px' : '12px' }}>
                <button style={tabBtnStyle(activeMode === 'users')} onClick={() => setActiveMode('users')}>
                    <Users size={14} /> From Users
                </button>
                <button style={tabBtnStyle(activeMode === 'project')} onClick={() => setActiveMode('project')}>
                    <Briefcase size={14} /> From Project
                </button>
                <button style={tabBtnStyle(activeMode === 'manual')} onClick={() => setActiveMode('manual')}>
                    <Mail size={14} /> Manual
                </button>
            </div>


            {/* Users Mode */}
            {activeMode === 'users' && (
                <div>
                    <div style={{ position: 'relative', marginBottom: '8px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            style={{
                                width: '100%',
                                padding: '8px 10px 8px 30px',
                                borderRadius: '8px',
                                border: '1.5px solid var(--border-color)',
                                fontSize: '0.82rem',
                                fontFamily: 'inherit',
                                outline: 'none'
                            }}
                            placeholder="Search by name or email..."
                            value={userSearch}
                            onChange={e => setUserSearch(e.target.value)}
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                        />
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }} className="custom-scrollbar">
                        {usersLoading ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>
                                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>No users found</div>
                        ) : filteredUsers.map(u => {
                            const email = u.email || '';
                            const name = u.fullName || '';
                            const selected = isSelected(email);
                            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || email)}&size=52&background=1e293b&color=ffffff&bold=true&rounded=true`;
                            return (
                                <div key={u.userId || email} onClick={() => toggleUser(email, name, 'user')}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', background: selected ? '#eff6ff' : '#fff', border: selected ? '1px solid #bfdbfe' : '1px solid var(--border-light)', transition: 'all 0.15s' }}
                                    onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                                    onMouseLeave={e => { if (!selected) e.currentTarget.style.background = selected ? '#eff6ff' : '#fff'; }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <img src={avatarUrl} alt={name} style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0 }} />
                                        <div>
                                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{email}</div>
                                        </div>
                                    </div>
                                    {selected && <Check size={16} color="#3b82f6" />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Project Mode */}
            {activeMode === 'project' && (
                <div>
                    {/* Styled project selector */}
                    <div style={{ position: 'relative', marginBottom: '8px' }}>
                        <select
                            style={{
                                width: '100%', padding: '9px 32px 9px 12px',
                                borderRadius: '10px', border: '1.5px solid #e2e8f0',
                                fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none',
                                background: '#fff', color: selectedProjectId ? 'var(--text-primary)' : '#94a3b8',
                                fontWeight: selectedProjectId ? 600 : 400,
                                cursor: 'pointer', appearance: 'none' as any,
                                transition: 'border-color 0.15s',
                            }}
                            value={selectedProjectId}
                            onChange={e => setSelectedProjectId(e.target.value)}
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                        >
                            <option value="">Choose a project...</option>
                            {Object.entries(projectsMap).map(([id, name]) => (
                                <option key={id} value={id}>{name}</option>
                            ))}
                        </select>
                        <svg style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }} className="custom-scrollbar">
                        {projectMembersLoading ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>
                                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
                            </div>
                        ) : !selectedProjectId ? (
                            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>Select a project above</div>
                        ) : projectMembers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>No members in this project</div>
                        ) : projectMembers.filter(m => !excludeSet.has((m.email || m.userEmail || '').toLowerCase())).map(m => {
                            const email = m.email || m.userEmail || '';
                            const name = m.fullName || m.userName || '';
                            const role = m.projectRoleName || '';
                            const selected = isSelected(email);
                            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || email)}&size=52&background=1e293b&color=ffffff&bold=true&rounded=true`;
                            return (
                                <div key={m.memberId || m.userId || email} onClick={() => email && toggleUser(email, name, 'project')}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '8px', cursor: email ? 'pointer' : 'default', background: selected ? '#ecfdf5' : '#fff', border: selected ? '1px solid #bbf7d0' : '1px solid var(--border-light)', opacity: email ? 1 : 0.5, transition: 'all 0.15s' }}
                                    onMouseEnter={e => { if (!selected && email) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                                    onMouseLeave={e => { if (!selected && email) e.currentTarget.style.background = selected ? '#ecfdf5' : '#fff'; }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <img src={avatarUrl} alt={name} style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0 }} />
                                        <div>
                                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{name || 'Unknown'}</div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{email || 'No email'}{role ? ` · ${role}` : ''}</div>
                                        </div>
                                    </div>
                                    {selected && <Check size={16} color="#10b981" />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Manual Mode */}
            {activeMode === 'manual' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {manualInputs.map((val, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input
                                style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1.5px solid var(--border-color)',
                                    fontSize: '0.82rem',
                                    fontFamily: 'inherit',
                                    outline: 'none'
                                }}
                                value={val}
                                onChange={e => handleManualInputChange(idx, e.target.value)}
                                placeholder="Enter email address..."
                                onKeyDown={e => e.key === 'Enter' && handleManualAdd(idx)}
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            />
                            <button
                                onClick={() => handleManualAdd(idx)}
                                disabled={!val.trim()}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: val.trim() ? 'var(--accent-color)' : '#94a3b8',
                                    color: '#fff',
                                    cursor: val.trim() ? 'pointer' : 'not-allowed',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    flexShrink: 0
                                }}
                            >
                                Add
                            </button>
                            {manualInputs.length > 1 && (
                                <button
                                    onClick={() => handleRemoveInput(idx)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#ef4444',
                                        padding: '4px',
                                        display: 'flex',
                                        flexShrink: 0
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        onClick={handleAddMoreInput}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px dashed var(--border-color)',
                            background: 'transparent',
                            color: 'var(--accent-color)',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                        <Plus size={14} /> Add Another Email
                    </button>
                </div>
            )}
        </div>
    );
};

export default AttendeeSelector;
