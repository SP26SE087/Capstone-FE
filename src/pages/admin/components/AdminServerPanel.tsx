import React, { useState, useEffect } from 'react';
import { resourceTypeService, ResourceTypeItem, ResourceTypeCategory } from '@/services/resourceTypeService';
import { serverService, CreateServerRequest, UpdateServerRequest } from '@/services/serverService';
import {
  Server, Save, Loader2, MapPin, FileText, Cpu, MemoryStick, Zap,
  Users, Network, Key, Eye, EyeOff, ShieldCheck, AlertTriangle, Layers,
} from 'lucide-react';

interface AdminServerPanelProps {
  /** If provided, panel operates in Edit mode, pre-filling from GET /api/resources/server/{editingId} */
  editingId?: string;
  onClose: () => void;
  onSaved: (reload: boolean, message?: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: '9px',
  border: '1.5px solid #e2e8f0',
  fontSize: '0.83rem',
  fontWeight: 500,
  fontFamily: 'inherit',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.69rem',
  fontWeight: 800,
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.7px',
  marginBottom: '5px',
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
};

const sectionStyle: React.CSSProperties = {
  padding: '14px 16px',
  background: '#f8fafc',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  marginBottom: '12px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 800,
  color: '#475569',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.7px',
  marginBottom: '12px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

function handleFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = '#3b82f6';
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)';
}
function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = '#e2e8f0';
  e.currentTarget.style.boxShadow = 'none';
}

const AdminServerPanel: React.FC<AdminServerPanelProps> = ({ editingId, onClose, onSaved }) => {
  const isEdit = !!editingId;
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [serverTypes, setServerTypes] = useState<ResourceTypeItem[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [resourceTypeId, setResourceTypeId] = useState('');
  const [location, setLocation] = useState('');
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState(22);
  const [sshUsername, setSshUsername] = useState('');
  const [sshPrivateKey, setSshPrivateKey] = useState('');
  const [gpuCount, setGpuCount] = useState<number | ''>('');
  const [cpuCores, setCpuCores] = useState<number | ''>('');
  const [ramGb, setRamGb] = useState<number | ''>('');
  const [maxConcurrentUsers, setMaxConcurrentUsers] = useState<number | ''>(4);
  const [modelSeries, setModelSeries] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoadingTypes(true);
      try {
        const all = await resourceTypeService.getAll();
        const serverOnly = all.filter(t => t.category === ResourceTypeCategory.ServerCompute);
        setServerTypes(serverOnly);
        if (!editingId && serverOnly.length === 1) setResourceTypeId(serverOnly[0].id);
      } catch {
        // non-fatal
      } finally {
        setLoadingTypes(false);
      }
    };
    load();
  }, [editingId]);

  // Pre-fill for edit mode
  useEffect(() => {
    if (!editingId) return;
    setLoadingDetail(true);
    serverService.getServerDetail(editingId)
      .then(d => {
        setName(d.name ?? '');
        setDescription(d.description ?? '');
        setResourceTypeId(d.resourceTypeId ?? '');
        setLocation(d.location ?? '');
        setSshHost(d.sshHost ?? '');
        setSshPort(d.sshPort ?? 22);
        setSshUsername(d.sshUsername ?? '');
        setSshPrivateKey(''); // never pre-fill key
        setGpuCount(d.gpuCount ?? '');
        setCpuCores(d.cpuCores ?? '');
        setRamGb(d.ramGb ?? '');
        setMaxConcurrentUsers(d.maxConcurrentUsers ?? 4);
        setModelSeries(d.modelSeries ?? '');
      })
      .catch(() => setErrors(p => ({ ...p, submit: 'Failed to load server details for editing.' })))
      .finally(() => setLoadingDetail(false));
  }, [editingId]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required.';
    if (!resourceTypeId) errs.resourceTypeId = 'Please select a resource type.';
    if (!sshHost.trim()) errs.sshHost = 'SSH host is required.';
    if (!sshUsername.trim()) errs.sshUsername = 'SSH username is required.';
    // private key required only when creating
    if (!isEdit && !sshPrivateKey.trim()) errs.sshPrivateKey = 'Private key is required.';
    if (sshPort < 1 || sshPort > 65535) errs.sshPort = 'Port must be 1–65535.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        const payload: UpdateServerRequest = {
          name: name.trim(),
          description: description.trim() || undefined,
          resourceTypeId,
          location: location.trim() || undefined,
          sshHost: sshHost.trim(),
          sshPort,
          sshUsername: sshUsername.trim(),
          // only include key if user entered one
          ...(sshPrivateKey.trim() ? { sshPrivateKey: sshPrivateKey.trim() } : {}),
          gpuCount: gpuCount !== '' ? Number(gpuCount) : undefined,
          cpuCores: cpuCores !== '' ? Number(cpuCores) : undefined,
          ramGb: ramGb !== '' ? Number(ramGb) : undefined,
          maxConcurrentUsers: maxConcurrentUsers !== '' ? Number(maxConcurrentUsers) : undefined,
          modelSeries: modelSeries.trim() || undefined,
        };
        await serverService.updateServer(editingId!, payload);
        onSaved(true, `Server "${name.trim()}" updated successfully.`);
      } else {
        const payload: CreateServerRequest = {
          name: name.trim(),
          description: description.trim() || undefined,
          resourceTypeId,
          location: location.trim() || undefined,
          sshHost: sshHost.trim(),
          sshPort,
          sshUsername: sshUsername.trim(),
          sshPrivateKey: sshPrivateKey.trim(),
          gpuCount: gpuCount !== '' ? Number(gpuCount) : undefined,
          cpuCores: cpuCores !== '' ? Number(cpuCores) : undefined,
          ramGb: ramGb !== '' ? Number(ramGb) : undefined,
          maxConcurrentUsers: maxConcurrentUsers !== '' ? Number(maxConcurrentUsers) : undefined,
          modelSeries: modelSeries.trim() || undefined,
        };
        await serverService.createServer(payload);
        onSaved(true, `Server "${name.trim()}" registered successfully.`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.title || (isEdit ? 'Failed to update server.' : 'Failed to register server.');
      setErrors(prev => ({ ...prev, submit: msg }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {loadingDetail && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', marginBottom: '14px' }}>
          <Loader2 size={15} className="animate-spin" style={{ color: '#2563eb' }} />
          <span style={{ fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 600 }}>Loading server details…</span>
        </div>
      )}

      {/* Security notice */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px',
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', marginBottom: '14px',
      }}>
        <ShieldCheck size={16} style={{ color: '#2563eb', flexShrink: 0, marginTop: '1px' }} />
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#1d4ed8', lineHeight: 1.5 }}>
          The SSH private key will be <strong>AES-256 encrypted</strong> before storage.
          The response contains no credentials — only resource ID and status.
        </p>
      </div>

      {/* Basic Info */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}><FileText size={12} /> Basic Information</div>

        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>Server Name *</label>
          <input
            style={{ ...inputStyle, borderColor: errors.name ? '#ef4444' : undefined }}
            value={name}
            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
            placeholder="e.g. GPU-Node-01"
            onFocus={handleFocus} onBlur={handleBlur}
          />
          {errors.name && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.name}</span>}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>Description</label>
          <textarea
            style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' as const }}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. 8× A100 80GB, 128 vCPU, 512GB RAM"
            onFocus={handleFocus} onBlur={handleBlur}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}><Layers size={11} /> Resource Type *</label>
            {loadingTypes ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#94a3b8' }}>
                <Loader2 size={13} className="animate-spin" /> Loading...
              </div>
            ) : serverTypes.length === 0 ? (
              <div style={{
                padding: '8px 12px', borderRadius: '9px', border: '1.5px dashed #fbbf24',
                background: '#fffbeb', fontSize: '0.75rem', color: '#92400e',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <AlertTriangle size={13} />
                No ServerCompute types found. Create one first.
              </div>
            ) : (
              <select
                style={{ ...inputStyle, borderColor: errors.resourceTypeId ? '#ef4444' : undefined }}
                value={resourceTypeId}
                onChange={e => { setResourceTypeId(e.target.value); setErrors(p => ({ ...p, resourceTypeId: '' })); }}
              >
                <option value="">Select type…</option>
                {serverTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            {errors.resourceTypeId && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.resourceTypeId}</span>}
          </div>

          <div>
            <label style={labelStyle}><MapPin size={11} /> Location</label>
            <input
              style={inputStyle}
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Datacenter A, Rack 12"
              onFocus={handleFocus} onBlur={handleBlur}
            />
          </div>
        </div>
      </div>

      {/* Hardware Specs */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}><Cpu size={12} /> Hardware Specifications</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={labelStyle}><Zap size={11} /> GPU Count</label>
            <input
              type="number" min={0}
              style={inputStyle}
              value={gpuCount}
              onChange={e => setGpuCount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 8"
              onFocus={handleFocus} onBlur={handleBlur}
            />
          </div>
          <div>
            <label style={labelStyle}><Server size={11} /> Model Series</label>
            <input
              style={inputStyle}
              value={modelSeries}
              onChange={e => setModelSeries(e.target.value)}
              placeholder="e.g. NVIDIA A100 80GB"
              onFocus={handleFocus} onBlur={handleBlur}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}><Cpu size={11} /> CPU Cores</label>
            <input
              type="number" min={1}
              style={inputStyle}
              value={cpuCores}
              onChange={e => setCpuCores(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 128"
              onFocus={handleFocus} onBlur={handleBlur}
            />
          </div>
          <div>
            <label style={labelStyle}><MemoryStick size={11} /> RAM (GB)</label>
            <input
              type="number" min={1}
              style={inputStyle}
              value={ramGb}
              onChange={e => setRamGb(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 512"
              onFocus={handleFocus} onBlur={handleBlur}
            />
          </div>
          <div>
            <label style={labelStyle}><Users size={11} /> Max Concurrent Users</label>
            <input
              type="number" min={1}
              style={inputStyle}
              value={maxConcurrentUsers}
              onChange={e => setMaxConcurrentUsers(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 4"
              onFocus={handleFocus} onBlur={handleBlur}
            />
          </div>
        </div>
      </div>

      {/* SSH Credentials */}
      <div style={{ ...sectionStyle, border: '1px solid #e0f2fe', background: '#f0f9ff' }}>
        <div style={{ ...sectionTitleStyle, color: '#0369a1' }}><Key size={12} /> SSH Credentials</div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={labelStyle}><Network size={11} /> SSH Host *</label>
            <input
              style={{ ...inputStyle, borderColor: errors.sshHost ? '#ef4444' : undefined }}
              value={sshHost}
              onChange={e => { setSshHost(e.target.value); setErrors(p => ({ ...p, sshHost: '' })); }}
              placeholder="e.g. 192.168.10.5"
              onFocus={handleFocus} onBlur={handleBlur}
            />
            {errors.sshHost && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.sshHost}</span>}
          </div>
          <div>
            <label style={labelStyle}>SSH Port *</label>
            <input
              type="number" min={1} max={65535}
              style={{ ...inputStyle, borderColor: errors.sshPort ? '#ef4444' : undefined }}
              value={sshPort}
              onChange={e => { setSshPort(Number(e.target.value)); setErrors(p => ({ ...p, sshPort: '' })); }}
              onFocus={handleFocus} onBlur={handleBlur}
            />
            {errors.sshPort && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.sshPort}</span>}
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>SSH Username *</label>
          <input
            style={{ ...inputStyle, borderColor: errors.sshUsername ? '#ef4444' : undefined }}
            value={sshUsername}
            onChange={e => { setSshUsername(e.target.value); setErrors(p => ({ ...p, sshUsername: '' })); }}
            placeholder="e.g. labuser"
            onFocus={handleFocus} onBlur={handleBlur}
          />
          {errors.sshUsername && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.sshUsername}</span>}
        </div>

        <div>
          <label style={{ ...labelStyle, justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>SSH Private Key *</span>
            <button
              type="button"
              onClick={() => setShowPrivateKey(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, padding: 0 }}
            >
              {showPrivateKey ? <EyeOff size={12} /> : <Eye size={12} />}
              {showPrivateKey ? 'Hide' : 'Show'}
            </button>
          </label>
          <textarea
            style={{
              ...inputStyle,
              minHeight: '110px',
              resize: 'vertical' as const,
              fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
              fontSize: '0.72rem',
              letterSpacing: '0.01em',
              filter: showPrivateKey ? 'none' : 'blur(4px)',
              transition: 'filter 0.2s',
              borderColor: errors.sshPrivateKey ? '#ef4444' : '#bae6fd',
              background: '#fff',
            }}
            value={sshPrivateKey}
            onChange={e => { setSshPrivateKey(e.target.value); setErrors(p => ({ ...p, sshPrivateKey: '' })); }}
            placeholder={'SSH PRIVATE KEY'}
            onFocus={e => { setShowPrivateKey(true); handleFocus(e); }}
            onBlur={e => { handleBlur(e); }}
          />
          {!isEdit && errors.sshPrivateKey && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.sshPrivateKey}</span>}
          {isEdit && (
            <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
              Để trống nếu không muốn thay đổi private key hiện tại.
            </span>
          )}
        </div>
      </div>

      {errors.submit && (
        <div style={{
          padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: '9px', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600, marginBottom: '12px',
        }}>
          {errors.submit}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
        <button
          onClick={onClose}
          style={{ padding: '8px 20px', borderRadius: '9px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || serverTypes.length === 0}
          style={{
            padding: '8px 24px', borderRadius: '9px', border: 'none',
            background: saving || serverTypes.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9, #2563eb)',
            color: '#fff', cursor: saving || serverTypes.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
            boxShadow: saving || serverTypes.length === 0 ? 'none' : '0 4px 12px rgba(37,99,235,0.25)',
          }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isEdit ? 'Save Changes' : 'Register Server'}
        </button>
      </div>
    </div>
  );
};

export default AdminServerPanel;
