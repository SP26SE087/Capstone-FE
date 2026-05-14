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
  Cpu,
  User,
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

/* ── helpers ──────────────────────────────────────────────────────────────── */

type UnitStatus = 'available' | 'in-use' | 'damaged';

function deriveUnitStatuses(resource: Resource): { serial: string; status: UnitStatus }[] {
  const serials: string[] = Array.isArray(resource.serials) && resource.serials.length > 0
    ? resource.serials
    : resource.ids.map((_, i) => `UNIT-${String(i + 1).padStart(3, '0')}`);

  const availableIds = new Set(resource.availableIds || []);
  const total = serials.length;
  const damaged = resource.damagedQuantity ?? 0;
  const available = resource.availableQuantity ?? (total - damaged);

  return serials.map((serial, idx) => {
    const correspondingId = resource.ids[idx];

    // If we have fine-grained availableIds info
    if (resource.availableIds && resource.availableIds.length > 0) {
      if (correspondingId && availableIds.has(correspondingId)) return { serial, status: 'available' as UnitStatus };
      // Heuristic: first `damaged` units are damaged
      if (idx < damaged) return { serial, status: 'damaged' as UnitStatus };
      return { serial, status: 'in-use' as UnitStatus };
    }

    // Fallback: first `available` are available, next `damaged` are damaged, rest in-use
    if (idx < available) return { serial, status: 'available' as UnitStatus };
    if (idx < available + damaged) return { serial, status: 'damaged' as UnitStatus };
    return { serial, status: 'in-use' as UnitStatus };
  });
}

const STATUS_CONFIG: Record<UnitStatus, { label: string; color: string; bg: string; dot: string }> = {
  available: { label: 'Available', color: '#16a34a', bg: '#dcfce7', dot: '#22c55e' },
  'in-use':  { label: 'In Use',    color: '#b45309', bg: '#fef9c3', dot: '#f59e0b' },
  damaged:   { label: 'Damaged',   color: '#dc2626', bg: '#fee2e2', dot: '#ef4444' },
};

const ResourceManagement: React.FC<ResourceManagementProps> = ({
  resources,
  loading,
  onEdit,
  selectedId,
}) => {
  const [expandedCategories, setExpandedCategories] = React.useState<Record<number, boolean>>({});

  const toggleCategory = (type: number) => {
    setExpandedCategories(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const categories = React.useMemo(() => {
    const groups: Record<number, { label: string; icon: React.ReactNode; color: string; items: Resource[] }> = {
      1: { label: 'GPU Nodes',         icon: <Cpu size={16} />,     color: '#7c3aed', items: [] },
      2: { label: 'General Equipment', icon: <Package size={16} />, color: 'var(--accent-color)', items: [] },
      3: { label: 'Datasets',          icon: <Database size={16} />, color: '#10b981', items: [] },
      4: { label: 'Lab Stations',      icon: <Monitor size={16} />,  color: '#f59e0b', items: [] },
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
              boxShadow: 'var(--shadow-sm)',
            }}>
              {/* Category header */}
              <div
                onClick={() => toggleCategory(type)}
                style={{
                  padding: '12px 16px',
                  background: hasSelected ? 'var(--accent-bg)' : 'var(--surface-hover)',
                  borderBottom: isExpanded ? '1px solid var(--border-light)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: group.color.startsWith('var') ? group.color : group.color,
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {group.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{group.label}</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {group.items.length} {group.items.length === 1 ? 'Resource Group' : 'Resource Groups'} &nbsp;·&nbsp;
                      {group.items.reduce((s, r) => s + r.totalQuantity, 0)} Units Total
                    </div>
                  </div>
                </div>
                {isExpanded ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
              </div>

              {/* Resource rows */}
              {isExpanded && (
                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {group.items.map(resource => {
                    const isSelected = resource.id === selectedId;
                    const units = deriveUnitStatuses(resource);

                    const availableCount = units.filter(u => u.status === 'available').length;
                    const inUseCount    = units.filter(u => u.status === 'in-use').length;
                    const damagedCount  = units.filter(u => u.status === 'damaged').length;

                    // Overall status label
                    const overallStatus: UnitStatus =
                      availableCount === 0 && damagedCount > 0 ? 'damaged' :
                      availableCount === 0 ? 'in-use' : 'available';
                    const sc = STATUS_CONFIG[overallStatus];

                    return (
                      <div
                        key={resource.id}
                        onClick={e => { e.stopPropagation(); onEdit(resource); }}
                        style={{
                          padding: '14px 14px 12px',
                          borderRadius: '10px',
                          background: isSelected
                            ? 'linear-gradient(135deg, rgba(232,114,12,0.06), rgba(255,150,67,0.04))'
                            : 'transparent',
                          border: isSelected ? '1.5px solid var(--accent-color)' : '1px solid transparent',
                          cursor: 'pointer', transition: 'all 0.2s',
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
                        {/* Top row: name + overall status */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{
                            fontSize: '0.85rem', fontWeight: 700,
                            color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                          }}>
                            {resource.name}
                          </span>
                          {/* Overall status pill */}
                          <span style={{
                            flexShrink: 0, marginLeft: '10px',
                            display: 'flex', alignItems: 'center', gap: '5px',
                            fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.04em',
                            padding: '3px 9px', borderRadius: '20px',
                            color: sc.color, background: sc.bg,
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                            {sc.label}
                          </span>
                        </div>

                        {/* Meta row: location, manager, unit counts */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
                          {resource.location && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              <MapPin size={11} />
                              <span>{resource.location}</span>
                            </div>
                          )}
                          {resource.managerName && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              <User size={11} />
                              <span>{resource.managerName}</span>
                            </div>
                          )}
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {[
                              { label: `${availableCount} avail`, color: '#16a34a', bg: '#dcfce7' },
                              inUseCount > 0 ? { label: `${inUseCount} in-use`, color: '#b45309', bg: '#fef9c3' } : null,
                              damagedCount > 0 ? { label: `${damagedCount} damaged`, color: '#dc2626', bg: '#fee2e2' } : null,
                            ].filter(Boolean).map((pill, idx) => (
                              <span key={idx} style={{
                                fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px',
                                borderRadius: '10px', color: pill!.color, background: pill!.bg,
                              }}>
                                {pill!.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Serial number badges */}
                        {units.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {units.map(({ serial, status }) => {
                              const cfg = STATUS_CONFIG[status];
                              return (
                                <span
                                  key={serial}
                                  title={`${serial} — ${cfg.label}`}
                                  style={{
                                    fontSize: '0.63rem', fontWeight: 700,
                                    fontFamily: '"Fira Code", "Cascadia Code", monospace',
                                    padding: '3px 8px', borderRadius: '6px',
                                    color: cfg.color, background: cfg.bg,
                                    border: `1px solid ${cfg.dot}40`,
                                    letterSpacing: '0.02em',
                                    whiteSpace: 'nowrap',
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                  }}
                                >
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: cfg.dot, display: 'inline-block', flexShrink: 0 }} />
                                  {serial}
                                </span>
                              );
                            })}
                          </div>
                        )}
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
