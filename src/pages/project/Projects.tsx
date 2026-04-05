import React, { useState, useEffect } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { projectService, researchFieldService } from '@/services';
import { Project, ProjectStatus, ResearchField } from '@/types';
import { getProjectStatusStyle, getVietnamDateInputValue, toApiDate } from '@/utils/projectUtils';
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
    ShieldAlert
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const Projects: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
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

            setSubmitting(true);

            await projectService.create({
                projectName: createForm.projectName,
                projectDescription: createForm.projectDescription,
                startDate: toApiDate(startDate),
                endDate: toApiDate(createForm.endDate),
                researchFieldIds: selectedFieldIds
            });
            setShowPanel(false);
            await fetchProjects();
        } catch (err: any) {
            setCreateError(err.response?.data?.message || err.message || 'Failed to create project.');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredProjects = projects.filter(p => {
        const name = (p.projectName || '').toLowerCase();
        const matchesSearch = name.includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">
                {/* Header */}
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>My Projects</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Management hub for your research initiatives and active workflows.</p>
                    </div>
                    {isLabDirector && (
                        <button
                            onClick={openPanel}
                            className="btn btn-primary"
                            style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 700 }}
                        >
                            <Plus size={18} /> New Project
                        </button>
                    )}
                </div>

                {/* Focus Toolbar */}
                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    marginBottom: '2rem',
                    alignItems: 'center',
                    background: 'var(--surface-color)',
                    padding: '1rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Quick find project..."
                            className="form-input"
                            style={{
                                paddingLeft: '44px',
                                height: '44px',
                                border: 'none',
                                background: 'var(--surface-hover)',
                                borderRadius: '10px',
                                fontSize: '0.95rem'
                            }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {(['All', ProjectStatus.Active, ProjectStatus.Completed] as const).map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status as any)}
                                className={`filter-chip ${statusFilter === status ? 'active' : ''}`}
                                style={{ height: '44px', padding: '0 1.25rem', borderRadius: '10px' }}
                            >
                                {status === 'All' ? 'All' : status === ProjectStatus.Active ? 'Active' : 'Completed'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Project Grid + Create Project Panel */}
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch', minHeight: showPanel ? 680 : 'auto' }}>
                    <div style={{ flex: showPanel ? 3 : 10, minWidth: 0, transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                            </div>
                        ) : filteredProjects.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
                                {filteredProjects.map((project) => {
                                    const statusStyle = getProjectStatusStyle(project.status);
                                    const totalTasks = project.totalTasks || 0;
                                    const completedTasks = project.completedTasks || 0;
                                    const progress = project.progress !== undefined ? project.progress : (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);

                                    const formatDate = (dateString?: string | null) => {
                                        if (!dateString) return 'TBD';
                                        const d = new Date(dateString);
                                        if (isNaN(d.getTime()) || d.getFullYear() < 1970) return 'TBD';
                                        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                                    };

                                    const projectName = project.projectName || (project as any).name || 'Untitled Project';
                                    const projectDescription = project.projectDescription || (project as any).description;
                                    const creatorName = project.nameProjectCreator || project.NameProjectCreator || 'Lab Manager';

                                    return (
                                        <div
                                            key={project.projectId}
                                            className="card card-interactive"
                                            onClick={() => navigate(`/projects/${project.projectId}`)}
                                            style={{
                                                padding: '1.25rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '1rem',
                                                border: '1px solid var(--border-color)',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                                <h3 title={projectName} style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
                                                    {projectName}
                                                </h3>
                                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                                    <span className="badge" style={{ background: statusStyle.bg, color: statusStyle.color, border: 'none', padding: '2px 8px', fontSize: '0.65rem', fontWeight: 600 }}>
                                                        {statusStyle.label}
                                                    </span>
                                                    {project.roleName && (
                                                        <span className="badge badge-accent" style={{ background: 'var(--accent-bg)', color: 'var(--accent-color)', padding: '2px 8px', fontSize: '0.65rem', fontWeight: 600 }}>
                                                            {project.roleName}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background-color)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div className="avatar avatar-sm avatar-accent" style={{ width: '28px', height: '28px', fontSize: '0.7rem' }}>
                                                        {creatorName[0]}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Created by</span>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{creatorName}</span>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', fontSize: '0.65rem', color: 'var(--accent-color)', fontWeight: 700, marginBottom: '2px' }}>
                                                        <Calendar size={12} /> TIMELINE
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                        {formatDate(project.startDate)} - {formatDate(project.endDate)}
                                                    </div>
                                                </div>
                                            </div>

                                            <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '3.8rem', fontWeight: 500 }}>
                                                {projectDescription || 'No detailed research protocol or description provided for this work stream.'}
                                            </p>

                                            <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                        <ClipboardList size={14} style={{ color: 'var(--primary-color)' }} /> Milestones
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-color)' }}>({progress}%)</span>
                                                </div>
                                                <div className="progress-bar-track" style={{ height: '6px', borderRadius: '3px', background: 'var(--border-light)', overflow: 'hidden' }}>
                                                    <div className="progress-bar-fill" style={{ width: `${progress}%`, height: '100%', borderRadius: '3px' }} />
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                                    <Users size={14} />
                                                    <span style={{ fontWeight: 700 }}>{project.membersCount || 0} Team Members</span>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'flex-end', maxWidth: '160px' }}>
                                                    {project.researchFields?.slice(0, 2).map((f, idx) => (
                                                        <span key={f.researchFieldId || `rf-${idx}`} className="tag" style={{ margin: 0, fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{f.name}</span>
                                                    ))}
                                                    {project.researchFields && project.researchFields.length > 2 && (
                                                        <span className="tag" style={{ margin: 0, fontSize: '0.65rem', padding: '2px 8px', background: 'var(--surface-hover)', borderRadius: '4px', fontWeight: 600 }}>
                                                            +{project.researchFields.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
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
                        <div style={{ flex: 4, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
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

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '2px' }} className="custom-scrollbar">
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
                                            style={{ ...inputStyle, paddingLeft: '36px', minHeight: 100, resize: 'vertical' }}
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
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0.85rem', background: '#fff', borderRadius: '12px', border: '1px solid var(--border-light)', maxHeight: 180, overflowY: 'auto' }} className="custom-scrollbar">
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

                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '0.85rem', borderRadius: '12px', background: 'var(--background-color)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)', fontSize: '0.82rem', marginBottom: '16px' }}>
                                    <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent-color)' }} />
                                    <span>Project will be <strong>Active</strong> until approved by an administrator.</span>
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
            </div>
        </MainLayout>
    );
};

export default Projects;
