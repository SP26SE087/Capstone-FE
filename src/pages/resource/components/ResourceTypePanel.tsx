import React, { useState, useEffect } from 'react';
import { resourceTypeService, ResourceTypeItem, ResourceTypeCategory } from '@/services/resourceTypeService';
import { Save, Loader2, Layers, Tag, Box, Server } from 'lucide-react';

interface ResourceTypePanelProps {
    editing?: ResourceTypeItem | null;
    onClose: () => void;
    onSaved: (message: string) => void;
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1.5px solid var(--border-color)',
    fontSize: '0.85rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    outline: 'none',
    background: '#fff',
    transition: 'border-color 0.2s, box-shadow 0.2s'
};

const labelStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
};

const ResourceTypePanel: React.FC<ResourceTypePanelProps> = ({ editing, onClose, onSaved }) => {
    const [name, setName] = useState(editing?.name || '');
    const [description, setDescription] = useState(editing?.description || '');
    const [isActive, setIsActive] = useState(editing?.isActive ?? true);
    const [category, setCategory] = useState<ResourceTypeCategory>(editing?.category ?? ResourceTypeCategory.Physical);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        setName(editing?.name || '');
        setDescription(editing?.description || '');
        setIsActive(editing?.isActive ?? true);
        setCategory(editing?.category ?? ResourceTypeCategory.Physical);
        setErrors({});
    }, [editing]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.currentTarget.style.borderColor = 'var(--accent-color)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)';
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.boxShadow = 'none';
    };

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!name.trim()) errs.name = 'Name is required.';
        if (name.trim().length > 200) errs.name = 'Max 200 characters.';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            if (editing) {
                await resourceTypeService.update(editing.id, {
                    name: name.trim(),
                    description: description.trim() || undefined,
                    isActive,
                    category,
                });
                onSaved('Resource type updated successfully.');
            } else {
                await resourceTypeService.create(name.trim(), description.trim() || undefined, category);
                onSaved('Resource type created successfully.');
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to save.';
            setErrors(prev => ({ ...prev, submit: msg }));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Layers size={16} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {editing ? 'Edit Resource Type' : 'New Resource Type'}
                    </h3>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {editing ? `Editing: ${editing.name}` : 'Add a new resource category'}
                    </span>
                </div>
            </div>

            {/* Form */}
            <div>
                <div style={{ padding: '20px', background: 'var(--background-color)', borderRadius: '12px', border: '1px solid var(--border-light)', marginBottom: '16px' }}>
                    <div style={labelStyle}><Tag size={12} /> Details</div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Name *</label>
                        <input
                            style={{ ...inputStyle, borderColor: errors.name ? '#ef4444' : undefined }}
                            value={name}
                            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
                            placeholder="e.g. GPU, Microscope, Camera..."
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                        {errors.name && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.name}</span>}
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Category *</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {[
                                { value: ResourceTypeCategory.Physical, label: 'Physical', desc: 'Lab equipment, hardware', icon: <Box size={14} /> },
                                { value: ResourceTypeCategory.ServerCompute, label: 'Server / Compute', desc: 'GPU nodes, compute instances', icon: <Server size={14} /> },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setCategory(opt.value)}
                                    style={{
                                        flex: 1,
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        border: category === opt.value ? '2px solid var(--accent-color)' : '1.5px solid var(--border-color)',
                                        background: category === opt.value ? 'rgba(232,114,12,0.06)' : '#fff',
                                        color: category === opt.value ? 'var(--accent-color)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        textAlign: 'left' as const,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.8rem', marginBottom: '2px' }}>
                                        {opt.icon} {opt.label}
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>{opt.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Description</label>
                        <textarea
                            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' as const }}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Optional description..."
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                    </div>

                    {editing && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ ...labelStyle, fontSize: '0.68rem', marginBottom: 0 }}>Active</label>
                            <button
                                type="button"
                                onClick={() => setIsActive(v => !v)}
                                style={{
                                    width: '40px', height: '22px', borderRadius: '11px', border: 'none',
                                    background: isActive ? '#10b981' : '#e2e8f0',
                                    cursor: 'pointer', position: 'relative' as const, transition: 'background 0.2s'
                                }}
                            >
                                <span style={{
                                    position: 'absolute' as const, top: '3px',
                                    left: isActive ? '21px' : '3px',
                                    width: '16px', height: '16px', borderRadius: '50%',
                                    background: '#fff', transition: 'left 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                }} />
                            </button>
                            <span style={{ fontSize: '0.78rem', color: isActive ? '#10b981' : '#94a3b8', fontWeight: 600 }}>
                                {isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    )}
                </div>

                {errors.submit && (
                    <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#dc2626', fontSize: '0.82rem', fontWeight: 600 }}>
                        {errors.submit}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: '10px', border: '1px solid var(--border-color)', background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{ padding: '8px 24px', borderRadius: '10px', border: 'none', background: saving ? '#94a3b8' : 'var(--accent-color)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: saving ? 'none' : '0 4px 12px rgba(232,114,12,0.25)' }}
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {editing ? 'Update' : 'Create'}
                </button>
            </div>
        </div>
    );
};

export default ResourceTypePanel;
