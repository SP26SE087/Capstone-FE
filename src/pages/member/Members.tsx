import React, { useState, useEffect, useMemo, useRef } from 'react';
import MainLayout from '@/layout/MainLayout';
import {
    UserPlus,
    Search,
    Mail,
    Users,
    Loader2,
    X
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/services/userService';
import UserDetailModal from './UserDetailModal';
import InviteMemberForm from './components/InviteMemberForm';
import FaceScannerModal from './FaceScannerModal';
import CheckLogPanel from './CheckLogPanel';
import UserProjectsPanel from './UserProjectsPanel';
import { SystemRoleEnum, SystemRoleMap } from '@/types/enums';
import { useToastStore } from '@/store/slices/toastSlice';

const Members: React.FC = () => {
    const { user } = useAuth();
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [isInviteFormOpen, setIsInviteFormOpen] = useState(false);
    const [faceScanData, setFaceScanData] = useState<{ studentId: string; userName: string } | null>(null);
    const [checkLogData, setCheckLogData] = useState<{ email: string; studentId: string; userName: string } | null>(null);
    const [projectPanelData, setProjectPanelData] = useState<{ email: string; userName: string } | null>(null);
    const [studentSearchResult, setStudentSearchResult] = useState<any | null>(null);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isLabDirector = user.role === 'Lab Director' || 
                         user.role === 'LabDirector' || 
                         Number(user.role) === SystemRoleEnum.LabDirector;
    
    const { addToast } = useToastStore();

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const data = await userService.getAll();
            setMembers(data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch members:', err);
            setError((err as any).message || 'Failed to load lab members.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, []);

    const filteredMembers = useMemo(() => {
        const base = (() => {
            if (!searchQuery.trim()) return members;
            const query = searchQuery.toLowerCase();
            return members.filter(member =>
                (member.fullName || member.userName || '').toLowerCase().includes(query) ||
                (member.email || '').toLowerCase().includes(query) ||
                (SystemRoleMap[member.role] || String(member.role || '')).toLowerCase().includes(query) ||
                (member.studentId || member.StudentId || '').toLowerCase().includes(query)
            );
        })();

        if (studentSearchResult) {
            const alreadyIn = base.some(m =>
                (m.userId || m.id) === (studentSearchResult.userId || studentSearchResult.id)
            );
            return alreadyIn ? base : [...base, studentSearchResult];
        }
        return base;
    }, [members, searchQuery, studentSearchResult]);

    // studentId API search when local results are empty
    useEffect(() => {
        const q = searchQuery.trim();
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        if (!q) { setStudentSearchResult(null); return; }
        searchDebounceRef.current = setTimeout(async () => {
            try {
                const result = await userService.getByStudentId(q);
                if (result && (result.userId || result.id)) setStudentSearchResult(result);
                else setStudentSearchResult(null);
            } catch {
                setStudentSearchResult(null);
            }
        }, 500);
    }, [searchQuery]);

    const isSidePanelOpen = isInviteFormOpen || Boolean(selectedUserId);
    const isCheckLogOpen = Boolean(checkLogData);
    const isProjectPanelOpen = Boolean(projectPanelData);

    const handleMemberClick = (userId: string) => {
        setSelectedUserId(userId);
        setIsInviteFormOpen(false);
        setCheckLogData(null);
    };

    return (
        <>
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">
                {/* Page Header */}
                <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                        <h1>Lab Members</h1>
                        <p>Manage team access, roles and laboratory permissions.</p>
                    </div>
                </div>

                {/* Search and Action — Horizontal Right/Left Alignment */}
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: '1.5rem', 
                    marginBottom: '2rem' 
                }}>
                    <div className="card" style={{ flex: 1, margin: 0, display: 'flex', alignItems: 'center', padding: '0 1.25rem', height: '44px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search members by name, email or role..."
                                className="form-input"
                                style={{ 
                                    paddingLeft: '40px', 
                                    width: '100%',
                                    border: 'none', 
                                    background: 'transparent', 
                                    boxShadow: 'none',
                                    outline: 'none'
                                }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {isLabDirector && (
                        <div style={{ flexShrink: 0 }}>
                            <button 
                                className="btn btn-primary" 
                                style={{ 
                                    height: '44px',
                                    minWidth: '160px',
                                    padding: '0 1.5rem', 
                                    boxShadow: 'var(--shadow-sm)',
                                    backgroundColor: isInviteFormOpen ? 'var(--secondary-color)' : 'var(--accent-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px'
                                }}
                                onClick={() => {
                                    setIsInviteFormOpen((prev) => {
                                        const next = !prev;
                                        if (next) setSelectedUserId(null);
                                        return next;
                                    });
                                }}
                            >
                                {isInviteFormOpen ? <X size={20} /> : <UserPlus size={20} />} 
                                {isInviteFormOpen ? 'Close' : 'Invite Member'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Main Content Area: List + Form */}
                <div style={{ 
                    display: 'flex', 
                    gap: isSidePanelOpen ? '1.5rem' : '0', 
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    {/* Left Column: Members List */}
                    <div style={{
                        flex: (isCheckLogOpen || isProjectPanelOpen) ? '0 0 0' : (!isSidePanelOpen ? '1' : '0 0 60%'),
                        maxWidth: (isCheckLogOpen || isProjectPanelOpen) ? '0' : (!isSidePanelOpen ? '100%' : '60%'),
                        opacity: (isCheckLogOpen || isProjectPanelOpen) ? 0 : 1,
                        visibility: (isCheckLogOpen || isProjectPanelOpen) ? 'hidden' : 'visible',
                        overflow: 'hidden',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        minWidth: 0
                    }}>
                        {/* Status indicators (loading/error) */}
                        {loading && (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
                                <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-color)' }} />
                            </div>
                        )}

                        {/* Members List with Scroll Container */}
                        {!loading && !error && (
                            <div 
                                className="custom-scrollbar"
                                style={{ 
                                    display: 'grid',
                                    gridTemplateColumns: '1fr',
                                    gap: '0.75rem',
                                    maxHeight: 'calc(100vh - 350px)',
                                    overflowY: 'auto',
                                    paddingRight: '6px'
                                }}
                            >
                                {filteredMembers.length > 0 ? (
                                    filteredMembers.map((member: any) => {
                                        const name = member.fullName || member.userName || member.name || 'Unknown User';
                                        const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
                                        
                                        return (
                                            <div 
                                                key={member.userId || member.id} 
                                                className="card card-interactive" 
                                                onClick={() => handleMemberClick(member.userId || member.id)}
                                                style={{ 
                                                    padding: '0.75rem 1.5rem', 
                                                    margin: 0,
                                                    display: 'grid',
                                                    gridTemplateColumns: '48px 1fr auto',
                                                    alignItems: 'center',
                                                    gap: '1.5rem',
                                                    borderRadius: 'var(--radius-md)'
                                                }}
                                            >
                                                {/* Column 1: Avatar (Left Aligned) */}
                                                <div className="avatar" style={{
                                                    background: 'var(--accent-bg)',
                                                    color: 'var(--accent-color)',
                                                    borderRadius: 'var(--radius-md)',
                                                    fontWeight: 700,
                                                    width: '48px',
                                                    height: '48px',
                                                    fontSize: '1rem',
                                                    overflow: 'hidden',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    {(member.avatarUrl || member.AvatarUrl) ? (
                                                        <img
                                                            src={member.avatarUrl || member.AvatarUrl}
                                                            alt={name}
                                                            referrerPolicy="no-referrer"
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    ) : initials}
                                                </div>

                                                {/* Column 2: Identity Info (Left Aligned) */}
                                                <div style={{ minWidth: 0, textAlign: 'left' }}>
                                                    <h3 style={{ margin: '0 0 2px 0', fontSize: '0.95rem', fontWeight: 600 }}>{name}</h3>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                                        <Mail size={12} />
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {member.email}
                                                        </span>
                                                        {member.department && <span style={{ color: 'var(--text-muted)' }}>• {member.department}</span>}
                                                    </div>
                                                </div>

                                                {/* Column 3: Role & Status (Right Aligned) */}
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
                                                    <span className="badge badge-muted" style={{ fontWeight: 600, fontSize: '0.7rem' }}>
                                                        {SystemRoleMap[member.role] || member.role || 'Member'}
                                                    </span>
                                                    {member.status && (
                                                        <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>
                                                            {member.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="empty-state">
                                        <Users size={36} />
                                        <h2>No members found</h2>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Middle Column: User detail / Invite form */}
                    <div style={{
                        flex: isSidePanelOpen ? ((isCheckLogOpen || isProjectPanelOpen) ? '0 0 38%' : '0 0 40%') : '0 0 0',
                        maxWidth: isSidePanelOpen ? ((isCheckLogOpen || isProjectPanelOpen) ? '38%' : '40%') : '0',
                        transform: isSidePanelOpen ? 'translateX(0)' : 'translateX(50px)',
                        opacity: isSidePanelOpen ? 1 : 0,
                        visibility: isSidePanelOpen ? 'visible' : 'hidden',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        zIndex: 10,
                        minWidth: 0
                    }}>
                        {isInviteFormOpen ? (
                            <InviteMemberForm 
                                onSuccess={() => {
                                    fetchMembers();
                                    addToast('Member invited successfully!', 'success');
                                }}
                                onCancel={() => setIsInviteFormOpen(false)}
                            />
                        ) : (
                            <UserDetailModal
                                userId={selectedUserId}
                                systemRoleMap={SystemRoleMap}
                                onClose={() => { setSelectedUserId(null); setCheckLogData(null); setProjectPanelData(null); }}
                                onCheckLog={(email, studentId, userName) => {
                                    setProjectPanelData(null);
                                    if (isCheckLogOpen && checkLogData?.email === email) {
                                        setCheckLogData(null);
                                    } else {
                                        setCheckLogData({ email, studentId, userName });
                                    }
                                }}
                                isCheckLogOpen={isCheckLogOpen}
                                onViewProjects={(email, userName) => {
                                    setCheckLogData(null);
                                    if (isProjectPanelOpen && projectPanelData?.email === email) {
                                        setProjectPanelData(null);
                                    } else {
                                        setProjectPanelData({ email, userName });
                                    }
                                }}
                                isProjectPanelOpen={isProjectPanelOpen}
                                isLabDirector={isLabDirector}
                                onDeleted={() => {
                                    addToast('User deleted successfully.', 'success');
                                    setSelectedUserId(null);
                                    setCheckLogData(null);
                                    setProjectPanelData(null);
                                    fetchMembers();
                                }}
                            />
                        )}
                    </div>

                    {/* Right Column: Check Log / Projects panel */}
                    <div style={{
                        flex: (isCheckLogOpen || isProjectPanelOpen) ? '0 0 62%' : '0 0 0',
                        maxWidth: (isCheckLogOpen || isProjectPanelOpen) ? '62%' : '0',
                        transform: (isCheckLogOpen || isProjectPanelOpen) ? 'translateX(0)' : 'translateX(50px)',
                        opacity: (isCheckLogOpen || isProjectPanelOpen) ? 1 : 0,
                        visibility: (isCheckLogOpen || isProjectPanelOpen) ? 'visible' : 'hidden',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        zIndex: 10,
                        minWidth: 0
                    }}>
                        {checkLogData && (
                            <CheckLogPanel
                                email={checkLogData.email}
                                studentId={checkLogData.studentId}
                                userName={checkLogData.userName}
                                onClose={() => setCheckLogData(null)}
                                onScanFace={(studentId, userName) => setFaceScanData({ studentId, userName })}
                            />
                        )}
                        {projectPanelData && (
                            <UserProjectsPanel
                                email={projectPanelData.email}
                                userName={projectPanelData.userName}
                                onClose={() => setProjectPanelData(null)}
                            />
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
        <FaceScannerModal
            isOpen={Boolean(faceScanData)}
            onClose={() => setFaceScanData(null)}
            initialStudentId={faceScanData?.studentId ?? ''}
            userName={faceScanData?.userName ?? ''}
        />
        </>
    );
};

export default Members;
