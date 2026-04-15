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
    Cpu,
    HardDrive,
    Box,
    Monitor,
    Package,
    AlertCircle,
    Minus,
    Plus,
    X
} from 'lucide-react';

interface BookingResourceFormProps {
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string) => void;
    onTitleChange?: (title: string) => void;
    cartItems: BookingCartItem[];
    onCartChange: (items: BookingCartItem[]) => void;
}

interface BookingCartItem {
    resourceId: string;
    quantity: number;
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1.5px solid var(--border-color)',
    fontSize: '0.82rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    background: '#fff'
};

const labelStyle: React.CSSProperties = {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.7px',
    marginBottom: '5px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
};

const sectionStyle: React.CSSProperties = {
    padding: '12px 14px',
    background: 'var(--background-color)',
    borderRadius: '10px',
    border: '1px solid var(--border-light)',
    marginBottom: '12px'
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

const getMinDatetime = () => formatDatetimeLocal(new Date());

const BookingResourceForm: React.FC<BookingResourceFormProps> = ({
    onClose,
    onSaved,
    onTitleChange,
    cartItems,
    onCartChange
}) => {
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState('');
    const [purpose, setPurpose] = useState('');
    // Per-item urgent: set of resourceIds marked urgent
    const [urgentIds, setUrgentIds] = useState<Set<string>>(new Set());

    const toggleUrgent = (resourceId: string) => {
        setUrgentIds(prev => {
            const next = new Set(prev);
            if (next.has(resourceId)) next.delete(resourceId);
            else next.add(resourceId);
            return next;
        });
    };

    const now = new Date();
    const defaultStart = new Date(now.getTime() + 3600000);
    const defaultEnd = new Date(now.getTime() + 3600000 * 3);

    const [startTime, setStartTime] = useState(formatDatetimeLocal(defaultStart));
    const [endTime, setEndTime] = useState(formatDatetimeLocal(defaultEnd));

    const [resources, setResources] = useState<Resource[]>([]);
    const [loadingResources, setLoadingResources] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => { loadResources(); }, []);

    const loadResources = async () => {
        setLoadingResources(true);
        try {
            const data = await resourceService.getAll(1, 200);
            setResources(data.items || []);
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

    const removeFromCart = (resourceId: string) => {
        onCartChange(cartItems.filter(i => i.resourceId !== resourceId));
    };

    const updateQty = (resourceId: string, delta: number) => {
        onCartChange(cartItems.map(item => {
            if (item.resourceId !== resourceId) return item;
            const res = resources.find(r => r.id === resourceId);
            const max = res?.availableQuantity ?? 99;
            return { ...item, quantity: Math.max(1, Math.min(max, item.quantity + delta)) };
        }));
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        const now = new Date();

        if (!title.trim()) newErrors.title = 'Title is required.';
        else if (title.trim().length > 300) newErrors.title = 'Title must be under 300 characters.';

        if (!purpose.trim()) newErrors.purpose = 'Purpose is required.';
        else if (purpose.trim().length > 2000) newErrors.purpose = 'Purpose must be under 2000 characters.';

        if (cartItems.length === 0) {
            newErrors.resources = 'Add at least one resource.';
        } else {
            for (const item of cartItems) {
                const res = resources.find(r => r.id === item.resourceId);
                if (res && item.quantity > res.availableQuantity) {
                    newErrors.resources = `"${res.name}" only has ${res.availableQuantity} unit(s) available.`;
                    break;
                }
            }
        }

        const start = new Date(startTime);
        const end = new Date(endTime);
        if (isNaN(start.getTime())) newErrors.startTime = 'Invalid start time.';
        else if (start.getTime() <= now.getTime()) newErrors.startTime = 'Start time must be in the future.';

        if (isNaN(end.getTime())) newErrors.endTime = 'Invalid end time.';
        else if (end.getTime() <= start.getTime()) newErrors.endTime = 'End time must be after start time.';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            const base = {
                title: title.trim(),
                purpose: purpose.trim(),
                startTime: new Date(startTime).toISOString(),
                endTime: new Date(endTime).toISOString(),
            };
            // Group items by urgent flag → send as separate requests so each
            // booking gets its own isUrgent value
            const urgentItems: typeof cartItems = [];
            const normalItems: typeof cartItems = [];
            for (const item of cartItems) {
                (urgentIds.has(item.resourceId) ? urgentItems : normalItems).push(item);
            }
            const toRequest = (items: typeof cartItems, urgent: boolean): CreateBookingRequest => ({
                ...base,
                isUrgent: urgent || undefined,
                items: items.map(item => {
                    const res = resources.find(r => r.id === item.resourceId);
                    const pickedIds = res?.ids?.slice(0, item.quantity) ?? [item.resourceId];
                    return { resourceIds: pickedIds };
                }),
            });
            const promises: Promise<any>[] = [];
            if (urgentItems.length > 0) promises.push(bookingService.create(toRequest(urgentItems, true)));
            if (normalItems.length > 0) promises.push(bookingService.create(toRequest(normalItems, false)));
            await Promise.all(promises);
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Calendar size={14} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            New Booking Request
                        </h3>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>You can add multiple resource types</span>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">

                {/* Schedule — first so user picks dates before resources */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><Clock size={12} /> Schedule</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Pickup Time *</label>
                            <input type="datetime-local"
                                style={{ ...inputStyle, borderColor: errors.startTime ? '#ef4444' : undefined }}
                                value={startTime} min={getMinDatetime()}
                                onChange={e => setStartTime(e.target.value)}
                                onFocus={handleFocus} onBlur={handleBlur}
                            />
                            {errors.startTime && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.startTime}</span>}
                        </div>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Return Time *</label>
                            <input type="datetime-local"
                                style={{ ...inputStyle, borderColor: errors.endTime ? '#ef4444' : undefined }}
                                value={endTime} min={startTime || getMinDatetime()}
                                onChange={e => setEndTime(e.target.value)}
                                onFocus={handleFocus} onBlur={handleBlur}
                            />
                            {errors.endTime && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.endTime}</span>}
                        </div>
                    </div>
                    {startTime && endTime && new Date(endTime) > new Date(startTime) && (
                        <div style={{ marginTop: '10px', padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 600 }}>
                            Duration: {(() => {
                                const diff = new Date(endTime).getTime() - new Date(startTime).getTime();
                                const hours = Math.floor(diff / 3600000);
                                const minutes = Math.floor((diff % 3600000) / 60000);
                                return `${hours}h ${minutes}m`;
                            })()}
                        </div>
                    )}
                </div>

                {/* Booking Details */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={12} /> Booking Details</div>
                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Title *</label>
                        <input
                            style={{ ...inputStyle, borderColor: errors.title ? '#ef4444' : undefined }}
                            value={title}
                            onChange={e => { setTitle(e.target.value); onTitleChange?.(e.target.value || 'New Booking'); }}
                            placeholder="e.g. GPU Training Session"
                            onFocus={handleFocus} onBlur={handleBlur}
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
                            onFocus={handleFocus} onBlur={handleBlur}
                        />
                        {errors.purpose && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.purpose}</span>}
                    </div>
                </div>

                {/* Resources — single unified list with inline qty stepper */}
                <div style={sectionStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={labelStyle}><Package size={11} /> Resources *</div>
                        {cartItems.length > 0 && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1px 8px', borderRadius: '20px' }}>
                                {cartItems.length} type{cartItems.length !== 1 ? 's' : ''} · {cartItems.reduce((t, i) => t + i.quantity, 0)} unit{cartItems.reduce((t, i) => t + i.quantity, 0) !== 1 ? 's' : ''} selected
                            </span>
                        )}
                    </div>

                    {errors.resources && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '7px', fontSize: '0.68rem', color: '#ef4444', fontWeight: 600 }}>
                            <AlertCircle size={11} /> {errors.resources}
                        </div>
                    )}

                    {cartItems.length === 0 ? (
                        <div style={{ padding: '14px 0', textAlign: 'center' as const, color: '#94a3b8', fontSize: '0.74rem' }}>
                            Click <strong style={{ color: 'var(--accent-color, #f97316)' }}>+</strong> on any resource from the list to add it here.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {cartItems.map(item => {
                                const res = resources.find(r => r.id === item.resourceId);
                                const qty = item.quantity;
                                const maxQty = res?.availableQuantity ?? 99;
                                const urgent = urgentIds.has(item.resourceId);
                                return (
                                    <div key={item.resourceId} style={{
                                        borderRadius: '9px',
                                        border: urgent ? '1.5px solid #fecaca' : '1.5px solid #e2e8f0',
                                        background: urgent ? '#fff9f9' : '#fff',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                        overflow: 'hidden'
                                    }}>
                                        {/* Main row */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px' }}>
                                            <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', flexShrink: 0 }}>
                                                {res ? getResourceIcon(res.type) : <Package size={13} />}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                                        {res?.name ?? item.resourceId}
                                                    </span>
                                                    {urgent && (
                                                        <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '0 5px', borderRadius: '5px', flexShrink: 0 }}>
                                                            Urgent
                                                        </span>
                                                    )}
                                                </div>
                                                {res && (
                                                    <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '1px' }}>
                                                        {getResourceTypeLabel(res.type)}{res.location ? ` · ${res.location}` : ''}
                                                    </div>
                                                )}
                                            </div>
                                            {res && (
                                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: res.availableQuantity > 0 ? '#059669' : '#dc2626', background: res.availableQuantity > 0 ? '#ecfdf5' : '#fef2f2', border: `1px solid ${res.availableQuantity > 0 ? '#a7f3d0' : '#fecaca'}`, padding: '1px 6px', borderRadius: '5px', flexShrink: 0 }}>
                                                    {res.availableQuantity}/{res.totalQuantity}
                                                </span>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                                                <button type="button" onClick={() => qty <= 1 ? removeFromCart(item.resourceId) : updateQty(item.resourceId, -1)}
                                                    style={{ width: '22px', height: '22px', borderRadius: '6px', border: qty <= 1 ? '1px solid #fecaca' : '1px solid #e2e8f0', background: qty <= 1 ? '#fef2f2' : '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: qty <= 1 ? '#dc2626' : '#475569' }}>
                                                    {qty <= 1 ? <X size={9} /> : <Minus size={9} />}
                                                </button>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 800, minWidth: '20px', textAlign: 'center' as const, color: '#0f172a' }}>{qty}</span>
                                                <button type="button" onClick={() => updateQty(item.resourceId, +1)} disabled={qty >= maxQty}
                                                    style={{ width: '22px', height: '22px', borderRadius: '6px', border: '1px solid #e2e8f0', background: qty >= maxQty ? '#f8fafc' : '#fff', cursor: qty >= maxQty ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: qty >= maxQty ? '#cbd5e1' : '#475569' }}>
                                                    <Plus size={9} />
                                                </button>
                                            </div>
                                        </div>
                                        {/* Urgent toggle row */}
                                        <label style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '4px 10px 6px',
                                            borderTop: urgent ? '1px dashed #fecaca' : '1px dashed #e2e8f0',
                                            cursor: 'pointer', userSelect: 'none' as const,
                                            background: urgent ? '#fef2f2' : '#f8fafc'
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={urgent}
                                                onChange={() => toggleUrgent(item.resourceId)}
                                                style={{ width: '13px', height: '13px', accentColor: '#dc2626', cursor: 'pointer' }}
                                            />
                                            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: urgent ? '#dc2626' : '#94a3b8' }}>
                                                Mark as urgent
                                            </span>
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {errors.submit && (
                    <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#dc2626', fontSize: '0.82rem', fontWeight: 600, marginBottom: '16px' }}>
                        {errors.submit}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: 'auto' }}>
                <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: '10px', border: '1px solid var(--border-color)', background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s' }}>
                    Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                    style={{ padding: '8px 24px', borderRadius: '10px', border: 'none', background: saving ? '#94a3b8' : 'var(--accent-color)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', boxShadow: saving ? 'none' : '0 4px 12px rgba(232,114,12,0.25)' }}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Submit Booking
                </button>
            </div>
        </div>
    );
};

export default BookingResourceForm;
