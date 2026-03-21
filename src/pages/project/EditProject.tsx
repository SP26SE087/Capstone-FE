import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '@/layout/MainLayout';
import { projectService, researchFieldService } from '@/services';
import { ResearchField, ProjectStatus, Project, ProjectRoleEnum } from '@/types';
import { getProjectStatusStyle, isDefaultDate, toApiDate, formatProjectDate } from '@/utils/projectUtils';

import Modal from '@/components/common/Modal';
import Toast, { ToastType } from '@/components/common/Toast';
import ProjectSidebar from '@/components/navigation/ProjectSidebar';
import {
    Save,
    Calendar,
    FileText,
    Briefcase,
    AlertCircle,
    Plus,
    Check,
    Trash2,
    Clock,
    User,
    ShieldAlert,
    ChevronDown,
    Activity,
    Search
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';

const EditProject: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation() as { state: { projectName?: string } };
    const { user: currentUser } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [currentMember, setCurrentMember] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // RBAC: Check project role
    const isAdmin = currentUser.role === 'Admin';
    const projectRoleValue = currentMember?.projectRole || project?.projectRole;

    const isProjectLeader = isAdmin ||
        (Number(projectRoleValue) === ProjectRoleEnum.Leader) ||
        (Number(projectRoleValue) === ProjectRoleEnum.LabDirector);

    // ONLY Project LabDirector (1) or Global Admin can delete
    const canDeleteProject = isAdmin || (Number(projectRoleValue) === ProjectRoleEnum.LabDirector);

    const isArchived = project?.status === ProjectStatus.Archived;
    const isReadOnly = (isArchived && !isAdmin) || !isProjectLeader;

    const [submitting, setSubmitting] = useState(false);
    const [availableFields, setAvailableFields] = useState<ResearchField[]>([]);
    const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
    const [fieldSearchTerm, setFieldSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        projectName: '',
        projectDescription: '',
        startDate: '',
        endDate: '',
        status: ProjectStatus.Active
    });

    // Modal & Notification States
    const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<ProjectStatus | null>(null);

    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const showToast = (message: string, type: ToastType = 'info') => {
        setToast({ message, type });
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const memberInfo = await projectService.getCurrentMember(id);

                if ((!memberInfo || !memberInfo.projectRole) && !isAdmin) {
                    navigate(`/explore/projects/${id}`, { replace: true });
                    return;
                }

                setCurrentMember(memberInfo);

                const projectData = await projectService.getById(id);

                if (projectData) {
                    setProject(projectData);
                    setFormData({
                        projectName: projectData.projectName || (projectData as any).name || '',
                        projectDescription: projectData.projectDescription || (projectData as any).description || '',
                        startDate: !isDefaultDate(projectData.startDate) ? new Date(projectData.startDate!).toISOString().split('T')[0] : '',
                        endDate: !isDefaultDate(projectData.endDate) ? new Date(projectData.endDate!).toISOString().split('T')[0] : '',
                        status: projectData.status
                    });
                    setSelectedFieldIds(projectData.researchFields?.map(f => f.id) || []);

                    const fields = await researchFieldService.getAll();
                    setAvailableFields(fields);
                }
            } catch (error) {
                console.error('Failed to fetch project for editing:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, isAdmin, navigate]);

    const handleTabChange = (tabId: string) => {
        if (tabId === 'settings') return;
        navigate(`/projects/${id}`, { state: { activeTab: tabId } });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const isValidTransition = (currentStatus: ProjectStatus, newStatus: ProjectStatus): boolean => {
        switch (currentStatus) {
            case ProjectStatus.Active:
                return [ProjectStatus.Inactive, ProjectStatus.Completed, ProjectStatus.Archived].includes(newStatus);
            case ProjectStatus.Inactive:
                return [ProjectStatus.Active, ProjectStatus.Archived].includes(newStatus);
            case ProjectStatus.Completed:
                return newStatus === ProjectStatus.Archived;
            case ProjectStatus.Archived:
                return newStatus === ProjectStatus.Active;
            default:
                return false;
        }
    };

    const handleStatusChange = (newStatus: number) => {
        if (!project) return;
        const nextStatus = newStatus as ProjectStatus;

        if (isReadOnly && !isAdmin) {
            showToast('You do not have permission to change the status of an archived project.', 'error');
            return;
        }

        if (!isValidTransition(project.status, nextStatus)) {
            showToast(`Cannot transition from ${ProjectStatus[project.status]} to ${ProjectStatus[nextStatus]}.`, 'error');
            return;
        }
        setPendingStatus(nextStatus);
        setIsStatusConfirmOpen(true);
    };

    const confirmStatusChange = async () => {
        if (pendingStatus !== null && id) {
            try {
                await projectService.updateStatus(id, pendingStatus);
                setFormData(prev => ({ ...prev, status: pendingStatus }));
                if (project) {
                    setProject({ ...project, status: pendingStatus });
                }
                setIsStatusConfirmOpen(false);
                showToast(`Project status updated to ${ProjectStatus[pendingStatus]}`, 'success');
            } catch (error) {
                console.error('Failed to update project status:', error);
                showToast('An error occurred while updating the status.', 'error');
            }
        }
    };

    const toggleField = (fieldId: string) => {
        setSelectedFieldIds(prev =>
            prev.includes(fieldId)
                ? prev.filter(id => id !== fieldId)
                : [...prev, fieldId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        if (isReadOnly) {
            showToast(`This project is archived and cannot be modified.`, 'warning');
            return;
        }
        setSubmitting(true);
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const updateData = {
                projectId: id,
                projectName: formData.projectName,
                projectDescription: formData.projectDescription,
                startDate: toApiDate(formData.startDate || todayStr),
                endDate: toApiDate(formData.endDate),
                researchFieldIds: selectedFieldIds
            };

            await projectService.update(updateData);
            showToast('Project details updated successfully!', 'success');
            setTimeout(() => navigate(`/projects/${id}`), 1500);
        } catch (error: any) {
            console.error('Failed to update project:', error);
            showToast('Failed to update project details.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        try {
            await projectService.delete(id);
            showToast('Project deleted successfully.', 'info');
            navigate('/projects');
        } catch (error) {
            console.error('Failed to delete project:', error);
            showToast('Failed to delete project.', 'error');
        } finally {
            setIsDeleteConfirmOpen(false);
        }
    };

    if (loading) {
        return (
            <MainLayout
                role={currentUser.role}
                userName={currentUser.name}
                customSidebar={
                    <ProjectSidebar
                        projectId={id || ''}
                        projectName={location.state?.projectName || ''}
                        activeTab="settings"
                        onTabChange={() => { }}
                        roleName={currentMember?.roleName || currentMember?.projectRoleName || project?.roleName}
                    />
                }
            >
                <div className="page-container">
                    <div className="page-header">
                        <div>
                            <h1>Configuration</h1>
                            <p>Loading project settings...</p>
                        </div>
                    </div>
                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                        <div className="loader" style={{ margin: '0 auto 1.5rem' }}></div>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const getStatusStyle = (status: ProjectStatus) => {
        const style = getProjectStatusStyle(status);
        return { color: style.color, label: style.label };
    };

    return (
        <MainLayout
            role={currentUser.role}
            userName={currentUser.name}
            customSidebar={
                <ProjectSidebar
                    projectId={id || ''}
                    projectName={formData.projectName}
                    activeTab="settings"
                    onTabChange={handleTabChange}
                    roleName={currentMember?.roleName || currentMember?.projectRoleName || project?.roleName}
                />
            }
        >
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <div className="page-container">
                {/* Page Header */}
                <div className="page-header">
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <button
                                onClick={() => navigate(`/projects/${id}`)}
                                className="btn-ghost"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--accent-color)',
                                    padding: 0,
                                    font: 'inherit',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 600
                                }}
                            >
                                Project Space
                            </button>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Configuration</span>
                        </div>
                        <h1>Project Configuration</h1>
                        <p>Manage project identity, timeline, research fields, and status.</p>
                    </div>
                </div>

                {/* Archive Warning Banner */}
                {isArchived && (
                    <div className="card" style={{
                        marginBottom: '1.5rem',
                        padding: '1rem 1.25rem',
                        background: 'var(--warning-bg)',
                        border: '1px solid #FDE68A',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        color: '#92400E'
                    }}>
                        <ShieldAlert size={24} />
                        <div>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#92400E' }}>Project Archived</h4>
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', opacity: 0.9 }}>
                                {isAdmin
                                    ? 'You have Administrative override to modify this project.'
                                    : 'To make changes, transition the status back to Active first.'}
                            </p>
                        </div>
                    </div>
                )}

                {!isArchived && isReadOnly && (
                    <div className="card" style={{
                        marginBottom: '1.5rem',
                        padding: '1rem 1.25rem',
                        background: 'var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        color: 'var(--text-secondary)'
                    }}>
                        <AlertCircle size={20} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            Read-only: You don't have permission to modify this project's settings.
                        </span>
                    </div>
                )}

                {/* Main Content */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem' }}>
                    {/* Left Column — Form */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Project Identity Section */}
                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <div>
                                    <h3 style={{ margin: 0 }}>Project Identity</h3>
                                    <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Define the core vision and scope.</p>
                                </div>
                                <div style={{
                                    padding: '6px 14px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'var(--surface-hover)',
                                    border: '1px solid var(--border-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>STATUS:</span>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => handleStatusChange(parseInt(e.target.value))}
                                            className="form-input"
                                            style={{
                                                padding: '4px 28px 4px 10px',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                color: getStatusStyle(formData.status).color,
                                                minWidth: '100px',
                                                appearance: 'none'
                                            }}
                                            disabled={isReadOnly && !isAdmin}
                                        >
                                            <option value={ProjectStatus.Active}>Active</option>
                                            <option value={ProjectStatus.Inactive}>Inactive</option>
                                            {(project?.status !== ProjectStatus.Archived || isAdmin) && (
                                                <option value={ProjectStatus.Completed}>Completed</option>
                                            )}
                                            <option value={ProjectStatus.Archived}>Archived</option>
                                        </select>
                                        <ChevronDown size={14} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" htmlFor="projectName">Project Name</label>
                                    <div style={{ position: 'relative' }}>
                                        <Briefcase size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            className="form-input"
                                            style={{ paddingLeft: '40px' }}
                                            type="text"
                                            id="projectName"
                                            name="projectName"
                                            value={formData.projectName}
                                            onChange={handleInputChange}
                                            required
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" htmlFor="projectDescription">Description</label>
                                    <div style={{ position: 'relative' }}>
                                        <FileText size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                        <textarea
                                            className="form-input"
                                            style={{ paddingLeft: '40px', minHeight: '120px', resize: 'vertical' }}
                                            id="projectDescription"
                                            name="projectDescription"
                                            value={formData.projectDescription}
                                            onChange={handleInputChange}
                                            required
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Timeline & Fields Section */}
                        <section className="card" style={{ opacity: isArchived ? 0.7 : 1 }}>
                            <h3 style={{ margin: '0 0 1.25rem' }}>Operation Timeline</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Ngày bắt đầu dự kiến</label>
                                    <div style={{ position: 'relative' }}>
                                        <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            className="form-input"
                                            style={{ paddingLeft: '40px' }}
                                            type="date"
                                            name="startDate"
                                            value={formData.startDate}
                                            onChange={handleInputChange}
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Ngày kết thúc dự kiến</label>
                                    <div style={{ position: 'relative' }}>
                                        <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            className="form-input"
                                            style={{ paddingLeft: '40px' }}
                                            type="date"
                                            name="endDate"
                                            value={formData.endDate}
                                            onChange={handleInputChange}
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                            </div>

                            <h3 style={{ margin: '0 0 1rem' }}>Research Fields</h3>
                            
                            <div style={{ position: 'relative', marginBottom: '10px' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search research fields..."
                                    className="form-input"
                                    style={{ paddingLeft: '36px', height: '36px', fontSize: '0.85rem' }}
                                    value={fieldSearchTerm}
                                    onChange={(e) => setFieldSearchTerm(e.target.value)}
                                    disabled={isArchived}
                                />
                            </div>

                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px',
                                padding: '1rem',
                                background: 'var(--surface-hover)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-color)',
                                maxHeight: '200px',
                                overflowY: 'auto'
                            }}>
                                {availableFields
                                    .filter(f => f.name.toLowerCase().includes(fieldSearchTerm.toLowerCase()))
                                    .length > 0 ? (
                                        availableFields
                                            .filter(f => f.name.toLowerCase().includes(fieldSearchTerm.toLowerCase()))
                                            .map((field) => (
                                                <button
                                                    key={field.id}
                                                    type="button"
                                                    onClick={() => !isArchived && toggleField(field.id)}
                                                    className={`filter-chip ${selectedFieldIds.includes(field.id) ? 'active' : ''}`}
                                                    style={{
                                                        cursor: isArchived ? 'not-allowed' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        opacity: isArchived && !selectedFieldIds.includes(field.id) ? 0.5 : 1
                                                    }}
                                                    disabled={isArchived}
                                                >
                                                    {selectedFieldIds.includes(field.id) ? <Check size={14} /> : <Plus size={14} />}
                                                    {field.name}
                                                </button>
                                            ))
                                    ) : (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 auto', padding: '10px' }}>
                                            {availableFields.length > 0 ? "No fields match your search." : "Loading research fields..."}
                                        </p>
                                    )}
                            </div>
                        </section>

                        {/* Action Bar */}
                        <div className="card" style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px'
                        }}>
                            <button
                                type="button"
                                onClick={() => navigate(`/projects/${id}`)}
                                className="btn btn-secondary"
                                style={{ minWidth: '120px' }}
                            >Cancel</button>
                            <button
                                onClick={handleSubmit}
                                className="btn btn-primary"
                                style={{
                                    minWidth: '170px',
                                    opacity: isArchived ? 0.5 : 1,
                                    cursor: isArchived ? 'not-allowed' : 'pointer'
                                }}
                                disabled={submitting || isArchived}
                            >
                                {submitting ? 'Saving...' : <><Save size={18} /> Update Project</>}
                            </button>
                        </div>
                    </div>

                    {/* Right Column — Sidebar Info */}
                    <aside>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: 'calc(var(--header-height) + 2rem)' }}>
                            {/* Project Timeline & Origin */}
                            <div className="card" style={{ opacity: isArchived ? 0.8 : 1 }}>
                                <h4 style={{ margin: '0 0 1.25rem', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Activity size={18} color="var(--accent-color)" /> Project Timeline
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <div className="avatar avatar-md" style={{ background: 'var(--border-light)', color: 'var(--text-secondary)' }}>
                                            <User size={16} />
                                        </div>
                                        <div>
                                            <p className="section-title" style={{ marginBottom: '2px' }}>Principal/Creator</p>
                                            <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>
                                                {project?.NameProjectCreator || project?.nameProjectCreator || project?.createdBy || 'System Admin'}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <div className="avatar avatar-md" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                                            <Calendar size={16} />
                                        </div>
                                        <div>
                                            <p className="section-title" style={{ marginBottom: '2px' }}>Duration</p>
                                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>
                                                {formatProjectDate(project?.startDate)} — {formatProjectDate(project?.endDate, 'Ongoing')}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
                                        <div className="avatar avatar-md" style={{ background: 'var(--border-light)', color: 'var(--text-secondary)' }}>
                                            <Clock size={16} />
                                        </div>
                                        <div>
                                            <p className="section-title" style={{ marginBottom: '2px' }}>System Log</p>
                                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                Created: {project?.createdAt ? new Date(project.createdAt).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                {project?.NameProjectCreator && ` by ${project.NameProjectCreator}`}
                                            </p>
                                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                Modified: {project?.updatedAt ? new Date(project.updatedAt).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Danger Zone */}
                            <div className="card" style={{
                                background: canDeleteProject && !isArchived ? 'var(--danger-bg)' : 'var(--surface-hover)',
                                border: '1px solid',
                                borderColor: canDeleteProject && !isArchived ? '#FECACA' : 'var(--border-color)',
                                opacity: !canDeleteProject || isArchived ? 0.8 : 1
                            }}>
                                <h4 style={{
                                    margin: '0 0 0.75rem',
                                    fontSize: '0.95rem',
                                    color: canDeleteProject && !isArchived ? 'var(--danger)' : 'var(--text-secondary)',
                                    fontWeight: 700
                                }}>Delete Project</h4>

                                {!canDeleteProject ? (
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 0 }}>
                                        Only the project's Principal/Lab Director or system administrators can permanently delete projects.
                                    </p>
                                ) : isArchived ? (
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 0 }}>
                                        Archived projects are preserved for historical audit and cannot be deleted.
                                    </p>
                                ) : (
                                    <>
                                        <p style={{ fontSize: '0.82rem', color: '#991B1B', lineHeight: 1.5, marginBottom: '1rem' }}>
                                            Once deleted, all tasks, files and data will be gone forever. This action is irreversible.
                                        </p>
                                        <button
                                            onClick={() => setIsDeleteConfirmOpen(true)}
                                            className="btn"
                                            style={{
                                                width: '100%',
                                                background: 'var(--danger)',
                                                color: 'white',
                                                border: 'none'
                                            }}
                                        >
                                            <Trash2 size={18} /> Delete Project
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            {/* Status Confirmation Modal */}
            <Modal
                isOpen={isStatusConfirmOpen}
                onClose={() => setIsStatusConfirmOpen(false)}
                title="Status Transition"
                variant="info"
                footer={(
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsStatusConfirmOpen(false)}>Revert</button>
                        <button className="btn btn-primary" onClick={confirmStatusChange}>Confirm Transition</button>
                    </>
                )}
            >
                <div style={{ display: 'flex', gap: '16px' }}>
                    <AlertCircle size={32} color="var(--accent-color)" style={{ flexShrink: 0 }} />
                    <p style={{ margin: 0 }}>Transitioning to <strong>{ProjectStatus[pendingStatus || 0]}</strong>. This update will be propagated to all researchers.</p>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                title="Delete Project"
                variant="danger"
                footer={(
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</button>
                        <button className="btn" style={{ background: 'var(--danger)', color: 'white' }} onClick={handleDelete}>Delete Project</button>
                    </>
                )}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--danger)' }}>
                        <ShieldAlert size={28} />
                        <strong style={{ fontSize: '1rem' }}>Confirm Deletion</strong>
                    </div>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>
                        You are about to permanently delete <strong>"{formData.projectName}"</strong>.
                        All research data, tasks, and audit trails will be irreversibly lost.
                    </p>
                </div>
            </Modal>
        </MainLayout>
    );
};

export default EditProject;
