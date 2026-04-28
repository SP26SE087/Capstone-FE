import React, { useState } from 'react';
import { Resource, ResourceType } from '@/types/booking';
import { Cpu, HardDrive, Box, Monitor, Package, MapPin, ChevronRight, UserCog, Plus, Minus, X, Eye, Zap, Server, Wrench } from 'lucide-react';

export interface BookingCartItem {
    resourceId: string;
    quantity: number;
    isUrgent?: boolean;
}

interface ResourceListViewProps {
    resources: Resource[];
    selectedId: string | null;
    onSelect: (resource: Resource) => void;
    onBook?: (resource: Resource) => void;
    isSplit?: boolean;
    cartItems?: BookingCartItem[];
    onCartChange?: (items: BookingCartItem[]) => void;
}

// Category split
const SERVER_TYPES = new Set([ResourceType.GPU, ResourceType.Compute]);
const isServerType = (t: ResourceType) => SERVER_TYPES.has(t);

const getResourceIcon = (type: ResourceType) => {
    switch (type) {
        case ResourceType.GPU: return <Cpu size={14} />;
        case ResourceType.Equipment: return <HardDrive size={14} />;
        case ResourceType.Dataset: return <Box size={14} />;
        case ResourceType.LabStation: return <Monitor size={14} />;
        default: return <Package size={14} />;
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
        case ResourceType.GPU: return { bg: '#f5f3ff', color: '#7c3aed', border: '#e9d5ff' };
        case ResourceType.Equipment: return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
        case ResourceType.Dataset: return { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' };
        case ResourceType.LabStation: return { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' };
        default: return { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
    }
};

const ResourceListView: React.FC<ResourceListViewProps> = ({
    resources,
    selectedId,
    onSelect,
    onBook,
    isSplit: _isSplit = false,
    cartItems,
    onCartChange,
}) => {
    const [tab, setTab] = useState<'physical' | 'server'>('physical');

    const physicalResources = resources.filter(r => !isServerType(r.type));
    const serverResources   = resources.filter(r =>  isServerType(r.type));
    const visibleResources  = tab === 'physical' ? physicalResources : serverResources;
    const cartMap = React.useMemo(() => {
        const m = new Map<string, number>();
        if (cartItems) for (const i of cartItems) m.set(i.resourceId, i.quantity);
        return m;
    }, [cartItems]);

    const addToCart = (resource: Resource) => {
        if (!onCartChange || !cartItems) return;
        if (cartMap.has(resource.id)) return;
        onCartChange([...cartItems, { resourceId: resource.id, quantity: 1 }]);
    };
    const removeFromCart = (resourceId: string) => {
        if (!onCartChange || !cartItems) return;
        onCartChange(cartItems.filter(i => i.resourceId !== resourceId));
    };
    const updateQty = (resourceId: string, delta: number) => {
        if (!onCartChange || !cartItems) return;
        const resource = resources.find(r => r.id === resourceId);
        const maxQty = resource?.availableQuantity ?? 99;
        onCartChange(cartItems.map(item => {
            if (item.resourceId !== resourceId) return item;
            return { ...item, quantity: Math.max(1, Math.min(maxQty, item.quantity + delta)) };
        }));
    };
    const toggleUrgent = (resourceId: string) => {
        if (!onCartChange || !cartItems) return;
        onCartChange(cartItems.map(item =>
            item.resourceId === resourceId ? { ...item, isUrgent: !item.isUrgent } : item
        ));
    };
    if (resources.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                <Package size={48} style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>No Resources</h3>
                <p style={{ fontSize: '0.85rem' }}>No resources found matching your criteria.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {/* Category tabs */}
            <div style={{ position: 'sticky', top: -12, zIndex: 10, background: '#fff', paddingTop: 12, paddingBottom: 6, marginBottom: -2, marginLeft: -12, marginRight: -12, paddingLeft: 12, paddingRight: 12 }}>
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4 }}>
                {(['physical', 'server'] as const).map(t => {
                    const active = tab === t;
                    const count  = t === 'physical' ? physicalResources.length : serverResources.length;
                    const cartCount = t === 'physical'
                        ? physicalResources.filter(r => cartMap.has(r.id)).length
                        : serverResources.filter(r => cartMap.has(r.id)).length;
                    return (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setTab(t)}
                            style={{
                                flex: 1, padding: '5px 8px', borderRadius: 7, border: 'none',
                                background: active ? '#fff' : 'transparent',
                                color: active ? 'var(--text-primary)' : '#94a3b8',
                                fontSize: '0.7rem', fontWeight: active ? 800 : 600,
                                cursor: 'pointer', fontFamily: 'inherit',
                                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                transition: 'all 0.15s',
                            }}
                        >
                            {t === 'physical' ? <Wrench size={11} /> : <Server size={11} />}
                            {t === 'physical' ? 'Physical' : 'Server'}
                            <span style={{
                                fontSize: '0.6rem', fontWeight: 800, minWidth: 16,
                                padding: '0 4px', borderRadius: 6,
                                background: active ? (cartCount > 0 ? '#7c3aed' : '#e2e8f0') : 'transparent',
                                color: active ? (cartCount > 0 ? '#fff' : '#64748b') : '#94a3b8',
                            }}>{cartCount > 0 ? `${cartCount}/${count}` : count}</span>
                        </button>
                    );
                })}
            </div>
            </div>
            {visibleResources.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.78rem' }}>
                    No {tab === 'physical' ? 'physical' : 'server'} resources found.
                </div>
            )}
            {visibleResources.map(resource => {
                const isSelected = resource.id === selectedId;
                const typeColors = getTypeColor(resource.type);
                const isAvailable = resource.availableQuantity > 0;
                const inCart = cartMap.has(resource.id);
                const cartQty = cartMap.get(resource.id) ?? 0;
                const cartItem = cartItems?.find(i => i.resourceId === resource.id);
                const isUrgent = cartItem?.isUrgent ?? false;

                const cardBg = inCart ? '#f5f3ff' : isSelected ? 'var(--accent-bg)' : '#fff';
                const cardBorder = inCart
                    ? '1.5px solid #7c3aed'
                    : isSelected
                    ? '1.5px solid var(--accent-color)'
                    : '1px solid var(--border-color)';

                return (
                    <div
                        key={resource.id}
                        onClick={() => cartItems ? (inCart ? removeFromCart(resource.id) : addToCart(resource)) : onSelect(resource)}
                        style={{
                            padding: '9px 12px',
                            borderRadius: '10px',
                            border: cardBorder,
                            background: cardBg,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                        }}
                    >
                        {/* Icon */}
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: inCart ? '#ede9fe' : typeColors.bg,
                            color: inCart ? '#7c3aed' : typeColors.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            {getResourceIcon(resource.type)}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', wordBreak: 'break-word' }}>
                                    {resource.name}
                                </span>
                                {inCart && (
                                    <span style={{ fontSize: '0.57rem', fontWeight: 700, color: '#7c3aed', background: '#ede9fe', border: '1px solid #c4b5fd', padding: '0 5px', borderRadius: '4px', flexShrink: 0 }}>
                                        ✓ Added
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '0.68rem', color: '#64748b', flexWrap: 'wrap' as const, alignItems: 'center' }}>
                                <span style={{ fontSize: '0.58rem', fontWeight: 700, color: typeColors.color, background: typeColors.bg, border: `1px solid ${typeColors.border}`, padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' as const }}>
                                    {resource.resourceTypeName || getResourceTypeLabel(resource.type)}
                                </span>
                                {resource.location && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <MapPin size={11} /> {resource.location}
                                    </span>
                                )}
                                {resource.managerName && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600, color: '#475569' }}>
                                        <UserCog size={11} /> {resource.managerName}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Right column */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            <span style={{
                                fontSize: '0.68rem', fontWeight: 800,
                                color: isAvailable ? '#059669' : '#dc2626',
                                background: isAvailable ? '#ecfdf5' : '#fef2f2',
                                border: `1px solid ${isAvailable ? '#a7f3d0' : '#fecaca'}`,
                                padding: '1px 8px', borderRadius: '20px', whiteSpace: 'nowrap' as const,
                            }}>
                                {resource.availableQuantity}/{resource.totalQuantity} available
                            </span>

                            {/* Urgent toggle (when in cart) */}
                            {inCart && onCartChange && (
                                <button
                                    type="button"
                                    title={isUrgent ? 'Mark as normal' : 'Mark as urgent'}
                                    onClick={() => toggleUrgent(resource.id)}
                                    style={{
                                        width: '24px', height: '24px', borderRadius: '7px',
                                        border: isUrgent ? '1.5px solid #ef4444' : '1px solid #e2e8f0',
                                        background: isUrgent ? '#fef2f2' : '#f8fafc',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: isUrgent ? '#ef4444' : '#cbd5e1',
                                        flexShrink: 0,
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <Zap size={11} fill={isUrgent ? '#ef4444' : 'none'} />
                                </button>
                            )}

                            {/* Quantity stepper (when in cart) */}
                            {inCart && onCartChange && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <button
                                        type="button"
                                        onClick={() => cartQty <= 1 ? removeFromCart(resource.id) : updateQty(resource.id, -1)}
                                        style={{
                                            width: '22px', height: '22px', borderRadius: '6px',
                                            border: cartQty <= 1 ? '1px solid #fecaca' : '1px solid #e2e8f0',
                                            background: cartQty <= 1 ? '#fef2f2' : '#f8fafc',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: cartQty <= 1 ? '#dc2626' : '#475569',
                                        }}
                                    >
                                        {cartQty <= 1 ? <X size={9} /> : <Minus size={9} />}
                                    </button>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, minWidth: '18px', textAlign: 'center', color: '#7c3aed' }}>
                                        {cartQty}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => updateQty(resource.id, +1)}
                                        disabled={cartQty >= resource.availableQuantity}
                                        style={{
                                            width: '22px', height: '22px', borderRadius: '6px',
                                            border: '1px solid #e2e8f0',
                                            background: cartQty >= resource.availableQuantity ? '#f8fafc' : '#fff',
                                            cursor: cartQty >= resource.availableQuantity ? 'not-allowed' : 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: cartQty >= resource.availableQuantity ? '#cbd5e1' : '#475569',
                                        }}
                                    >
                                        <Plus size={9} />
                                    </button>
                                </div>
                            )}

                            {/* Add to cart button (when cart mode, not yet in cart) */}
                            {cartItems && !inCart && onCartChange && (
                                <button
                                    type="button"
                                    onClick={() => addToCart(resource)}
                                    disabled={!isAvailable}
                                    style={{
                                        padding: '3px 9px', borderRadius: '7px', border: 'none',
                                        background: isAvailable ? '#7c3aed' : '#e2e8f0',
                                        color: isAvailable ? '#fff' : '#94a3b8',
                                        cursor: isAvailable ? 'pointer' : 'not-allowed',
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' as const,
                                    }}
                                >
                                    <Plus size={11} /> Add
                                </button>
                            )}

                            {/* View button */}
                            {(onBook || onSelect) && (
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); onBook ? onBook(resource) : onSelect(resource); }}
                                    style={{
                                        padding: '3px 9px', borderRadius: '7px',
                                        border: '1px solid #e2e8f0',
                                        background: '#fff', color: '#475569',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                        fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' as const,
                                    }}
                                >
                                    <Eye size={11} /> View
                                </button>
                            )}

                            <ChevronRight size={16} style={{ color: inCart ? '#7c3aed' : isSelected ? 'var(--accent-color)' : '#cbd5e1' }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ResourceListView;
