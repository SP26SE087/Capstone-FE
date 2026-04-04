import React, { useState, useEffect } from 'react';
import { Resource, ResourceType, CreateBookingRequest } from '@/types/booking';
import { resourceService } from '@/services/resourceService';
import { bookingService } from '@/services/bookingService';
import {
    Save,
    Loader2,
    Calendar,
    Clock,
    FileText,
    Search,
    Cpu,
    HardDrive,
    Box,
    Monitor,
    Package,
    AlertCircle,
    Minus,
    Plus
} from 'lucide-react';

interface BookingResourceFormProps {
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string) => void;
    onTitleChange?: (title: string) => void;
    preSelectedResource?: Resource | null;
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

const padTwo = (n: number) => String(n).padStart(2, '0');

const formatDatetimeLocal = (d: Date): string => {
    return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}T${padTwo(d.getHours())}:${padTwo(d.getMinutes())}`;
};

const getMinDatetime = () => {
    const now = new Date();
    return formatDatetimeLocal(now);
};

const BookingResourceForm: React.FC<BookingResourceFormProps> = ({
    onClose,
    onSaved,
    onTitleChange,
    preSelectedResource
}) => {
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState('');
    const [purpose, setPurpose] = useState('');

    const now = new Date();
    const defaultStart = new Date(now.getTime() + 3600000); // +1 hour
    const defaultEnd = new Date(now.getTime() + 3600000 * 3); // +3 hours

    const [startTime, setStartTime] = useState(formatDatetimeLocal(defaultStart));
    const [endTime, setEndTime] = useState(formatDatetimeLocal(defaultEnd));

    const [resources, setResources] = useState<Resource[]>([]);
    const [selectedResourceId, setSelectedResourceId] = useState<string>(
        preSelectedResource ? preSelectedResource.id : ''
    );
    const [quantity, setQuantity] = useState(1);
    const [resourceSearch, setResourceSearch] = useState('');
    const [loadingResources, setLoadingResources] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        loadResources();
    }, []);

    const loadResources = async () => {
        setLoadingResources(true);
        try {
            const data = await resourceService.getAll(1, 200);
            const items = data.items || [];
            setResources(items);
        } catch (err) {
            console.error('Failed to load resources:', err);
        } finally {
            setLoadingResources(false);
        }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.currentTarget.style.borderColor = 'var(--accent-color)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)';
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.boxShadow = 'none';
    };

    const selectResource = (id: string) => {
        setSelectedResourceId(id);
        setQuantity(1);
        setErrors(prev => ({ ...prev, resources: '' }));
    };

    const filteredResources = resources.filter(r => {
        const q = resourceSearch.toLowerCase();
        return !q || r.name.toLowerCase().includes(q) || getResourceTypeLabel(r.type).toLowerCase().includes(q);
    });

    const selectedResource = resources.find(r => r.id === selectedResourceId);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        const now = new Date();

        if (!title.trim()) newErrors.title = 'Title is required.';
        if (title.trim().length > 300) newErrors.title = 'Title must be under 300 characters.';
        if (!purpose.trim()) newErrors.purpose = 'Purpose is required.';
        if (purpose.trim().length > 2000) newErrors.purpose = 'Purpose must be under 2000 characters.';

        if (!selectedResourceId) {
            newErrors.resources = 'Select a resource.';
        } else if (selectedResource && quantity > selectedResource.availableQuantity) {
            newErrors.resources = `Only ${selectedResource.availableQuantity} unit(s) available.`;
        } else if (quantity < 1) {
            newErrors.resources = 'Quantity must be at least 1.';
        }

        const start = new Date(startTime);
        const end = new Date(endTime);

        if (isNaN(start.getTime())) newErrors.startTime = 'Invalid start time.';
        if (isNaN(end.getTime())) newErrors.endTime = 'Invalid end time.';

        if (start.getTime() <= now.getTime()) {
            newErrors.startTime = 'Start time must be in the future.';
        }

        if (end.getTime() <= start.getTime()) {
            newErrors.endTime = 'End time must be after start time.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;

        setSaving(true);
        try {
            // Pick `quantity` unit IDs from the selected resource group
            const pickedIds = selectedResource?.ids?.slice(0, quantity) || [selectedResourceId];

            const request: CreateBookingRequest = {
                resourceIds: pickedIds,
                title: title.trim(),
                purpose: purpose.trim(),
                startTime: new Date(startTime).toISOString(),
                endTime: new Date(endTime).toISOString()
            };

            await bookingService.create(request);
            onSaved(true, 'Booking request submitted successfully.');
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to create booking.';
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
                        background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Calendar size={16} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Book Resources
                        </h3>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            Reserve lab resources for your research
                        </span>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                {/* Booking Details */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={12} /> Booking Details</div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Title *</label>
                        <input
                            style={{ ...inputStyle, borderColor: errors.title ? '#ef4444' : undefined }}
                            value={title}
                            onChange={e => {
                                setTitle(e.target.value);
                                onTitleChange?.(e.target.value || 'New Booking');
                            }}
                            placeholder="e.g. GPU Training Session"
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                        {errors.title && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.title}</span>}
                    </div>

                    <div>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Purpose *</label>
                        <textarea
                            style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' as const, borderColor: errors.purpose ? '#ef4444' : undefined }}
                            value={purpose}
                            onChange={e => setPurpose(e.target.value)}
                            placeholder="Describe what you'll use these resources for..."
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                        {errors.purpose && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.purpose}</span>}
                    </div>
                </div>

                {/* Schedule */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><Clock size={12} /> Schedule</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Pickup Time *</label>
                            <input
                                type="datetime-local"
                                style={{ ...inputStyle, borderColor: errors.startTime ? '#ef4444' : undefined }}
                                value={startTime}
                                min={getMinDatetime()}
                                onChange={e => setStartTime(e.target.value)}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                            />
                            {errors.startTime && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.startTime}</span>}
                        </div>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Return Time *</label>
                            <input
                                type="datetime-local"
                                style={{ ...inputStyle, borderColor: errors.endTime ? '#ef4444' : undefined }}
                                value={endTime}
                                min={startTime || getMinDatetime()}
                                onChange={e => setEndTime(e.target.value)}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                            />
                            {errors.endTime && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.endTime}</span>}
                        </div>
                    </div>

                    {startTime && endTime && new Date(endTime) > new Date(startTime) && (
                        <div style={{
                            marginTop: '10px',
                            padding: '8px 12px',
                            background: '#eff6ff',
                            borderRadius: '8px',
                            border: '1px solid #bfdbfe',
                            fontSize: '0.78rem',
                            color: '#1d4ed8',
                            fontWeight: 600
                        }}>
                            Duration: {(() => {
                                const diff = new Date(endTime).getTime() - new Date(startTime).getTime();
                                const hours = Math.floor(diff / 3600000);
                                const minutes = Math.floor((diff % 3600000) / 60000);
                                return `${hours}h ${minutes}m`;
                            })()}
                        </div>
                    )}
                </div>

                {/* Resource Selection */}
                <div style={sectionStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={labelStyle}><Package size={12} /> Select Resource *</div>
                    </div>

                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: '10px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            style={{ ...inputStyle, paddingLeft: '34px', fontSize: '0.8rem' }}
                            value={resourceSearch}
                            onChange={e => setResourceSearch(e.target.value)}
                            placeholder="Search resources..."
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                    </div>

                    {errors.resources && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.72rem', color: '#ef4444' }}>
                            <AlertCircle size={12} /> {errors.resources}
                        </div>
                    )}

                    {/* Resource List */}
                    {loadingResources ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
                        </div>
                    ) : (
                        <div style={{
                            maxHeight: '240px',
                            overflowY: 'auto',
                            background: '#fff',
                            borderRadius: '10px',
                            border: '1px solid var(--border-light)'
                        }} className="custom-scrollbar">
                            {filteredResources.length === 0 ? (
                                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                                    No resources found.
                                </div>
                            ) : filteredResources.map(resource => {
                                const isSelected = selectedResourceId === resource.id;
                                const isAvailable = resource.availableQuantity > 0;

                                return (
                                    <div
                                        key={resource.id}
                                        onClick={() => isAvailable && selectResource(resource.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '10px 12px',
                                            borderBottom: '1px solid var(--border-light)',
                                            cursor: isAvailable ? 'pointer' : 'not-allowed',
                                            background: isSelected ? 'rgba(232,114,12,0.06)' : 'transparent',
                                            opacity: isAvailable ? 1 : 0.5,
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        {/* Radio indicator */}
                                        <div style={{
                                            width: '16px',
                                            height: '16px',
                                            borderRadius: '50%',
                                            border: `2px solid ${isSelected ? 'var(--accent-color)' : '#cbd5e1'}`,
                                            background: isSelected ? 'var(--accent-color)' : 'transparent',
                                            flexShrink: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
                                        </div>

                                        <div style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '8px',
                                            background: '#f1f5f9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#64748b',
                                            flexShrink: 0
                                        }}>
                                            {getResourceIcon(resource.type)}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {resource.name}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                {getResourceTypeLabel(resource.type)} {resource.location ? `· ${resource.location}` : ''}
                                            </div>
                                        </div>

                                        <span style={{
                                            fontSize: '0.68rem',
                                            fontWeight: 700,
                                            color: isAvailable ? '#059669' : '#dc2626',
                                            background: isAvailable ? '#ecfdf5' : '#fef2f2',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            flexShrink: 0
                                        }}>
                                            {isAvailable ? `${resource.availableQuantity} avail` : 'Unavailable'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Quantity selector - shown only when a resource is selected */}
                    {selectedResource && (
                        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                Quantity
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                    style={{
                                        width: '28px', height: '28px', borderRadius: '8px',
                                        border: '1.5px solid var(--border-color)',
                                        background: '#fff', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    <Minus size={12} />
                                </button>
                                <span style={{ fontSize: '0.9rem', fontWeight: 800, minWidth: '24px', textAlign: 'center', color: 'var(--text-primary)' }}>
                                    {quantity}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setQuantity(q => Math.min(selectedResource.availableQuantity, q + 1))}
                                    style={{
                                        width: '28px', height: '28px', borderRadius: '8px',
                                        border: '1.5px solid var(--border-color)',
                                        background: '#fff', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    <Plus size={12} />
                                </button>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                                    / {selectedResource.availableQuantity} available
                                </span>
                            </div>
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
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        transition: 'all 0.2s'
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
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        boxShadow: saving ? 'none' : '0 4px 12px rgba(232,114,12,0.25)'
                    }}
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Submit Booking
                </button>
            </div>
        </div>
    );
};

export default BookingResourceForm;
