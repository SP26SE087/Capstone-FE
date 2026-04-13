import React from 'react';
import { EquipmentLog } from '@/types/booking';
import { Loader2, Trash2, Edit2, Info, Activity } from 'lucide-react';

interface EquipmentLogListProps {
  logs: EquipmentLog[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (log: EquipmentLog) => void;
  onDelete: (id: string) => void;
  isSplit?: boolean;
}

const EquipmentLogList: React.FC<EquipmentLogListProps> = ({ logs, loading, onEdit, onDelete, isSplit }) => {
  const [page, setPage] = React.useState(1);
  const itemsPerPage = isSplit ? 6 : 8;

  const totalPages = Math.ceil(logs.length / itemsPerPage) || 1;
  const paginatedLogs = logs.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  React.useEffect(() => {
    setPage(1);
  }, [logs.length]);

  const getEventBadge = (action: string) => {
    const act = action.toLowerCase();
    const style: React.CSSProperties = {
        padding: '4px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase'
    };
    
    if (act.includes('check-in')) return <span style={{ ...style, background: '#f0fdf4', color: '#16a34a' }}>Check-in</span>;
    if (act.includes('check-out')) return <span style={{ ...style, background: '#fffbeb', color: '#d97706' }}>Check-out</span>;
    if (act.includes('maintenance')) return <span style={{ ...style, background: '#fef2f2', color: '#dc2626' }}>Maintenance</span>;
    return <span style={{ ...style, background: '#f1f5f9', color: '#475569' }}>{action}</span>;
  };

  return (
    <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ background: '#fff7ed', padding: '10px', borderRadius: '12px', color: '#e8720c' }}>
            <Activity size={20} />
        </div>
        <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 700 }}>Activity Records</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Immutable audit trail for laboratory equipment</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc' }}>Event</th>
              <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc' }}>Subject</th>
              {!isSplit && <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc' }}>User</th>}
              <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc', textAlign: 'center' }}>Time</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', background: '#f8fafc', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '4rem' }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: '#3b82f6', margin: '0 auto 12px' }} />
                  <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Syncing journals...</p>
                </td>
              </tr>
            ) : paginatedLogs.length > 0 ? (
              paginatedLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} className="table-row-hover">
                   <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {getEventBadge(String(log.action))}
                        {isSplit && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{log.userFullName || log.userName}</div>}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>{log.resourceTitle || log.resourceName}</div>
                    {(log.bookingTitle) && <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{log.bookingTitle}</div>}
                  </td>
                  {!isSplit && (
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>{log.userFullName || log.userName}</div>
                      {log.userEmail && <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{log.userEmail}</div>}
                    </td>
                  )}
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    {(() => {
                      const d = new Date(log.loggedAt);
                      return (
                        <>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                            {d.getDate().toString().padStart(2,'0')}/{(d.getMonth()+1).toString().padStart(2,'0')}/{d.getFullYear()}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {d.getHours().toString().padStart(2,'0')}:{d.getMinutes().toString().padStart(2,'0')}
                          </div>
                        </>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                      <button 
                        onClick={() => onEdit(log)}
                        style={{ padding: '6px', border: 'none', background: 'transparent', borderRadius: '8px', cursor: 'pointer', color: '#3b82f6' }}
                        className="btn-icon-hover"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => onDelete(log.id)}
                        style={{ padding: '6px', border: 'none', background: 'transparent', borderRadius: '8px', cursor: 'pointer', color: '#ef4444' }}
                        className="btn-icon-hover"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                  <Info size={24} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <p style={{ fontSize: '0.9rem' }}>No activity logs founded.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center', background: '#fff' }}>
           <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: page === 1 ? '#f8fafc' : 'white', color: page === 1 ? '#cbd5e1' : '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: page === 1 ? 'default' : 'pointer' }}
          >
            Prev
          </button>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>{page} / {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: page === totalPages ? '#f8fafc' : 'white', color: page === totalPages ? '#cbd5e1' : '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: page === totalPages ? 'default' : 'pointer' }}
          >
            Next
          </button>
        </div>
      )}
      <style>{`
        .table-row-hover:hover { background-color: #f8fafc; }
        .btn-icon-hover:hover { background-color: #f1f5f9; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default EquipmentLogList;
