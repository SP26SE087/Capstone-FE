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
            {resources.map(resource => {
                const isSelected = resource.id === selectedId;
                const isAvailable = resource.availableQuantity > 0;
                const rt = resourceTypes.find(t => t.id === resource.resourceTypeId);
                const catStyle = getCategoryStyle(rt?.category);

                return (
                    <div
                        key={resource.id}
                        onClick={() => onSelect(resource)}
                        style={{
                            padding: '9px 12px',
                            borderRadius: '10px',
                            border: isSelected ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                            background: isSelected ? 'var(--accent-bg)' : '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
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

                        {/* Info — name full, then meta */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '3px', wordBreak: 'break-word' }}>
                                {resource.name}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '0.68rem', color: '#64748b', flexWrap: 'wrap' as const, alignItems: 'center' }}>
                                <span style={{ fontSize: '0.58rem', fontWeight: 700, color: catStyle.color, background: catStyle.bg, border: `1px solid ${catStyle.border}`, padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' as const }}>
                                    {resource.resourceTypeName || 'Resource'}
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

                        {/* Right column: available + arrow */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: isAvailable ? '#059669' : '#dc2626', background: isAvailable ? '#ecfdf5' : '#fef2f2', border: `1px solid ${isAvailable ? '#a7f3d0' : '#fecaca'}`, padding: '1px 8px', borderRadius: '20px', whiteSpace: 'nowrap' as const }}>
                                {resource.availableQuantity}/{resource.totalQuantity} available
                            </span>
                            <ChevronRight size={16} style={{ color: isSelected ? 'var(--accent-color)' : '#cbd5e1' }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ResourceListView;
