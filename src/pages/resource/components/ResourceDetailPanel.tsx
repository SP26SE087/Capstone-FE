import React, { useState, useEffect } from 'react';
import { Resource, ResourceType, UpdateResourceRequest } from '@/types/booking';
import { resourceService } from '@/services/resourceService';
import { userService, UserResponse } from '@/services/userService';
import {
    Save,
    Loader2,
    Cpu,
    HardDrive,
    Box,
    Monitor,
    MapPin,
    FileText,
    Package,
    Trash2,
    AlertTriangle,
    Hash,
    UserCog
} from 'lucide-react';

interface ResourceDetailPanelProps {
    resource: Resource;
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string) => void;
    onTitleChange?: (title: string) => void;
    isLabDirector: boolean;
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
    transition: 'border-color 0.2s, box-shadow 0.2s',
    background: '#fff'
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

const sectionStyle: React.CSSProperties = {
    padding: '16px',
    background: 'var(--background-color)',
    borderRadius: '12px',
    border: '1px solid var(--border-light)',
    marginBottom: '16px'
};

const getResourceIcon = (type: ResourceType) => {
    switch (type) {
        case ResourceType.GPU: return <Cpu size={16} />;
        case ResourceType.Equipment: return <HardDrive size={16} />;
        case ResourceType.Dataset: return <Box size={16} />;
        case ResourceType.LabStation: return <Monitor size={16} />;
        default: return <Package size={16} />;
    }
};

const getResourceTypeLabel = (type: ResourceType) => {
    switch (type) {
        case ResourceType.GPU: return 'GPU';
        case ResourceType.Equipment: return 'Equipment';
        case ResourceType.Dataset: return 'Dataset';
        case ResourceType.LabStation: return 'Lab Station';
        default: return 'Resource';
    }
};

const getTypeColor = (type: ResourceType) => {
    switch (type) {
        case ResourceType.GPU: return '#7c3aed';
        case ResourceType.Equipment: return '#2563eb';
        case ResourceType.Dataset: return '#059669';
        case ResourceType.LabStation: return '#ea580c';
        default: return '#64748b';
    }
};

const ResourceDetailPanel: React.FC<ResourceDetailPanelProps> = ({
    resource: initialResource,
    onClose,
    onSaved,
    onTitleChange,
    isLabDirector
}) => {
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [selectedManagerId, setSelectedManagerId] = useState(initialResource.managedBy || '');
    const [users, setUsers] = useState<UserResponse[]>([]);

    // Editable fields – initialized from the passed resource
    const [name, setName] = useState(initialResource.name || '');
    const [description, setDescription] = useState(initialResource.description || '');
    const [location, setLocation] = useState(initialResource.location || '');

    const typeColor = getTypeColor(initialResource.type);

    useEffect(() => {
        if (!isLabDirector) return;
        userService.getAll().then((data: any) => {
            const list: UserResponse[] = Array.isArray(data) ? data : (data.items || []);
            setUsers(list);
        }).catch(() => {});
    }, [isLabDirector]);

    const handleAssignManager = async () => {
        if (!selectedManagerId) return;
        setAssigning(true);
        try {
            await Promise.all(initialResource.ids.map(id => resourceService.assignManager(id, selectedManagerId)));
            onSaved(false, 'Manager assigned successfully.');
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to assign manager.';
            alert(msg);
        } finally {
            setAssigning(false);
        }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!isLabDirector) return;
        e.currentTarget.style.borderColor = 'var(--accent-color)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)';
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.boxShadow = 'none';
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const request: UpdateResourceRequest = {
                name: name.trim() || undefined,
                description: description.trim() || undefined,
                location: location.trim() || undefined
            };
            // Update every unit in this resource group
            await Promise.all(initialResource.ids.map(id => resourceService.update(id, request)));
            onSaved(false, 'Resource updated successfully.');
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to update resource.';
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            // Delete every unit in this resource group
            await Promise.all(initialResource.ids.map(id => resourceService.delete(id)));
            onSaved(true, 'Resource deleted successfully.');
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to delete resource.';
            alert(msg);
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Panel Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '10px',
                        background: `${typeColor}15`, color: typeColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {getResourceIcon(initialResource.type)}
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {initialResource.name}
                        </h3>
                        <span style={{
                            fontSize: '0.68rem', fontWeight: 700, color: typeColor,
                            background: `${typeColor}10`, padding: '2px 8px', borderRadius: '12px'
                        }}>
                            {getResourceTypeLabel(initialResource.type)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">

                {/* Inventory Status */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><Package size={12} /> Inventory Status</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {[
                            { label: 'Total', value: initialResource.totalQuantity, color: '#1e293b', bg: '#fff' },
                            { label: 'Available', value: initialResource.availableQuantity, color: '#059669', bg: '#ecfdf5' },
                            { label: 'In Use', value: initialResource.inUseCount ?? 0, color: '#7c3aed', bg: '#f5f3ff' },
                            { label: 'Damaged', value: initialResource.damagedQuantity, color: initialResource.damagedQuantity > 0 ? '#dc2626' : '#94a3b8', bg: initialResource.damagedQuantity > 0 ? '#fef2f2' : '#f8fafc' }
                        ].map(stat => (
                            <div key={stat.label} style={{ padding: '10px', background: stat.bg, borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>{stat.label}</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                            </div>
                        ))}
                    </div>
                    {initialResource.location && (
                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#64748b' }}>
                            <MapPin size={12} />
                            <span style={{ fontWeight: 600 }}>{initialResource.location}</span>
                        </div>
                    )}
                    {initialResource.managerName && (
                        <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                            Managed by: <strong style={{ color: '#1e293b' }}>{initialResource.managerName}</strong>
                        </div>
                    )}
                </div>

                {/* Serial Numbers */}
                {(initialResource.serials?.length ?? 0) > 0 && (
                    <div style={sectionStyle}>
                        <div style={labelStyle}><Hash size={12} /> Serial Numbers ({initialResource.serials!.length} units)</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }} className="custom-scrollbar">
                            {initialResource.serials!.map((serial, idx) => (
                                <div key={idx} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '7px 10px', background: '#fff',
                                    borderRadius: '8px', border: '1px solid var(--border-light)'
                                }}>
                                    <span style={{
                                        width: '20px', height: '20px', borderRadius: '6px', background: '#f1f5f9',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.65rem', fontWeight: 700, color: '#64748b', flexShrink: 0
                                    }}>{idx + 1}</span>
                                    <code style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', letterSpacing: '0.5px' }}>
                                        {serial}
                                    </code>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Editable Details */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={12} /> {isLabDirector ? 'Editable Details' : 'Details'}</div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Name</label>
                        <input
                            style={{ ...inputStyle, ...(!isLabDirector ? { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' } : {}) }}
                            value={name}
                            onChange={e => { if (isLabDirector) { setName(e.target.value); onTitleChange?.(e.target.value || 'Resource'); } }}
                            readOnly={!isLabDirector}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Description</label>
                        <textarea
                            style={{
                                ...inputStyle, minHeight: '70px',
                                resize: isLabDirector ? 'vertical' as const : 'none' as const,
                                ...(!isLabDirector ? { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' } : {})
                            }}
                            value={description}
                            onChange={e => { if (isLabDirector) setDescription(e.target.value); }}
                            readOnly={!isLabDirector}
                            placeholder="Resource description..."
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                    </div>

                    <div>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}><MapPin size={12} /> Location</label>
                        <input
                            style={{ ...inputStyle, ...(!isLabDirector ? { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' } : {}) }}
                            value={location}
                            onChange={e => { if (isLabDirector) setLocation(e.target.value); }}
                            readOnly={!isLabDirector}
                            placeholder="Resource location..."
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                    </div>
                </div>

                {/* Assign Manager */}
                {isLabDirector && (
                    <div style={sectionStyle}>
                        <div style={labelStyle}><UserCog size={12} /> Assign Manager</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <select
                                style={{ ...inputStyle, flex: 1 }}
                                value={selectedManagerId}
                                onChange={e => setSelectedManagerId(e.target.value)}
                            >
                                <option value="">— Select a manager —</option>
                                {users.map(u => (
                                    <option key={u.userId} value={u.userId}>
                                        {u.fullName} ({u.email})
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={handleAssignManager}
                                disabled={assigning || !selectedManagerId}
                                style={{
                                    padding: '10px 16px', borderRadius: '10px', border: 'none',
                                    background: (!selectedManagerId || assigning) ? '#e2e8f0' : 'var(--accent-color)',
                                    color: (!selectedManagerId || assigning) ? '#94a3b8' : '#fff',
                                    cursor: (!selectedManagerId || assigning) ? 'not-allowed' : 'pointer',
                                    fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                {assigning ? <Loader2 size={14} className="animate-spin" /> : <UserCog size={14} />}
                                Assign
                            </button>
                        </div>
                        {initialResource.managerName && (
                            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#64748b' }}>
                                Current: <strong style={{ color: '#1e293b' }}>{initialResource.managerName}</strong>
                            </div>
                        )}
                    </div>
                )}

                {/* Delete Confirmation */}
                {showDeleteConfirm && isLabDirector && (
                    <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <AlertTriangle size={16} color="#dc2626" />
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626' }}>Confirm Delete</span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: '#7f1d1d', margin: '0 0 12px 0' }}>
                            This will delete all {initialResource.ids.length} unit(s) of "{initialResource.name}". This cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                style={{
                                    padding: '6px 16px', borderRadius: '8px', border: 'none',
                                    background: '#dc2626', color: '#fff',
                                    cursor: deleting ? 'not-allowed' : 'pointer',
                                    fontSize: '0.78rem', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{
                paddingTop: '14px', borderTop: '1px solid var(--border-light)',
                display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: 'auto'
            }}>
                <div>
                    {isLabDirector && !showDeleteConfirm && (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            style={{
                                padding: '8px 16px', borderRadius: '10px',
                                border: '1px solid #fecaca', background: '#fff', color: '#dc2626',
                                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                            }}
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 20px', borderRadius: '10px',
                            border: '1px solid var(--border-color)', background: '#fff',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s'
                        }}
                    >
                        Close
                    </button>
                    {isLabDirector && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                padding: '8px 24px', borderRadius: '10px', border: 'none',
                                background: saving ? '#94a3b8' : 'var(--accent-color)',
                                color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                                fontSize: '0.8rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: '6px',
                                transition: 'all 0.2s',
                                boxShadow: saving ? 'none' : '0 4px 12px rgba(232,114,12,0.25)'
                            }}
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save Changes
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResourceDetailPanel;
