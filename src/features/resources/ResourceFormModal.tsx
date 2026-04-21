import React, { useState, useEffect } from 'react';
import AppSelect from '@/components/common/AppSelect';
import { Resource, ResourceType } from '@/types/booking';
import { userService } from '@/services/userService';
import { useAuth } from '@/hooks/useAuth';
import { X, Save, Cpu, HardDrive, Database, Monitor, Package, Info, MapPin, Hash, AlertTriangle, Type, User } from 'lucide-react';
import { validateTextField } from '@/utils/validation';

interface ResourceFormModalProps {
  resource?: Resource;
  onClose: () => void;
  onSubmit: (resourceData: Partial<Resource> & { managedByEmail: string }) => void;
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1.5px solid var(--border-color)', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  color: 'var(--text-primary)', background: '#fff', transition: 'border-color 0.18s',
};
const labelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  fontSize: 11, fontWeight: 800, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7,
};
const errStyle: React.CSSProperties = {
  fontSize: 11, color: '#ef4444', marginTop: 4, display: 'block',
};
const qtyBtnStyle: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 8, border: '1.5px solid var(--border-color)',
  background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0,
};

const TYPE_OPTIONS = [
  { value: ResourceType.GPU,        label: 'GPU Node',        desc: 'Compute GPU / cluster',    color: '#7c3aed', icon: <Cpu size={14} /> },
  { value: ResourceType.Equipment,  label: 'Equipment',       desc: 'Hardware / peripherals',   color: '#2563eb', icon: <HardDrive size={14} /> },
  { value: ResourceType.Dataset,    label: 'Dataset',         desc: 'Data storage / NAS',       color: '#059669', icon: <Database size={14} /> },
  { value: ResourceType.LabStation, label: 'Lab Station',     desc: 'Desk / workstation',       color: '#ea580c', icon: <Monitor size={14} /> },
];

const ResourceFormModal: React.FC<ResourceFormModalProps> = ({ resource, onClose, onSubmit }) => {
  const { user: currentUser } = useAuth();
  const isEditing = !!resource;
  
  const [name, setName] = useState(resource?.name || '');
  const [description, setDescription] = useState(resource?.description || '');
  const [type, setType] = useState<ResourceType>(resource?.type || ResourceType.GPU);
  const [location, setLocation] = useState(resource?.location || '');
  const [totalQuantity, setTotalQuantity] = useState(resource?.totalQuantity || 1);
  const [damagedQuantity, setDamagedQuantity] = useState(resource?.damagedQuantity || 0);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; description?: string; location?: string }>({});
  
  // Managed By selection state
  const [managedBy, setManagedBy] = useState(resource?.managedBy || "");
  const [directors, setDirectors] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Sync managedBy with currentUser once available
  useEffect(() => {
    if (currentUser?.email && (managedBy === "" || !managedBy)) {
      setManagedBy(currentUser.email);
    }
  }, [currentUser?.email]);

  useEffect(() => {
    const fetchDirectors = async () => {
      setLoadingUsers(true);
      try {
        const users = await userService.getAll();
        // Lọc Admin/Director hoặc lấy toàn bộ nếu list rỗng
        const filtered = users.filter((u: any) => 
            Number(u.role) === 1 || Number(u.role) === 2 || 
            u.role === 'Admin' || u.role === 'LabDirector' || u.role === 'Lab Director'
        );
        setDirectors(filtered.length > 0 ? filtered : users);
      } catch (error) {
        console.error('Failed to load users:', error);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchDirectors();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = validateTextField(name, 'Resource title', { required: true, maxLength: 200 });
    const descErr = validateTextField(description, 'Description', { required: true, maxLength: 2000 });
    const locErr = validateTextField(location, 'Location', { maxLength: 200 });
    if (nameErr || descErr || locErr) {
      setFieldErrors({ name: nameErr, description: descErr, location: locErr });
      return;
    }
    setFieldErrors({});
    
    // Đảm bảo managedBy không bị trống trước khi gửi
    const finalManagedBy = managedBy || currentUser.email || '';
    
    if (!finalManagedBy) {
        alert("Please select a manager (Managed By) for this resource.");
        return;
    }

    onSubmit({
      id: resource?.id,
      name,
      description,
      type,
      location,
      totalQuantity,
      damagedQuantity,
      availableQuantity: totalQuantity - damagedQuantity,
      managedByEmail: finalManagedBy
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: '16px' }}>
      <div style={{ width: 820, maxWidth: '95vw', maxHeight: '90vh', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px -15px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(135deg, var(--primary-color, #1e3a5f) 0%, var(--secondary-color, #2d5a8e) 100%)' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Package size={22} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
              {isEditing ? 'Modify Inventory Item' : 'Register New Resource'}
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)' }}>
              {isEditing ? 'Update the details of an existing lab asset' : 'Add a new piece of equipment to the lab inventory'}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 99, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* ── Body ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }} className="custom-scrollbar">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px' }}>

              {/* ── Left: main info ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                {/* Name */}
                <div>
                  <label style={labelStyle}><Type size={12} /> Resource Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => { setName(e.target.value); setFieldErrors(p => ({ ...p, name: validateTextField(e.target.value, 'Resource title', { required: true, maxLength: 200 }) })); }}
                    placeholder="e.g., NVIDIA RTX 4090 GPU Node"
                    maxLength={200}
                    required
                    style={{ ...inputStyle, ...(fieldErrors.name ? { borderColor: '#ef4444' } : {}) }}
                  />
                  {fieldErrors.name && <span style={errStyle}>{fieldErrors.name}</span>}
                </div>

                {/* Type + Location */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}><Package size={12} /> Type <span style={{ color: '#ef4444' }}>*</span></label>
                    {/* Type selector rendered as button strip */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {TYPE_OPTIONS.map(opt => {
                        const active = type === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setType(opt.value)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                              border: `1.5px solid ${active ? opt.color : 'var(--border-color)'}`,
                              background: active ? `${opt.color}12` : '#fafafa',
                              transition: 'all 0.12s',
                            }}
                          >
                            <span style={{ width: 28, height: 28, borderRadius: 8, background: active ? `${opt.color}20` : '#f1f5f9', color: active ? opt.color : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.12s' }}>
                              {opt.icon}
                            </span>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: active ? opt.color : 'var(--text-primary)', lineHeight: 1.2 }}>{opt.label}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 1 }}>{opt.desc}</div>
                            </div>
                            <span style={{ marginLeft: 'auto', width: 16, height: 16, borderRadius: 99, border: `2px solid ${active ? opt.color : '#cbd5e1'}`, background: active ? opt.color : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.12s' }}>
                              {active && <span style={{ width: 5, height: 5, borderRadius: 99, background: '#fff', display: 'block' }} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={labelStyle}><MapPin size={12} /> Location</label>
                      <input
                        type="text"
                        value={location}
                        onChange={e => { setLocation(e.target.value); setFieldErrors(p => ({ ...p, location: validateTextField(e.target.value, 'Location', { maxLength: 200 }) })); }}
                        placeholder="e.g., Rack A4, Room 201"
                        maxLength={200}
                        style={{ ...inputStyle, ...(fieldErrors.location ? { borderColor: '#ef4444' } : {}) }}
                      />
                      {fieldErrors.location && <span style={errStyle}>{fieldErrors.location}</span>}
                    </div>
                    <div>
                      <label style={labelStyle}><User size={12} /> Managed By <span style={{ color: '#ef4444' }}>*</span></label>
                      <AppSelect
                        value={managedBy}
                        onChange={setManagedBy}
                        placeholder="Select a manager..."
                        isDisabled={loadingUsers}
                        isLoading={loadingUsers}
                        options={[
                          ...(currentUser.email ? [{ value: currentUser.email, label: `Me (${currentUser.name})` }] : []),
                          ...directors.filter(d => d.id !== currentUser.userId).map(dir => ({
                            value: dir.email || dir.id,
                            label: dir.fullName || dir.name,
                          })),
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={labelStyle}><Info size={12} /> Description / Notes <span style={{ color: '#ef4444' }}>*</span></label>
                  <textarea
                    value={description}
                    onChange={e => { setDescription(e.target.value); setFieldErrors(p => ({ ...p, description: validateTextField(e.target.value, 'Description', { required: true, maxLength: 2000 }) })); }}
                    placeholder="Technical specs, serial numbers, model, etc."
                    rows={5}
                    maxLength={2000}
                    required
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, minHeight: 100, ...(fieldErrors.description ? { borderColor: '#ef4444' } : {}) }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                    {fieldErrors.description ? <span style={errStyle}>{fieldErrors.description}</span> : <span />}
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{description.length}/2000</span>
                  </div>
                </div>
              </div>

              {/* ── Right: inventory metrics ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: '18px', background: 'var(--background-color)', borderRadius: 14, border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-light)' }}>
                    <Hash size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Asset Metrics</span>
                  </div>

                  {/* Total qty */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Total Units</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button type="button" onClick={() => setTotalQuantity(v => Math.max(1, v - 1))}
                        style={qtyBtnStyle}>−</button>
                      <input
                        type="number" min={1} value={totalQuantity}
                        onChange={e => setTotalQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ ...inputStyle, textAlign: 'center', fontWeight: 800, fontSize: 15, flex: 1, minWidth: 0 }}
                      />
                      <button type="button" onClick={() => setTotalQuantity(v => v + 1)}
                        style={qtyBtnStyle}>+</button>
                    </div>
                  </div>

                  {/* Damaged qty */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Damaged / Offline</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button type="button" onClick={() => setDamagedQuantity(v => Math.max(0, v - 1))}
                        style={qtyBtnStyle}>−</button>
                      <input
                        type="number" min={0} max={totalQuantity} value={damagedQuantity}
                        onChange={e => setDamagedQuantity(Math.min(totalQuantity, Math.max(0, parseInt(e.target.value) || 0)))}
                        style={{ ...inputStyle, textAlign: 'center', fontWeight: 800, fontSize: 15, flex: 1, minWidth: 0, borderColor: damagedQuantity > 0 ? '#f59e0b' : undefined, background: damagedQuantity > 0 ? '#fffbeb' : undefined }}
                      />
                      <button type="button" onClick={() => setDamagedQuantity(v => Math.min(totalQuantity, v + 1))}
                        style={qtyBtnStyle}>+</button>
                    </div>
                  </div>

                  {/* Health bar */}
                  <div style={{ padding: '14px', background: '#fff', borderRadius: 10, border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Health</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>{totalQuantity} total</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                      {[
                        { label: 'Operational', value: totalQuantity - damagedQuantity, color: '#10b981', bg: '#ecfdf5' },
                        { label: 'Damaged',     value: damagedQuantity,                color: damagedQuantity > 0 ? '#f59e0b' : '#94a3b8', bg: damagedQuantity > 0 ? '#fffbeb' : '#f8fafc' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px', background: s.bg, borderRadius: 8 }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3, opacity: 0.8 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ height: 7, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99,
                        background: 'linear-gradient(90deg, #10b981, #34d399)',
                        width: totalQuantity > 0 ? `${((totalQuantity - damagedQuantity) / totalQuantity) * 100}%` : '100%',
                        transition: 'width 0.35s ease',
                      }} />
                    </div>
                    {damagedQuantity > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>
                        <AlertTriangle size={13} />
                        {damagedQuantity} unit{damagedQuantity > 1 ? 's' : ''} offline
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-light)', background: 'var(--background-color)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '9px 22px', borderRadius: 10, border: '1px solid var(--border-color)', background: '#fff', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 28px', borderRadius: 10, border: 'none', background: 'var(--accent-color)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px -3px rgba(232,114,12,0.4)' }}>
              <Save size={15} />
              {isEditing ? 'Save Changes' : 'Add to Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResourceFormModal;
