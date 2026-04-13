import React from 'react';
import { Resource, ResourceType } from '@/types/booking';
import { Cpu, HardDrive, Box, Monitor, Package, MapPin, ChevronRight, Calendar, UserCog } from 'lucide-react';

interface ResourceListViewProps {
    resources: Resource[];
    selectedId: string | null;
    onSelect: (resource: Resource) => void;
    onBook?: (resource: Resource) => void;
    isSplit?: boolean;
}

const getResourceIcon = (type: ResourceType) => {
    switch (type) {
        case ResourceType.GPU: return <Cpu size={18} />;
        case ResourceType.Equipment: return <HardDrive size={18} />;
        case ResourceType.Dataset: return <Box size={18} />;
        case ResourceType.LabStation: return <Monitor size={18} />;
        default: return <Package size={18} />;
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {resources.map(resource => {
                const isSelected = resource.id === selectedId;
                const typeColors = getTypeColor(resource.type);
                const isAvailable = resource.availableQuantity > 0;

                return (
                    <div
                        key={resource.id}
                        onClick={() => onSelect(resource)}
                        style={{
                            padding: '14px 16px',
                            borderRadius: '12px',
                            border: isSelected ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                            background: isSelected ? 'var(--accent-bg)' : '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px'
                        }}
                    >
                        {/* Icon */}
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: typeColors.bg,
                            color: typeColors.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {getResourceIcon(resource.type)}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    color: '#1e293b',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {resource.name}
                                </span>
                                <span style={{
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    color: typeColors.color,
                                    background: typeColors.bg,
                                    border: `1px solid ${typeColors.border}`,
                                    padding: '1px 6px',
                                    borderRadius: '6px',
                                    flexShrink: 0
                                }}>
                                    {getResourceTypeLabel(resource.type)}
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: '#64748b' }}>
                                {resource.location && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <MapPin size={11} /> {resource.location}
                                    </span>
                                )}
                                <span style={{
                                    fontWeight: 700,
                                    color: isAvailable ? '#059669' : '#dc2626'
                                }}>
                                    {resource.availableQuantity}/{resource.totalQuantity} available
                                </span>
                            </div>
                            {(resource.managerName || resource.managerEmail) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#64748b', marginTop: '3px' }}>
                                    <UserCog size={11} />
                                    {resource.managerName && <span style={{ fontWeight: 600, color: '#475569' }}>{resource.managerName}</span>}
                                    {resource.managerName && resource.managerEmail && <span>·</span>}
                                    {resource.managerEmail && <span style={{ color: '#2563eb' }}>{resource.managerEmail}</span>}
                                </div>
                            )}
                        </div>

                        {/* Book button */}
                        {onBook && isAvailable && (
                            <button
                                onClick={e => { e.stopPropagation(); onBook(resource); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    padding: '5px 12px', borderRadius: '8px', border: 'none',
                                    background: isSelected ? 'rgba(255,255,255,0.9)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                    color: isSelected ? '#4f46e5' : '#fff',
                                    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                    flexShrink: 0, transition: 'all 0.15s',
                                    boxShadow: '0 2px 6px rgba(99,102,241,0.25)'
                                }}
                            >
                                <Calendar size={12} /> Book
                            </button>
                        )}

                        {/* Arrow */}
                        <ChevronRight size={16} style={{ color: isSelected ? 'var(--accent-color)' : '#cbd5e1', flexShrink: 0 }} />
                    </div>
                );
            })}
        </div>
    );
};

export default ResourceListView;
