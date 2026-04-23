import React, { useState, useEffect, useMemo } from 'react';
import { Resource, ResourceType, CreateBookingRequest, Booking, BookingStatus } from '@/types/booking';
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
    X,
    Search,
    MapPin,
    Zap,
} from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const padTwo = (n: number) => String(n).padStart(2, '0');

const fmtLocal = (d: Date): string =>
    `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}T${padTwo(d.getHours())}:${padTwo(d.getMinutes())}`;

const fmtDuration = (start: string, end: string): string => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (diff <= 0) return '';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
};

const fmtDisplayShort = (iso: string): string => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${padTwo(d.getHours())}:${padTwo(d.getMinutes())}`;
};

/**
 * Compute how many units of a resource group are free during [start, end].
 * Cross-references existing bookings client-side so the form always reflects
 * the real situation — not just the "currently available" snapshot from the API.
 */
function computeAvailableForWindow(
    resource: Resource,
    start: string,
    end: string,
    allBookings: Booking[],
): number {
    if (!resource.ids?.length) return resource.availableQuantity;
    if (!start || !end) return resource.availableQuantity;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(s) || isNaN(e) || e <= s) return resource.availableQuantity;

    const unitIds = new Set(resource.ids);
    const bookedIds = new Set<string>();

    for (const b of allBookings) {
        if (
            b.status === BookingStatus.Rejected ||
            b.status === BookingStatus.Cancelled ||
            b.status === BookingStatus.Completed
        ) continue;

        const bs = new Date(b.startTime).getTime();
        const be = new Date(b.endTime).getTime();
        if (be <= s || bs >= e) continue; // no overlap

        for (const id of (b.resourceIds ?? (b.resourceId ? [b.resourceId] : []))) {
            if (unitIds.has(id)) bookedIds.add(id);
        }
    }

    return Math.max(0, resource.ids.length - bookedIds.size);
}

// ─── Icons & labels ───────────────────────────────────────────────────────────
const RT_ICON: Record<number, React.ReactNode> = {
    [ResourceType.GPU]:       <Cpu size={13} />,
    [ResourceType.Equipment]: <HardDrive size={13} />,
    [ResourceType.Dataset]:   <Box size={13} />,
    [ResourceType.LabStation]:<Monitor size={13} />,
    [ResourceType.Compute]:   <Zap size={13} />,
};
const RT_LABEL: Record<number, string> = {
    [ResourceType.GPU]:       'GPU',
    [ResourceType.Equipment]: 'Equipment',
    [ResourceType.Dataset]:   'Dataset',
    [ResourceType.LabStation]:'Lab Station',
    [ResourceType.Compute]:   'Compute',
};

// ─── Style constants ──────────────────────────────────────────────────────────
const baseInput: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 8,
    border: '1.5px solid var(--border-color)', fontSize: '0.8rem',
    fontWeight: 500, fontFamily: 'inherit', outline: 'none',
    background: '#fff', transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
};
const sectionStyle: React.CSSProperties = {
    padding: '10px 12px', background: 'var(--background-color)',
    borderRadius: 10, border: '1px solid var(--border-light)',
};
const sectionLabel: React.CSSProperties = {
    fontSize: '0.62rem', fontWeight: 800, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.7px',
    display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8,
};
const fieldLabel: React.CSSProperties = {
    fontSize: '0.63rem', fontWeight: 800, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.6px',
    marginBottom: 3, display: 'flex', alignItems: 'center', gap: 3,
};
const errText: React.CSSProperties = {
    fontSize: '0.68rem', color: '#ef4444', marginTop: 3,
    display: 'block', fontWeight: 600,
};

const focusIn  = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = 'var(--accent-color)';
    e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(232,114,12,0.08)';
};
const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>, hasErr?: boolean) => {
    e.currentTarget.style.borderColor = hasErr ? '#ef4444' : 'var(--border-color)';
    e.currentTarget.style.boxShadow   = 'none';
};

// ─── Component ────────────────────────────────────────────────────────────────
const BookingResourceForm: React.FC<BookingResourceFormProps> = ({
    onClose, onSaved, onTitleChange, cartItems, onCartChange,
}) => {
    const now         = new Date();
    const defaultStart = new Date(now.getTime() + 3600000);      // +1h
    const defaultEnd   = new Date(now.getTime() + 3600000 * 3);  // +3h

    // ── State ─────────────────────────────────────────────────────────────────
    const [title,     setTitle]     = useState('');
    const [purpose,   setPurpose]   = useState('');
    const [isUrgent,  setIsUrgent]  = useState(false);
    const [startTime, setStartTime] = useState(fmtLocal(defaultStart));
    const [endTime,   setEndTime]   = useState(fmtLocal(defaultEnd));
    const [search,    setSearch]    = useState('');

    const [resources,   setResources]   = useState<Resource[]>([]);
    const [allBookings, setAllBookings] = useState<Booking[]>([]);
    const [loading,     setLoading]     = useState(false);
    const [saving,      setSaving]      = useState(false);
    const [errors,      setErrors]      = useState<Record<string, string>>({});

    // ── Load resources + all bookings once ───────────────────────────────────
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [resItems, allBk] = await Promise.all([
                    resourceService.getAllPages(),
                    bookingService.getAllPages(),
                ]);
                setResources(resItems);
                setAllBookings(allBk);
            } catch (err) {
                console.error('BookingResourceForm: failed to load data', err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // ── Derived: per-resource availability for the selected window ────────────
    const availMap = useMemo(() => {
        const m = new Map<string, number>();
        for (const r of resources) {
            m.set(r.id, computeAvailableForWindow(r, startTime, endTime, allBookings));
        }
        return m;
    }, [resources, allBookings, startTime, endTime]);

    // ── Derived: filtered resource list ──────────────────────────────────────
    const filteredResources = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return resources;
        return resources.filter(r =>
            r.name.toLowerCase().includes(q) ||
            (r.resourceTypeName ?? '').toLowerCase().includes(q) ||
            (r.location ?? '').toLowerCase().includes(q),
        );
    }, [resources, search]);

    // ── Cart helpers ──────────────────────────────────────────────────────────
    const cartMap = useMemo(() => {
        const m = new Map<string, number>();
        for (const i of cartItems) m.set(i.resourceId, i.quantity);
        return m;
    }, [cartItems]);

    const addToCart = (resourceId: string) => {
        if (cartMap.has(resourceId)) return;
        onCartChange([...cartItems, { resourceId, quantity: 1 }]);
    };
    const removeFromCart = (resourceId: string) => {
        onCartChange(cartItems.filter(i => i.resourceId !== resourceId));
    };
    const updateQty = (resourceId: string, delta: number) => {
        onCartChange(cartItems.map(item => {
            if (item.resourceId !== resourceId) return item;
            const avail = availMap.get(resourceId) ?? 99;
            return { ...item, quantity: Math.max(1, Math.min(avail, item.quantity + delta)) };
        }));
    };

    // ── Validation ────────────────────────────────────────────────────────────
    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        const now = new Date();
        if (!title.trim())                       errs.title   = 'Title is required.';
        else if (title.trim().length > 300)      errs.title   = 'Max 300 characters.';
        if (!purpose.trim())                     errs.purpose = 'Purpose is required.';
        else if (purpose.trim().length > 2000)   errs.purpose = 'Max 2000 characters.';
        if (cartItems.length === 0)              errs.resources = 'Select at least one resource.';
        else {
            for (const item of cartItems) {
                const avail = availMap.get(item.resourceId) ?? 0;
                const res   = resources.find(r => r.id === item.resourceId);
                if (item.quantity > avail) {
                    errs.resources = `"${res?.name ?? item.resourceId}" only has ${avail} unit(s) free in this window.`;
                    break;
                }
            }
        }
        const s = new Date(startTime);
        const e = new Date(endTime);
        if (isNaN(s.getTime()))              errs.startTime = 'Invalid start time.';
        else if (s.getTime() <= now.getTime()) errs.startTime = 'Start time must be in the future.';
        if (isNaN(e.getTime()))              errs.endTime   = 'Invalid end time.';
        else if (e.getTime() <= s.getTime()) errs.endTime   = 'End time must be after start.';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            const request: CreateBookingRequest = {
                title:    title.trim(),
                purpose:  purpose.trim(),
                startTime: new Date(startTime).toISOString(),
                endTime:   new Date(endTime).toISOString(),
                isUrgent:  isUrgent || undefined,
                items: cartItems.map(item => {
                    const res    = resources.find(r => r.id === item.resourceId);
                    const pool   = res?.availableIds?.length ? res.availableIds : (res?.ids ?? [item.resourceId]);
                    const picked = pool.slice(0, item.quantity);
                    return { resourceIds: picked.length > 0 ? picked : [item.resourceId] };
                }),
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

    // ── Render ────────────────────────────────────────────────────────────────
    const isTimeValid = !!(startTime && endTime && new Date(endTime) > new Date(startTime));
    const duration    = isTimeValid ? fmtDuration(startTime, endTime) : '';
    const totalUnits  = cartItems.reduce((t, i) => t + i.quantity, 0);
    const minDt       = fmtLocal(new Date());

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Calendar size={14} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        New Booking Request
                    </h3>
                    <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)' }}>
                        Pick a time window — availability updates automatically
                    </span>
                </div>
            </div>

            {/* ── Scrollable body ──────────────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2, display: 'flex', flexDirection: 'column', gap: 8 }} className="custom-scrollbar">

                {/* ── 1. SCHEDULE ────────────────────────────────────────────── */}
                <div style={sectionStyle}>
                    <div style={sectionLabel}><Clock size={11} /> When?</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                            <label style={fieldLabel}>Pickup *</label>
                            <input
                                type="datetime-local"
                                style={{ ...baseInput, borderColor: errors.startTime ? '#ef4444' : undefined }}
                                value={startTime} min={minDt}
                                onChange={e => setStartTime(e.target.value)}
                                onFocus={focusIn}
                                onBlur={e => focusOut(e, !!errors.startTime)}
                            />
                            {errors.startTime && <span style={errText}>{errors.startTime}</span>}
                        </div>
                        <div>
                            <label style={fieldLabel}>Return *</label>
                            <input
                                type="datetime-local"
                                style={{ ...baseInput, borderColor: errors.endTime ? '#ef4444' : undefined }}
                                value={endTime} min={startTime || minDt}
                                onChange={e => setEndTime(e.target.value)}
                                onFocus={focusIn}
                                onBlur={e => focusOut(e, !!errors.endTime)}
                            />
                            {errors.endTime && <span style={errText}>{errors.endTime}</span>}
                        </div>
                    </div>
                    {duration && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#eff6ff', borderRadius: 7, border: '1px solid #bfdbfe', fontSize: '0.73rem', color: '#1d4ed8', fontWeight: 700 }}>
                            <Clock size={11} />
                            <span>{duration}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '0.63rem', fontWeight: 600, color: '#3b82f6', fontVariantNumeric: 'tabular-nums' }}>
                                {fmtDisplayShort(startTime)} → {fmtDisplayShort(endTime)}
                            </span>
                        </div>
                    )}
                </div>

                {/* ── 2. RESOURCE AVAILABILITY GRID ──────────────────────────── */}
                <div style={sectionStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={sectionLabel}>
                            <Package size={11} />
                            Resources
                            {isTimeValid && (
                                <span style={{ fontWeight: 500, color: '#94a3b8', fontSize: '0.59rem', marginLeft: 2 }}>
                                    — for selected window
                                </span>
                            )}
                        </div>
                        {cartItems.length > 0 && (
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1px 8px', borderRadius: 20, flexShrink: 0 }}>
                                {cartItems.length} type{cartItems.length !== 1 ? 's' : ''} · {totalUnits} unit{totalUnits !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: 7 }}>
                        <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                        <input
                            style={{ ...baseInput, paddingLeft: 28, fontSize: '0.75rem' }}
                            placeholder="Filter by name, type, location…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch('')}
                                style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}>
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {errors.resources && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7, fontSize: '0.67rem', color: '#ef4444', fontWeight: 600 }}>
                            <AlertCircle size={11} /> {errors.resources}
                        </div>
                    )}

                    {/* Cards */}
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px 0', color: '#94a3b8', fontSize: '0.75rem' }}>
                            <Loader2 size={15} className="animate-spin" /> Loading resources…
                        </div>
                    ) : filteredResources.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: '0.75rem' }}>
                            {search ? 'No resources match your filter.' : 'No resources available.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {filteredResources.map(resource => {
                                const avail       = availMap.get(resource.id) ?? 0;
                                const total       = resource.ids?.length || resource.totalQuantity || 1;
                                const inCart      = cartMap.has(resource.id);
                                const cartQty     = cartMap.get(resource.id) ?? 0;
                                const fullyBooked = avail === 0;
                                const freeRatio   = total > 0 ? avail / total : 0;
                                const barColor    = fullyBooked ? '#ef4444' : freeRatio < 0.5 ? '#f59e0b' : '#10b981';

                                return (
                                    <div key={resource.id} style={{
                                        borderRadius: 9,
                                        border: inCart ? '1.5px solid #6366f1' : '1.5px solid #e2e8f0',
                                        background: inCart ? '#f8f7ff' : fullyBooked ? '#fafafa' : '#fff',
                                        opacity: fullyBooked && !inCart ? 0.55 : 1,
                                        transition: 'border-color 0.15s, background 0.15s',
                                    }}>
                                        {/* Top row */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 4px' }}>
                                            <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: inCart ? '#e0e7ff' : '#f1f5f9', color: inCart ? '#4f46e5' : fullyBooked ? '#94a3b8' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {RT_ICON[resource.type] ?? <Package size={13} />}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: fullyBooked ? '#94a3b8' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {resource.name}
                                                    </span>
                                                    {inCart && (
                                                        <span style={{ fontSize: '0.57rem', fontWeight: 700, color: '#4f46e5', background: '#e0e7ff', border: '1px solid #c7d2fe', padding: '0 4px', borderRadius: 4, flexShrink: 0 }}>
                                                            ✓ Added
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                                                    <span style={{ fontSize: '0.62rem', color: '#64748b' }}>
                                                        {RT_LABEL[resource.type] ?? 'Resource'}
                                                    </span>
                                                    {resource.location && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.62rem', color: '#94a3b8' }}>
                                                            <MapPin size={9} /> {resource.location}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Avail count */}
                                            <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 48 }}>
                                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: fullyBooked ? '#ef4444' : '#059669', lineHeight: 1 }}>
                                                    {avail}/{total}
                                                </div>
                                                <div style={{ fontSize: '0.58rem', color: '#94a3b8', fontWeight: 600, marginTop: 1 }}>
                                                    {isTimeValid ? 'free' : 'now'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom row: bar + controls */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 10px 7px' }}>
                                            <div style={{ flex: 1, height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', background: barColor, borderRadius: 99, width: `${freeRatio * 100}%`, transition: 'width 0.35s ease, background 0.35s ease' }} />
                                            </div>

                                            {fullyBooked && !inCart ? (
                                                <span style={{ fontSize: '0.62rem', color: '#ef4444', fontWeight: 700, flexShrink: 0 }}>
                                                    Fully booked
                                                </span>
                                            ) : inCart ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                                                    <button type="button"
                                                        onClick={() => cartQty <= 1 ? removeFromCart(resource.id) : updateQty(resource.id, -1)}
                                                        style={{ width: 22, height: 22, borderRadius: 6, border: cartQty <= 1 ? '1px solid #fecaca' : '1px solid #e2e8f0', background: cartQty <= 1 ? '#fef2f2' : '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: cartQty <= 1 ? '#dc2626' : '#475569' }}>
                                                        {cartQty <= 1 ? <X size={9} /> : <Minus size={9} />}
                                                    </button>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, minWidth: 18, textAlign: 'center', color: '#0f172a' }}>
                                                        {cartQty}
                                                    </span>
                                                    <button type="button"
                                                        onClick={() => updateQty(resource.id, +1)}
                                                        disabled={cartQty >= avail}
                                                        style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #e2e8f0', background: cartQty >= avail ? '#f8fafc' : '#fff', cursor: cartQty >= avail ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: cartQty >= avail ? '#cbd5e1' : '#475569' }}>
                                                        <Plus size={9} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button type="button"
                                                    onClick={() => addToCart(resource.id)}
                                                    style={{ height: 22, padding: '0 10px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <Plus size={9} /> Add
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── 3. DETAILS ─────────────────────────────────────────────── */}
                <div style={sectionStyle}>
                    <div style={sectionLabel}><FileText size={11} /> Booking Details</div>

                    <div style={{ marginBottom: 10 }}>
                        <label style={fieldLabel}>Title *</label>
                        <input
                            style={{ ...baseInput, borderColor: errors.title ? '#ef4444' : undefined }}
                            value={title}
                            onChange={e => { setTitle(e.target.value); onTitleChange?.(e.target.value || 'New Booking'); }}
                            placeholder="e.g. GPU Training Session"
                            onFocus={focusIn}
                            onBlur={e => focusOut(e, !!errors.title)}
                        />
                        {errors.title && <span style={errText}>{errors.title}</span>}
                    </div>

                    <div style={{ marginBottom: 10 }}>
                        <label style={fieldLabel}>Purpose *</label>
                        <textarea
                            style={{ ...baseInput, minHeight: 64, resize: 'vertical', borderColor: errors.purpose ? '#ef4444' : undefined }}
                            value={purpose}
                            onChange={e => setPurpose(e.target.value)}
                            placeholder="Describe what you'll use these resources for…"
                            onFocus={focusIn}
                            onBlur={e => focusOut(e, !!errors.purpose)}
                        />
                        {errors.purpose && <span style={errText}>{errors.purpose}</span>}
                    </div>

                    {/* Urgent toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none', padding: '6px 9px', borderRadius: 8, border: isUrgent ? '1.5px solid #fca5a5' : '1.5px solid #e2e8f0', background: isUrgent ? '#fff9f9' : '#f8fafc', transition: 'all 0.15s' }}>
                        <input
                            type="checkbox"
                            checked={isUrgent}
                            onChange={e => setIsUrgent(e.target.checked)}
                            style={{ width: 13, height: 13, accentColor: '#dc2626', cursor: 'pointer' }}
                        />
                        <Zap size={11} style={{ color: isUrgent ? '#dc2626' : '#94a3b8', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isUrgent ? '#dc2626' : '#64748b' }}>
                            Mark as urgent
                        </span>
                        {isUrgent && (
                            <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: '#dc2626', fontWeight: 600 }}>
                                Notifies manager immediately
                            </span>
                        )}
                    </label>
                </div>

                {/* Submit error */}
                {errors.submit && (
                    <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, color: '#dc2626', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertCircle size={13} /> {errors.submit}
                    </div>
                )}
            </div>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
                {totalUnits > 0 ? (
                    <span style={{ flex: 1, fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>
                        {totalUnits} unit{totalUnits !== 1 ? 's' : ''} · {cartItems.length} type{cartItems.length !== 1 ? 's' : ''}
                        {duration ? ` · ${duration}` : ''}
                    </span>
                ) : (
                    <span style={{ flex: 1 }} />
                )}
                <button type="button" onClick={onClose}
                    style={{ padding: '7px 16px', borderRadius: 9, border: '1px solid var(--border-color)', background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                    Cancel
                </button>
                <button type="button" onClick={handleSave} disabled={saving}
                    style={{ padding: '7px 20px', borderRadius: 9, border: 'none', background: saving ? '#94a3b8' : 'var(--accent-color)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, boxShadow: saving ? 'none' : '0 4px 12px rgba(232,114,12,0.25)' }}>
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Submit Booking
                </button>
            </div>
        </div>
    );
};

export default BookingResourceForm;
