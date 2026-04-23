import React from 'react';
import { Server, Terminal } from 'lucide-react';
import { ComputeAccess, ComputeAccessStatus } from '@/types/booking';

interface ComputeAccessPanelProps {
  bookingId: string;
  onOpenTerminal: (access: ComputeAccess) => void;
}

const ComputeAccessPanel: React.FC<ComputeAccessPanelProps> = ({ bookingId, onOpenTerminal }) => {
  const handleOpenTerminal = () => {
    const access: ComputeAccess = {
      id: bookingId,
      bookingId,
      tierId: '',
      tierName: '',
      status: ComputeAccessStatus.Ready,
    };
    onOpenTerminal(access);
  };

  return (
    <div style={{
      marginTop: '8px', borderRadius: '10px',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
      border: '1px solid rgba(14,165,233,0.2)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 14px',
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '9px',
        flexShrink: 0,
        background: 'rgba(14,165,233,0.2)',
        border: '1px solid rgba(14,165,233,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Server size={18} style={{ color: '#38bdf8' }} />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}>Compute Server Access</div>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '1px' }}>
          Click to get a terminal token and connect via WebSocket
        </div>
      </div>

      <button
        onClick={handleOpenTerminal}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '7px 14px',
          borderRadius: '8px',
          border: 'none',
          background: '#0ea5e9',
          color: '#fff',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: '0.78rem',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(14,165,233,0.4)',
        }}
      >
        <Terminal size={14} /> Open Terminal
      </button>
    </div>
  );
};

export default ComputeAccessPanel;