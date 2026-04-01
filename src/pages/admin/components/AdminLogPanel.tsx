import React, { useState, useEffect } from 'react';
import { EquipmentLog, Resource } from '@/types/booking';
import { equipmentLogService } from '@/services/equipmentLogService';
import { X, Activity, MessageSquare, Tag, Loader2, Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AdminLogPanelProps {
  resources: Resource[];
  editingLog?: EquipmentLog;
  onClose: () => void;
  onSaved: (reload: boolean, message?: string) => void;
}

const AdminLogPanel: React.FC<AdminLogPanelProps> = ({ 
  resources,
  editingLog, 
  onClose, 
  onSaved 
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<EquipmentLog>>({
    resourceId: '',
    action: 1,
    note: '',
    userId: user?.userId || ''
  });

  useEffect(() => {
    if (editingLog) {
      setFormData(editingLog);
    }
  }, [editingLog]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.resourceId) return;
    
    setLoading(true);
    try {
      const requestData: any = {
        resourceId: formData.resourceId,
        action: Number(formData.action) || 1,
        note: formData.note || ''
      };

      if (editingLog) {
        await equipmentLogService.update(editingLog.id, requestData);
        onSaved(true, 'Activity log updated.');
      } else {
        await equipmentLogService.create(requestData);
        onSaved(true, 'Event logged successfully.');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const actionTypes = [
    { value: 1, label: 'Manual Adjustment', color: '#6366f1' },
    { value: 2, label: 'Status Update', color: '#3b82f6' },
    { value: 3, label: 'Maintenance Start', color: '#f59e0b' },
    { value: 4, label: 'Maintenance End', color: '#10b981' },
    { value: 5, label: 'Damage Reported', color: '#ef4444' },
    { value: 6, label: 'Lost/Stolen', color: '#7c3aed' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            {editingLog ? 'Edit Event Log' : 'New Operational Log'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0 0' }}>
            Track resource history and maintenance events manually.
          </p>
        </div>
        <button onClick={onClose} style={{ padding: '8px', borderRadius: '10px', background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b' }}>
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: '#334155' }}>
              <Tag size={16} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Event Classification</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Target Resource</label>
                <select 
                  value={formData.resourceId}
                  onChange={e => setFormData({...formData, resourceId: e.target.value})}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem', outline: 'none', background: '#fff' }}
                >
                  <option value="">Select resource...</option>
                  {resources.map(res => (
                    <option key={res.id} value={res.id}>{res.name} ({res.location || 'Unknown location'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Action Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {actionTypes.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({...formData, action: type.value})}
                      style={{ 
                        padding: '10px 12px', 
                        borderRadius: '10px', 
                        border: '1px solid', 
                        borderColor: formData.action === type.value ? type.color : '#e2e8f0',
                        background: formData.action === type.value ? `${type.color}10` : '#fff',
                        color: formData.action === type.value ? type.color : '#64748b',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: type.color }} />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: '#334155' }}>
              <MessageSquare size={16} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Observations / Notes</span>
            </div>
            <div>
              <textarea 
                value={formData.note}
                onChange={e => setFormData({...formData, note: e.target.value})}
                placeholder="Briefly explain the intent or outcome of this action..."
                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.88rem', outline: 'none', minHeight: '120px', resize: 'none', lineHeight: 1.5 }}
              />
            </div>
          </div>

           {!editingLog && (
            <div style={{ display: 'flex', gap: '10px', padding: '12px', background: '#fff7ed', borderRadius: '12px', border: '1px solid #ffedd5' }}>
              <Info size={16} color="#f97316" style={{ flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#9a3412', lineHeight: 1.4 }}>
                This log will be tied to your admin account and timestamped automatically for audit purposes.
              </p>
            </div>
          )}
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
          disabled={loading || !formData.resourceId}
          style={{ 
            padding: '10px 24px', 
            background: 'linear-gradient(135deg, #f59e0b, #f97316)', 
            border: 'none', 
            color: 'white', 
            borderRadius: '12px', 
            fontSize: '0.88rem', 
            fontWeight: 600, 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)',
            opacity: !formData.resourceId ? 0.6 : 1
          }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <><Activity size={18} /> {editingLog ? 'Update Log' : 'Commit Entry'}</>}
        </button>
      </div>
    </div>
  );
};

export default AdminLogPanel;
