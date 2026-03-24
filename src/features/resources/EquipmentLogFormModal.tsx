import React, { useState } from 'react';
import { Resource, EquipmentLog } from '@/types/booking';
import { X, Save, Clock, Package, Edit3 } from 'lucide-react';

interface EquipmentLogFormModalProps {
  resources: Resource[];
  log?: EquipmentLog; // Added for edit mode
  onClose: () => void;
  onSubmit: (logData: Partial<EquipmentLog>) => void;
}

const EquipmentLogFormModal: React.FC<EquipmentLogFormModalProps> = ({ resources, log, onClose, onSubmit }) => {
  const isEditing = !!log;
  const [resourceId, setResourceId] = useState(log?.resourceId || resources[0]?.id || '');
  const [action, setAction] = useState(log?.action || 'Maintenance Check');
  const [note, setNote] = useState(log?.note || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedRes = resources.find(r => r.id === resourceId);
    onSubmit({
      id: log?.id, // ID preserved for update
      resourceId,
      resourceName: selectedRes?.name || log?.resourceName || 'Selected Equipment',
      action,
      note,
      createdAt: log?.createdAt || new Date().toISOString()
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2>{isEditing ? 'Modify Activity Record' : 'Log New Asset Event'}</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {isEditing ? 'Updating historical maintenance log' : 'Record usage, calibration, or system heartbeats'}
            </p>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label"><Package size={14}/> Resource Association</label>
            <select
              className="form-input"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              required
              disabled={isEditing} // Usually log resource shouldn't change
            >
              {resources.map((resource) => (
                <option key={resource.id} value={resource.id}>{resource.name}</option>
              ))}
              {isEditing && !resources.some(r => r.id === log?.resourceId) && (
                 <option value={log?.resourceId}>{log?.resourceName}</option>
              )}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label"><Edit3 size={14}/> Event Action</label>
            <input
              type="text"
              className="form-input"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="e.g., Firmware Update, Maintenance Check"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label"><Clock size={14}/> Narrative / Details</label>
            <textarea
              className="form-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Provide a detailed technical narrative of the event..."
              rows={4}
            />
          </div>

          <div className="modal-footer" style={{ padding: '1.25rem 0 0 0', marginTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Discard</button>
            <button type="submit" className="btn btn-primary" style={{ minWidth: '140px' }}>
              <Save size={18} /> {isEditing ? 'Confirm Update' : 'Persist Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EquipmentLogFormModal;
