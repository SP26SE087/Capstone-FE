import React from 'react';
import { Resource } from '@/types/booking';
import { 
  Loader2, 
  MapPin, 
  Search, 
  Folder, 
  ChevronDown, 
  ChevronRight, 
  Package, 
  Database, 
  Monitor, 
  Cpu 
} from 'lucide-react';

interface ResourceManagementProps {
  resources: Resource[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (resource: Resource) => void;
  onDelete: (resourceId: string) => void;
  isSplit?: boolean;
  selectedId?: string | null;
}

const ResourceManagement: React.FC<ResourceManagementProps> = ({ 
  resources, 
  loading, 
  onEdit, 
  selectedId 
}) => {
  const [expandedCategories, setExpandedCategories] = React.useState<Record<number, boolean>>({});

  const toggleCategory = (type: number) => {
    setExpandedCategories(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const categories = React.useMemo(() => {
    const groups: Record<number, { label: string; icon: React.ReactNode; color: string; items: Resource[] }> = {
      1: { label: 'GPU Nodes', icon: <Cpu size={16} />, color: '#3b82f6', items: [] },
      2: { label: 'General Equipment', icon: <Package size={16} />, color: 'var(--accent-color)', items: [] },
      3: { label: 'Datasets', icon: <Database size={16} />, color: '#10b981', items: [] },
      4: { label: 'Lab Stations', icon: <Monitor size={16} />, color: '#f59e0b', items: [] }
    };
    
    resources.forEach(r => {
      if (groups[r.type]) groups[r.type].items.push(r);
      else {
        if (!groups[99]) groups[99] = { label: 'Others', icon: <Folder size={16} />, color: '#64748b', items: [] };
        groups[99].items.push(r);
      }
    });

    return Object.entries(groups).filter(([_, g]) => g.items.length > 0);
  }, [resources]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="animate-spin" style={{ marginBottom: '12px' }} />
        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Fetching inventory data...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {categories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
            <Search size={40} style={{ marginBottom: '1rem', opacity: 0.1, color: 'var(--text-primary)' }} />
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>No resources found match your criteria.</p>
        </div>
      ) : (
        categories.map(([typeId, group]) => {
          const type = Number(typeId);
          const isExpanded = expandedCategories[type] ?? false;
          const hasSelected = group.items.some(r => r.id === selectedId);

          return (
            <div key={type} style={{ 
              background: 'var(--card-bg)', 
              borderRadius: 'var(--radius-lg)', 
              border: '1px solid var(--border-color)', 
              overflow: 'hidden', 
              boxShadow: 'var(--shadow-sm)' 
            }}>
              {/* Parent Group Header (Seminar style) */}
              <div 
                onClick={() => toggleCategory(type)}
                style={{
                  padding: '12px 16px', 
                  background: hasSelected ? 'var(--accent-bg)' : 'var(--surface-hover)',
                  borderBottom: isExpanded ? '1px solid var(--border-light)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px', 
                    background: hasSelected ? 'var(--accent-color)' : (group.color.startsWith('var') ? group.color : 'var(--primary-color)'), 
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {group.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{group.label}</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {group.items.length} {group.items.length === 1 ? 'Resource' : 'Resources'}
                    </div>
                  </div>
                </div>
                {isExpanded ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
              </div>

              {/* Resource Items (Seminar style Children) */}
              {isExpanded && (
                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {group.items.map(resource => {
                    const isSelected = resource.id === selectedId;
                    
                    return (
                      <div
                        key={resource.id}
                        onClick={(e) => { e.stopPropagation(); onEdit(resource); }}
                        style={{
                          padding: '12px 14px', borderRadius: '10px',
                          background: isSelected 
                            ? 'linear-gradient(135deg, rgba(232, 114, 12, 0.06), rgba(255, 150, 67, 0.04))'
                            : 'transparent',
                          border: isSelected 
                            ? '1.5px solid var(--accent-color)'
                            : '1px solid transparent',
                          cursor: 'pointer', transition: 'all 0.2s',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'var(--surface-hover)';
                            e.currentTarget.style.borderColor = 'var(--border-light)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'transparent';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
                          <span style={{ 
                            fontSize: '0.85rem', fontWeight: 700, 
                            color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>
                            {resource.name}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                <MapPin size={12} />
                                <span>{resource.location || 'N/A'}</span>
                            </div>
                            <div style={{ 
                              fontSize: '0.72rem', fontWeight: 800, 
                              color: resource.availableQuantity > 0 ? 'var(--success)' : 'var(--danger)',
                              display: 'flex', alignItems: 'center', gap: '4px'
                            }}>
                                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: resource.availableQuantity > 0 ? 'var(--success)' : 'var(--danger)' }} />
                                {resource.availableQuantity} / {resource.totalQuantity} Available
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ 
                            fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', 
                            opacity: isSelected ? 1 : 0.4, transition: 'opacity 0.2s',
                            display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                             {isSelected ? 'EDITING' : `ID: ${String(resource?.id || 'N/A').substring(0, 4)}`}
                             {isSelected && <ChevronRight size={12} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ResourceManagement;
