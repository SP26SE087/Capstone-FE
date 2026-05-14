import React, { useState } from 'react';
import { Resource } from '@/types/booking';
import { Box, Cpu, Package, MapPin, ChevronRight, UserCog, Server } from 'lucide-react';
import { ResourceTypeItem, ResourceTypeCategory } from '@/services/resourceTypeService';

interface ResourceListViewProps {
    resources: Resource[];
    selectedId: string | null;
    onSelect: (resource: Resource) => void;
    onBook?: (resource: Resource) => void;
    isSplit?: boolean;
    resourceTypes?: ResourceTypeItem[];
}

const SECTION_CFG = {
    server: {
        label: 'Server / Compute',
        color: '#7c3aed',
        bg: '#f5f3ff',
        border: '#e9d5ff',
        icon: <Server size={11} />,
        cardIcon: <Cpu size={14} />,
    },
    physical: {
        label: 'Physical',
        color: '#0284c7',
        bg: '#f0f9ff',
        border: '#bae6fd',
        icon: <Box size={11} />,
        cardIcon: <Box size={14} />,
    },
};

/* ── Status config (for the overall now-status pill) ────────────────────── */
type UnitStatus = 'available' | 'in-use' | 'damaged';

const STATUS_CFG: Record<UnitStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
    available: { label: 'Available', color: '#16a34a', bg: '#dcfce7', border: '#86efac', dot: '#22c55e' },
    'in-use':  { label: 'In Use',    color: '#b45309', bg: '#fef9c3', border: '#fde68a', dot: '#f59e0b' },
    damaged:   { label: 'Damaged',   color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', dot: '#ef4444' },
};


/* ── Component ───────────────────────────────────────────────────────────── */
const ResourceListView: React.FC<ResourceListViewProps> = ({
    resources,
    selectedId,
    onSelect,
    onBook: _onBook,
    isSplit: _isSplit = false,
    resourceTypes = [],
}) => {
    const [activeTab, setActiveTab] = useState<'server' | 'physical'>('server');

    if (resources.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                <Package size={48} style={{ display: 'block', margin: '0 auto 1.5rem', opacity: 0.3 }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>No Resources</h3>
                <p style={{ fontSize: '0.85rem' }}>No resources found matching your criteria.</p>
            </div>
        );
    }

    const serverResources = resources.filter(r => {
        const rt = resourceTypes.find(t => t.id === r.resourceTypeId);
        return rt?.category === ResourceTypeCategory.ServerCompute;
    });
    const physicalResources = resources.filter(r => {
        const rt = resourceTypes.find(t => t.id === r.resourceTypeId);
        return rt?.category !== ResourceTypeCategory.ServerCompute;
    });

    const renderCard = (resource: Resource) => {
        const isSelected = resource.id === selectedId;
        const rt = resourceTypes.find(t => t.id === resource.resourceTypeId);
        const isServer = rt?.category === ResourceTypeCategory.ServerCompute;
        const cfg = isServer ? SECTION_CFG.server : SECTION_CFG.physical;

        // Derive counts from resource fields directly
        const total        = Math.max(resource.totalQuantity || 0, 1);
        const availableCount = resource.availableQuantity ?? 0;
        const damagedCount   = resource.damagedQuantity ?? 0;
        const inUseCount     = resource.inUseCount ?? Math.max(0, total - availableCount - damagedCount);

        // Overall now-status (for the header pill)
        type UnitStatus = 'available' | 'in-use' | 'damaged';
        const overallStatus: UnitStatus =
            availableCount > 0 ? 'available' :
            damagedCount > 0   ? 'damaged'   : 'in-use';
        const osc = STATUS_CFG[overallStatus];

        // Availability bar
        const availabilityPct = Math.min(100, Math.round((availableCount / total) * 100));

        return (
            <div
                key={resource.id}
                onClick={() => onSelect(resource)}
                style={{
                    padding: '11px 12px',
                    borderRadius: '12px',
                    border: isSelected ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                    background: isSelected ? 'var(--accent-bg)' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                }}
            >
                {/* ── Top row: icon + name + overall status badge ── */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: cfg.bg, color: cfg.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        {cfg.cardIcon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Name + now-status */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', wordBreak: 'break-word', flex: 1 }}>
                                {resource.name}
                            </div>
                            {/* Now-status pill */}
                            <span style={{
                                flexShrink: 0,
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.03em',
                                padding: '2px 8px', borderRadius: '20px',
                                color: osc.color, background: osc.bg, border: `1px solid ${osc.border}`,
                                whiteSpace: 'nowrap',
                            }}>
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: osc.dot, display: 'inline-block' }} />
                                {osc.label}
                            </span>
                        </div>

                        {/* Meta: type badge + location + manager */}
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' as const }}>
                            <span style={{
                                fontSize: '0.6rem', fontWeight: 700,
                                color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
                                padding: '1px 7px', borderRadius: '999px', whiteSpace: 'nowrap' as const,
                            }}>
                                {resource.resourceTypeName || 'Resource'}
                            </span>
                            {resource.location && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: '#64748b' }}>
                                    <MapPin size={11} /> {resource.location}
                                </span>
                            )}
                            {resource.managerName && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600, color: '#475569', fontSize: '0.68rem' }}>
                                    <UserCog size={11} /> {resource.managerName}
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={{
                        width: '28px', height: '28px', borderRadius: '999px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isSelected ? 'rgba(232,114,12,0.15)' : '#f8fafc',
                        border: isSelected ? '1px solid rgba(232,114,12,0.35)' : '1px solid #e2e8f0',
                        marginTop: '2px', flexShrink: 0,
                    }}>
                        <ChevronRight size={15} style={{ color: isSelected ? 'var(--accent-color)' : '#94a3b8' }} />
                    </div>
                </div>

                {/* ── Availability bar ── */}
                <div style={{ marginTop: '9px' }}>
                    <div style={{ height: '5px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                        <div style={{
                            width: `${availabilityPct}%`, height: '100%', borderRadius: '999px',
                            background: availabilityPct > 50 ? '#10b981' : availabilityPct > 20 ? '#f59e0b' : '#ef4444',
                            transition: 'width 0.2s ease',
                        }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '3px', fontSize: '0.62rem', color: '#64748b', fontWeight: 600 }}>
                        <span>Availability</span>
                        <span style={{ display: 'flex', gap: '6px' }}>
                            {availableCount > 0 && <span style={{ color: '#16a34a' }}>{availableCount} avail</span>}
                            {inUseCount > 0     && <span style={{ color: '#b45309' }}>{inUseCount} in-use</span>}
                            {damagedCount > 0   && <span style={{ color: '#dc2626' }}>{damagedCount} damaged</span>}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    const visibleList = activeTab === 'server' ? serverResources : physicalResources;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Category toggle */}
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
                {(['server', 'physical'] as const).map(tab => {
                    const cfg = SECTION_CFG[tab];
                    const count = tab === 'server' ? serverResources.length : physicalResources.length;
                    const active = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '6px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                                fontSize: '0.75rem', fontWeight: active ? 700 : 500,
                                background: active ? '#fff' : 'transparent',
                                color: active ? cfg.color : '#64748b',
                                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            <div style={{
                                width: '16px', height: '16px', borderRadius: '4px',
                                background: active ? cfg.bg : 'transparent',
                                color: active ? cfg.color : '#94a3b8',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                            }}>
                                {cfg.icon}
                            </div>
                            {cfg.label}
                            <span style={{
                                fontSize: '0.62rem', fontWeight: 800, minWidth: '16px', height: '16px',
                                borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                padding: '0 4px',
                                background: active ? cfg.color : '#e2e8f0',
                                color: active ? '#fff' : '#64748b',
                                transition: 'all 0.15s',
                            }}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Summary bar */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '10px', flexWrap: 'wrap' as const,
                padding: '8px 12px', borderRadius: '10px',
                border: '1px solid #e2e8f0', background: '#f8fafc',
            }}>
                <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700 }}>
                    {visibleList.length} {visibleList.length === 1 ? 'resource' : 'resources'}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' as const }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: 999 }}>
                        Available: {visibleList.reduce((s, r) => s + (r.availableQuantity || 0), 0)}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 999 }}>
                        In Use: {visibleList.reduce((s, r) => s + (r.inUseCount || 0), 0)}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#334155', background: '#ffffff', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: 999 }}>
                        Units: {visibleList.reduce((s, r) => s + (r.totalQuantity || 0), 0)}
                    </span>
                </div>
            </div>

            {/* Resource cards */}
            {visibleList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                    No {SECTION_CFG[activeTab].label} resources found.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {visibleList.map(renderCard)}
                </div>
            )}
        </div>
    );
};

export default ResourceListView;
