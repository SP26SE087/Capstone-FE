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
    Search
} from 'lucide-react';
import { toApiDate } from '@/utils/projectUtils';


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
        startDate: '',
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
        setSubmitting(true);
        try {
            const projectData = {
                projectName: formData.projectName,
                projectDescription: formData.projectDescription,
                startDate: toApiDate(formData.startDate),
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
            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1rem' }}>
                <header style={{
                    marginBottom: '2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Create New Project</h1>
                        <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Initialize a new research initiative in the lab.</p>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" htmlFor="projectName">Project Name</label>
                                <div style={{ position: 'relative' }}>
                                    <Briefcase size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
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
                                    <FileText size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
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

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" htmlFor="startDate">Ngày bắt đầu dự kiến</label>
                                    <div style={{ position: 'relative' }}>
                                        <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                        <input
                                            className="form-input"
                                            style={{ paddingLeft: '40px' }}
                                            type="date"
                                            id="startDate"
                                            name="startDate"
                                            value={formData.startDate}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" htmlFor="endDate">Ngày kết thúc dự kiến</label>
                                    <div style={{ position: 'relative' }}>
                                        <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                        <input
                                            className="form-input"
                                            style={{ paddingLeft: '40px' }}
                                            type="date"
                                            id="endDate"
                                            name="endDate"
                                            value={formData.endDate}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Research Fields (Select relevant areas)</label>
                                
                                <div style={{ position: 'relative', marginBottom: '10px' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search research fields..."
                                        className="form-input"
                                        style={{ paddingLeft: '36px', height: '36px', fontSize: '0.85rem' }}
                                        value={fieldSearchTerm}
                                        onChange={(e) => setFieldSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '10px',
                                    padding: '1rem',
                                    background: '#f8f9fa',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    maxHeight: '200px',
                                    overflowY: 'auto'
                                }}>
                                    {availableFields.length > 0 ? (
                                        availableFields
                                            .filter(f => f.name.toLowerCase().includes(fieldSearchTerm.toLowerCase()))
                                            .length > 0 ? (
                                                availableFields
                                                    .filter(f => f.name.toLowerCase().includes(fieldSearchTerm.toLowerCase()))
                                                    .map((field) => (
                                                        <button
                                                            key={field.id}
                                                            type="button"
                                                            onClick={() => toggleField(field.id)}
                                                            style={{
                                                                padding: '8px 16px',
                                                                borderRadius: '20px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: 500,
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                transition: 'all 0.2s',
                                                                background: selectedFieldIds.includes(field.id)
                                                                    ? 'var(--accent-color)'
                                                                    : 'white',
                                                                color: selectedFieldIds.includes(field.id)
                                                                    ? 'white'
                                                                    : 'var(--text-secondary)',
                                                                border: selectedFieldIds.includes(field.id)
                                                                    ? '1px solid var(--accent-color)'
                                                                    : '1px solid var(--border-color)',
                                                                boxShadow: selectedFieldIds.includes(field.id)
                                                                    ? '0 2px 4px rgba(42, 111, 151, 0.2)'
                                                                    : 'none'
                                                            }}
                                                        >
                                                            {selectedFieldIds.includes(field.id) ? <Check size={14} /> : <Plus size={14} />}
                                                            {field.name}
                                                        </button>
                                                    ))
                                            ) : (
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 auto', padding: '10px' }}>
                                                    No fields match your search.
                                                </p>
                                            )
                                    ) : (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Loading research fields...</p>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                    * Only Administrators can create new research fields. Contact admin if a field is missing.
                                </p>
                            </div>

                            <div style={{
                                display: 'flex',
                                gap: '1rem',
                                marginTop: '1rem',
                                borderTop: '1px solid var(--border-color)',
                                paddingTop: '2rem'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => navigate('/projects')}
                                    className="btn btn-secondary"
                                    style={{ flex: 1 }}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ flex: 2 }}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Creating Project...' : (
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
                        background: '#eff6ff',
                        borderRadius: '12px',
                        color: '#1e40af',
                        fontSize: '0.9rem',
                        border: '1px solid #bfdbfe'
                    }}>
                        <AlertCircle size={20} />
                        <div>
                            <strong>Approval Required:</strong> Your project will enter a "Pending" status and must be approved by the Lab Administrator before members can be assigned.
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default CreateProject;
