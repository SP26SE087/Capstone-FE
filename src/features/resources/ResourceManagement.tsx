import React from 'react';
import { Resource, ResourceType } from '@/types/booking';
import { Edit2, Trash2, Plus, Loader2, MapPin, Package, Search, Info } from 'lucide-react';

interface ResourceManagementProps {
  resources: Resource[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (resource: Resource) => void;
  onDelete: (resourceId: string) => void;
}

const ResourceManagement: React.FC<ResourceManagementProps> = ({ resources, loading, onAdd, onEdit, onDelete }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [stockFilter, setStockFilter] = React.useState<string>('all');
  const [page, setPage] = React.useState(1);
  const itemsPerPage = 5;

  const filteredResources = React.useMemo(() => {
    let result = [...resources];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r => 
        r.name.toLowerCase().includes(term) || 
        r.location?.toLowerCase().includes(term)
      );
    }

    if (typeFilter !== 'all') {
      result = result.filter(r => r.type === Number(typeFilter));
    }

    if (stockFilter === 'available') {
      result = result.filter(r => r.availableQuantity > 0);
    } else if (stockFilter === 'out') {
      result = result.filter(r => r.availableQuantity === 0);
    }

    // Sort by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [resources, searchTerm, typeFilter, stockFilter]);

  const totalPages = Math.ceil(filteredResources.length / itemsPerPage) || 1;
  const paginatedResources = filteredResources.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  React.useEffect(() => {
    setPage(1);
  }, [searchTerm, typeFilter, stockFilter]);

  const getResourceTypeLabel = (type: ResourceType) => {
    switch (type) {
      case ResourceType.GPU: return 'GPU Node';
      case ResourceType.Equipment: return 'Equipment';
      case ResourceType.Dataset: return 'Dataset';
      case ResourceType.LabStation: return 'Lab Station';
      default: return 'Asset';
    }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>Equipment List</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Manage laboratory physical assets</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
               <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
               <input 
                  type="text" 
                  placeholder="Search by name/location..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ padding: '8px 12px 8px 34px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', width: '220px', outline: 'none' }}
               />
            </div>
            <select 
               value={typeFilter}
               onChange={(e) => setTypeFilter(e.target.value)}
               style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', background: '#fff', cursor: 'pointer' }}
            >
               <option value="all">All Categories</option>
               <option value="1">GPU Node</option>
               <option value="2">Equipment</option>
               <option value="3">Dataset</option>
               <option value="4">Lab Station</option>
            </select>
            <select 
               value={stockFilter}
               onChange={(e) => setStockFilter(e.target.value)}
               style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', background: '#fff', cursor: 'pointer' }}
            >
               <option value="all">Stock Status</option>
               <option value="available">In Stock</option>
               <option value="out">Out of Stock</option>
            </select>
            <button className="btn btn-primary" onClick={onAdd} style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> New Asset
            </button>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '30%', background: '#f8fafc', textAlign: 'left', paddingLeft: '1.5rem' }}>Equipment Name</th>
              <th style={{ width: '15%', background: '#f8fafc', textAlign: 'left' }}>Category</th>
              <th style={{ width: '15%', background: '#f8fafc', textAlign: 'left' }}>Location</th>
              <th style={{ width: '25%', background: '#f8fafc', textAlign: 'center' }}>Quantity (Total/Avail/Fail)</th>
              <th style={{ width: '15%', textAlign: 'center', background: '#f8fafc' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '4rem' }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-color)', margin: '0 auto 12px' }} />
                  <p style={{ color: '#64748b', fontWeight: 500 }}>Syncing inventory data...</p>
                </td>
              </tr>
            ) : paginatedResources.length > 0 ? (
              paginatedResources.map((resource) => (
                <tr key={resource.id} style={{ transition: 'all 0.2s', verticalAlign: 'middle', borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ paddingLeft: '1.5rem', paddingRight: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'flex-start' }}>
                      <div style={{ 
                        background: 'linear-gradient(135deg, #f5f3ff, #f0fdf4)', 
                        padding: '10px', 
                        borderRadius: '12px', 
                        color: 'var(--accent-color)',
                        flexShrink: 0
                      }}>
                        <Package size={18} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left', wordBreak: 'break-word', maxWidth: '300px', overflow: 'hidden' }}>
                        <span style={{ 
                          fontWeight: 800, 
                          color: '#0f172a', 
                          fontSize: '0.95rem', 
                          lineHeight: '1.2',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block'
                        }} title={resource.name}>
                          {resource.name}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <span className="badge badge-accent" style={{ padding: '4px 12px', fontSize: '0.7rem', border: '1px solid rgba(124, 58, 237, 0.2)', fontWeight: 700 }}>
                      {getResourceTypeLabel(resource.type)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600, wordBreak: 'break-word' }}>
                      <MapPin size={14} style={{ color: 'var(--accent-color)', opacity: 0.7, flexShrink: 0 }} />
                      <span style={{ lineHeight: '1.2' }}>{resource.location || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Remote</span>}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                      <div title="Total" style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 800, color: '#475569' }}>
                        {resource.totalQuantity}
                      </div>
                      <div title="Available" style={{ background: '#f0fdf4', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 800, color: '#16a34a', border: '1px solid #dcfce7' }}>
                        {resource.availableQuantity}
                      </div>
                      <div title="Damaged" style={{ background: '#fef2f2', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 800, color: '#dc2626', border: '1px solid #fee2e2' }}>
                        {resource.damagedQuantity}
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <button 
                        className="btn btn-ghost" 
                        onClick={() => onEdit(resource)}
                        style={{ padding: '8px', width: '34px', height: '34px', borderRadius: '8px' }}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button 
                        className="btn btn-ghost" 
                        style={{ color: '#e11d48', padding: '8px', width: '34px', height: '34px', borderRadius: '8px' }} 
                        onClick={() => onDelete(resource.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                  <div style={{ marginBottom: '8px' }}><Info size={32} style={{ opacity: 0.3 }} /></div>
                  <p>No equipment found matching criteria.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ padding: '1.25rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="btn btn-ghost"
            style={{ padding: '6px 16px', borderRadius: '8px', background: page === 1 ? 'transparent' : '#f8fafc' }}
          >
            Previous
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 700 }}>
            <span style={{ color: 'var(--accent-color)', background: '#f5f3ff', padding: '4px 12px', borderRadius: '6px' }}>{page}</span>
            <span style={{ color: '#94a3b8' }}>of</span>
            <span style={{ color: '#64748b' }}>{totalPages}</span>
          </div>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="btn btn-ghost"
            style={{ padding: '6px 16px', borderRadius: '8px', background: page === totalPages ? 'transparent' : '#f8fafc' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ResourceManagement;
