import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/layout/MainLayout';
import { projectService } from '@/services';
import { useAuth } from '@/hooks/useAuth';
import {
    Search,
    Calendar,
    Users,
    TrendingUp,
    ChevronRight,
    X,
    FlaskConical,
    CheckCircle2,
    Circle,
    Clock,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PublicMilestone {
    id: string;
    name: string;
    description: string;
    status: number; // 0=NotStarted | 1=InProgress | 2=Completed
    startDate: string | null;
    dueDate: string | null;
    progress: number;
}

interface PublicMember {
    membershipId: string;
    userId: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    roleName: string;
    projectRole: number;
    memberStatus: number;
    joinDate: string;
}

interface PublicResearchField {
    id: string;
    name: string;
}

interface PublicProject {
    projectId: string;
    name: string;
    description: string;
    status: number; // 0=Inactive | 1=Active | 2=Completed | 3=Archived
    startDate: string | null;
    endDate: string | null;
    createdAt: string;
    updatedAt: string;
    creatorName: string;
    progress: number;
    milestones: PublicMilestone[];
    members: PublicMember[];
    researchFields: PublicResearchField[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (date: string | null | undefined, fallback = 'TBD') => {
    if (!date) return fallback;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
    if (!m) return fallback;
    const [, y, mo, d] = m;
    if (Number(y) < 1970) return fallback;
    return `${d}/${mo}/${y}`;
};

const MILESTONE_STATUS: Record<number, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    0: { label: 'Not Started', icon: <Circle size={12} />, color: '#64748b', bg: '#f1f5f9' },
    1: { label: 'In Progress', icon: <Clock size={12} />, color: '#d97706', bg: '#fffbeb' },
    2: { label: 'Completed',   icon: <CheckCircle2 size={12} />, color: '#16a34a', bg: '#f0fdf4' },
};

const STATUS: Record<number, { label: string; color: string; bg: string }> = {
    1: { label: 'Active',    color: '#10b981', bg: '#ecfdf5' },
    2: { label: 'Inactive',  color: '#f57c00', bg: '#fff3e0' },
    3: { label: 'Archived',  color: '#6b7280', bg: '#f3f4f6' },
    4: { label: 'Completed', color: '#3b82f6', bg: '#eff6ff' },
    5: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
};

const PANEL_HEIGHT = 'calc(100vh - 170px)';

// ─── Component ───────────────────────────────────────────────────────────────

const LabProjects: React.FC = () => {
    const { user } = useAuth();
    const [projects, setProjects]     = useState<PublicProject[]>([]);
    const [loading, setLoading]       = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<number | 'All'>('All');
    const [selected, setSelected]     = useState<PublicProject | null>(null);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const data = await projectService.getPublic();
            setProjects(data);
        } catch {
            // handled in service
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProjects(); }, []);

    const filtered = useMemo(() =>
        projects.filter(p => {
            const matchSearch = (p.name ?? '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus = statusFilter === 'All' || p.status === statusFilter;
            return matchSearch && matchStatus;
        }),
        [projects, searchTerm, statusFilter]
    );

    const statusOptions = [
        { value: 'All' as const, label: 'All' },
        { value: 1, label: 'Active' },
        { value: 2, label: 'Inactive' },
        { value: 3, label: 'Archived' },
        { value: 4, label: 'Completed' },
        { value: 5, label: 'Cancelled' },
    ];

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">

                {/* ── Header ── */}
                <div className="page-header" style={{ marginBottom: '1.25rem' }}>
                    <div>
                        <h1>Lab's Projects</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                            Overview of all research projects in the lab.
                        </p>
                    </div>
                </div>

                {/* ── Toolbar ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            className="form-input"
                            style={{ paddingLeft: '36px', height: '36px', borderRadius: '10px', fontSize: '0.85rem', width: '100%' }}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div style={{ width: '1px', height: '22px', background: 'var(--border-color)', flexShrink: 0 }} />

                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {statusOptions.map(opt => (
                            <button
                                key={String(opt.value)}
                                onClick={() => setStatusFilter(opt.value)}
                                className={`filter-chip ${statusFilter === opt.value ? 'active' : ''}`}
                                style={{ height: '30px', padding: '0 0.75rem', borderRadius: '8px', fontSize: '0.75rem' }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
                        {filtered.length} project{filtered.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* ── Body: list + detail ── */}
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>

                    {/* Left: Project list (scrollable) */}
                    <div style={{
                        flex: selected ? 5 : 10,
                        minWidth: 0,
                        maxHeight: PANEL_HEIGHT,
                        overflowY: 'auto',
                        transition: 'flex 0.3s cubic-bezier(0.4,0,0.2,1)',
                        paddingRight: '2px',
                    }} className="custom-scrollbar">

                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                                <div className="loader" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="empty-state card" style={{ padding: '6rem 2rem', borderStyle: 'dashed' }}>
                                <TrendingUp size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                                <h2>No Projects Found</h2>
                                <p>There are no public projects matching your filters.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {filtered.map(project => {
                                    const st = STATUS[project.status] ?? STATUS[0];
                                    const isSelected = selected?.projectId === project.projectId;
                                    const memberCount = project.members?.length ?? 0;
                                    const milestoneCount = project.milestones?.length ?? 0;

                                    return (
                                        <div
                                            key={project.projectId}
                                            onClick={() => setSelected(isSelected ? null : project)}
                                            style={{
                                                background: isSelected ? '#f0f7ff' : '#fff',
                                                border: `1.5px solid ${isSelected ? 'var(--primary-color)' : '#e2e8f0'}`,
                                                borderLeft: `4px solid ${st.color}`,
                                                borderRadius: '12px',
                                                padding: '12px 14px',
                                                cursor: 'pointer',
                                                transition: 'all 0.18s',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '8px',
                                            }}
                                            onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.07)'; e.currentTarget.style.borderColor = '#c7d9f0'; } }}
                                            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = isSelected ? 'var(--primary-color)' : '#e2e8f0'; }}
                                        >
                                            {/* Row 1: title + status + chevron */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {project.name}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                                                    <span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: '5px', fontSize: '0.65rem', fontWeight: 700 }}>
                                                        {st.label}
                                                    </span>
                                                    <ChevronRight size={14} color="#94a3b8" style={{ transform: isSelected ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                                                </div>
                                            </div>

                                            {/* Row 2: description (only when no panel open) */}
                                            {!selected && (
                                                <div style={{ fontSize: '0.78rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                                    {project.description || 'No description provided.'}
                                                </div>
                                            )}

                                            {/* Row 3: research field tags */}
                                            {project.researchFields?.length > 0 && (
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                    {project.researchFields.slice(0, selected ? 2 : 4).map(f => (
                                                        <span key={f.id} style={{ fontSize: '0.6rem', padding: '1px 7px', borderRadius: '4px', fontWeight: 600, background: '#f1f5f9', color: '#475569' }}>{f.name}</span>
                                                    ))}
                                                    {project.researchFields.length > (selected ? 2 : 4) && (
                                                        <span style={{ fontSize: '0.6rem', padding: '1px 7px', borderRadius: '4px', fontWeight: 600, background: '#f1f5f9', color: '#94a3b8' }}>
                                                            +{project.researchFields.length - (selected ? 2 : 4)}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Row 4: progress bar */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: '#f1f5f9', overflow: 'hidden' }}>
                                                    <div style={{ width: `${project.progress ?? 0}%`, height: '100%', borderRadius: '3px', background: project.progress === 100 ? '#22c55e' : 'var(--primary-color)', transition: 'width 0.3s' }} />
                                                </div>
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: project.progress === 100 ? '#16a34a' : 'var(--primary-color)', minWidth: '28px', textAlign: 'right' }}>
                                                    {project.progress ?? 0}%
                                                </span>
                                            </div>

                                            {/* Row 5: meta */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.71rem', color: '#64748b', fontWeight: 600 }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <Calendar size={10} /> {fmt(project.startDate)} – {fmt(project.endDate)}
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <Users size={10} /> {memberCount}
                                                </span>
                                                {!selected && (
                                                    <>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <CheckCircle2 size={10} /> {project.milestones?.filter(m => m.status === 2).length ?? 0}/{milestoneCount} milestones
                                                        </span>
                                                        <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>
                                                            by {project.creatorName || 'Unknown'}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right: Detail panel */}
                    {selected && (
                        <div style={{
                            flex: 6,
                            minWidth: 0,
                            background: '#fff',
                            borderRadius: '14px',
                            border: '1.5px solid var(--border-color)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                            position: 'sticky',
                            top: '80px',
                            maxHeight: PANEL_HEIGHT,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}>
                            {/* Panel header */}
                            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1rem', alignItems: 'flex-start', flexShrink: 0 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    {/* Status badge only */}
                                    <div style={{ marginBottom: '6px' }}>
                                        {(() => {
                                            const st = STATUS[selected.status] ?? STATUS[0];
                                            return <span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 700 }}>{st.label}</span>;
                                        })()}
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.3 }}>
                                        {selected.name}
                                    </h3>
                                    <p style={{ margin: '3px 0 0', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                                        PI: <strong>{selected.creatorName || 'Unknown'}</strong> · {fmt(selected.startDate)} – {fmt(selected.endDate)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelected(null)}
                                    style={{ width: 28, height: 28, borderRadius: '7px', border: '1px solid var(--border-color)', background: 'var(--surface-hover)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}
                                >
                                    <X size={13} />
                                </button>
                            </div>

                            {/* Panel body */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="custom-scrollbar">

                                {/* Description */}
                                {selected.description && (
                                    <section>
                                        <SectionLabel>Description</SectionLabel>
                                        <p style={{ margin: 0, fontSize: '0.84rem', color: '#334155', lineHeight: 1.7 }}>
                                            {selected.description}
                                        </p>
                                    </section>
                                )}

                                {/* Overall progress */}
                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <SectionLabel noMargin>Overall Progress</SectionLabel>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: selected.progress === 100 ? '#16a34a' : 'var(--primary-color)' }}>
                                            {selected.progress ?? 0}%
                                        </span>
                                    </div>
                                    <div style={{ height: '8px', borderRadius: '4px', background: '#f1f5f9', overflow: 'hidden' }}>
                                        <div style={{ width: `${selected.progress ?? 0}%`, height: '100%', background: selected.progress === 100 ? '#22c55e' : 'var(--primary-color)', borderRadius: '4px', transition: 'width 0.4s' }} />
                                    </div>
                                </section>

                                {/* Milestones */}
                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <SectionLabel noMargin>Milestones</SectionLabel>
                                        <span style={{ fontSize: '0.71rem', color: 'var(--accent-color)', fontWeight: 700 }}>
                                            {selected.milestones?.filter(m => m.status === 2).length ?? 0}/{selected.milestones?.length ?? 0} done
                                        </span>
                                    </div>

                                    {selected.milestones?.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: selected.milestones.length >= 2 ? '260px' : undefined, overflowY: selected.milestones.length >= 2 ? 'auto' : undefined, paddingRight: selected.milestones.length >= 2 ? '2px' : undefined }} className={selected.milestones.length >= 2 ? 'custom-scrollbar' : undefined}>
                                            {[...selected.milestones]
                                                .sort((a, b) => new Date(a.startDate || '').getTime() - new Date(b.startDate || '').getTime())
                                                .map(m => {
                                                    const ms = MILESTONE_STATUS[m.status] ?? MILESTONE_STATUS[0];
                                                    return (
                                                        <div key={m.id} style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', borderLeft: `3px solid ${ms.color}` }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                                                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', flex: 1 }}>{m.name}</span>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.63rem', fontWeight: 700, color: ms.color, background: ms.bg, padding: '2px 7px', borderRadius: '4px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                                                    {ms.icon} {ms.label}
                                                                </span>
                                                            </div>
                                                            {m.description && (
                                                                <p style={{ margin: '0 0 6px', fontSize: '0.76rem', color: '#475569', lineHeight: 1.5 }}>{m.description}</p>
                                                            )}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.69rem', color: '#64748b', fontWeight: 600 }}>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                    <Calendar size={10} /> {fmt(m.startDate)} – {fmt(m.dueDate)}
                                                                </span>
                                                                <span style={{ marginLeft: 'auto', fontWeight: 800, color: m.progress === 100 ? '#16a34a' : '#64748b' }}>{m.progress}%</span>
                                                            </div>
                                                            <div style={{ height: '3px', borderRadius: '2px', background: '#e2e8f0', overflow: 'hidden', marginTop: '6px' }}>
                                                                <div style={{ width: `${m.progress}%`, height: '100%', background: m.progress === 100 ? '#22c55e' : ms.color, borderRadius: '2px' }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    ) : (
                                        <Empty text="No milestones defined yet." />
                                    )}
                                </section>

                                {/* Members */}
                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <SectionLabel noMargin>Team Members</SectionLabel>
                                        <span style={{ fontSize: '0.71rem', color: 'var(--accent-color)', fontWeight: 700 }}>
                                            {selected.members?.length ?? 0} members
                                        </span>
                                    </div>

                                    {selected.members?.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: selected.members.length >= 4 ? '220px' : undefined, overflowY: selected.members.length >= 4 ? 'auto' : undefined, paddingRight: selected.members.length >= 4 ? '2px' : undefined }} className={selected.members.length >= 4 ? 'custom-scrollbar' : undefined}>
                                            {[...selected.members]
                                                .sort((a, b) => a.projectRole - b.projectRole)
                                                .map(member => (
                                                    <div key={member.membershipId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#f8fafc', borderRadius: '9px' }}>
                                                        {member.avatarUrl ? (
                                                            <img
                                                                src={member.avatarUrl}
                                                                alt={member.fullName}
                                                                style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                                            />
                                                        ) : (
                                                            <div style={{
                                                                width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                                                                background: 'var(--primary-color)', display: 'flex', alignItems: 'center',
                                                                justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#fff',
                                                            }}>
                                                                {(member.fullName || '?')[0].toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {member.fullName}
                                                            </div>
                                                            <div style={{ fontSize: '0.69rem', color: '#64748b' }}>{member.roleName}</div>
                                                        </div>
                                                        {member.projectRole === 0 && (
                                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '2px 7px', borderRadius: '4px', flexShrink: 0 }}>
                                                                Creator
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                        </div>
                                    ) : (
                                        <Empty text="No members listed." />
                                    )}
                                </section>

                                {/* Research Fields */}
                                {selected.researchFields?.length > 0 && (
                                    <section>
                                        <SectionLabel>Research Fields</SectionLabel>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {selected.researchFields.map(f => (
                                                <span key={f.id} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', fontWeight: 600, background: '#f1f5f9', color: '#475569' }}>
                                                    {f.name}
                                                </span>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Footer stats */}
                                <section style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        {[
                                            { label: 'Created', value: fmt(selected.createdAt) },
                                            { label: 'Last Updated', value: fmt(selected.updatedAt) },
                                        ].map(item => (
                                            <div key={item.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '2px' }}>{item.label}</div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>{item.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
};

// ─── Small helpers ────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode; noMargin?: boolean }> = ({ children, noMargin }) => (
    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: noMargin ? 0 : '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <FlaskConical size={11} /> {children}
    </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
    <div style={{ padding: '1.25rem', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #e2e8f0' }}>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem' }}>{text}</p>
    </div>
);

export default LabProjects;
