import React, { useEffect, useState, useCallback } from 'react';
import { 
  Play, 
  Square, 
  Terminal, 
  RefreshCw, 
  Clock, 
  Activity, 
  Cpu, 
  MemoryStick,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Zap,
  Server
} from 'lucide-react';
import { ComputeAccess, ComputeAccessStatus } from '@/types/booking';
import { computeService } from '@/services/computeService';

interface ComputeAccessPanelProps {
  bookingId: string;
  onOpenTerminal: (access: ComputeAccess) => void;
}

const ComputeAccessPanel: React.FC<ComputeAccessPanelProps> = ({
  bookingId,
  onOpenTerminal
}) => {
  const [access, setAccess] = useState<ComputeAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{ gpuUtilization: number; memoryUsage: number; cpuUsage: number } | null>(null);

  const fetchAccess = useCallback(async () => {
    try {
      setLoading(true);
      const data = await computeService.getAccessByBookingId(bookingId);
      setAccess(data);
      setError(null);

      // Fetch metrics if instance is running
      if (data && (data.status === ComputeAccessStatus.Running || data.status === ComputeAccessStatus.Ready)) {
        const metricsData = await computeService.getMetrics(data.id);
        setMetrics(metricsData);
      }
    } catch (err) {
      setError('Failed to load compute access');
      console.error('Error fetching compute access:', err);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchAccess();

    // Poll for updates every 30 seconds if instance is active
    const interval = setInterval(() => {
      if (access && [ComputeAccessStatus.Provisioning, ComputeAccessStatus.Running, ComputeAccessStatus.Ready].includes(access.status)) {
        fetchAccess();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchAccess, access?.status]);

  const handleStart = async () => {
    if (!access) return;
    try {
      setActionLoading(true);
      const updated = await computeService.startInstance(access.id);
      setAccess(updated);
    } catch (err) {
      setError('Failed to start instance');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!access) return;
    try {
      setActionLoading(true);
      const updated = await computeService.stopInstance(access.id);
      setAccess(updated);
    } catch (err) {
      setError('Failed to stop instance');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusConfig = (status: ComputeAccessStatus) => {
    switch (status) {
      case ComputeAccessStatus.Pending:
        return { label: 'Pending', color: 'var(--warning)', bg: 'var(--warning-bg)', icon: Clock };
      case ComputeAccessStatus.Provisioning:
        return { label: 'Provisioning', color: 'var(--info)', bg: 'var(--info-bg)', icon: Loader2 };
      case ComputeAccessStatus.Ready:
        return { label: 'Ready', color: 'var(--success)', bg: 'var(--success-bg)', icon: CheckCircle2 };
      case ComputeAccessStatus.Running:
        return { label: 'Running', color: 'var(--success)', bg: 'var(--success-bg)', icon: Activity };
      case ComputeAccessStatus.Stopped:
        return { label: 'Stopped', color: 'var(--text-muted)', bg: 'var(--border-light)', icon: Square };
      case ComputeAccessStatus.Terminated:
        return { label: 'Terminated', color: 'var(--danger)', bg: 'var(--danger-bg)', icon: AlertCircle };
      case ComputeAccessStatus.Error:
        return { label: 'Error', color: 'var(--danger)', bg: 'var(--danger-bg)', icon: AlertCircle };
      default:
        return { label: 'Unknown', color: 'var(--text-muted)', bg: 'var(--border-light)', icon: AlertCircle };
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
      return `${days}d ${hours % 24}h remaining`;
    }
    return `${hours}h ${minutes}m remaining`;
  };

  if (loading) {
    return (
      <div style={{
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-color)' }} />
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Loading compute access...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && !access) {
    return (
      <div style={{
        padding: '1.5rem',
        background: 'var(--danger-bg)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: 'var(--danger)'
      }}>
        <AlertCircle size={20} />
        <span>{error}</span>
        <button
          onClick={fetchAccess}
          style={{
            marginLeft: 'auto',
            padding: '6px 12px',
            background: 'white',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--danger)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.8rem',
            fontWeight: 600
          }}
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  if (!access) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        background: 'var(--surface-hover)',
        borderRadius: 'var(--radius-md)'
      }}>
        <Server size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          No compute instance associated with this booking
        </p>
      </div>
    );
  }

  const statusConfig = getStatusConfig(access.status);
  const StatusIcon = statusConfig.icon;
  const canStart = access.status === ComputeAccessStatus.Stopped;
  const canStop = access.status === ComputeAccessStatus.Running || access.status === ComputeAccessStatus.Ready;
  const canOpenTerminal = access.status === ComputeAccessStatus.Running || access.status === ComputeAccessStatus.Ready;

  return (
    <div style={{
      background: 'var(--card-bg)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-color)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '1.25rem',
        background: 'var(--surface-hover)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent-color), var(--accent-light))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <Zap size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{access.tierName}</h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Compute Instance</p>
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '6px 12px',
          borderRadius: 'var(--radius-full)',
          background: statusConfig.bg,
          color: statusConfig.color,
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase'
        }}>
          <StatusIcon size={14} style={access.status === ComputeAccessStatus.Provisioning ? { animation: 'spin 1s linear infinite' } : {}} />
          {statusConfig.label}
        </div>
      </div>

      {/* Error message if any */}
      {access.errorMessage && (
        <div style={{
          padding: '0.75rem 1.25rem',
          background: 'var(--danger-bg)',
          color: 'var(--danger)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertCircle size={16} />
          {access.errorMessage}
        </div>
      )}

      {/* Metrics section */}
      {metrics && canOpenTerminal && (
        <div style={{
          padding: '1rem 1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--info-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--info)'
            }}>
              <Zap size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>GPU</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{metrics.gpuUtilization}%</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--success-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--success)'
            }}>
              <Cpu size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>CPU</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{metrics.cpuUsage}%</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--warning-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--warning)'
            }}>
              <MemoryStick size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Memory</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{metrics.memoryUsage}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Info section */}
      <div style={{ padding: '1.25rem' }}>
        {access.expiresAt && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--surface-hover)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem'
          }}>
            <Clock size={16} style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{formatTimeRemaining(access.expiresAt)}</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {canOpenTerminal && (
            <button
              onClick={() => onOpenTerminal(access)}
              className="btn btn-primary"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Terminal size={18} />
              Open Terminal
            </button>
          )}

          {canStart && (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="btn btn-outline"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {actionLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={18} />}
              Start Instance
            </button>
          )}

          {canStop && (
            <button
              onClick={handleStop}
              disabled={actionLoading}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {actionLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Square size={18} />}
              Stop
            </button>
          )}

          <button
            onClick={fetchAccess}
            className="btn btn-ghost"
            title="Refresh"
            style={{
              width: '40px',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ComputeAccessPanel;
