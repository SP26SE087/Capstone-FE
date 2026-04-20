import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { projectService, researchFieldService } from '@/services';
import { Project, ProjectStatus, ResearchField } from '@/types';
import { getProjectStatusStyle, getVietnamDateInputValue, toApiDate } from '@/utils/projectUtils';
import { validateSpecialChars } from '@/utils/validation';
import { useToastStore } from '@/store/slices/toastSlice';
import {
    Plus,
    Search,
    Calendar,
    Users,
    ClipboardList,
    TrendingUp,
    X,
    Save,
    Briefcase,
    FileText,
    Check,
    AlertTriangle,
    Clock,
    FlaskConical,
    RotateCcw
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import ResearchFieldManager from '@/features/projects/components/ResearchFieldManager';

const DEADLINE_WARN_DAYS = 7;

const getDeadlineState = (project: Project): 'overdue' | 'soon' | null => {
    if (project.status !== ProjectStatus.Active && project.status !== ProjectStatus.Inactive) return null;
    const datePart = /^(\d{4}-\d{2}-\d{2})/.exec(project.endDate ?? '')?.[1];
    if (!datePart) return null;
    const [y, m, d] = datePart.split('-').map(Number);
    if (!y || y < 1970) return null;
    const end = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return 'overdue';
    if (diffDays <= DEADLINE_WARN_DAYS) return 'soon';
    return null;
};

const PROJECT_SORT_ORDER: Record<number, number> = {
    [ProjectStatus.Inactive as number]: 0,
    [ProjectStatus.Active as number]: 1,
    [ProjectStatus.Completed as number]: 2,
    [ProjectStatus.Archived as number]: 3,
};

const Projects: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToast } = useToastStore();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'All'>('All');

    // Create panel
    const [showPanel, setShowPanel] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [availableFields, setAvailableFields] = useState<ResearchField[]>([]);
    const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
    const [fieldSearch, setFieldSearch] = useState('');
    const [createForm, setCreateForm] = useState({ projectName: '', projectDescription: '', startDate: '', endDate: '' });
    const [createError, setCreateError] = useState<string | null>(null);
    const todayVn = getVietnamDateInputValue();

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1.5px solid var(--border-color)',
        fontSize: '0.85rem',
        fontWeight: 500,
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        background: '#fff'
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '0.72rem',
        fontWeight: 800,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        marginBottom: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    };

    const sectionStyle: React.CSSProperties = {
        padding: '16px',
        background: 'var(--background-color)',
        borderRadius: '12px',
        border: '1px solid var(--border-light)',
        marginBottom: '16px'
    };

    const [showResearchPanel, setShowResearchPanel] = React.useState(false);

    const isLabDirector = Number(user.role) === 1 || Number(user.role) === 2 ||
        user.role === 'Admin' || user.role === 'Lab Director' || user.role === 'LabDirector';

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const data = await projectService.getAll();
            setProjects(data || []);
        } catch (error) {
            console.error('Failed to fetch projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const data = await projectService.getAll();
            setProjects(data || []);
        } catch (error) {
            console.error('Failed to refresh projects:', error);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchProjects(); }, []);

    const openPanel = async () => {
        setShowPanel(true);
        setCreateForm({ projectName: '', projectDescription: '', startDate: todayVn, endDate: '' });
        setSelectedFieldIds([]);
        setFieldSearch('');
        setCreateError(null);
        if (availableFields.length === 0) {
            const fields = await researchFieldService.getAll();
            setAvailableFields(fields);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError(null);
        try {
            const startDate = createForm.startDate || todayVn;

            if (startDate < todayVn) {
                setCreateError('Start date cannot be in the past.');
                return;
            }

            if (createForm.endDate && createForm.endDate < startDate) {
                setCreateError('End date cannot be earlier than start date.');
                return;
            }

            const nameErr = validateSpecialChars(createForm.projectName);
            if (nameErr) { setCreateError(`Project name: ${nameErr}`); return; }
            const descErr = validateSpecialChars(createForm.projectDescription);
            if (descErr) { setCreateError(`Description: ${descErr}`); return; }

            setSubmitting(true);

            await projectService.create({
                projectName: createForm.projectName,
                projectDescription: createForm.projectDescription,
                startDate: toApiDate(startDate),
                endDate: toApiDate(createForm.endDate),
                status: 2, // 2 is Inactive/Pending
                researchFieldIds: selectedFieldIds
            });
            setShowPanel(false);
            addToast('Project created successfully!', 'success');
            await fetchProjects();
        } catch (err: any) {
            setCreateError(err.response?.data?.message || err.message || 'Failed to create project.');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredProjects = useMemo(() => projects
        .filter(p => {
            const name = (p.projectName || (p as any).name || '').toLowerCase();
            const matchesSearch = name.includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => (PROJECT_SORT_ORDER[a.status as unknown as number] ?? 1) - (PROJECT_SORT_ORDER[b.status as unknown as number] ?? 1)),
    [projects, searchTerm, statusFilter]);

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">
                {/* Header */}
                <div className="page-header" style={{ marginBottom: '1.25rem' }}>
                    <div>
                        <h1>My Projects</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Management hub for your research initiatives and active workflows.</p>
                    </div>
                    {isLabDirector && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                onClick={() => setShowResearchPanel(true)}
                                title="Manage Research Fields"
                                style={{
                                    padding: '0.65rem 0.9rem', borderRadius: '12px', fontWeight: 600,
                                    border: '1.5px solid #f59e0b', background: 'var(--surface-color)',
                                    color: '#b45309', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#d97706'; e.currentTarget.style.color = '#92400e'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.color = '#b45309'; }}
                            >
                                <FlaskConical size={18} />
                                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Research Fields</span>
                            </button>
                            <button
                                onClick={openPanel}
                                className="btn btn-primary"
                                style={{ padding: '0.65rem 1.3rem', borderRadius: '12px', fontWeight: 700 }}
                            >
                                <Plus size={18} /> New Project
                            </button>
                        </div>
                    )}
                </div>

                {/* Toolbar: Search + Status chips + Refresh */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                    {/* Search */}
                    <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            className="form-input"
                            style={{ paddingLeft: '36px', height: '36px', borderRadius: '10px', fontSize: '0.85rem', width: '100%' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Divider */}
                    <div style={{ width: '1px', height: '22px', background: 'var(--border-color)', flexShrink: 0 }} />

                    {/* Status chips */}
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {(['All', ProjectStatus.Active, ProjectStatus.Inactive, ProjectStatus.Completed, ProjectStatus.Cancelled, ProjectStatus.Archived] as const).map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status as any)}
                                className={`filter-chip ${statusFilter === status ? 'active' : ''}`}
                                style={{ height: '30px', padding: '0 0.75rem', borderRadius: '8px', fontSize: '0.75rem' }}
                            >
                                {status === 'All' ? 'All' : getProjectStatusStyle(status as ProjectStatus).label}
                            </button>
                        ))}
                    </div>

                    {/* Divider */}
                    <div style={{ width: '1px', height: '22px', background: 'var(--border-color)', flexShrink: 0 }} />

                    {/* Refresh */}
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        style={{
                            height: '36px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--border-color)',
                            background: 'white', cursor: refreshing ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            color: 'var(--text-secondary)', opacity: refreshing ? 0.6 : 1, flexShrink: 0, transition: 'all 0.15s',
                            fontSize: '0.8rem', fontWeight: 600,
                        }}
                    >
                        <RotateCcw size={14} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Project Grid + Create Project Panel */}
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                    <div style={{ flex: showPanel ? 3 : 10, minWidth: 0, transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: '2px' }} className="custom-scrollbar">
                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                            </div>
                        ) : filteredProjects.length > 0 ? (
                            (() => {
                                const formatDate = (dateString?: string | null) => {
                                    if (!dateString) return 'TBD';
                                    const datePart = /^\d{4}-\d{2}-\d{2}/.exec(dateString)?.[0];
                                    if (!datePart) return 'TBD';
                                    const [y, m, d] = datePart.split('-').map(Number);
                                    if (!y || !m || !d || y < 1970) return 'TBD';
                                    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
                                };
                                return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {filteredProjects.map((project) => {
                                        const statusStyle = getProjectStatusStyle(project.status);
                                        const totalTasks = project.totalTasks || 0;
                                        const completedTasks = project.completedTasks || 0;
                                        const progress = project.progress !== undefined ? project.progress : (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);
                                        const projectName = project.projectName || (project as any).name || 'Untitled Project';
                                        const projectDescription = project.projectDescription || (project as any).description;
                                        const creatorName = project.nameProjectCreator || project.NameProjectCreator || 'Lab Manager';
                                        const deadlineState = getDeadlineState(project);

                                        return (
                                            <div
                                                key={project.projectId}
                                                onClick={() => navigate(`/projects/${project.projectId}`)}
                                                style={{
                                                    background: '#fff',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '14px',
                                                    borderLeft: `4px solid ${deadlineState === 'overdue' ? '#ef4444' : deadlineState === 'soon' ? '#f59e0b' : statusStyle.color}`,
                                                    padding: '14px 16px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    overflow: 'hidden',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '10px',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                                            >
                                                {/* Row 1: title + badges */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: showPanel ? '0.88rem' : '0.95rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {projectName}
                                                        </div>
                                                        {!showPanel && (
                                                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                                                {projectDescription || 'No description provided.'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '5px', flexShrink: 0, alignItems: 'center' }}>
                                                        {deadlineState === 'overdue' && (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.62rem', fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '2px 7px', borderRadius: '5px' }}>
                                                                <AlertTriangle size={10} /> Overdue
                                                            </span>
                                                        )}
                                                        {deadlineState === 'soon' && (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.62rem', fontWeight: 700, color: '#d97706', background: '#fffbeb', padding: '2px 7px', borderRadius: '5px' }}>
                                                                <Clock size={10} /> Due soon
                                                            </span>
                                                        )}
                                                        <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: '3px 9px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 700 }}>
                                                            {statusStyle.label}
                                                        </span>
                                                        {project.roleName && (
                                                            <span style={{ background: 'var(--accent-bg)', color: 'var(--accent-color)', padding: '3px 9px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 700 }}>
                                                                {project.roleName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Row 2: research fields (full view only) */}
                                                {!showPanel && project.researchFields && project.researchFields.length > 0 && (
                                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                        {project.researchFields.slice(0, 3).map((f, idx) => (
                                                            <span key={f.researchFieldId || `rf-${idx}`} style={{ fontSize: '0.62rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, background: '#f1f5f9', color: '#475569' }}>{f.name}</span>
                                                        ))}
                                                        {project.researchFields.length > 3 && (
                                                            <span style={{ fontSize: '0.62rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, background: '#f1f5f9', color: '#94a3b8' }}>+{project.researchFields.length - 3}</span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Row 3: progress bar */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: '#f1f5f9', overflow: 'hidden' }}>
                                                        <div style={{ width: `${progress}%`, height: '100%', borderRadius: '3px', background: progress === 100 ? '#22c55e' : 'var(--primary-color)', transition: 'width 0.3s' }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: progress === 100 ? '#16a34a' : 'var(--primary-color)', minWidth: '30px', textAlign: 'right' }}>{progress}%</span>
                                                </div>

                                                {/* Row 4: meta info */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Calendar size={11} /> {formatDate(project.startDate)} – {formatDate(project.endDate)}
                                                    </span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Users size={11} /> {project.membersCount || 0} members
                                                    </span>
                                                    {!showPanel && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <ClipboardList size={11} /> {completedTasks}/{totalTasks} tasks
                                                        </span>
                                                    )}
                                                    {!showPanel && (
                                                        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                                                            by {creatorName}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                );
                            })()
                        ) : (
                            <div className="empty-state card" style={{ padding: '6rem 2rem', borderStyle: 'dashed' }}>
                                <TrendingUp size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                                <h2>Initialize Your Research</h2>
                                <p>No active projects found. Start by creating a workspace for your next breakthrough.</p>
                                {isLabDirector && (
                                    <button onClick={openPanel} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                                        + Create Project
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {showPanel && (
                        <div style={{ flex: 4, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)', position: 'sticky', top: '80px', maxHeight: 'calc(100vh - 120px)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>New Project</h3>
                                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Initialize a new research initiative</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowPanel(false)}
                                    style={{ width: 34, height: 34, borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--surface-hover)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px', gap: '0.5rem' }} className="custom-scrollbar">
                                <div style={sectionStyle}>
                                    <label style={labelStyle}>Project Name</label>
                                    <div style={{ position: 'relative' }}>
                                        <Briefcase size={16} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            placeholder="e.g. AI-Powered Medical Diagnosis"
                                            value={createForm.projectName}
                                            onChange={e => setCreateForm(p => ({ ...p, projectName: e.target.value }))}
                                            required
                                            style={{ ...inputStyle, paddingLeft: '36px' }}
                                        />
                                    </div>
                                </div>

                                <div style={sectionStyle}>
                                    <label style={labelStyle}>Description</label>
                                    <div style={{ position: 'relative' }}>
                                        <FileText size={16} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--text-muted)' }} />
                                        <textarea
                                            placeholder="Briefly describe the goals and scope..."
                                            value={createForm.projectDescription}
                                            onChange={e => setCreateForm(p => ({ ...p, projectDescription: e.target.value }))}
                                            required
                                            style={{ ...inputStyle, paddingLeft: '36px', minHeight: 72, resize: 'vertical' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div style={sectionStyle}>
                                        <label style={labelStyle}>Start Date</label>
                                        <div style={{ position: 'relative' }}>
                                            <Calendar size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input
                                                type="date"
                                                min={todayVn}
                                                value={createForm.startDate}
                                                onChange={e => setCreateForm(p => ({
                                                    ...p,
                                                    startDate: e.target.value,
                                                    endDate: p.endDate && p.endDate < e.target.value ? e.target.value : p.endDate
                                                }))}
                                                style={{ ...inputStyle, paddingLeft: '34px' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={sectionStyle}>
                                        <label style={labelStyle}>End Date</label>
                                        <div style={{ position: 'relative' }}>
                                            <Calendar size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input
                                                type="date"
                                                min={createForm.startDate || todayVn}
                                                value={createForm.endDate}
                                                onChange={e => setCreateForm(p => ({
                                                    ...p,
                                                    endDate: e.target.value && p.startDate && e.target.value < p.startDate ? p.startDate : e.target.value
                                                }))}
                                                style={{ ...inputStyle, paddingLeft: '34px' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div style={sectionStyle}>
                                    <label style={labelStyle}>Research Fields</label>
                                    <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                                        <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            placeholder="Search fields..."
                                            value={fieldSearch}
                                            onChange={e => setFieldSearch(e.target.value)}
                                            style={{ ...inputStyle, paddingLeft: '32px', height: '38px', fontSize: '0.875rem' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0.85rem', background: '#fff', borderRadius: '12px', border: '1px solid var(--border-light)', maxHeight: 120, overflowY: 'auto' }} className="custom-scrollbar">
                                        {availableFields
                                            .filter(f => f.name.toLowerCase().includes(fieldSearch.toLowerCase()))
                                            .map(field => (
                                                <button
                                                    key={field.researchFieldId}
                                                    type="button"
                                                    onClick={() => setSelectedFieldIds(prev =>
                                                        prev.includes(field.researchFieldId)
                                                            ? prev.filter(id => id !== field.researchFieldId)
                                                            : [...prev, field.researchFieldId]
                                                    )}
                                                    className={`filter-chip ${selectedFieldIds.includes(field.researchFieldId) ? 'active' : ''}`}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                                                >
                                                    {selectedFieldIds.includes(field.researchFieldId) ? <Check size={12} /> : <Plus size={12} />}
                                                    {field.name}
                                                </button>
                                            ))}
                                        {availableFields.length === 0 && (
                                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading fields...</span>
                                        )}
                                    </div>
                                </div>

                                {createError && (
                                    <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 500, border: '1px solid rgba(239,68,68,0.2)', marginBottom: '16px' }}>
                                        {createError}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
                                    <button type="button" onClick={() => setShowPanel(false)} className="btn btn-secondary" style={{ flex: 1 }} disabled={submitting}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={submitting}>
                                        {submitting ? 'Creating...' : <><Save size={16} /> Create Project</>}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                {isLabDirector && (
                    <ResearchFieldManager open={showResearchPanel} onClose={() => setShowResearchPanel(false)} />
                )}
            </div>
        </MainLayout>
    );
};

export default Projects;
