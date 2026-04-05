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
    AlertCircle,
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
                researchFieldIds: selectedFieldIds || []
            };

            console.log('Submitting project to API:', projectData);

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
                <header className="page-header" style={{ marginBottom: '2.5rem' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                    <form onSubmit={handleSubmit} className="card" style={{ padding: '2.5rem', marginBottom: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <section>
                                <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>Basic Information</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                                                placeholder="e.g. AI-Powered Medical Diagnosis"
                                                value={formData.projectName}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" htmlFor="projectDescription">Project Description</label>
                                        <div style={{ position: 'relative' }}>
                                            <FileText size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                                            <textarea
                                                className="form-input"
                                                style={{ paddingLeft: '40px', minHeight: '120px', resize: 'vertical' }}
                                                id="projectDescription"
                                                name="projectDescription"
                                                placeholder="Briefly describe the goals and scope of the project..."
                                                value={formData.projectDescription}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>Project Timeline</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" htmlFor="startDate">Expected Start Date</label>
                                        <div style={{ position: 'relative' }}>
                                            <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input
                                                className="form-input"
                                                style={{ paddingLeft: '40px' }}
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
                                        <label className="form-label" htmlFor="endDate">Expected End Date</label>
                                        <div style={{ position: 'relative' }}>
                                            <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input
                                                className="form-input"
                                                style={{ paddingLeft: '40px' }}
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
                            </section>

                            <section>
                                <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>Research Fields</h3>
                                
                                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search fields..."
                                        className="form-input"
                                        style={{ paddingLeft: '36px', height: '42px', fontSize: '0.9rem' }}
                                        value={fieldSearchTerm}
                                        onChange={(e) => setFieldSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '10px',
                                    padding: '1.25rem',
                                    background: 'var(--surface-hover)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-color)',
                                    maxHeight: '240px',
                                    overflowY: 'auto'
                                }}
                                className="custom-scrollbar"
                                >
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
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            transition: 'all 0.2s',
                                                        }}
                                                    >
                                                        {selectedFieldIds.includes(field.researchFieldId) ? <Check size={14} /> : <Plus size={14} />}
                                                        {field.name}
                                                    </button>
                                                ))
                                        ) : (
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 auto', padding: '10px' }}>
                                                No research fields match your search.
                                            </p>
                                        )
                                    ) : (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Loading research fields...</p>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertCircle size={14} />
                                    Only administrators can create new research fields.
                                </p>
                            </section>

                            <div style={{
                                display: 'flex',
                                gap: '1rem',
                                marginTop: '1.5rem',
                                borderTop: '1px solid var(--border-color)',
                                paddingTop: '2.5rem'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => navigate('/projects')}
                                    className="btn btn-secondary"
                                    style={{ flex: 1, height: '48px' }}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ flex: 2, height: '48px' }}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Creating...' : (
                                        <>
                                            <Save size={18} />
                                            Create Project
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '1.25rem',
                        background: 'var(--info-bg)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--info)',
                        fontSize: '0.9rem',
                        border: '1px solid var(--border-color)'
                    }}>
                        <ShieldAlert size={20} />
                        <div>
                            <strong>Approval Required:</strong> Your project will be in "Pending" status and requires administrator approval before starting.
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default CreateProject;
