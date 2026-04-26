import React from 'react';
import { Server, Terminal, Clock, CheckCircle2, AlertTriangle, Ban } from 'lucide-react';
import { ComputeAccess, ComputeAccessStatus } from '@/types/booking';
import { ServerAccess } from '@/services/computeService';

interface ComputeAccessPanelProps {
  bookingId: string;
  onOpenTerminal: (access: ComputeAccess) => void;
  serverAccess?: ServerAccess | null;
}

const getAccessStatusConfig = (status: string | undefined) => {
  switch (status) {
    case 'Active':
    case 'Provisioned':
      return { label: 'Active', color: '#16a34a', bg: '#dcfce7', border: '#a7f3d0', icon: <CheckCircle2 size={11} />, canConnect: true };
    case 'Expired':
      return { label: 'Expired', color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', icon: <Clock size={11} />, canConnect: false };
    case 'Revoked':
      return { label: 'Revoked', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: <Ban size={11} />, canConnect: false };
    case 'Provisioning':
      return { label: 'Provisioning…', color: '#d97706', bg: '#fefce8', border: '#fde68a', icon: <Clock size={11} />, canConnect: false };
    case 'Pending':
      return { label: 'Pending', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', icon: <Clock size={11} />, canConnect: false };
    default:
      return null;
  }
};

const ComputeAccessPanel: React.FC<ComputeAccessPanelProps> = ({ bookingId, onOpenTerminal, serverAccess }) => {
  const accessConfig = serverAccess ? getAccessStatusConfig(serverAccess.status) : null;

  // "Session ended" = has a non-connectable, non-waiting status
  const isSessionEnded = !!accessConfig && !accessConfig.canConnect
    && serverAccess?.status !== 'Pending'
    && serverAccess?.status !== 'Provisioning';

  // Allow connect if no access info yet (default), or if status is Active/Provisioned
  const canConnect = accessConfig ? accessConfig.canConnect : true;

  const handleOpenTerminal = () => {
    const access: ComputeAccess = {
      id: bookingId,
      bookingId,
      tierId: '',
      tierName: '',
      status: ComputeAccessStatus.Active,
    };
    onOpenTerminal(access);
  };

  return (
    <div style={{
      marginTop: '8px',
      borderRadius: '10px',
      background: isSessionEnded
        ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
        : 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
      border: isSessionEnded
        ? '1px solid rgba(100,116,139,0.3)'
        : '1px solid rgba(14,165,233,0.2)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px 14px',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
          background: isSessionEnded ? 'rgba(100,116,139,0.2)' : 'rgba(14,165,233,0.2)',
          border: isSessionEnded ? '1px solid rgba(100,116,139,0.3)' : '1px solid rgba(14,165,233,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Server size={18} style={{ color: isSessionEnded ? '#94a3b8' : '#38bdf8' }} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}>
              Compute Server Access
            </div>
            {accessConfig && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '0.62rem', fontWeight: 700,
                color: accessConfig.color,
                background: accessConfig.bg,
                border: `1px solid ${accessConfig.border}`,
                padding: '1px 8px', borderRadius: 20,
              }}>
                {accessConfig.icon} {accessConfig.label}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.7rem', color: isSessionEnded ? '#64748b' : '#94a3b8', marginTop: '1px' }}>
            {isSessionEnded
              ? 'Phiên truy cập đã kết thúc'
              : serverAccess?.status === 'Provisioning'
                ? 'Đang chuẩn bị môi trường server…'
                : 'Click to get a terminal token and connect via WebSocket'}
          </div>
        </div>

        <button
          onClick={handleOpenTerminal}
          disabled={!canConnect}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '8px', border: 'none',
            background: !canConnect ? '#334155' : '#0ea5e9',
            color: !canConnect ? '#64748b' : '#fff',
            cursor: !canConnect ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap' as const,
            boxShadow: !canConnect ? 'none' : '0 4px 12px rgba(14,165,233,0.4)',
            opacity: !canConnect ? 0.6 : 1,
          }}
        >
          <Terminal size={14} /> Open Terminal
        </button>
      </div>

      {/* Session ended notice */}
      {isSessionEnded && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 12px', borderRadius: '8px',
          background: 'rgba(100,116,139,0.15)',
          border: '1px solid rgba(100,116,139,0.2)',
          fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500,
        }}>
          <AlertTriangle size={12} style={{ color: '#64748b', flexShrink: 0 }} />
          Phiên sử dụng server đã kết thúc. SSH credentials đã bị thu hồi.
        </div>
      )}
    </div>
  );
};

export default ComputeAccessPanel;