import React, { useState, useEffect } from 'react';
import AppSelect from '@/components/common/AppSelect';
import { Resource } from '@/types/booking';
import { resourceService } from '@/services/resourceService';
import { X, Layers, Loader2, Save, Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AdminResourcePanelProps {
  editingResource?: Resource;
  onClose: () => void;
  onSaved: (reload: boolean, message?: string) => void;
}

const AdminResourcePanel: React.FC<AdminResourcePanelProps> = ({ 
  editingResource, 
  onClose, 
  onSaved 
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Resource> & { modelSeriesList: string[] }>({
    name: '',
    description: '',
    type: 1,
    location: '',
    totalQuantity: 1,
    modelSeriesList: ['DEFAULT-001']
  });

  useEffect(() => {
    if (editingResource) {
      setFormData({
        ...editingResource,
        modelSeriesList: (editingResource as any).modelSeriesList || ['DEFAULT-001']
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
        modelSeriesList: formData.modelSeriesList
      };

      if (editingResource) {
        await resourceService.update(editingResource.id, requestData);
        onSaved(true, 'Resource updated successfully.');
      } else {
        await resourceService.create({
          ...requestData,
          managedByEmail: user?.email || ''
        });
        onSaved(true, 'Resource registered successfully.');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            {editingResource ? 'Edit Resource' : 'Register Resource'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0 0' }}>
            {editingResource ? `Updating ID: ${String(editingResource?.id || '').substring(0, 8)}` : 'Add new equipment to lab inventory'}
          </p>
        </div>
        <button onClick={onClose} style={{ padding: '8px', borderRadius: '10px', background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b' }}>
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* General Section */}
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
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                  placeholder="e.g. NVIDIA A100 GPU"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Category</label>
                  <AppSelect
                    value={String(formData.type)}
                    onChange={val => setFormData({...formData, type: Number(val)})}
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
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    placeholder="Rack A-05"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Description</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Detailed specs or usage guidelines..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem', outline: 'none', minHeight: '100px', resize: 'none' }}
                />
              </div>
            </div>
          </div>

          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: '#334155' }}>
              <Layers size={16} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Inventory Logic</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Serial Number Units (Comma separated)</label>
                <input 
                  type="text" 
                  value={formData.modelSeriesList?.join(', ')}
                  onChange={e => setFormData({...formData, modelSeriesList: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                  placeholder="SN-001, SN-002, SN-003"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem', outline: 'none' }}
                />
                <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '6px' }}>We will automatically track quantity based on how many serial numbers you provide.</p>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Footer Actions */}
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
            border: 'none', 
            color: 'white', 
            borderRadius: '12px', 
            fontSize: '0.88rem', 
            fontWeight: 600, 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
          }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> {editingResource ? 'Update Inventory' : 'Register Resource'}</>}
        </button>
      </div>
    </div>
  );
};

export default AdminResourcePanel;
