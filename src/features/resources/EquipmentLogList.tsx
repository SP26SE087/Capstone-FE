import React from 'react';
import { EquipmentLog } from '@/types/booking';
import { Clock, Loader2, Package, Trash2, Edit2, Search, Info, Activity, Plus } from 'lucide-react';

interface EquipmentLogListProps {
  logs: EquipmentLog[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (log: EquipmentLog) => void;
  onDelete: (id: string) => void;
}

const EquipmentLogList: React.FC<EquipmentLogListProps> = ({ logs, loading, onAdd, onEdit, onDelete }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState('all');
  const [page, setPage] = React.useState(1);
  const itemsPerPage = 5;

  const filteredLogs = React.useMemo(() => {
    let result = [...logs];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log => 
        log.resourceName.toLowerCase().includes(term) || 
        log.userName.toLowerCase().includes(term) ||
        log.note?.toLowerCase().includes(term)
      );
    }

    if (actionFilter !== 'all') {
      result = result.filter(log => log.action.toLowerCase().includes(actionFilter.toLowerCase()));
    }

    // Sort by date descending
    return result.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
  }, [logs, searchTerm, actionFilter]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = filteredLogs.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  React.useEffect(() => {
    setPage(1);
  }, [searchTerm, actionFilter]);

  const getActionColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('check-in')) return 'status-success';
    if (act.includes('check-out')) return 'status-warning';
    if (act.includes('maintenance')) return 'status-danger';
    return 'status-info';
  };

  const formatTimestamp = (dateString: string) => {
    const d = new Date(dateString);
    return {
      date: d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }),
      time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
    };
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#fff7ed', padding: '8px', borderRadius: '10px', color: '#e8720c' }}>
               <Activity size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Operational Logs</h3>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Real-time inventory event history</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
               <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
               <input 
                  type="text" 
                  placeholder="Search logs..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ padding: '8px 12px 8px 34px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', width: '220px', outline: 'none' }}
               />
            </div>
            <select 
               value={actionFilter}
               onChange={(e) => setActionFilter(e.target.value)}
               style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', background: '#fff', cursor: 'pointer' }}
            >
               <option value="all">Every Action</option>
               <option value="check-in">Check-in</option>
               <option value="check-out">Check-out</option>
               <option value="maintenance">Maintenance</option>
            </select>
            <button className="btn btn-primary" onClick={onAdd} style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> New Entry
            </button>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '15%', background: '#f8fafc', textAlign: 'center', paddingLeft: '1.5rem' }}>Date & Time</th>
              <th style={{ width: '15%', background: '#f8fafc', textAlign: 'left' }}>User</th>
              <th style={{ width: '17%', background: '#f8fafc', textAlign: 'left' }}>Equipment</th>
              <th style={{ width: '10%', background: '#f8fafc', textAlign: 'center' }}>Event</th>
              <th style={{ width: '33%', background: '#f8fafc', textAlign: 'left' }}>Details</th>
              <th style={{ width: '10%', background: '#f8fafc', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '5rem' }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-color)', margin: '0 auto 12px' }} />
                  <p style={{ color: '#64748b', fontWeight: 500 }}>Syncing historical logs...</p>
                </td>
              </tr>
            ) : paginatedLogs.length > 0 ? (
              paginatedLogs.map((log) => {
                const ts = formatTimestamp(log.loggedAt);
                return (
                  <tr key={log.id} style={{ verticalAlign: 'middle', borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ textAlign: 'center', paddingLeft: '1.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>{ts.date}</span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                           <Clock size={10} /> {ts.time}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'left', maxWidth: '180px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-start', overflow: 'hidden' }}>
                        <div className="avatar avatar-sm avatar-brand" style={{ flexShrink: 0, width: '28px', height: '28px', fontSize: '0.75rem', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                          {log.userName.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ 
                          fontSize: '0.85rem', 
                          fontWeight: 600, 
                          color: '#334155',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }} title={log.userName}>
                          {log.userName}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'left', maxWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-start', overflow: 'hidden' }}>
                        <div style={{ color: '#e8720c', opacity: 0.8, flexShrink: 0 }}>
                          <Package size={16} />
                        </div>
                        <span style={{ 
                          fontWeight: 600, 
                          color: '#0f172a', 
                          fontSize: '0.9rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }} title={log.resourceName}>
                          {log.resourceName}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${getActionColor(log.action)}`} style={{ padding: '4px 10px', fontSize: '0.65rem' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ textAlign: 'left', maxWidth: '350px' }}>
                      <p style={{ 
                        margin: 0, 
                        fontSize: '0.825rem', 
                        color: '#475569', 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontStyle: log.note ? 'normal' : 'italic',
                      }} title={log.note || ''}>
                        {log.note || 'No notes'}
                      </p>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button 
                          className="btn btn-ghost" 
                          onClick={() => onEdit(log)}
                          style={{ padding: '6px', width: '32px', height: '32px', borderRadius: '8px' }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          className="btn btn-ghost" 
                          style={{ color: '#e11d48', padding: '6px', width: '32px', height: '32px', borderRadius: '8px' }} 
                          onClick={() => onDelete(log.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                    <div style={{ marginBottom: '8px' }}><Info size={32} style={{ opacity: 0.3 }} /></div>
                    <p>No log records match your search criteria.</p>
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

export default EquipmentLogList;
