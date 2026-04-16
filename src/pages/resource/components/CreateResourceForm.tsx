import React, { useState, useEffect } from 'react';
import { CreateResourceRequest } from '@/types/booking';
import { resourceService } from '@/services/resourceService';
import { resourceTypeService, ResourceTypeItem } from '@/services/resourceTypeService';
import { userService } from '@/services/userService';
import { useAuth } from '@/hooks/useAuth';
import {
    Save,
    Loader2,
    MapPin,
    FileText,
    Plus,
    X,
    Hash,
    Shuffle,
    User,
    Search,
    Layers
} from 'lucide-react';
import { validateTextField } from '@/utils/validation';

interface CreateResourceFormProps {
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string) => void;
    onTitleChange?: (title: string) => void;
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
    padding: '20px',
    background: 'var(--background-color)',
    borderRadius: '12px',
    border: '1px solid var(--border-light)',
    marginBottom: '20px'
};


const generateSerialNumber = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = [4, 4, 4];
    return segments.map(len =>
        Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    ).join('-');
};

const CreateResourceForm: React.FC<CreateResourceFormProps> = ({
    onClose,
    onSaved,
    onTitleChange
}) => {
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [resourceTypeId, setResourceTypeId] = useState('');
    const [resourceTypes, setResourceTypes] = useState<ResourceTypeItem[]>([]);
    const [loadingTypes, setLoadingTypes] = useState(false);
    const [location, setLocation] = useState('');
    const [managedBy, setManagedBy] = useState(user?.email || '');
    const [selectedManagerName, setSelectedManagerName] = useState(user ? user.name : '');
    const [searchTerm, setSearchTerm] = useState('');
    const [showUserList, setShowUserList] = useState(false);
    const [directors, setDirectors] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [serialInput, setSerialInput] = useState('');
    const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const container = document.getElementById('manager-picker-container');
            if (container && !container.contains(event.target as Node)) {
                setShowUserList(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoadingUsers(true);
            try {
                const data = await userService.getAll();
                setDirectors(data);
            } catch (error) {
                console.error('Failed to load users:', error);
            } finally {
                setLoadingUsers(false);
            }
        };
        fetchUsers();
    }, []);

    useEffect(() => {
        const fetchTypes = async () => {
            setLoadingTypes(true);
            try {
                const data = await resourceTypeService.getAll();
                setResourceTypes(data);
                if (data.length > 0) setResourceTypeId(data[0].id);
            } catch (error) {
                console.error('Failed to load resource types:', error);
            } finally {
                setLoadingTypes(false);
            }
        };
        fetchTypes();
    }, []);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        e.currentTarget.style.borderColor = 'var(--accent-color)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)';
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.boxShadow = 'none';
    };

    const addSerial = (serial: string) => {
        const trimmed = serial.trim();
        if (!trimmed) return;
        if (serialNumbers.includes(trimmed)) {
            setErrors(prev => ({ ...prev, serial: 'This serial number already exists.' }));
            return;
        }
        setSerialNumbers(prev => [...prev, trimmed]);
        setSerialInput('');
        setErrors(prev => ({ ...prev, serial: '' }));
    };

    const handleAddManual = () => {
        addSerial(serialInput);
    };

    const handleAddRandom = () => {
        let serial = generateSerialNumber();
        while (serialNumbers.includes(serial)) {
            serial = generateSerialNumber();
        }
        setSerialNumbers(prev => [...prev, serial]);
        setErrors(prev => ({ ...prev, serial: '' }));
    };

    const handleRemoveSerial = (index: number) => {
        setSerialNumbers(prev => prev.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddManual();
        }
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) newErrors.name = 'Name is required.';
        else if (name.trim().length > 200) newErrors.name = 'Name must be under 200 characters.';
        else { const err = validateTextField(name, 'Name'); if (err) newErrors.name = err; }
        if (!resourceTypeId) newErrors.resourceTypeId = 'Please select a resource type.';
        if (!managedBy) newErrors.managedBy = 'Please select a manager.';
        if (serialNumbers.length === 0) newErrors.serial = 'At least one serial number is required.';
        const descErr = validateTextField(description, 'Description');
        if (descErr) newErrors.description = descErr;
        const locErr = validateTextField(location, 'Location');
        if (locErr) newErrors.location = locErr;
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;

        setSaving(true);
        try {
            const request: CreateResourceRequest = {
                name: name.trim(),
                description: description.trim() || undefined,
                resourceTypeId,
                location: location.trim() || undefined,
                managedByEmail: managedBy,
                modelSeriesList: serialNumbers
            };

            await resourceService.create(request);
            onSaved(true, 'Resource created successfully.');
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to create resource.';
            setErrors(prev => ({ ...prev, submit: msg }));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Panel Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Plus size={16} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Create New Resource
                        </h3>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            Add a new lab resource with serial numbers
                        </span>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                {/* Basic Info */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={12} /> Basic Information</div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Resource Name *</label>
                        <input
                            style={{ ...inputStyle, borderColor: errors.name ? '#ef4444' : undefined }}
                            value={name}
                            onChange={e => {
                                setName(e.target.value);
                                onTitleChange?.(e.target.value || 'New Resource');
                                setErrors(prev => ({ ...prev, name: validateTextField(e.target.value, 'Name', { required: true, maxLength: 200 }) }));
                            }}
                            placeholder="e.g. NVIDIA RTX 4090"
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                        {errors.name && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.name}</span>}
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}><User size={12} /> Managed By *</label>
                        <div style={{ position: 'relative' }} id="manager-picker-container">
                            <div
                                style={{
                                    ...inputStyle,
                                    padding: '0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    overflow: 'hidden',
                                    borderColor: errors.managedBy ? '#ef4444' : (showUserList ? 'var(--accent-color)' : undefined),
                                    boxShadow: showUserList ? '0 0 0 3px rgba(232,114,12,0.08)' : 'none'
                                }}
                            >
                                <div style={{ padding: '0 12px', color: 'var(--text-muted)' }}>
                                    <Search size={14} />
                                </div>
                                <input
                                    type="text"
                                    style={{
                                        border: 'none',
                                        outline: 'none',
                                        padding: '10px 0',
                                        fontSize: '0.85rem',
                                        width: '100%',
                                        background: 'transparent'
                                    }}
                                    placeholder={selectedManagerName || "Search for a manager..."}
                                    value={searchTerm}
                                    onChange={e => {
                                        setSearchTerm(e.target.value);
                                        setShowUserList(true);
                                    }}
                                    onFocus={() => setShowUserList(true)}
                                />
                                {(managedBy || searchTerm) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setManagedBy('');
                                            setSelectedManagerName('');
                                            setSearchTerm('');
                                        }}
                                        style={{
                                            padding: '8px',
                                            border: 'none',
                                            background: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--text-muted)'
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {showUserList && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        marginTop: '4px',
                                        background: '#fff',
                                        borderRadius: '10px',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                        border: '1px solid var(--border-color)',
                                        zIndex: 100,
                                        maxHeight: '200px',
                                        overflowY: 'auto'
                                    }}
                                    className="custom-scrollbar"
                                >
                                    {loadingUsers ? (
                                        <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            <Loader2 size={16} className="animate-spin" style={{ margin: '0 auto 4px' }} />
                                            <span>Loading users...</span>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Other users */}
                                            {directors
                                                .filter(dir => {
                                                    const dId = dir.userId || dir.id;
                                                    const dName = dir.fullName || dir.name || dir.userName || '';
                                                    return dId && (!searchTerm || dName.toLowerCase().includes(searchTerm.toLowerCase()));
                                                })
                                                .map(dir => {
                                                    const dId = dir.userId || dir.id;
                                                    const dName = dir.fullName || dir.name || dir.userName || 'Unknown User';
                                                    return (
                                                        <div
                                                            key={dId}
                                                            onClick={() => {
                                                                setManagedBy(dir.email || '');
                                                                setSelectedManagerName(dName);
                                                                setSearchTerm('');
                                                                setShowUserList(false);
                                                            }}
                                                            style={{
                                                                padding: '10px 14px',
                                                                cursor: 'pointer',
                                                                borderBottom: '1px solid var(--border-light)',
                                                                background: managedBy === dir.email ? 'var(--accent-bg)' : 'transparent',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '10px'
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = managedBy === dir.email ? 'var(--accent-bg)' : 'transparent'}
                                                        >
                                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#64748b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>
                                                                {dName.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{dName}</div>
                                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{dir.email || 'No email provided'}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            }

                                            {/* No results */}
                                            {directors.filter(dir => {
                                                const dId = dir.userId || dir.id;
                                                const dName = dir.fullName || dir.name || dir.userName || '';
                                                return dId && (!searchTerm || dName.toLowerCase().includes(searchTerm.toLowerCase()));
                                            }).length === 0 && (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                        No users found matching "{searchTerm}"
                                                    </div>
                                                )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        {errors.managedBy && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.managedBy}</span>}
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Description</label>
                        <textarea
                            style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' as const, ...(errors.description ? { borderColor: '#ef4444' } : {}) }}
                            value={description}
                            onChange={e => { setDescription(e.target.value); setErrors(prev => ({ ...prev, description: validateTextField(e.target.value, 'Description') })); }}
                            placeholder="Brief description of this resource..."
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                        {errors.description && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.description}</span>}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}><Layers size={12} /> Type *</label>
                            {loadingTypes ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    <Loader2 size={14} className="animate-spin" /> Loading types...
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {resourceTypes.map(rt => (
                                        <button
                                            key={rt.id}
                                            type="button"
                                            onClick={() => { setResourceTypeId(rt.id); setErrors(prev => ({ ...prev, resourceTypeId: '' })); }}
                                            style={{
                                                padding: '7px 10px',
                                                borderRadius: '8px',
                                                border: resourceTypeId === rt.id ? '2px solid var(--accent-color)' : '1.5px solid var(--border-color)',
                                                background: resourceTypeId === rt.id ? 'rgba(232,114,12,0.06)' : '#fff',
                                                color: resourceTypeId === rt.id ? 'var(--accent-color)' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                textAlign: 'left',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {rt.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {errors.resourceTypeId && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.resourceTypeId}</span>}
                        </div>

                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}><MapPin size={12} /> Location</label>
                            <input
                                style={{ ...inputStyle, ...(errors.location ? { borderColor: '#ef4444' } : {}) }}
                                value={location}
                                onChange={e => { setLocation(e.target.value); setErrors(prev => ({ ...prev, location: validateTextField(e.target.value, 'Location') })); }}
                                placeholder="e.g. Lab Room A3"
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                            />
                            {errors.location && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.location}</span>}
                        </div>
                    </div>
                </div>

                {/* Serial Numbers */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><Hash size={12} /> Serial Numbers *</div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px', marginTop: 0 }}>
                        Each serial number represents one unit of this resource.
                    </p>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            style={{ ...inputStyle, flex: 1 }}
                            value={serialInput}
                            onChange={e => setSerialInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Enter serial number..."
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                        <button
                            type="button"
                            onClick={handleAddManual}
                            disabled={!serialInput.trim()}
                            style={{
                                padding: '8px 14px',
                                borderRadius: '10px',
                                border: 'none',
                                background: serialInput.trim() ? 'var(--accent-color)' : '#e2e8f0',
                                color: serialInput.trim() ? '#fff' : '#94a3b8',
                                cursor: serialInput.trim() ? 'pointer' : 'not-allowed',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s',
                                flexShrink: 0
                            }}
                        >
                            <Plus size={14} /> Add
                        </button>
                        <button
                            type="button"
                            onClick={handleAddRandom}
                            style={{
                                padding: '8px 14px',
                                borderRadius: '10px',
                                border: '1.5px solid var(--border-color)',
                                background: '#fff',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s',
                                flexShrink: 0
                            }}
                        >
                            <Shuffle size={14} /> Random
                        </button>
                    </div>

                    {errors.serial && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginBottom: '8px', display: 'block' }}>{errors.serial}</span>}

                    {serialNumbers.length > 0 && (
                        <div style={{
                            background: '#fff',
                            borderRadius: '10px',
                            border: '1px solid var(--border-light)',
                            maxHeight: '200px',
                            overflowY: 'auto'
                        }} className="custom-scrollbar">
                            {serialNumbers.map((serial, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 12px',
                                        borderBottom: idx < serialNumbers.length - 1 ? '1px solid var(--border-light)' : 'none',
                                        fontSize: '0.82rem'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '6px',
                                            background: '#f1f5f9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.68rem',
                                            fontWeight: 700,
                                            color: '#64748b'
                                        }}>
                                            {idx + 1}
                                        </span>
                                        <code style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1e293b', letterSpacing: '0.5px' }}>
                                            {serial}
                                        </code>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSerial(idx)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#94a3b8',
                                            padding: '2px',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'color 0.2s'
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {errors.submit && (
                    <div style={{
                        padding: '12px 16px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '10px',
                        color: '#dc2626',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        marginBottom: '16px'
                    }}>
                        {errors.submit}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{
                paddingTop: '14px',
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: 'auto'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        padding: '8px 20px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: '#fff',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        padding: '8px 24px',
                        borderRadius: '10px',
                        border: 'none',
                        background: saving ? '#94a3b8' : 'var(--accent-color)',
                        color: '#fff',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: saving ? 'none' : '0 4px 12px rgba(232,114,12,0.25)'
                    }}
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Create Resource
                </button>
            </div>
        </div>
    );
};

export default CreateResourceForm;
