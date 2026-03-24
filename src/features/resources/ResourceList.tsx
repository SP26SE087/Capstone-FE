import React from 'react';
import { Resource, ResourceType } from '@/types/booking';
import { HardDrive, Monitor, Cpu, Box, MapPin, Info, Calendar, Package } from 'lucide-react';

interface ResourceListProps {
  resources: Resource[];
  onBook: (resource: Resource) => void;
}

const ResourceList: React.FC<ResourceListProps> = ({ resources, onBook }) => {
  const getResourceIcon = (type: ResourceType) => {
    switch (type) {
      case ResourceType.GPU:
        return <Cpu size={24} />;
      case ResourceType.Equipment:
        return <HardDrive size={24} />;
      case ResourceType.Dataset:
        return <Box size={24} />;
      case ResourceType.LabStation:
        return <Monitor size={24} />;
      default:
        return <Package size={24} />;
    }
  };

  const getResourceTypeLabel = (type: ResourceType) => {
    switch (type) {
      case ResourceType.GPU:
        return 'GPU Node';
      case ResourceType.Equipment:
        return 'Lab Equipment';
      case ResourceType.Dataset:
        return 'Dataset';
      case ResourceType.LabStation:
        return 'Lab Station';
      default:
        return 'Resource';
    }
  };

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(5, 1fr)', 
      gap: '1rem' 
    }}>
      {resources.map((resource) => (
        <div key={resource.id} className="card card-interactive" style={{ 
          padding: '1rem', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.75rem',
          minHeight: '280px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{
              background: 'var(--accent-bg)',
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              color: 'var(--accent-color)'
            }}>
              {getResourceIcon(resource.type)}
            </div>
            <span className="badge badge-accent" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
              {getResourceTypeLabel(resource.type)}
            </span>
          </div>

          <div>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '1rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={resource.name}>
              {resource.name}
            </h3>
            <p style={{
              margin: 0,
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: '1.4',
              height: '2.1rem' // Roughly 2 lines
            }}>
              {resource.description || 'No description available.'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <MapPin size={12} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resource.location || 'Lab Main Area'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <Info size={12} />
              <span>Avail: <strong>{resource.availableQuantity}</strong> / {resource.totalQuantity}</span>
            </div>
          </div>

          <div style={{
            marginTop: 'auto',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onBook(resource)}
              disabled={resource.availableQuantity <= 0}
              style={{ width: '100%', padding: '6px 12px', fontSize: '0.8rem', height: '32px' }}
            >
              <Calendar size={14} /> Book Now
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ResourceList;
