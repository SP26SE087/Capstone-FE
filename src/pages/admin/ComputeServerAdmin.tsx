import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useToastStore } from '@/store/slices/toastSlice';
import { resourceTypeService, ResourceTypeItem, ResourceTypeCategory } from '@/services/resourceTypeService';
import { resourceService } from '@/services/resourceService';
import { Resource } from '@/types/booking';
import AdminServerPanel from './components/AdminServerPanel';
import {
  Server, Layers, Plus, Loader2, Edit2, Trash2, CheckCircle2,
  XCircle, Cpu, MemoryStick, Zap, Users, X, ShieldCheck,
  ChevronRight, Tag,
} from 'lucide-react';
import ConfirmModal from '@/components/common/ConfirmModal';
import ResourceTypePanel from '@/pages/resource/components/ResourceTypePanel';

type TabType = 'types' | 'servers';

type SlidePanel =
  | { kind: 'newType' }
  | { kind: 'editType'; item: ResourceTypeItem }
  | { kind: 'newServer' };

// ─── helpers ────────────────────────────────────────────────────────────────
const badge = (label: string, color: string, bg: string) => (
  <span style={{
    fontSize: '0.68rem', fontWeight: 700, padding: '2px 9px', borderRadius: '20px',
    color, background: bg, whiteSpace: 'nowrap' as const,
  }}>{label}</span>
);

// ─── Main page ───────────────────────────────────────────────────────────────
const ComputeServerAdmin: React.FC = () => {
  const { addToast } = useToastStore();
  const [tab, setTab] = useState<TabType>('types');
  const [slidePanel, setSlidePanel] = useState<SlidePanel | null>(null);

  const [types, setTypes] = useState<ResourceTypeItem[]>([]);
  const [servers, setServers] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeToDelete, setTypeToDelete] = useState<ResourceTypeItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allTypes, allResources] = await Promise.all([
        resourceTypeService.getAll(),
        resourceService.getAll(),
      ]);
      const computeTypes = allTypes.filter(t => t.category === ResourceTypeCategory.ServerCompute);
      setTypes(computeTypes);
      const computeTypeIds = new Set(computeTypes.map(t => t.id));
      const resourceArr = Array.isArray(allResources) ? allResources : (allResources as any).items ?? [];
      setServers(resourceArr.filter((r: Resource) => computeTypeIds.has(r.resourceTypeId ?? '')));
    } catch (err: any) {
      addToast(err?.message || 'Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (reload: boolean, message?: string) => {
    if (reload) load();
    if (message) addToast(message, 'success');
    setSlidePanel(null);
  };

  const handleTypeSaved = (message: string) => {
    load();
    addToast(message, 'success');
    setSlidePanel(null);
  };

  const handleDeleteType = async () => {
    if (!typeToDelete) return;
    try {
      await resourceTypeService.delete(typeToDelete.id);
      addToast('Resource type deleted.', 'success');
      load();
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Delete failed.', 'error');
    } finally {
      setTypeToDelete(null);
    }
  };

  const panelTitle = slidePanel?.kind === 'newType' ? 'New ServerCompute Type'
    : slidePanel?.kind === 'editType' ? 'Edit Resource Type'
    : 'Register Compute Server';

  return (
    <MainLayout>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 16px rgba(37,99,235,0.25)',
          }}>
            <Server size={22} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
              Compute Server Management
            </h1>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>
              Admin-only: register GPU / compute nodes accessible via browser terminal
            </p>
          </div>
        </div>

        {/* ── Setup flow hint ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', marginBottom: '20px',
        }}>
          <ShieldCheck size={15} style={{ color: '#2563eb', flexShrink: 0 }} />
          <span style={{ fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 600 }}>Setup flow:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#3b82f6' }}>
            <span style={{ padding: '2px 8px', background: '#dbeafe', borderRadius: '6px', fontWeight: 700 }}>Step 1</span>
            Create a ServerCompute resource type
            <ChevronRight size={13} />
            <span style={{ padding: '2px 8px', background: '#dbeafe', borderRadius: '6px', fontWeight: 700 }}>Step 2</span>
            Register a compute server (with SSH credentials)
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#fff', padding: '8px 12px', borderRadius: '14px',
          border: '1px solid #e2e8f0', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
            {([
              { id: 'types' as TabType, label: 'Step 1 — Resource Types', icon: <Layers size={14} /> },
              { id: 'servers' as TabType, label: 'Step 2 — Compute Servers', icon: <Server size={14} /> },
            ]).map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setSlidePanel(null); }}
                style={{
                  padding: '7px 16px', display: 'flex', alignItems: 'center', gap: '7px',
                  border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem',
                  background: tab === t.id ? '#fff' : 'transparent',
                  color: tab === t.id ? '#1e293b' : '#64748b',
                  boxShadow: tab === t.id ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {t.icon} {t.label}
                {t.id === 'types' && types.length > 0 && (
                  <span style={{ padding: '1px 7px', background: '#dbeafe', color: '#2563eb', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700 }}>
                    {types.length}
                  </span>
                )}
                {t.id === 'servers' && servers.length > 0 && (
                  <span style={{ padding: '1px 7px', background: '#dcfce7', color: '#16a34a', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700 }}>
                    {servers.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === 'types' && (
            <button onClick={() => setSlidePanel({ kind: 'newType' })} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px',
              borderRadius: '9px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
              background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff',
              boxShadow: '0 4px 12px rgba(245,158,11,0.25)',
            }}>
              <Plus size={14} /> New Type
            </button>
          )}
          {tab === 'servers' && (
            <button
              onClick={() => types.length === 0 ? setTab('types') : setSlidePanel({ kind: 'newServer' })}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px',
                borderRadius: '9px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                background: types.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                color: '#fff',
                boxShadow: types.length === 0 ? 'none' : '0 4px 12px rgba(37,99,235,0.25)',
              }}
              title={types.length === 0 ? 'Create a ServerCompute resource type first (Step 1)' : undefined}
            >
              <Plus size={14} /> Register Server
            </button>
          )}
        </div>

        {/* ── Content + slide panel ── */}
        <div style={{ display: 'flex', gap: '16px', minHeight: '500px' }}>

          {/* Left: list */}
          <div style={{ flex: slidePanel ? 6 : 10, transition: 'flex 0.35s ease', minWidth: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '10px', color: '#94a3b8' }}>
                <Loader2 size={28} className="animate-spin" />
                <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>Loading...</span>
              </div>
            ) : tab === 'types' ? (
              <TypesList
                types={types}
                onEdit={item => setSlidePanel({ kind: 'editType', item })}
                onDelete={setTypeToDelete}
                onNew={() => setSlidePanel({ kind: 'newType' })}
              />
            ) : (
              <ServersList
                servers={servers}
                onNew={() => types.length === 0 ? setTab('types') : setSlidePanel({ kind: 'newServer' })}
                hasTypes={types.length > 0}
              />
            )}
          </div>

          {/* Right: slide panel */}
          {slidePanel && (
            <div style={{
              flex: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)', padding: '20px', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              animation: 'slideIn 0.3s cubic-bezier(0,0,0.2,1)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{panelTitle}</h2>
                <button onClick={() => setSlidePanel(null)} style={{ background: '#f1f5f9', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={15} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                {(slidePanel.kind === 'newType' || slidePanel.kind === 'editType') && (
                  <ResourceTypePanel
                    editing={slidePanel.kind === 'editType' ? slidePanel.item : undefined}
                    onClose={() => setSlidePanel(null)}
                    onSaved={handleTypeSaved}
                  />
                )}
                {slidePanel.kind === 'newServer' && (
                  <AdminServerPanel
                    onClose={() => setSlidePanel(null)}
                    onSaved={handleSaved}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!typeToDelete}
        onClose={() => setTypeToDelete(null)}
        onConfirm={handleDeleteType}
        title="Delete Resource Type"
        message={`Delete "${typeToDelete?.name}"? Any servers using this type will lose their type assignment.`}
        confirmText="Delete"
        variant="danger"
      />

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(24px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
      `}</style>
    </MainLayout>
  );
};

// ─── Types list ──────────────────────────────────────────────────────────────
const TypesList: React.FC<{
  types: ResourceTypeItem[];
  onEdit: (item: ResourceTypeItem) => void;
  onDelete: (item: ResourceTypeItem) => void;
  onNew: () => void;
}> = ({ types, onEdit, onDelete, onNew }) => {
  if (types.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '360px', gap: '14px', color: '#94a3b8' }}>
        <Layers size={44} style={{ opacity: 0.3 }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#475569' }}>No ServerCompute types yet</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>Create one to get started with Step 1</p>
        </div>
        <button onClick={onNew} style={{ padding: '8px 20px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14} /> New Type</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {types.map(t => (
        <div key={t.id} style={{
          padding: '14px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px',
          display: 'flex', alignItems: 'center', gap: '14px',
          transition: 'box-shadow 0.2s',
        }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Tag size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{t.name}</span>
              {badge('ServerCompute', '#0369a1', '#e0f2fe')}
              {t.isActive === false
                ? badge('Inactive', '#64748b', '#f1f5f9')
                : badge('Active', '#16a34a', '#dcfce7')}
            </div>
            {t.description && (
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{t.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button onClick={() => onEdit(t)} style={iconBtn('#3b82f6', '#eff6ff')} title="Edit">
              <Edit2 size={14} />
            </button>
            <button onClick={() => onDelete(t)} style={iconBtn('#ef4444', '#fef2f2')} title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Servers list ─────────────────────────────────────────────────────────────
const ServersList: React.FC<{
  servers: Resource[];
  onNew: () => void;
  hasTypes: boolean;
}> = ({ servers, onNew, hasTypes }) => {
  if (servers.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '360px', gap: '14px', color: '#94a3b8' }}>
        <Server size={44} style={{ opacity: 0.3 }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#475569' }}>No compute servers registered</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
            {hasTypes ? 'Register your first server with SSH credentials' : 'Complete Step 1 first — create a ServerCompute type'}
          </p>
        </div>
        <button onClick={onNew} style={{ padding: '8px 20px', borderRadius: '9px', border: 'none', background: hasTypes ? 'linear-gradient(135deg, #0ea5e9, #2563eb)' : '#94a3b8', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: hasTypes ? 'pointer' : 'not-allowed' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14} /> {hasTypes ? 'Register Server' : 'Go to Step 1 first'}</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {servers.map(s => (
        <div key={s.id} style={{ padding: '14px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Server size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' as const }}>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>{s.name}</span>
              {s.resourceTypeName && badge(s.resourceTypeName, '#0369a1', '#e0f2fe')}
              {s.status != null
                ? badge('Available', '#16a34a', '#dcfce7')
                : badge('Unknown', '#64748b', '#f1f5f9')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' as const }}>
              {s.description && (
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.description}</span>
              )}
              {s.location && (
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  📍 {s.location}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px', flexWrap: 'wrap' as const }}>
              {s.modelSeries && (
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Zap size={11} /> {s.modelSeries}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>SSH terminal available</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>Credentials stored</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const iconBtn = (color: string, bg: string): React.CSSProperties => ({
  width: '30px', height: '30px', borderRadius: '8px', border: 'none',
  background: bg, color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
});

export default ComputeServerAdmin;
