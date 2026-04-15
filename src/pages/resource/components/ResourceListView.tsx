import React from 'react';
import { Resource, ResourceType } from '@/types/booking';
import { Cpu, HardDrive, Box, Monitor, Package, MapPin, ChevronRight, UserCog, Plus } from 'lucide-react';

interface ResourceListViewProps {
    resources: Resource[];
    selectedId: string | null;
    onSelect: (resource: Resource) => void;
    onBook?: (resource: Resource) => void;
    isSplit?: boolean;
}

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
    isSplit: _isSplit = false
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
                const typeColors = getTypeColor(resource.type);
                const isAvailable = resource.availableQuantity > 0;

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
                            background: typeColors.bg,
                            color: typeColors.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {getResourceIcon(resource.type)}
                        </div>

                        {/* Info — name full, then meta */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '3px', wordBreak: 'break-word' }}>
                                {resource.name}
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

                        {/* Right column: available + Book + arrow */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: isAvailable ? '#059669' : '#dc2626', background: isAvailable ? '#ecfdf5' : '#fef2f2', border: `1px solid ${isAvailable ? '#a7f3d0' : '#fecaca'}`, padding: '1px 8px', borderRadius: '20px', whiteSpace: 'nowrap' as const }}>
                                {resource.availableQuantity}/{resource.totalQuantity} available
                            </span>
                                {onBook && (
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); onBook(resource); }}
                                        disabled={!isAvailable}
                                        style={{ padding: '3px 9px', borderRadius: '7px', border: 'none', background: isAvailable ? 'var(--accent-color, #f97316)' : '#e2e8f0', color: isAvailable ? '#fff' : '#94a3b8', cursor: isAvailable ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' as const }}
                                    >
                                        <Plus size={11} /> Book
                                    </button>
                                )}
                                <ChevronRight size={16} style={{ color: isSelected ? 'var(--accent-color)' : '#cbd5e1' }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ResourceListView;
