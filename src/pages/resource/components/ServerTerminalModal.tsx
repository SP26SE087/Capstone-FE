import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Maximize2, Minimize2, Copy, Check, Zap, Clock, Terminal, FolderOpen } from 'lucide-react';
import { ComputeAccess } from '@/types/booking';
import { computeService } from '@/services/computeService';
import ServerTerminal from './ServerTerminal';
import TerminalFileManager from './TerminalFileManager';

interface ServerTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  access: ComputeAccess;
  privateKey: string;
}

const ServerTerminalModal: React.FC<ServerTerminalModalProps> = ({
  isOpen,
  onClose,
  access,
  privateKey,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'terminal' | 'files'>('terminal');
  const [token, setToken] = useState<string>('');
  const [wsUrl, setWsUrl] = useState<string>('');
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);
        const { token: newToken, wsUrl: newWsUrl, expiresAt } = await computeService.getTerminalToken(access.bookingId);
        setToken(newToken);
        setWsUrl(newWsUrl);
        setSessionExpiresAt(expiresAt);
      } catch (err: any) {
        setError(err.message || 'Failed to get terminal access token');
        console.error('Error getting terminal token:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [isOpen, access.bookingId]);

  const handleCopyIp = async () => {
    if (access.containerIp) {
      await navigator.clipboard.writeText(access.containerIp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  if (!isOpen) return null;

  const modalStyle: React.CSSProperties = isFullscreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        margin: 0,
        borderRadius: 0,
        maxWidth: 'none',
        width: '100%',
        height: '100%'
      }
    : {
        width: '100%',
        maxWidth: '1000px',
        height: '80vh',
        maxHeight: '700px'
      };

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4000,
        padding: isFullscreen ? 0 : '1.5rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        style={{
          backgroundColor: '#1e293b',
          borderRadius: isFullscreen ? 0 : 'var(--radius-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          border: isFullscreen ? 'none' : '1px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          ...modalStyle
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            background: '#0f172a',
            borderBottom: '1px solid #334155'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--accent-color), var(--accent-light))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}
            >
              <Zap size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#f1f5f9', fontWeight: 700 }}>
                {access.tierName} Terminal
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                {access.containerIp && (
                  <button
                    onClick={handleCopyIp}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'color 0.2s'
                    }}
                    title="Copy IP address"
                  >
                    {copied ? <Check size={12} style={{ color: '#22c55e' }} /> : <Copy size={12} />}
                    <span>{access.containerIp}</span>
                  </button>
                )}
                {sessionExpiresAt && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                    <Clock size={12} />
                    <span>{formatTimeRemaining(sessionExpiresAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Tab switcher — only when token is loaded */}
            {!loading && !error && (
              <div style={{
                display: 'flex', alignItems: 'center',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                padding: '3px',
                gap: '2px',
              }}>
                {(['terminal', 'files'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '4px 12px', borderRadius: '6px', border: 'none',
                      background: activeTab === tab ? 'rgba(255,255,255,0.12)' : 'none',
                      color: activeTab === tab ? '#f1f5f9' : '#64748b',
                      cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab === 'terminal' ? <Terminal size={13} /> : <FolderOpen size={13} />}
                    {tab === 'terminal' ? 'Terminal' : 'Files'}
                  </button>
                ))}
              </div>
            )}

            {/* Connection indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: connected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                color: connected ? '#22c55e' : '#fbbf24',
                fontSize: '0.7rem',
                fontWeight: 600
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'currentColor',
                  animation: connected ? 'none' : 'pulse 1.5s ease-in-out infinite'
                }}
              />
              {connected ? 'Connected' : 'Connecting...'}
            </div>

            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(239, 68, 68, 0.1)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: '#ef4444',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Close terminal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Terminal content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {loading ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                color: '#94a3b8'
              }}
            >
              <div className="premium-loader" style={{ width: '48px', height: '48px' }}>
                <div />
              </div>
              <p style={{ margin: 0 }}>Establishing secure connection...</p>
            </div>
          ) : error ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                padding: '2rem'
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444'
                }}
              >
                <X size={32} />
              </div>
              <p style={{ color: '#ef4444', margin: 0, textAlign: 'center', fontSize: '0.9rem' }}>{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  computeService.getTerminalToken(access.bookingId)
                    .then(({ token: t, wsUrl: w, expiresAt }) => {
                      setToken(t); setWsUrl(w); setSessionExpiresAt(expiresAt); setError(null);
                    })
                    .catch((err: any) => setError(err.message || 'Failed to get terminal token'))
                    .finally(() => setLoading(false));
                }}
                className="btn btn-secondary"
                style={{ marginTop: '0.5rem' }}
              >
                Retry
              </button>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
              {/* Terminal tab */}
              <div style={{ display: activeTab === 'terminal' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
                <ServerTerminal
                  wsUrl={wsUrl}
                  token={token}
                  privateKey={privateKey}
                  onConnectionChange={setConnected}
                  style={{ flex: 1, borderRadius: 0, border: 'none' }}
                />
              </div>
              {/* Files tab */}
              <div style={{ display: activeTab === 'files' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                <TerminalFileManager
                  bookingId={access.bookingId}
                  terminalToken={token}
                  privateKey={privateKey}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default ServerTerminalModal;
