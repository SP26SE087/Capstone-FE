import React, { useState, useEffect } from 'react';
import { validateSpecialChars } from '@/utils/validation';
import { useToastStore } from '@/store/slices/toastSlice';
import { researchFieldService, CreateResearchFieldRequest, UpdateResearchFieldRequest } from '@/services/researchFieldService';
import { ResearchField, ResearchFieldStatus } from '@/types/project';
import { Plus, Pencil, Trash2, X, Check, FlaskConical, Loader2 } from 'lucide-react';

type ModalMode = 'add' | 'edit' | null;

interface Props {
    open: boolean;
    onClose: () => void;
}

const ResearchFieldManager: React.FC<Props> = ({ open, onClose }) => {
    const [fields, setFields] = useState<ResearchField[]>([]);
    const [loading, setLoading] = useState(false);
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

    const fetchFields = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await researchFieldService.getAll();
            setFields(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load research fields.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchFields();
            setFormName('');
            setFormDescription('');
            setFormStatus(ResearchFieldStatus.Active);
            setFormError(null);
            setEditingField(null);
            setModalMode('add');
        }
    }, [open]);

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

    const cancelForm = () => {
        setModalMode(null);
        setEditingField(null);
        setFormError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) { setFormError('Name is required.'); return; }
        const nameErr = validateSpecialChars(formName);
        if (nameErr) { setFormError(`Name: ${nameErr}`); return; }
        const descErr = validateSpecialChars(formDescription);
        if (descErr) { setFormError(`Description: ${descErr}`); return; }
        setFormLoading(true);
        setFormError(null);
        try {
            if (modalMode === 'add') {
                await researchFieldService.create({ name: formName.trim(), description: formDescription.trim() || null } as CreateResearchFieldRequest);
                addToast('Research field created successfully.', 'success');
            } else if (modalMode === 'edit' && editingField) {
                await researchFieldService.update(editingField.researchFieldId, {
                    id: editingField.researchFieldId, name: formName.trim(),
                    description: formDescription.trim() || null, status: formStatus,
                } as UpdateResearchFieldRequest);
                addToast('Research field updated successfully.', 'success');
            }
            cancelForm();
            fetchFields();
        } catch (err: any) {
            setFormError(err?.response?.data?.message || err?.message || 'An error occurred.');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        setDeleteLoading(true);
        try {
            await researchFieldService.delete(id);
            addToast('Research field deleted.', 'success');
            setDeleteConfirmId(null);
            fetchFields();
        } catch (err: any) {
            addToast(err?.response?.data?.message || err?.message || 'Failed to delete.', 'error');
            setDeleteConfirmId(null);
        } finally {
            setDeleteLoading(false);
        }
    };

    const activeFields = fields.filter(f => f.status === ResearchFieldStatus.Active);
    const inactiveFields = fields.filter(f => f.status !== ResearchFieldStatus.Active);

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '24px',
            }} onClick={onClose}>
                {/* Modal box */}
                <div
                    onClick={e => e.stopPropagation()}
                    style={{
                        width: '100%', maxWidth: '820px',
                        background: '#fff', borderRadius: '16px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
                        display: 'flex', flexDirection: 'column',
                        height: '520px',
                        overflow: 'hidden',
                        animation: 'fadeUp 0.2s ease-out',
                    }}
                >
                    {/* Modal header */}
                    <div style={{
                        padding: '18px 24px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexShrink: 0,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FlaskConical size={18} style={{ color: 'var(--accent-color)' }} />
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Research Fields</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {loading ? 'Loading...' : `${fields.length} field${fields.length !== 1 ? 's' : ''} defined`}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '6px' }}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Two-column body */}
                    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

                        {/* LEFT: field list */}
                        <div style={{
                            flex: 1, borderRight: '1px solid var(--border-color)',
                            overflowY: 'auto', padding: '12px 16px',
                            minHeight: 0,
                        }} className="custom-scrollbar">
                            {loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                                    <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
                                </div>
                            ) : error ? (
                                <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', padding: '16px' }}>{error}</p>
                            ) : fields.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                                    <FlaskConical size={34} style={{ marginBottom: '10px', opacity: 0.22 }} />
                                    <p style={{ fontSize: '0.84rem', margin: 0, fontWeight: 600 }}>No fields yet.</p>
                                    <p style={{ fontSize: '0.76rem', margin: '4px 0 0' }}>Use the form on the right to add one.</p>
                                </div>
                            ) : (
                                <>
                                    {activeFields.length > 0 && (
                                        <div style={{ marginBottom: inactiveFields.length > 0 ? '20px' : 0 }}>
                                            <p style={{ fontSize: '0.63rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 6px 4px' }}>
                                                Active ({activeFields.length})
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                {activeFields.map(field => (
                                                    <FieldRow
                                                        key={field.researchFieldId}
                                                        field={field}
                                                        isEditing={editingField?.researchFieldId === field.researchFieldId}
                                                        onEdit={openEdit}
                                                        onDelete={setDeleteConfirmId}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {inactiveFields.length > 0 && (
                                        <div>
                                            <p style={{ fontSize: '0.63rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 6px 4px' }}>
                                                Inactive ({inactiveFields.length})
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                {inactiveFields.map(field => (
                                                    <FieldRow
                                                        key={field.researchFieldId}
                                                        field={field}
                                                        isEditing={editingField?.researchFieldId === field.researchFieldId}
                                                        onEdit={openEdit}
                                                        onDelete={setDeleteConfirmId}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* RIGHT: add / edit form */}
                        <div style={{
                            width: '300px', flexShrink: 0,
                            display: 'flex', flexDirection: 'column',
                            background: 'var(--background-color)',
                            minHeight: 0,
                        }}>
                            {/* Right header */}
                            <div style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                flexShrink: 0,
                            }}>
                                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>
                                    {modalMode === 'edit' ? 'Edit Field' : 'New Field'}
                                </h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {modalMode === 'edit' && (
                                        <button onClick={openAdd} className="btn btn-secondary"
                                            style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px', borderRadius: '7px' }}>
                                            <Plus size={12} /> New
                                        </button>
                                    )}
                                    {modalMode === 'edit' && (
                                        <button onClick={cancelForm}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
                                            <X size={15} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Right body — always shows form */}
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, padding: '16px', overflowY: 'auto' }} className="custom-scrollbar">
                                <div>
                                    <label className="rf-label">
                                        Name <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        className="input rf-control"
                                        type="text"
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        maxLength={200}
                                        placeholder="e.g. Machine Learning"
                                        style={{ width: '100%', fontSize: '0.85rem' }}
                                    />
                                </div>
                                <div>
                                    <label className="rf-label">
                                        Description
                                    </label>
                                    <textarea
                                        className="input rf-control"
                                        value={formDescription}
                                        onChange={e => setFormDescription(e.target.value)}
                                        maxLength={2000}
                                        rows={3}
                                        placeholder="Optional description..."
                                        style={{ width: '100%', resize: 'none', fontSize: '0.85rem' }}
                                    />
                                </div>
                                {modalMode === 'edit' && (
                                    <div>
                                        <label className="rf-label">
                                            Status
                                        </label>
                                        <select
                                            className="input rf-control"
                                            value={formStatus}
                                            onChange={e => setFormStatus(Number(e.target.value))}
                                            style={{ width: '100%', fontSize: '0.85rem' }}
                                        >
                                            <option value={ResearchFieldStatus.Active}>Active</option>
                                            <option value={ResearchFieldStatus.Inactive}>Inactive</option>
                                        </select>
                                    </div>
                                )}
                                {formError && (
                                    <p style={{ color: '#ef4444', fontSize: '0.78rem', margin: 0, padding: '8px 10px', background: '#fef2f2', borderRadius: '6px' }}>
                                        {formError}
                                    </p>
                                )}
                                <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', paddingTop: '4px' }}>
                                    <button type="submit" className="btn btn-primary" disabled={formLoading}
                                        style={{ flex: 1, fontSize: '0.82rem', padding: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        {formLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                                        {modalMode === 'add' ? 'Create' : 'Save changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete confirm */}
            {deleteConfirmId && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '360px', padding: '24px' }}>
                        <h3 style={{ margin: '0 0 10px', fontSize: '1rem', fontWeight: 700 }}>Delete Research Field</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 18px' }}>
                            Are you sure? This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => setDeleteConfirmId(null)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirmId)} disabled={deleteLoading} className="btn"
                                style={{ padding: '8px 16px', fontSize: '0.82rem', background: '#ef4444', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {deleteLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeUp {
                    from { transform: translateY(16px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                .rf-label {
                    display: block;
                    font-size: 0.72rem;
                    font-weight: 700;
                    margin-bottom: 5px;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .rf-control {
                    border: 1.5px solid var(--border-color);
                    border-radius: 10px;
                    background: #fff;
                    padding: 10px 12px;
                    transition: border-color 0.15s ease, box-shadow 0.15s ease;
                }

                .rf-control:focus {
                    border-color: var(--accent-color);
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
                    outline: none;
                }

                .rf-control::placeholder {
                    color: var(--text-muted);
                    opacity: 0.9;
                }
            `}</style>
        </>
    );
};

const FieldRow: React.FC<{
    field: ResearchField;
    isEditing: boolean;
    onEdit: (f: ResearchField) => void;
    onDelete: (id: string) => void;
}> = ({ field, isEditing, onEdit, onDelete }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 10px', borderRadius: '8px',
                background: isEditing
                    ? 'var(--accent-bg)'
                    : hovered ? 'var(--surface-hover)' : 'transparent',
                border: isEditing ? '1px solid var(--accent-color)' : '1px solid transparent',
                transition: 'all 0.12s', cursor: 'pointer',
            }}
            onClick={() => onEdit(field)}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: isEditing ? 'var(--accent-color)' : 'inherit' }}>
                    {field.name}
                </span>
                {field.description && (
                    <p style={{ margin: '1px 0 0', fontSize: '0.71rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {field.description}
                    </p>
                )}
            </div>
            <button
                onClick={e => { e.stopPropagation(); onDelete(field.researchFieldId); }}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                    color: '#ef4444', borderRadius: '5px', flexShrink: 0, marginLeft: '6px',
                    opacity: hovered || isEditing ? 1 : 0, transition: 'opacity 0.12s',
                }}
                title="Delete"
            >
                <Trash2 size={13} />
            </button>
        </div>
    );
};

export default ResearchFieldManager;
