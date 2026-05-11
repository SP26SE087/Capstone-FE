import React from 'react';
import { Resource } from '@/types/booking';
import { Box, Cpu, Package, MapPin, ChevronRight, UserCog } from 'lucide-react';
import { ResourceTypeItem, ResourceTypeCategory } from '@/services/resourceTypeService';

interface ResourceListViewProps {
    resources: Resource[];
    selectedId: string | null;
    onSelect: (resource: Resource) => void;
    onBook?: (resource: Resource) => void;
    isSplit?: boolean;
    resourceTypes?: ResourceTypeItem[];
}

const getCategoryStyle = (category?: ResourceTypeCategory) => {
    if (category === ResourceTypeCategory.ServerCompute)
        return { bg: '#f5f3ff', color: '#7c3aed', border: '#e9d5ff', icon: <Cpu size={14} /> };
    return { bg: '#f0f9ff', color: '#0284c7', border: '#bae6fd', icon: <Box size={14} /> };
};

const ResourceListView: React.FC<ResourceListViewProps> = ({
    resources,
    selectedId,
    onSelect,
    onBook: _onBook,
    isSplit: _isSplit = false,
    resourceTypes = [],
}) => {
    const totalUnits = resources.reduce((sum, r) => sum + (r.totalQuantity ?? 0), 0);
    const totalAvailable = resources.reduce((sum, r) => sum + (r.availableQuantity ?? 0), 0);
    const totalInUse = resources.reduce((sum, r) => sum + (r.inUseCount ?? 0), 0);

    if (resources.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                <Package size={48} style={{ display: 'block', margin: '0 auto 1.5rem', opacity: 0.3 }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>No Resources</h3>
                <p style={{ fontSize: '0.85rem' }}>No resources found matching your criteria.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '10px', flexWrap: 'wrap',
                padding: '10px 12px', borderRadius: '10px',
                border: '1px solid #e2e8f0', background: '#f8fafc'
            }}>
                <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700 }}>
                    {resources.length} resources
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' as const }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: 999 }}>
                        Available: {totalAvailable}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 999 }}>
                        In Use: {totalInUse}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#334155', background: '#ffffff', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: 999 }}>
                        Units: {totalUnits}
                    </span>
                </div>
            </div>
            {resources.map(resource => {
                const isSelected = resource.id === selectedId;
                const isAvailable = resource.availableQuantity > 0;
                const rt = resourceTypes.find(t => t.id === resource.resourceTypeId);
                const catStyle = getCategoryStyle(rt?.category);
                const total = Math.max(resource.totalQuantity || 0, 1);
                const availabilityPct = Math.min(100, Math.round(((resource.availableQuantity || 0) / total) * 100));

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
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px'
                        }}
                    >
                        {/* Icon */}
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: catStyle.bg,
                            color: catStyle.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {catStyle.icon}
                        </div>

                        {/* Info — name, meta, and availability bar */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '4px', wordBreak: 'break-word' }}>
                                        {resource.name}
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' as const }}>
                                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: catStyle.color, background: catStyle.bg, border: `1px solid ${catStyle.border}`, padding: '1px 7px', borderRadius: '999px', whiteSpace: 'nowrap' as const }}>
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
                                <span style={{ fontSize: '0.67rem', fontWeight: 800, color: isAvailable ? '#059669' : '#dc2626', background: isAvailable ? '#ecfdf5' : '#fef2f2', border: `1px solid ${isAvailable ? '#a7f3d0' : '#fecaca'}`, padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap' as const }}>
                                    {resource.availableQuantity}/{resource.totalQuantity} available
                                </span>
                            </div>
                            <div style={{ marginTop: '8px' }}>
                                <div style={{ height: '6px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${availabilityPct}%`,
                                        height: '100%',
                                        borderRadius: '999px',
                                        background: availabilityPct > 50 ? '#10b981' : availabilityPct > 20 ? '#f59e0b' : '#ef4444',
                                        transition: 'width 0.2s ease'
                                    }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.64rem', color: '#64748b', fontWeight: 600 }}>
                                    <span>Availability</span>
                                    <span>{availabilityPct}%</span>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            width: '28px', height: '28px', borderRadius: '999px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isSelected ? 'rgba(232,114,12,0.15)' : '#f8fafc',
                            border: isSelected ? '1px solid rgba(232,114,12,0.35)' : '1px solid #e2e8f0',
                            marginTop: '2px',
                            flexShrink: 0
                        }}>
                            <ChevronRight size={15} style={{ color: isSelected ? 'var(--accent-color)' : '#94a3b8' }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ResourceListView;
