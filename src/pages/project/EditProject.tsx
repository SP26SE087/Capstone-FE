import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '@/layout/MainLayout';
import { projectService, researchFieldService } from '@/services';
import { ResearchField, ProjectStatus, Project, ProjectRoleEnum } from '@/types';
import { getProjectStatusStyle } from '@/utils/projectUtils';

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
    Settings
} from 'lucide-react';

const EditProject: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation() as { state: { projectName?: string } };
    const currentUser = { name: "Current User", role: "Researcher" };
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
    // Read-only if:
    // 1. Project is archived and user is not global Admin
    // 2. User is not project leader/director and not global Admin
    const isReadOnly = (isArchived && !isAdmin) || !isProjectLeader;

    const [submitting, setSubmitting] = useState(false);
    const [availableFields, setAvailableFields] = useState<ResearchField[]>([]);
    const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);

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
                // 1. Get detailed member info first to check if user has access
                const memberInfo = await projectService.getCurrentMember(id);

                // 2. Security Check: If not member and not admin, redirect
                if ((!memberInfo || !memberInfo.projectRole) && !isAdmin) {
                    console.log("No project role found for editing, redirecting");
                    navigate(`/explore/projects/${id}`, { replace: true });
                    return;
                }

                setCurrentMember(memberInfo);

                // 3. Get Project Detail
                const projectData = await projectService.getById(id);

                if (projectData) {
                    setProject(projectData);
                    setFormData({
                        projectName: projectData.projectName || (projectData as any).name || '',
                        projectDescription: projectData.projectDescription || (projectData as any).description || '',
                        startDate: projectData.startDate ? new Date(projectData.startDate).toISOString().split('T')[0] : '',
                        endDate: projectData.endDate ? new Date(projectData.endDate).toISOString().split('T')[0] : '',
                        status: projectData.status
                    });
                    setSelectedFieldIds(projectData.researchFields?.map(f => f.id) || []);

                    // 4. Get available fields
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
        // In EditProject, clicking other tabs should return to ProjectDetails
        navigate(`/projects/${id}`, { state: { activeTab: tabId } });
    };

    // We no longer block access completely, isReadOnly will handle the view

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
                return newStatus === ProjectStatus.Active; // Only allow unarchiving to Active
            default:
                return false;
        }
    };

    const handleStatusChange = (newStatus: number) => {
        if (!project) return;
        const nextStatus = newStatus as ProjectStatus;

        // Admins can always change status, but non-admins are restricted by isReadOnly
        if (isReadOnly && !isAdmin) {
            showToast('You do not have permission to change the status of an archived project.', 'error');
            return;
        }

        if (!isValidTransition(project.status, nextStatus)) {
            showToast(`Cannot transition from ${ProjectStatus[project.status]} to ${ProjectStatus[nextStatus]}. Transition is invalid.`, 'error');
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
                showToast(`Project status successfully updated to ${ProjectStatus[pendingStatus]}`, 'success');
            } catch (error) {
                console.error('Failed to update project status:', error);
                showToast('An error occurred while updating the status. Please try again.', 'error');
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
            showToast(`This project is archived and cannot be modified by non-admins.`, 'warning');
            return;
        }
        setSubmitting(true);
        try {
            const toIsoDate = (dateStr: string) => dateStr ? new Date(dateStr).toISOString() : null;

            const updateData = {
                projectId: id,
                projectName: formData.projectName,
                projectDescription: formData.projectDescription,
                startDate: toIsoDate(formData.startDate),
                endDate: toIsoDate(formData.endDate),
                researchFieldIds: selectedFieldIds
            };

            await projectService.update(updateData);
            showToast('Project details updated successfully!', 'success');
            setTimeout(() => navigate(`/projects/${id}`), 1500);
        } catch (error: any) {
            console.error('Failed to update project:', error);
            showToast('Failed to update project details. Please try again.', 'error');
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
                <div>
                    <header style={{ marginBottom: '2.5rem', opacity: 0.6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', background: '#f8fafc', width: '200px', height: '16px' }}></div>
                        <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: 800, background: '#f1f5f9', width: '400px', height: '40px' }}>
                            {location.state?.projectName ? `${location.state.projectName} - Configuration` : 'Loading Configuration...'}
                        </h1>
                    </header>
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

            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 2rem 4rem' }}>
                {isArchived && (
                    <div style={{
                        marginBottom: '2rem',
                        padding: '1.25rem 1.5rem',
                        background: '#fff7ed',
                        border: '1px solid',
                        borderColor: '#ffedd5',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        color: '#9a3412'
                    }}>
                        <ShieldAlert size={28} />
                        <div>
                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Project Archived</h4>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
                                This research initiative has been moved to archives. Configuration is typically locked.
                                {isAdmin ? (
                                    <strong> You have Administrative override permissions to modify this project.</strong>
                                ) : (
                                    <> <br />To make changes, you must first transition the status back to Active.</>
                                )}
                            </p>
                        </div>
                    </div>
                )}
                {!isArchived && isReadOnly && ( // This condition will now only be true if isArchived is false, but isReadOnly is true, which is impossible with the new logic. This block will effectively not render.
                    <div style={{
                        marginBottom: '2rem',
                        padding: '1rem 1.25rem',
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        color: '#475569'
                    }}>
                        <AlertCircle size={20} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            Configuration View: You have read-only access to this project's settings.
                        </span>
                    </div>
                )}

                <header style={{
                    marginBottom: '2rem',
                    padding: '2rem 0',
                    borderBottom: '1px solid #eef2f6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>
                            <Settings size={16} />
                            <button
                                onClick={() => navigate(`/projects/${id}`)}
                                style={{ background: 'none', border: 'none', color: 'inherit', padding: 0, font: 'inherit', cursor: 'pointer', textTransform: 'uppercase' }}
                            >
                                Project Space
                            </button>
                            <span style={{ color: '#cbd5e1' }}>/</span>
                            <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Configuration</span>
                        </div>
                        <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.025em' }}>Configuration Project</h1>
                    </div>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Summary Section */}
                        <div className="card" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Project Identity</h3>
                                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Define the core vision and scope of the research.</p>
                                </div>
                                <div style={{
                                    padding: '8px 16px',
                                    borderRadius: '12px',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>STATUS:</span>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => handleStatusChange(parseInt(e.target.value))}
                                            style={{
                                                appearance: 'none',
                                                padding: '6px 32px 6px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                background: 'white',
                                                fontSize: '0.85rem',
                                                fontWeight: 700,
                                                color: getStatusStyle(formData.status).color,
                                                cursor: 'pointer'
                                            }}
                                            disabled={isReadOnly && !isAdmin} // Disable if archived and not admin
                                        >
                                            <option value={ProjectStatus.Active}>Active</option>
                                            <option value={ProjectStatus.Inactive}>Inactive</option>
                                            {(project?.status !== ProjectStatus.Archived || isAdmin) && (
                                                <option value={ProjectStatus.Completed}>Completed</option>
                                            )}
                                            <option value={ProjectStatus.Archived}>Archived</option>
                                        </select>
                                        <ChevronDown size={14} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="projectName">Project Name</label>
                                    <div style={{ position: 'relative' }}>
                                        <Briefcase size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
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

                                <div className="form-group">
                                    <label className="form-label" htmlFor="projectDescription">Description</label>
                                    <div style={{ position: 'relative' }}>
                                        <FileText size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                                        <textarea
                                            className="form-input"
                                            style={{ paddingLeft: '40px', minHeight: '140px', resize: 'vertical' }}
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
                        </div>

                        {/* Disciplines & Timeline */}
                        <div className="card" style={{ padding: '2rem', opacity: isArchived ? 0.7 : 1 }}>
                            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 700 }}>Operation Timeline</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Start Date</label>
                                    <div style={{ position: 'relative' }}>
                                        <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            className="form-input"
                                            style={{ paddingLeft: '40px' }}
                                            type="date"
                                            name="startDate"
                                            value={formData.startDate}
                                            onChange={handleInputChange}
                                            required
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">End Date</label>
                                    <div style={{ position: 'relative' }}>
                                        <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
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

                            <h3 style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 700 }}>Research Fields</h3>
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '10px',
                                padding: '1.25rem',
                                background: '#f8fafc',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0'
                            }}>
                                {availableFields.map((field) => (
                                    <button
                                        key={field.id}
                                        type="button"
                                        onClick={() => !isArchived && toggleField(field.id)}
                                        style={{
                                            padding: '6px 16px',
                                            borderRadius: '20px',
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            cursor: isArchived ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s',
                                            background: selectedFieldIds.includes(field.id) ? 'var(--accent-color)' : 'white',
                                            color: selectedFieldIds.includes(field.id) ? 'white' : 'var(--text-secondary)',
                                            border: '1px solid',
                                            borderColor: selectedFieldIds.includes(field.id) ? 'var(--accent-color)' : '#cbd5e1',
                                            opacity: isArchived && !selectedFieldIds.includes(field.id) ? 0.5 : 1
                                        }}
                                        disabled={isArchived}
                                    >
                                        {selectedFieldIds.includes(field.id) ? <Check size={14} /> : <Plus size={14} />}
                                        {field.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Action Bar */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px',
                            background: 'white',
                            padding: '1.5rem 2rem',
                            borderRadius: '16px',
                            border: '1px solid var(--border-color)',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
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
                                    minWidth: '180px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    opacity: isArchived ? 0.5 : 1,
                                    cursor: isArchived ? 'not-allowed' : 'pointer'
                                }}
                                disabled={submitting || isArchived}
                            >
                                {submitting ? 'Saving...' : <><Save size={18} /> Update Project</>}
                            </button>
                        </div>
                    </div>

                    <aside>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'sticky', top: 'calc(var(--header-height) + 2rem)' }}>
                            {/* History & Meta Detail */}
                            <div className="card" style={{ padding: '1.5rem', opacity: isArchived ? 0.8 : 1 }}>
                                <h4 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Activity size={18} color="var(--accent-color)" /> Project Timeline & Origin
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <User size={16} color="#64748b" />
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Principal/Creator</p>
                                            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{project?.NameProjectCreator || project?.createdBy || 'System Admin'}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Calendar size={16} color="#0ea5e9" />
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Duration</p>
                                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>
                                                {project?.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'} - {project?.endDate ? new Date(project.endDate).toLocaleDateString() : 'Ongoing'}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Clock size={16} color="#64748b" />
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>System Log</p>
                                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                                                Created: {project?.createdAt ? new Date(project.createdAt).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}
                                                {project?.NameProjectCreator && ` by ${project.NameProjectCreator}`}
                                            </p>
                                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                                                Modified: {project?.updatedAt ? new Date(project.updatedAt).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Danger Zone */}
                            <div className="card" style={{
                                padding: '1.5rem',
                                background: canDeleteProject && !isArchived ? '#fff1f2' : '#f8fafc',
                                border: '1px solid',
                                borderColor: canDeleteProject && !isArchived ? '#ffe4e6' : '#e2e8f0',
                                opacity: !canDeleteProject || isArchived ? 0.8 : 1
                            }}>
                                <h4 style={{
                                    marginTop: 0,
                                    marginBottom: '0.75rem',
                                    fontSize: '1rem',
                                    color: canDeleteProject && !isArchived ? '#e11d48' : '#64748b',
                                    fontWeight: 700
                                }}>Delete Project</h4>

                                {!canDeleteProject ? (
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, marginBottom: 0 }}>
                                        Only the project's Principal/Lab Director or system administrators have the authorization to permanently delete projects.
                                    </p>
                                ) : isArchived ? (
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, marginBottom: 0 }}>
                                        Archived projects are permanently preserved for historical audit and cannot be deleted. The record is locked.
                                    </p>
                                ) : (
                                    <>
                                        <p style={{ fontSize: '0.85rem', color: '#9f1239', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                                            Once you delete a project, all its tasks, files and data will be gone forever. This action is not reversible.
                                        </p>
                                        <button
                                            onClick={() => setIsDeleteConfirmOpen(true)}
                                            className="btn"
                                            style={{
                                                width: '100%',
                                                background: '#e11d48',
                                                color: 'white',
                                                border: 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                fontWeight: 700,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Trash2 size={18} /> Permanently Delete Project
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
                    <p style={{ margin: 0 }}>Transitioning space to <strong>{ProjectStatus[pendingStatus || 0]}</strong>. This update will be propagated to all researchers in real-time.</p>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                title="Critical Destruction Order"
                variant="danger"
                footer={(
                    <>
                        <button className="btn btn-secondary" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</button>
                        <button className="btn" style={{ background: '#e11d48', color: 'white' }} onClick={handleDelete}>Delete Project</button>
                    </>
                )}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#e11d48' }}>
                        <ShieldAlert size={32} />
                        <strong style={{ fontSize: '1.1rem' }}>CONFIRM DELETE</strong>
                    </div>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>
                        You are initiating a terminal operation to delete <strong>"{formData.projectName}"</strong>.
                        This will result in irrevocable loss of all research data, task chains, and audit trails.
                    </p>
                </div>
            </Modal>
        </MainLayout>
    );
};

export default EditProject;
