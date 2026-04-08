import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/layout/MainLayout';
import { projectService, researchFieldService } from '@/services';
import { ResearchField } from '@/types';
import {
    X,
    Save,
    Calendar,
    FileText,
    Briefcase,
    Plus,
    Check,
    Search,
    ShieldAlert
} from 'lucide-react';
import { getVietnamDateInputValue, toApiDate } from '@/utils/projectUtils';
import { useAuth } from '@/hooks/useAuth';

const CreateProject: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [availableFields, setAvailableFields] = useState<ResearchField[]>([]);
    const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
    const [fieldSearchTerm, setFieldSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        projectName: '',
        projectDescription: '',
        startDate: getVietnamDateInputValue(),
        endDate: '',
    });

    useEffect(() => {
        const fetchFields = async () => {
            const fields = await researchFieldService.getAll();
            setAvailableFields(fields);
        };
        fetchFields();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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
        try {
            const todayVn = getVietnamDateInputValue();
            const startDate = formData.startDate || todayVn;

            if (startDate < todayVn) {
                alert('Start date cannot be in the past.');
                return;
            }

            if (formData.endDate && formData.endDate < startDate) {
                alert('End date cannot be earlier than start date.');
                return;
            }

            setSubmitting(true);

            const projectData = {
                projectName: formData.projectName,
                projectDescription: formData.projectDescription,
                startDate: toApiDate(startDate),
                endDate: toApiDate(formData.endDate),
                status: 2, // 2 is Inactive/Pending
                researchFieldIds: selectedFieldIds || []
            };

            await projectService.create(projectData);
            navigate('/projects');
        } catch (error: any) {
            console.error('Failed to create project:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error occurred';
            alert(`Failed to create project: ${errorMessage}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container" style={{ margin: '0 auto' }}>
                <header className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                        <h1>Create New Project</h1>
                        <p>Initialize a new research initiative in the lab.</p>
                    </div>
                    <button
                        onClick={() => navigate('/projects')}
                        className="btn btn-secondary"
                        style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%' }}
                        title="Cancel"
                    >
                        <X size={20} />
                    </button>
                </header>

                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

                    {/* ── Left: Form ── */}
                    <form
                        onSubmit={handleSubmit}
                        className="card"
                        style={{ flex: 3, padding: '1.75rem', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                    >
                        {/* Project Name */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" htmlFor="projectName">Project Name</label>
                            <div style={{ position: 'relative' }}>
                                <Briefcase size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    className="form-input"
                                    style={{ paddingLeft: '38px' }}
                                    type="text"
                                    id="projectName"
                                    name="projectName"
                                    placeholder="e.g. AI-Powered Medical Diagnosis"
                                    value={formData.projectName}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" htmlFor="projectDescription">Project Description</label>
                            <div style={{ position: 'relative' }}>
                                <FileText size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
                                <textarea
                                    className="form-input"
                                    style={{ paddingLeft: '38px', minHeight: '90px', resize: 'vertical' }}
                                    id="projectDescription"
                                    name="projectDescription"
                                    placeholder="Briefly describe the goals and scope of the project..."
                                    value={formData.projectDescription}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                        </div>

                        {/* Timeline */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" htmlFor="startDate">Start Date</label>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        className="form-input"
                                        style={{ paddingLeft: '38px' }}
                                        type="date"
                                        id="startDate"
                                        name="startDate"
                                        min={getVietnamDateInputValue()}
                                        value={formData.startDate}
                                        onChange={(e) => {
                                            const nextStartDate = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                startDate: nextStartDate,
                                                endDate: prev.endDate && prev.endDate < nextStartDate ? nextStartDate : prev.endDate
                                            }));
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" htmlFor="endDate">End Date</label>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        className="form-input"
                                        style={{ paddingLeft: '38px' }}
                                        type="date"
                                        id="endDate"
                                        name="endDate"
                                        min={formData.startDate || getVietnamDateInputValue()}
                                        value={formData.endDate}
                                        onChange={(e) => {
                                            const nextEndDate = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                endDate: nextEndDate && prev.startDate && nextEndDate < prev.startDate ? prev.startDate : nextEndDate
                                            }));
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Research Fields */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Research Fields</label>
                            <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                                <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search fields..."
                                    className="form-input"
                                    style={{ paddingLeft: '36px', height: '40px', fontSize: '0.875rem' }}
                                    value={fieldSearchTerm}
                                    onChange={(e) => setFieldSearchTerm(e.target.value)}
                                />
                            </div>
                            <div style={{
                                display: 'flex', flexWrap: 'wrap', gap: '8px',
                                padding: '0.85rem',
                                background: 'var(--surface-hover)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)',
                                maxHeight: '150px', overflowY: 'auto'
                            }} className="custom-scrollbar">
                                {availableFields.length > 0 ? (
                                    availableFields.filter(f => f.name.toLowerCase().includes(fieldSearchTerm.toLowerCase())).length > 0 ? (
                                        availableFields
                                            .filter(f => f.name.toLowerCase().includes(fieldSearchTerm.toLowerCase()))
                                            .map((field) => (
                                                <button
                                                    key={field.researchFieldId}
                                                    type="button"
                                                    onClick={() => toggleField(field.researchFieldId)}
                                                    className={`filter-chip ${selectedFieldIds.includes(field.researchFieldId) ? 'active' : ''}`}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s' }}
                                                >
                                                    {selectedFieldIds.includes(field.researchFieldId) ? <Check size={12} /> : <Plus size={12} />}
                                                    {field.name}
                                                </button>
                                            ))
                                    ) : (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 auto' }}>No fields match.</p>
                                    )
                                ) : (
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Loading research fields...</p>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', marginTop: '0.25rem' }}>
                            <button
                                type="button"
                                onClick={() => navigate('/projects')}
                                className="btn btn-secondary"
                                style={{ flex: 1, height: '44px' }}
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ flex: 2, height: '44px' }}
                                disabled={submitting}
                            >
                                {submitting ? 'Creating...' : (
                                    <>
                                        <Save size={16} />
                                        Create Project
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* ── Right: Sidebar ── */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '80px' }}>

                        {/* Approval notice */}
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: '12px',
                            padding: '1rem 1.25rem',
                            background: 'var(--info-bg)',
                            borderRadius: '12px',
                            color: 'var(--info)',
                            fontSize: '0.85rem',
                            border: '1px solid rgba(59,130,246,0.2)',
                            lineHeight: 1.5
                        }}>
                            <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>
                                <strong style={{ display: 'block', marginBottom: '4px' }}>Approval Required</strong>
                                Your project will be in "Pending" status and requires administrator approval before it can start.
                            </div>
                        </div>

                        {/* Selected fields summary */}
                        {selectedFieldIds.length > 0 && (
                            <div style={{
                                padding: '1rem 1.25rem',
                                background: 'var(--accent-bg)',
                                borderRadius: '12px',
                                border: '1px solid rgba(99,102,241,0.15)',
                            }}>
                                <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-color)' }}>
                                    Selected Fields ({selectedFieldIds.length})
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {selectedFieldIds.map(id => {
                                        const f = availableFields.find(f => f.researchFieldId === id);
                                        return f ? (
                                            <span key={id} className="tag" style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>{f.name}</span>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Tip */}
                        <div style={{
                            padding: '1rem 1.25rem',
                            borderRadius: '12px',
                            background: 'var(--surface-hover)',
                            border: '1px dashed var(--border-color)',
                            fontSize: '0.82rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.6
                        }}>
                            <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.8rem' }}>💡 Tips</p>
                            Choose a clear, descriptive name. You can add members and milestones after the project is approved.
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default CreateProject;
