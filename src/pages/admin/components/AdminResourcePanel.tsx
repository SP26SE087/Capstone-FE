import React, { useState, useEffect } from 'react';
import AppSelect from '@/components/common/AppSelect';
import { Resource } from '@/types/booking';
import { resourceService } from '@/services/resourceService';
import { X, Layers, Loader2, Save, Info, CheckCircle, AlertTriangle, Clock, Hash } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AdminResourcePanelProps {
  editingResource?: Resource;
  onClose: () => void;
  onSaved: (reload: boolean, message?: string) => void;
}

/* ── types ─────────────────────────────────────────────────────────────────── */
type UnitStatus = 'available' | 'in-use' | 'damaged';

const STATUS_CONFIG: Record<UnitStatus, { label: string; icon: React.ReactNode; color: string; bg: string; border: string; dot: string }> = {
  available: { label: 'Available',  icon: <CheckCircle size={13} />, color: '#16a34a', bg: '#dcfce7', border: '#86efac', dot: '#22c55e' },
  'in-use':  { label: 'In Use',     icon: <Clock size={13} />,       color: '#b45309', bg: '#fef9c3', border: '#fde68a', dot: '#f59e0b' },
  damaged:   { label: 'Damaged',    icon: <AlertTriangle size={13} />, color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', dot: '#ef4444' },
};

function deriveUnitStatuses(resource: Resource): { serial: string; status: UnitStatus; id?: string }[] {
  const serials: string[] = Array.isArray(resource.serials) && resource.serials.length > 0
    ? resource.serials
    : resource.ids.map((_, i) => `UNIT-${String(i + 1).padStart(3, '0')}`);

  const availableIdSet = new Set(resource.availableIds || []);
  const total     = serials.length;
  const damaged   = resource.damagedQuantity ?? 0;
  const available = resource.availableQuantity ?? (total - damaged);

  return serials.map((serial, idx) => {
    const id = resource.ids[idx];
    if (resource.availableIds && resource.availableIds.length > 0) {
      if (id && availableIdSet.has(id)) return { serial, status: 'available', id };
      if (idx < damaged) return { serial, status: 'damaged', id };
      return { serial, status: 'in-use', id };
    }
    if (idx < available) return { serial, status: 'available', id };
    if (idx < available + damaged) return { serial, status: 'damaged', id };
    return { serial, status: 'in-use', id };
  });
}

/* ── component ──────────────────────────────────────────────────────────────── */
const AdminResourcePanel: React.FC<AdminResourcePanelProps> = ({
  editingResource,
  onClose,
  onSaved,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Resource> & { modelSeriesList: string[] }>({
    name: '',
    description: '',
    type: 1,
    location: '',
    totalQuantity: 1,
    modelSeriesList: ['DEFAULT-001'],
  });

  useEffect(() => {
    if (editingResource) {
      setFormData({
        ...editingResource,
        modelSeriesList: (editingResource as any).modelSeriesList || editingResource.serials || ['DEFAULT-001'],
      });
    }
  }, [editingResource]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const requestData = {
        name: formData.name || '',
        description: formData.description || '',
        type: Number(formData.type) || 1,
        resourceTypeId: formData.resourceTypeId || String(Number(formData.type) || 1),
        location: formData.location || '',
        modelSeriesList: formData.modelSeriesList,
      };

      if (editingResource) {
        await resourceService.update(editingResource.id, requestData);
        onSaved(true, 'Resource updated successfully.');
      } else {
        await resourceService.create({
          ...requestData,
          managedByEmail: user?.email || '',
        });
        onSaved(true, 'Resource registered successfully.');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Derived unit statuses (only when editing)
  const units = editingResource ? deriveUnitStatuses(editingResource) : [];
  const availableCount = units.filter(u => u.status === 'available').length;
  const inUseCount     = units.filter(u => u.status === 'in-use').length;
  const damagedCount   = units.filter(u => u.status === 'damaged').length;

  const overallStatus: UnitStatus =
    units.length === 0 ? 'available' :
    availableCount === 0 && damagedCount > 0 ? 'damaged' :
    availableCount === 0 ? 'in-use' : 'available';
  const osc = STATUS_CONFIG[overallStatus];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {editingResource ? editingResource.name : 'Register Resource'}
          </h2>
          {editingResource ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Now-status badge */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px',
                borderRadius: '20px', color: osc.color, background: osc.bg,
                border: `1px solid ${osc.border}`,
              }}>
                {osc.icon} {osc.label}
              </span>
              {/* Unit count summary */}
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                {editingResource.totalQuantity} units total
              </span>
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Add new equipment to lab inventory</p>
          )}
        </div>
        <button onClick={onClose} style={{ padding: '8px', borderRadius: '10px', background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}>
          <X size={20} />
        </button>
      </div>

      {/* ── Unit Status Summary (edit mode only) ── */}
      {editingResource && units.length > 0 && (
        <div style={{ marginBottom: '1.25rem', padding: '14px 16px', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <Hash size={13} color="#475569" />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Unit Status by Serial Number
            </span>
          </div>

          {/* Summary pills */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {([
              { count: availableCount, status: 'available' as UnitStatus },
              { count: inUseCount,     status: 'in-use' as UnitStatus },
              { count: damagedCount,   status: 'damaged' as UnitStatus },
            ] as const).filter(s => s.count > 0).map(s => {
              const cfg = STATUS_CONFIG[s.status];
              return (
                <div key={s.status} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '5px 12px', borderRadius: '20px',
                  color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
                  fontSize: '0.72rem', fontWeight: 800,
                }}>
                  {cfg.icon}
                  <span>{s.count} {cfg.label}</span>
                </div>
              );
            })}
          </div>

          {/* Serial badge grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {units.map(({ serial, status }) => {
              const cfg = STATUS_CONFIG[status];
              return (
                <span
                  key={serial}
                  title={`${serial} — ${cfg.label}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    fontSize: '0.65rem', fontWeight: 700,
                    fontFamily: '"Fira Code", "Cascadia Code", monospace',
                    padding: '4px 9px', borderRadius: '7px',
                    color: cfg.color, background: cfg.bg,
                    border: `1.5px solid ${cfg.border}`,
                    letterSpacing: '0.03em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot, display: 'inline-block', flexShrink: 0 }} />
                  {serial}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Basic Info */}
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: '#334155' }}>
              <Info size={16} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Basic Information</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Resource Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. NVIDIA A100 GPU"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Category</label>
                  <AppSelect
                    value={String(formData.type)}
                    onChange={val => setFormData({ ...formData, type: Number(val) })}
                    options={[
                      { value: '1', label: 'GPU' },
                      { value: '2', label: 'Equipment' },
                      { value: '3', label: 'Dataset' },
                      { value: '4', label: 'Lab Station' },
                    ]}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Internal Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Rack A-05"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed specs or usage guidelines..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem', outline: 'none', minHeight: '80px', resize: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {/* Inventory Logic */}
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: '#334155' }}>
              <Layers size={16} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Serial Number Units</span>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                Serial Numbers <span style={{ color: '#94a3b8', fontWeight: 500 }}>(comma separated)</span>
              </label>
              <input
                type="text"
                value={formData.modelSeriesList?.join(', ')}
                onChange={e => setFormData({ ...formData, modelSeriesList: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="SN-001, SN-002, SN-003"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem', fontFamily: '"Fira Code", monospace', outline: 'none', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '6px' }}>
                Each serial number represents one physical unit. Total quantity = number of serials provided.
              </p>

              {/* Live preview of entered serials */}
              {(formData.modelSeriesList?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
                  {formData.modelSeriesList?.map((s, i) => (
                    <span key={i} style={{
                      fontSize: '0.63rem', fontWeight: 700, fontFamily: '"Fira Code", monospace',
                      padding: '3px 9px', borderRadius: '6px',
                      background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* ── Footer Actions ── */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: '12px', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Discard
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: '10px 24px',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            border: 'none', color: 'white', borderRadius: '12px',
            fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> {editingResource ? 'Update Inventory' : 'Register Resource'}</>}
        </button>
      </div>
    </div>
  );
};

export default AdminResourcePanel;
