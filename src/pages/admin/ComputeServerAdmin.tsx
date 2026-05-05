import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useToastStore } from '@/store/slices/toastSlice';
import { resourceTypeService, ResourceTypeItem, ResourceTypeCategory } from '@/services/resourceTypeService';
import { resourceService } from '@/services/resourceService';
import { Resource } from '@/types/booking';
import { serverService, ServerResourceDetail } from '@/services/serverService';
import { useAuth } from '@/hooks/useAuth';
import AdminServerPanel from './components/AdminServerPanel';
import {
  Server, Layers, Plus, Loader2, Edit2, Trash2, CheckCircle2,
  XCircle, Cpu, MemoryStick, Zap, Users, X, ShieldCheck,
  ChevronRight, Tag, Eye, MapPin, Network, Hash, Key, Mail, UserCircle,
  Calendar, AlertTriangle,
} from 'lucide-react';
import ConfirmModal from '@/components/common/ConfirmModal';
import ResourceTypePanel from '@/pages/resource/components/ResourceTypePanel';

type TabType = 'types' | 'servers';

type SlidePanel =
  | { kind: 'newType' }
  | { kind: 'editType'; item: ResourceTypeItem }
  | { kind: 'viewType'; item: ResourceTypeItem }
  | { kind: 'newServer' }
  | { kind: 'viewServer'; item: Resource }
  | { kind: 'editServer'; item: Resource };

// ─── helpers ────────────────────────────────────────────────────────────────
const badge = (label: string, color: string, bg: string) => (
  <span style={{
    fontSize: '0.68rem', fontWeight: 700, padding: '2px 9px', borderRadius: '20px',
    color, background: bg, whiteSpace: 'nowrap' as const,
  }}>{label}</span>
);

// ─── Embeddable content (no MainLayout) ────────────────────────────────────
export const ComputeServerContent: React.FC = () => {
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
    : slidePanel?.kind === 'viewType' ? 'Resource Type Details'
    : slidePanel?.kind === 'viewServer' ? 'Compute Server Details'
    : slidePanel?.kind === 'editServer' ? 'Edit Compute Server'
    : 'Register Compute Server';

  return (
    <>
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
                onView={item => setSlidePanel({ kind: 'viewType', item })}
              />
            ) : (
              <ServersList
                servers={servers}
                onNew={() => types.length === 0 ? setTab('types') : setSlidePanel({ kind: 'newServer' })}
                hasTypes={types.length > 0}
                onView={item => setSlidePanel({ kind: 'viewServer', item })}
                onEdit={item => setSlidePanel({ kind: 'editServer', item })}
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
                {slidePanel.kind === 'viewType' && (
                  <TypeDetailView item={slidePanel.item} onEdit={() => setSlidePanel({ kind: 'editType', item: slidePanel.item })} />
                )}
                {slidePanel.kind === 'newServer' && (
                  <AdminServerPanel
                    onClose={() => setSlidePanel(null)}
                    onSaved={handleSaved}
                  />
                )}
                {slidePanel.kind === 'editServer' && (
                  <AdminServerPanel
                    editingId={slidePanel.item.id}
                    onClose={() => setSlidePanel(null)}
                    onSaved={handleSaved}
                  />
                )}
                {slidePanel.kind === 'viewServer' && (
                  <ServerDetailView
                    server={slidePanel.item}
                    onEdit={() => setSlidePanel({ kind: 'editServer', item: slidePanel.item })}
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
    </>
  );
};

// ─── Page wrapper (with MainLayout) ─────────────────────────────────────────
const ComputeServerAdmin: React.FC = () => (
  <MainLayout>
    <ComputeServerContent />
  </MainLayout>
);

// ─── Types list ──────────────────────────────────────────────────────────────
const TypesList: React.FC<{
  types: ResourceTypeItem[];
  onEdit: (item: ResourceTypeItem) => void;
  onDelete: (item: ResourceTypeItem) => void;
  onNew: () => void;
  onView: (item: ResourceTypeItem) => void;
}> = ({ types, onEdit, onDelete, onNew, onView }) => {
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
          padding: '10px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
          display: 'flex', alignItems: 'center', gap: '10px',
          transition: 'box-shadow 0.2s',
        }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Tag size={15} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.87rem', color: '#0f172a' }}>{t.name}</span>
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
            <button onClick={() => onView(t)} style={iconBtn('#0ea5e9', '#f0f9ff')} title="View details">
              <Eye size={14} />
            </button>
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
  onView: (item: Resource) => void;
  onEdit: (item: Resource) => void;
}> = ({ servers, onNew, hasTypes, onView, onEdit }) => {
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
        <div key={s.id} style={{ padding: '10px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Server size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' as const }}>
              <span style={{ fontWeight: 700, fontSize: '0.87rem', color: '#0f172a' }}>{s.name}</span>
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
                  <MapPin size={11} /> {s.location}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
              <CheckCircle2 size={13} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>Credentials stored</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => onView(s)} style={iconBtn('#0ea5e9', '#f0f9ff')} title="View details">
                <Eye size={14} />
              </button>
              <button onClick={() => onEdit(s)} style={iconBtn('#3b82f6', '#eff6ff')} title="Edit server">
                <Edit2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Type Detail View ────────────────────────────────────────────────────────
const TypeDetailView: React.FC<{ item: ResourceTypeItem; onEdit: () => void }> = ({ item, onEdit }) => {
  const detailRow = (label: string, value: React.ReactNode, icon?: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
      <span style={{ fontSize: '0.67rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        {icon}{label}
      </span>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderRadius: '14px', border: '1px solid #fde68a' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Tag size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{item.name}</div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            {badge('ServerCompute', '#0369a1', '#e0f2fe')}
            {item.isActive === false ? badge('Inactive', '#64748b', '#f1f5f9') : badge('Active', '#16a34a', '#dcfce7')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {detailRow('Name', item.name, <Tag size={10} />)}
        {detailRow('Category', 'ServerCompute', <Layers size={10} />)}
        {detailRow('Status', item.isActive === false
          ? <span style={{ color: '#64748b' }}>Inactive</span>
          : <span style={{ color: '#16a34a' }}>Active</span>)}
        {item.description && detailRow('Description', item.description)}
      </div>

      <button onClick={onEdit} style={{
        marginTop: '4px', padding: '9px 0', borderRadius: '10px', border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff', fontWeight: 700,
        fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      }}>
        <Edit2 size={13} /> Edit This Type
      </button>
    </div>
  );
};

// ─── Server Detail View ───────────────────────────────────────────────────────
const ServerDetailView: React.FC<{ server: Resource; onEdit: () => void }> = ({ server, onEdit }) => {
  const { user } = useAuth();
  const isPrivileged = user.role === 'Admin' || user.role === 'LabDirector';

  const [detail, setDetail] = useState<ServerResourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    serverService.getServerDetail(server.id)
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(e => { if (!cancelled) setError(e?.response?.data?.message || 'Failed to load server detail.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [server.id]);

  const detailRow = (label: string, value: React.ReactNode, icon?: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
      <span style={{ fontSize: '0.67rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        {icon}{label}
      </span>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>{value}</span>
    </div>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '10px', color: '#94a3b8' }}>
      <Loader2 size={22} className="animate-spin" />
      <span style={{ fontSize: '0.85rem' }}>Loading server details…</span>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#dc2626' }}>
      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{error}</span>
    </div>
  );

  const d = detail!;
  const statusLabel = d.status === 0 ? 'Available' : 'Unavailable';
  const statusColor = d.status === 0 ? '#16a34a' : '#64748b';
  const statusBg = d.status === 0 ? '#dcfce7' : '#f1f5f9';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Hero */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: '14px', border: '1px solid #bfdbfe' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Server size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{d.name}</div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' as const }}>
            {d.resourceTypeName && badge(d.resourceTypeName, '#0369a1', '#e0f2fe')}
            {badge(statusLabel, statusColor, statusBg)}
          </div>
        </div>
      </div>

      {/* Section: Thông tin chung */}
      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.7px', padding: '0 2px', marginTop: '4px' }}>Thông tin chung</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {detailRow('Name', d.name, <Server size={10} />)}
        {d.description && detailRow('Description', d.description)}
        {d.location && detailRow('Location', d.location, <MapPin size={10} />)}
        {d.modelSeries && detailRow('Model Series', d.modelSeries, <Zap size={10} />)}
        {detailRow('Status', badge(statusLabel, statusColor, statusBg))}
        {d.managedByName && detailRow('Managed By', d.managedByName, <UserCircle size={10} />)}
        {d.managedByEmail && detailRow('Manager Email', d.managedByEmail, <Mail size={10} />)}
      </div>

      {/* Section: Trạng thái */}
      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.7px', padding: '0 2px', marginTop: '4px' }}>Trạng thái</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
        <div style={{ flex: 1, minWidth: '90px', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Available</span>
          {d.isAvailable
            ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#16a34a' }}><CheckCircle2 size={14} /> Yes</span>
            : <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}><XCircle size={14} /> No</span>}
        </div>
        <div style={{ flex: 1, minWidth: '90px', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Damaged</span>
          {d.isDamaged
            ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#dc2626' }}><AlertTriangle size={14} /> Yes</span>
            : <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#16a34a' }}><CheckCircle2 size={14} /> No</span>}
        </div>
        <div style={{ flex: 1, minWidth: '90px', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>In Use</span>
          {d.isInUse
            ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#d97706' }}><Users size={14} /> Yes</span>
            : <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}><XCircle size={14} /> No</span>}
        </div>
      </div>

      {/* Section: Thông số phần cứng (privileged only) */}
      {isPrivileged && (
        <>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.7px', padding: '0 2px', marginTop: '4px' }}>Thông số phần cứng</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {d.gpuCount != null && detailRow('GPU Count', d.gpuCount, <Zap size={10} />)}
            {d.cpuCores != null && detailRow('CPU Cores', d.cpuCores, <Cpu size={10} />)}
            {d.ramGb != null && detailRow('RAM (GB)', d.ramGb, <MemoryStick size={10} />)}
            {d.maxConcurrentUsers != null && detailRow('Max Concurrent Users', d.maxConcurrentUsers, <Users size={10} />)}
          </div>
        </>
      )}

      {/* Section: SSH Connection (privileged only) */}
      {isPrivileged && (
        <>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.7px', padding: '0 2px', marginTop: '4px' }}>SSH Connection</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px' }}>
            {d.sshHost && detailRow('Host', d.sshHost, <Network size={10} />)}
            {d.sshPort != null && detailRow('Port', d.sshPort, <Network size={10} />)}
            {d.sshUsername && detailRow('Username', d.sshUsername, <UserCircle size={10} />)}
            {detailRow('Private Key', (
              <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.8rem' }}>Đã cấu hình (ẩn)</span>
            ), <Key size={10} />)}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px' }}>
            <ShieldCheck size={14} style={{ color: '#2563eb', flexShrink: 0, marginTop: '1px' }} />
            <span style={{ fontSize: '0.73rem', color: '#1d4ed8', lineHeight: 1.5 }}>
              SSH private key được <strong>mã hóa AES-256</strong> — không bao giờ được trả về qua API.
            </span>
          </div>
        </>
      )}

      {/* Timestamps */}
      {(d.createdAt || d.updatedAt) && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
          {d.createdAt && detailRow('Created', new Date(d.createdAt).toLocaleString('vi-VN'), <Calendar size={10} />)}
          {d.updatedAt && detailRow('Updated', new Date(d.updatedAt).toLocaleString('vi-VN'), <Calendar size={10} />)}
        </div>
      )}

      {/* Edit button */}
      <button onClick={onEdit} style={{
        marginTop: '4px', padding: '9px 0', borderRadius: '10px', border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff', fontWeight: 700,
        fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      }}>
        <Edit2 size={13} /> Edit This Server
      </button>
    </div>
  );
};

const iconBtn = (color: string, bg: string): React.CSSProperties => ({
  width: '30px', height: '30px', borderRadius: '8px', border: 'none',
  background: bg, color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
});

export default ComputeServerAdmin;
