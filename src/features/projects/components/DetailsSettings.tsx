import React from 'react';
import { ShieldAlert, ChevronDown, Briefcase, Save, Search, Calendar, Trash2 } from 'lucide-react';
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
}

const DetailsSettings: React.FC<DetailsSettingsProps> = ({
    isArchived, isReadOnly: permissionReadOnly, isAdmin, formData, handleStatusChange, handleInputChange,
    project, availableFields, selectedFieldIds, toggleField, handleSubmit, submitting,
    canDeleteProject, setIsDeleteConfirmOpen
}) => {
    // Local state for field searching and edit mode
    const [fieldSearchTerm, setFieldSearchTerm] = React.useState('');
    const [isEditing, setIsEditing] = React.useState(false);

    const isReadOnly = permissionReadOnly || !isEditing;

    // Date validation: End date cannot be before start date
    const isDateInvalid = React.useMemo(() => {
        if (!formData.startDate || !formData.endDate) return false;
        return new Date(formData.startDate) > new Date(formData.endDate);
    }, [formData.startDate, formData.endDate]);

    const getStatusStyle = (status: number) => {
        switch (status) {
            case ProjectStatus.Active: return { color: '#10b981', label: 'Active', bg: '#ecfdf5' };
            case ProjectStatus.Inactive: return { color: '#64748b', label: 'Inactive', bg: '#f1f5f9' };
            case ProjectStatus.Completed: return { color: '#3b82f6', label: 'Completed', bg: '#eff6ff' };
            case ProjectStatus.Archived: return { color: '#ef4444', label: 'Archived', bg: '#fef2f2' };
            default: return { color: '#64748b', label: 'Unknown', bg: '#f1f5f9' };
        }
    };

    const statusStyle = getStatusStyle(formData.status);

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Action Bar */}
            {!permissionReadOnly && !isArchived && (
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
            <div className="card" style={{ padding: '2rem' }}>
                {/* Header Information */}
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2rem' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
                                <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 0 }}>Project Name</label>
                                {isEditing && <span style={{ fontSize: '0.65rem', color: formData.projectName.length >= 200 ? 'var(--error)' : 'var(--text-muted)' }}>{formData.projectName.length}/200</span>}
                            </div>
                            <input
                                className="form-input"
                                style={{ fontSize: '1.5rem', fontWeight: 800, padding: isEditing ? '4px 8px' : '0 0 4px 0', border: isEditing ? '1px solid var(--border-color)' : 'none', background: isEditing ? 'white' : 'transparent', width: '100%', borderRadius: isEditing ? 'var(--radius-sm)' : 0, outline: 'none' }}
                                type="text"
                                name="projectName"
                                value={formData.projectName}
                                onChange={handleInputChange}
                                disabled={isReadOnly}
                                placeholder="Workspace Name"
                                maxLength={200}
                            />
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
                            {isEditing && <span style={{ fontSize: '0.65rem', color: formData.projectDescription.length >= 2000 ? 'var(--error)' : 'var(--text-muted)' }}>{formData.projectDescription.length}/2000</span>}
                        </div>
                        <textarea
                            className="form-input"
                            style={{ padding: isEditing ? '8px 12px' : '0', border: isEditing ? '1px solid var(--border-color)' : 'none', background: isEditing ? 'white' : 'transparent', minHeight: '80px', resize: isEditing ? 'vertical' : 'none', borderRadius: isEditing ? 'var(--radius-sm)' : 0, lineHeight: 1.6, width: '100%', outline: 'none' }}
                            name="projectDescription"
                            value={formData.projectDescription}
                            onChange={handleInputChange}
                            disabled={isReadOnly}
                            placeholder="Describe the research goals..."
                            maxLength={2000}
                        />
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
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Start Date</label>
                                <input className="form-input" type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} disabled={isReadOnly} style={{ fontSize: '0.9rem' }} />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.75rem', color: isDateInvalid ? 'var(--error)' : 'inherit' }}>End Date</label>
                                <input className="form-input" type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} disabled={isReadOnly} style={{ fontSize: '0.9rem', borderColor: isDateInvalid ? 'var(--error)' : '' }} />
                                {isDateInvalid && <p style={{ fontSize: '0.65rem', color: 'var(--error)', marginTop: '4px' }}>Cannot end before start</p>}
                            </div>
                        </div>
                    </div>

                    {/* Right: Domains */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 750, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Briefcase size={14} /> Research Fields
                            </h4>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Filter..."
                                    className="form-input"
                                    style={{ padding: '4px 30px 4px 10px', height: '28px', fontSize: '0.75rem', width: '120px' }}
                                    value={fieldSearchTerm}
                                    onChange={(e) => setFieldSearchTerm(e.target.value)}
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>
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
                                        onClick={() => !isReadOnly && toggleField(field.researchFieldId)}
                                        className={`filter-chip ${selectedFieldIds.includes(field.researchFieldId) ? 'active' : ''}`}
                                        style={{
                                            padding: '4px 10px',
                                            fontSize: '0.75rem',
                                            cursor: isReadOnly ? 'default' : 'pointer',
                                        }}
                                        disabled={isReadOnly}
                                    >
                                        {field.name}
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>

                {/* Integration Row (Bottom Management) */}
                <div style={{ marginTop: '2.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3rem', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '36px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusStyle.color, flexShrink: 0 }} />
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Project Status</p>
                            <div style={{ position: 'relative' }}>
                                <select
                                    value={formData.status}
                                    onChange={(e) => handleStatusChange(parseInt(e.target.value))}
                                    className="form-input"
                                    style={{
                                        padding: '0 20px 0 0',
                                        fontSize: '0.9rem',
                                        fontWeight: 700,
                                        color: 'var(--text-primary)',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: 0,
                                        appearance: 'none',
                                        cursor: 'pointer',
                                        width: 'auto',
                                        height: '36px',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                    disabled={isReadOnly && !isAdmin}
                                >
                                    <option value={ProjectStatus.Active}>Active</option>
                                    <option value={ProjectStatus.Inactive}>Inactive</option>
                                    {(project?.status !== ProjectStatus.Archived || isAdmin) && <option value={ProjectStatus.Completed}>Completed</option>}
                                    <option value={ProjectStatus.Archived}>Archived</option>
                                </select>
                                <ChevronDown size={14} style={{ position: 'absolute', right: '0', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                            </div>
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
                                onClick={() => { handleSubmit(); setIsEditing(false); }}
                                className="btn btn-primary"
                                style={{ height: '36px', padding: '0 20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                                disabled={submitting || isDateInvalid}
                            >
                                {submitting ? <div className="loader-sm" /> : <Save size={16} />}
                                Save Changes
                            </button>
                        )}
                        {canDeleteProject && !isArchived && (
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
