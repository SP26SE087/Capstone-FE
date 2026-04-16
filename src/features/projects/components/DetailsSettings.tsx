import React from 'react';
import { validateSpecialChars } from '@/utils/validation';
import { ChevronDown, Briefcase, Save, Search, Calendar, Trash2, Lock } from 'lucide-react';
import { Project, ResearchField, ProjectStatus } from '@/types';

interface DetailsSettingsProps {
    isArchived: boolean;
    isReadOnly: boolean;
    isAdmin: boolean;
    formData: any;
    handleStatusChange: (status: number) => void;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    project: Project | null;
    availableFields: ResearchField[];
    selectedFieldIds: string[];
    toggleField: (fieldId: string) => void;
    handleSubmit: () => void;
    submitting: boolean;
    canDeleteProject: boolean;
    setIsDeleteConfirmOpen: (open: boolean) => void;
    latestMilestoneDueDate?: string;
    earliestMilestoneStartDate?: string;
}

const DetailsSettings: React.FC<DetailsSettingsProps> = ({
    isArchived, isReadOnly: permissionReadOnly, isAdmin, formData, handleStatusChange, handleInputChange,
    project, availableFields, selectedFieldIds, toggleField, handleSubmit, submitting,
    canDeleteProject, setIsDeleteConfirmOpen, latestMilestoneDueDate, earliestMilestoneStartDate
}) => {
    // Local state for field searching and edit mode
    const [fieldSearchTerm, setFieldSearchTerm] = React.useState('');
    const [isEditing, setIsEditing] = React.useState(false);
    const projectNameValue = formData.projectName ?? '';
    const projectDescriptionValue = formData.projectDescription ?? '';

    const isReadOnly = permissionReadOnly || !isEditing;
    const isProjectNameInvalid = isEditing && !projectNameValue.trim();
    const [localFieldErrors, setLocalFieldErrors] = React.useState({ projectName: '', projectDescription: '' });

    const onSave = () => {
        const nameErr = validateSpecialChars(projectNameValue);
        const descErr = validateSpecialChars(projectDescriptionValue);
        if (nameErr || descErr) {
            setLocalFieldErrors({ projectName: nameErr, projectDescription: descErr });
            return;
        }
        setLocalFieldErrors({ projectName: '', projectDescription: '' });
        handleSubmit();
        setIsEditing(false);
    };

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const originalStartDate = project?.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '';
    const originalEndDate = project?.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '';

    // Date validation: End date cannot be before start date
    const isDateInvalid = React.useMemo(() => {
        if (!formData.startDate || !formData.endDate) return false;
        return formData.startDate > formData.endDate;
    }, [formData.startDate, formData.endDate]);

    // Start date cannot be in the past (only if user changed it)
    const isStartDateInPast = React.useMemo(() => {
        if (!formData.startDate) return false;
        if (formData.startDate === originalStartDate) return false;
        return formData.startDate < todayStr;
    }, [formData.startDate, originalStartDate]);

    // End date cannot be in the past (only if user changed it)
    const isEndDateInPast = React.useMemo(() => {
        if (!formData.endDate) return false;
        if (formData.endDate === originalEndDate) return false;
        return formData.endDate < todayStr;
    }, [formData.endDate, originalEndDate]);

    // End date cannot be before the latest milestone due date
    const isEndDateBeforeMilestone = React.useMemo(() => {
        if (!formData.endDate || !latestMilestoneDueDate) return false;
        return formData.endDate < latestMilestoneDueDate.split('T')[0];
    }, [formData.endDate, latestMilestoneDueDate]);

    // Start date cannot be after the earliest milestone start date
    const isStartDateAfterMilestone = React.useMemo(() => {
        if (!formData.startDate || !earliestMilestoneStartDate) return false;
        return formData.startDate > earliestMilestoneStartDate.split('T')[0];
    }, [formData.startDate, earliestMilestoneStartDate]);

    // Can edit when project is Inactive or Active (or Admin)
    const isInactive = project?.status === ProjectStatus.Inactive;
    const isActive = project?.status === ProjectStatus.Active;
    const isEditableStatus = isInactive || isActive;
    const canEdit = !permissionReadOnly && !isArchived && (isAdmin || isEditableStatus);

    // End date required before changing status
    const hasNoEndDate = !formData.endDate;

    // Valid status transitions (per spec):
    //   Inactive  → Active, Cancelled
    //   Active    → Completed, Cancelled
    //   Completed → Archived
    //   Cancelled → Archived
    //   Archived  → (none)
    const getAllowedStatuses = (current: number): number[] => {
        if (isAdmin) return [ProjectStatus.Inactive, ProjectStatus.Active, ProjectStatus.Completed, ProjectStatus.Archived, ProjectStatus.Cancelled];
        switch (current) {
            case ProjectStatus.Inactive:  return [ProjectStatus.Inactive, ProjectStatus.Active, ProjectStatus.Cancelled];
            case ProjectStatus.Active:    return [ProjectStatus.Active, ProjectStatus.Completed, ProjectStatus.Cancelled];
            case ProjectStatus.Completed: return [ProjectStatus.Completed, ProjectStatus.Archived];
            case ProjectStatus.Cancelled: return [ProjectStatus.Cancelled, ProjectStatus.Archived];
            case ProjectStatus.Archived:  return [ProjectStatus.Archived];
            default: return [current];
        }
    };
    const allowedStatuses = getAllowedStatuses(formData.status);

    const getStatusStyle = (status: number) => {
        switch (status) {
            case ProjectStatus.Active:    return { color: '#10b981', label: 'Active',     bg: '#ecfdf5' };
            case ProjectStatus.Inactive:  return { color: '#64748b', label: 'Inactive',   bg: '#f1f5f9' };
            case ProjectStatus.Completed: return { color: '#3b82f6', label: 'Completed',  bg: '#eff6ff' };
            case ProjectStatus.Archived:  return { color: '#6b7280', label: 'Archived',   bg: '#f3f4f6' };
            case ProjectStatus.Cancelled: return { color: '#dc2626', label: 'Cancelled',  bg: '#fef2f2' };
            default:                      return { color: '#64748b', label: 'Unknown',    bg: '#f1f5f9' };
        }
    };

    const statusStyle = getStatusStyle(formData.status);

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Action Bar */}
            {canEdit && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '-0.5rem' }}>
                    {!isEditing ? (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="btn btn-secondary"
                            style={{ height: '32px', fontSize: '0.8rem', padding: '0 16px', background: 'var(--primary-color)', color: 'white', border: 'none' }}
                        >
                            Edit Settings
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsEditing(false)}
                            className="btn btn-secondary"
                            style={{ height: '32px', fontSize: '0.8rem', padding: '0 16px', background: 'transparent', border: '1px solid var(--border-color)' }}
                        >
                            Discard
                        </button>
                    )}
                </div>
            )}
            {!permissionReadOnly && !isArchived && !isEditableStatus && !isAdmin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.65rem 1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '0.8rem', color: '#92400e' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Settings can only be edited while the project is <strong style={{ marginLeft: '4px' }}>Inactive</strong> or <strong style={{ marginLeft: '4px' }}>Active</strong>.
                </div>
            )}
            <div className="card" style={{ padding: '2rem' }}>
                {/* Header Information */}
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2rem' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
                                <label className="form-label" style={{ fontSize: '0.75rem', color: isProjectNameInvalid ? '#dc2626' : 'var(--text-muted)', marginBottom: 0 }}>
                                    Project Name <span style={{ color: '#dc2626' }}>*</span>
                                </label>
                                {isEditing && <span style={{ fontSize: '0.65rem', color: projectNameValue.length >= 200 ? '#dc2626' : 'var(--text-muted)' }}>{projectNameValue.length}/200</span>}
                            </div>
                            {isEditing ? (
                                <input
                                    className="form-input"
                                    style={{ fontSize: '1.5rem', fontWeight: 800, padding: '4px 8px', border: `1px solid ${isProjectNameInvalid ? '#dc2626' : 'var(--border-color)'}`, background: 'white', width: '100%', borderRadius: 'var(--radius-sm)', outline: 'none' }}
                                    type="text"
                                    name="projectName"
                                    value={projectNameValue}
                                    onChange={handleInputChange}
                                    placeholder="Workspace Name"
                                    maxLength={200}
                                />
                            ) : (
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, padding: '0 0 4px 0', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.3 }}>
                                    {projectNameValue || <span style={{ color: 'var(--text-muted)' }}>Workspace Name</span>}
                                </div>
                            )}
                            {isProjectNameInvalid && (
                                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', marginTop: '6px' }}>
                                    Project name is required.
                                </p>
                            )}
                            {!isProjectNameInvalid && localFieldErrors.projectName && (
                                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', marginTop: '6px' }}>
                                    {localFieldErrors.projectName}
                                </p>
                            )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Lab Director / Creator</p>
                            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {project?.nameProjectCreator || project?.NameProjectCreator || 'Lab Director'}
                            </p>
                        </div>
                    </div>
                    <div style={{ marginTop: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 0 }}>Description</label>
                            {isEditing && <span style={{ fontSize: '0.65rem', color: projectDescriptionValue.length >= 2000 ? 'var(--error)' : 'var(--text-muted)' }}>{projectDescriptionValue.length}/2000</span>}
                        </div>
                        <textarea
                            className="form-input"
                            style={{ padding: isEditing ? '8px 12px' : '0', border: isEditing ? '1px solid var(--border-color)' : 'none', background: isEditing ? 'white' : 'transparent', minHeight: '80px', resize: isEditing ? 'vertical' : 'none', borderRadius: isEditing ? 'var(--radius-sm)' : 0, lineHeight: 1.6, width: '100%', outline: 'none' }}
                            name="projectDescription"
                                value={projectDescriptionValue}
                            onChange={handleInputChange}
                            disabled={isReadOnly}
                            placeholder="Describe the research goals..."
                            maxLength={2000}
                        />
                        {localFieldErrors.projectDescription && (
                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', marginTop: '4px' }}>
                                {localFieldErrors.projectDescription}
                            </p>
                        )}
                    </div>
                </div>

                {/* Configuration Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
                    {/* Left: Timeline */}
                    <div>
                        <h4 style={{ margin: '0 0 1rem', fontSize: '0.85rem', fontWeight: 750, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={14} /> Project operating time
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.75rem', color: isStartDateAfterMilestone ? '#dc2626' : 'inherit' }}>Start Date</label>
                                <input className="form-input" type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} disabled={isReadOnly} min={todayStr} style={{ fontSize: '0.9rem', borderColor: isStartDateAfterMilestone ? '#dc2626' : '' }} />
                                {isStartDateAfterMilestone && (
                                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', marginTop: '4px' }}>
                                        Start date cannot be after earliest milestone ({earliestMilestoneStartDate!.split('T')[0]})
                                    </p>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.75rem', color: (isDateInvalid || isEndDateInPast || isEndDateBeforeMilestone) ? '#dc2626' : 'inherit' }}>End Date</label>
                                <input className="form-input" type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} disabled={isReadOnly} min={todayStr} style={{ fontSize: '0.9rem', borderColor: (isDateInvalid || isEndDateInPast || isEndDateBeforeMilestone) ? '#dc2626' : '' }} />
                                {isDateInvalid && <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', marginTop: '4px' }}>Cannot end before start date</p>}
                                {!isDateInvalid && isEndDateInPast && <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', marginTop: '4px' }}>End date cannot be in the past</p>}
                                {!isDateInvalid && !isEndDateInPast && isEndDateBeforeMilestone && (
                                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', marginTop: '4px' }}>
                                        Cannot end before latest milestone ({latestMilestoneDueDate!.split('T')[0]})
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Domains */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 750, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Briefcase size={14} /> Research Fields
                            </h4>
                            {isEditing && (
                                <div style={{ position: 'relative' }}>
                                    <Search size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder="Filter..."
                                        className="form-input"
                                        style={{ padding: '4px 30px 4px 10px', height: '28px', fontSize: '0.75rem', width: '120px' }}
                                        value={fieldSearchTerm}
                                        onChange={(e) => setFieldSearchTerm(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                        {isEditing ? (
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '6px',
                                maxHeight: '120px',
                                overflowY: 'auto',
                                padding: '8px',
                                background: 'var(--background-light)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-color)'
                            }} className="custom-scrollbar">
                                {availableFields
                                    .filter(f => f.name.toLowerCase().includes(fieldSearchTerm.toLowerCase()))
                                    .map((field) => (
                                        <button
                                            key={field.researchFieldId}
                                            type="button"
                                            onClick={() => toggleField(field.researchFieldId)}
                                            className={`filter-chip ${selectedFieldIds.includes(field.researchFieldId) ? 'active' : ''}`}
                                            style={{ padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}
                                        >
                                            {field.name}
                                        </button>
                                    ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {selectedFieldIds.length === 0 ? (
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No fields selected</span>
                                ) : (
                                    availableFields
                                        .filter(f => selectedFieldIds.includes(f.researchFieldId))
                                        .map((field) => (
                                            <span
                                                key={field.researchFieldId}
                                                className="filter-chip active"
                                                style={{ padding: '4px 10px', fontSize: '0.75rem', cursor: 'default' }}
                                            >
                                                {field.name}
                                            </span>
                                        ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Integration Row (Bottom Management) */}
                <div style={{ marginTop: '2.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3rem', flex: 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '36px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: (hasNoEndDate || isEditing) ? '#94a3b8' : statusStyle.color, flexShrink: 0 }} />
                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Project Status</p>
                                {(hasNoEndDate || isEditing) ? (
                                    <div
                                        title={isEditing ? 'Discard or save changes before changing status' : 'Set an end date and save first'}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 10px', height: '36px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0', cursor: 'not-allowed' }}
                                    >
                                        <Lock size={13} style={{ color: '#94a3b8' }} />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8' }}>{getStatusStyle(formData.status).label}</span>
                                    </div>
                                ) : (
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => handleStatusChange(parseInt(e.target.value))}
                                            className="form-input"
                                            style={{
                                                padding: '0 28px 0 10px',
                                                fontSize: '0.9rem',
                                                fontWeight: 700,
                                                color: 'var(--text-primary)',
                                                background: permissionReadOnly ? '#f8fafc' : '#fff',
                                                border: '1.5px solid #e2e8f0',
                                                borderRadius: '8px',
                                                appearance: 'none' as const,
                                                outline: 'none',
                                                cursor: permissionReadOnly ? 'not-allowed' : 'pointer',
                                                width: 'auto',
                                                height: '36px',
                                            }}
                                            disabled={permissionReadOnly}
                                        >
                                            {allowedStatuses.includes(ProjectStatus.Inactive) && <option value={ProjectStatus.Inactive}>Inactive</option>}
                                            {allowedStatuses.includes(ProjectStatus.Active) && <option value={ProjectStatus.Active}>Active</option>}
                                            {allowedStatuses.includes(ProjectStatus.Completed) && <option value={ProjectStatus.Completed}>Completed</option>}
                                            {allowedStatuses.includes(ProjectStatus.Cancelled) && <option value={ProjectStatus.Cancelled}>Cancelled</option>}
                                            {allowedStatuses.includes(ProjectStatus.Archived) && <option value={ProjectStatus.Archived}>Archived</option>}
                                        </select>
                                        <ChevronDown size={14} style={{ position: 'absolute', right: '0', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                                    </div>
                                )}
                            </div>
                            {hasNoEndDate && !isEditing && (
                                <p style={{ margin: 0, fontSize: '0.72rem', color: '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Lock size={11} /> Please set an End Date and save before changing status.
                                </p>
                            )}
                            {isEditing && (
                                <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Lock size={11} /> Discard or save changes to change status.
                                </p>
                            )}
                        </div>

                        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '36px' }}>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Created at</p>
                            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', height: '36px' }}>
                                {project?.createdAt ? new Date(project.createdAt).toLocaleDateString() : '—'}
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', height: '36px' }}>
                        {isEditing && (
                            <button
                            onClick={onSave}
                                className="btn btn-primary"
                                style={{ height: '36px', padding: '0 20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                                disabled={submitting || isDateInvalid || isStartDateInPast || isEndDateInPast || isEndDateBeforeMilestone || isStartDateAfterMilestone || isProjectNameInvalid}
                            >
                                {submitting ? <div className="loader-sm" /> : <Save size={16} />}
                                Save Changes
                            </button>
                        )}
                        {canDeleteProject && (isAdmin || isInactive || isActive) && !isArchived && (
                            <button
                                onClick={() => setIsDeleteConfirmOpen(true)}
                                className="btn"
                                style={{ height: '36px', background: 'transparent', color: '#E53E3E', border: '1px solid #FED7D7', fontSize: '0.85rem', padding: '0 12px' }}
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DetailsSettings;
