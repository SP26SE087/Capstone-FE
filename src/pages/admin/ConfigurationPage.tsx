import React, { useState, useEffect } from 'react';
import { validateSpecialChars } from '@/utils/validation';
import { useToastStore } from '@/store/slices/toastSlice';
import MainLayout from '@/layout/MainLayout';
import { researchFieldService, CreateResearchFieldRequest, UpdateResearchFieldRequest } from '@/services/researchFieldService';
import { ResearchField, ResearchFieldStatus } from '@/types/project';
import { Plus, Pencil, Trash2, X, Check, FlaskConical, Loader2 } from 'lucide-react';

type ModalMode = 'add' | 'edit' | null;

const ConfigurationPage: React.FC = () => {
    const [fields, setFields] = useState<ResearchField[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { addToast } = useToastStore();

    const [modalMode, setModalMode] = useState<ModalMode>(null);
    const [editingField, setEditingField] = useState<ResearchField | null>(null);
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formStatus, setFormStatus] = useState<number>(ResearchFieldStatus.Active);
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        addToast(message, type);
    };

    const fetchFields = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await researchFieldService.getAll();
            setFields(data);
        } catch (error: any) {
            setError(error.message || 'Failed to load research fields.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchFields(); }, []);

    const openAdd = () => {
        setFormName('');
        setFormDescription('');
        setFormStatus(ResearchFieldStatus.Active);
        setFormError(null);
        setEditingField(null);
        setModalMode('add');
    };

    const openEdit = (field: ResearchField) => {
        setFormName(field.name);
        setFormDescription(field.description || '');
        setFormStatus(field.status ?? ResearchFieldStatus.Active);
        setFormError(null);
        setEditingField(field);
        setModalMode('edit');
    };

    const closeModal = () => {
        setModalMode(null);
        setEditingField(null);
        setFormError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) {
            setFormError('Name is required.');
            return;
        }
        const nameSpecialErr = validateSpecialChars(formName);
        if (nameSpecialErr) { setFormError(`Name: ${nameSpecialErr}`); return; }
        const descSpecialErr = validateSpecialChars(formDescription);
        if (descSpecialErr) { setFormError(`Description: ${descSpecialErr}`); return; }
        setFormLoading(true);
        setFormError(null);
        try {
            if (modalMode === 'add') {
                const payload: CreateResearchFieldRequest = {
                    name: formName.trim(),
                    description: formDescription.trim() || null,
                };
                await researchFieldService.create(payload);
                showToast('Research field created successfully.');
            } else if (modalMode === 'edit' && editingField) {
                const payload: UpdateResearchFieldRequest = {
                    id: editingField.researchFieldId,
                    name: formName.trim(),
                    description: formDescription.trim() || null,
                    status: formStatus,
                };
                await researchFieldService.update(editingField.researchFieldId, payload);
                showToast('Research field updated successfully.');
            }
            closeModal();
            fetchFields();
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'An error occurred.';
            setFormError(msg);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        setDeleteLoading(true);
        try {
            await researchFieldService.delete(id);
            showToast('Research field deleted.');
            setDeleteConfirmId(null);
            fetchFields();
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to delete.';
            showToast(msg, 'error');
            setDeleteConfirmId(null);
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="page-container" style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Configuration</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '0.875rem' }}>
                        Manage system-level settings and configurations.
                    </p>
                </div>

                {/* Research Fields Section */}
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FlaskConical size={20} style={{ color: 'var(--accent-color)' }} />
                            <div>
                                <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Research Fields</h2>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                                    Define the research domains available in the system.
                                </p>
                            </div>
                        </div>
                        <button className="btn btn-primary" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', padding: '8px 16px' }}>
                            <Plus size={16} /> Add Field
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : error ? (
                        <div style={{ color: '#ef4444', padding: '16px', textAlign: 'center' }}>{error}</div>
                    ) : fields.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            No research fields yet. Click "Add Field" to create one.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Name</th>
                                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Description</th>
                                    <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Status</th>
                                    <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fields.map(field => (
                                    <tr key={field.researchFieldId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px' }}>{field.name}</td>
                                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{field.description || '—'}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span className={`badge ${field.status === ResearchFieldStatus.Active ? 'badge-success' : 'badge-muted'}`}>
                                                {field.status === ResearchFieldStatus.Active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                <button
                                                    onClick={() => openEdit(field)}
                                                    className="btn btn-secondary"
                                                    style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    <Pencil size={14} /> Edit
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirmId(field.researchFieldId)}
                                                    className="btn"
                                                    style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', background: '#fee2e2', color: '#ef4444', border: 'none' }}
                                                >
                                                    <Trash2 size={14} /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {modalMode && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                                {modalMode === 'add' ? 'Add Research Field' : 'Edit Research Field'}
                            </h3>
                            <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '6px' }}>
                                    Name <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <input
                                    className="input"
                                    type="text"
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    maxLength={200}
                                    placeholder="e.g. Machine Learning"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '6px' }}>Description</label>
                                <textarea
                                    className="input"
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    maxLength={2000}
                                    rows={3}
                                    placeholder="Optional description..."
                                    style={{ width: '100%', resize: 'vertical' }}
                                />
                            </div>
                            {modalMode === 'edit' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '6px' }}>Status</label>
                                    <select
                                        className="input"
                                        value={formStatus}
                                        onChange={e => setFormStatus(Number(e.target.value))}
                                        style={{ width: '100%' }}
                                    >
                                        <option value={ResearchFieldStatus.Active}>Active</option>
                                        <option value={ResearchFieldStatus.Inactive}>Inactive</option>
                                    </select>
                                </div>
                            )}
                            {formError && (
                                <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>{formError}</p>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                                <button type="button" onClick={closeModal} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={formLoading} style={{ padding: '8px 16px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {formLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
                                    {modalMode === 'add' ? 'Create' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirmId && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '380px', padding: '24px' }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600 }}>Delete Research Field</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 20px' }}>
                            Are you sure you want to delete this research field? This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setDeleteConfirmId(null)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirmId)}
                                disabled={deleteLoading}
                                className="btn"
                                style={{ padding: '8px 16px', fontSize: '0.875rem', background: '#ef4444', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                {deleteLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={16} />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default ConfigurationPage;
