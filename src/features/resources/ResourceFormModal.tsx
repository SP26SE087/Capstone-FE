import React, { useState, useEffect } from 'react';
import AppSelect from '@/components/common/AppSelect';
import { Resource, ResourceType } from '@/types/booking';
import { userService } from '@/services/userService';
import { useAuth } from '@/hooks/useAuth';
import { X, Save, Box, Info, MapPin, Hash, AlertTriangle, Type, Package, User } from 'lucide-react';
import { validateTextField } from '@/utils/validation';

interface ResourceFormModalProps {
  resource?: Resource;
  onClose: () => void;
  onSubmit: (resourceData: Partial<Resource> & { managedByEmail: string }) => void;
}

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
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '800px', maxHeight: '90vh' }}>
        {/* Modal Header */}
        <div className="modal-header" style={{ 
          background: 'linear-gradient(to right, var(--primary-color), var(--secondary-color))',
          color: 'white',
          border: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '12px' }}>
              <Box size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.25rem' }}>
                {isEditing ? 'Modify Inventory Item' : 'Register New Resource'}
              </h2>
              <p style={{ margin: '4px 0 0 0', opacity: 0.7, fontSize: '0.8rem' }}>
                {isEditing ? 'Updating existing lab asset information' : 'Adding a new piece of equipment to the lab database'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ color: 'white', opacity: 0.6 }}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Modal Body - Scrollable */}
          <div className="modal-body" style={{ background: 'white' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
              {/* Left Column: Information */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">
                    <Type size={14} className="text-muted" /> Resource Title <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setFieldErrors(prev => ({ ...prev, name: validateTextField(e.target.value, 'Resource title', { required: true, maxLength: 200 }) })); }}
                    placeholder="e.g., NVIDIA RTX 4090 GPU Node"
                    required
                    maxLength={200}
                    style={fieldErrors.name ? { borderColor: '#ef4444' } : undefined}
                  />
                  {fieldErrors.name && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{fieldErrors.name}</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                   <div className="form-group">
                      <label className="form-label">
                        <Package size={14} className="text-muted" /> Type <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <AppSelect
                          value={String(type)}
                          onChange={val => setType(parseInt(val) as ResourceType)}
                          options={[
                              { value: String(ResourceType.GPU), label: 'GPU Node' },
                              { value: String(ResourceType.Equipment), label: 'Equipment / Hardware' },
                              { value: String(ResourceType.Dataset), label: 'Dataset / Storage' },
                              { value: String(ResourceType.LabStation), label: 'Lab Station / Desk' },
                          ]}
                      />
                  </div>
                  <div className="form-group">
                      <label className="form-label">
                        <MapPin size={14} className="text-muted" /> Location
                      </label>
                      <input
                          type="text"
                          className="form-input"
                          value={location}
                          onChange={(e) => { setLocation(e.target.value); setFieldErrors(prev => ({ ...prev, location: validateTextField(e.target.value, 'Location', { maxLength: 200 }) })); }}
                          placeholder="Rack A4"
                          maxLength={200}
                          style={fieldErrors.location ? { borderColor: '#ef4444' } : undefined}
                      />
                      {fieldErrors.location && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{fieldErrors.location}</span>}
                  </div>
                </div>

                <div className="form-group">
                      <label className="form-label">
                      <User size={14} className="text-muted" /> Managed By <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
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

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    <Info size={14} className="text-muted" /> Description / Notes <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <textarea
                    className="form-input"
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); setFieldErrors(prev => ({ ...prev, description: validateTextField(e.target.value, 'Description', { required: true, maxLength: 2000 }) })); }}
                    placeholder="Technical specifications, serial numbers, owner, etc."
                    rows={4}
                    maxLength={2000}
                    required
                    style={{ resize: 'none', ...(fieldErrors.description ? { borderColor: '#ef4444' } : {}) }}
                  />
                  {fieldErrors.description && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{fieldErrors.description}</span>}
                </div>
              </div>

              {/* Right Column: Inventory Control */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1.25rem', 
                background: 'var(--background-color)', 
                padding: '1.5rem', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border-color)',
                alignSelf: 'start'
              }}>
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '5px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Hash size={16} /> Asset Metrics
                    </h4>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Total Inventory Units</label>
                  <input
                    type="number"
                    className="form-input"
                    min={1}
                    value={totalQuantity}
                    onChange={(e) => setTotalQuantity(parseInt(e.target.value))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Damaged / Offline</label>
                  <input
                    type="number"
                    className="form-input"
                    min={0}
                    max={totalQuantity}
                    value={damagedQuantity}
                    onChange={(e) => setDamagedQuantity(parseInt(e.target.value))}
                    required
                    style={{ 
                        borderColor: damagedQuantity > 0 ? 'var(--danger)' : 'var(--border-color)',
                        background: damagedQuantity > 0 ? 'rgba(239, 68, 68, 0.05)' : 'white'
                    }}
                  />
                </div>

                <div style={{ 
                    marginTop: '1rem', 
                    padding: '1.25rem', 
                    background: 'white', 
                    borderRadius: 'var(--radius-sm)', 
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Health Status</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                        <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)' }}>
                          {totalQuantity - damagedQuantity}
                        </span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Ready for use</span>
                    </div>
                    <div style={{ marginTop: '10px', height: '8px', background: 'var(--border-light)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ 
                            height: '100%', 
                            background: 'var(--success)', 
                            width: `${((totalQuantity - damagedQuantity) / totalQuantity) * 100}%`,
                            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                        }} />
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                         <AlertTriangle size={16} style={{ color: damagedQuantity > 0 ? 'var(--danger)' : 'var(--text-muted)', opacity: damagedQuantity > 0 ? 1 : 0.3 }} />
                    </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '10px 24px' }}>
              Dismiss
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 40px' }}>
              <Save size={18} /> {isEditing ? 'Confirm Updates' : 'Add to Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResourceFormModal;
