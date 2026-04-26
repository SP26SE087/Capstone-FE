import React, { useState } from 'react';
import { Server, Terminal, Clock, CheckCircle2, AlertTriangle, Ban, Key, Upload, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { ComputeAccess, ComputeAccessStatus } from '@/types/booking';
import { ServerAccess, computeService, SubmitPublicKeyRequest } from '@/services/computeService';

interface ComputeAccessPanelProps {
  bookingId: string;
  onOpenTerminal: (access: ComputeAccess) => void;
  serverAccess?: ServerAccess | null;
  onAccessChange?: () => void;
}

const getAccessStatusConfig = (status: string | undefined) => {
  switch (status) {
    case 'Active':
      return { label: 'Active', color: '#16a34a', bg: '#dcfce7', border: '#a7f3d0', icon: <CheckCircle2 size={11} />, canConnect: true };
    case 'Expired':
      return { label: 'Expired', color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', icon: <Clock size={11} />, canConnect: false };
    case 'Revoked':
      return { label: 'Revoked', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: <Ban size={11} />, canConnect: false };
    case 'Provisioning':
      return { label: 'Provisioning…', color: '#d97706', bg: '#fefce8', border: '#fde68a', icon: <Clock size={11} />, canConnect: false };
    case 'Pending':
      return { label: 'Pending Provisioning', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', icon: <Clock size={11} />, canConnect: false };
    default:
      return null;
  }
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: '7px',
  border: '1px solid rgba(148,163,184,0.3)',
  background: 'rgba(15,23,42,0.6)',
  color: '#e2e8f0',
  fontSize: '0.75rem',
  fontFamily: 'monospace',
  outline: 'none',
  boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical' as const,
  minHeight: '80px',
};

const stepBtnStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '5px',
  padding: '6px 13px', borderRadius: '7px', border: 'none',
  background: active ? '#0ea5e9' : '#334155',
  color: active ? '#fff' : '#64748b',
  cursor: active ? 'pointer' : 'not-allowed',
  fontWeight: 700, fontSize: '0.75rem',
  boxShadow: active ? '0 3px 10px rgba(14,165,233,0.35)' : 'none',
  opacity: active ? 1 : 0.7,
  flexShrink: 0,
});

const ComputeAccessPanel: React.FC<ComputeAccessPanelProps> = ({
  bookingId,
  onOpenTerminal,
  serverAccess,
  onAccessChange,
}) => {
  // ── Step 2: submit public key ────────────────────────────────────────
  const [showPublicKeyForm, setShowPublicKeyForm] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [gpuCount, setGpuCount] = useState('');
  const [cpuCores, setCpuCores] = useState('');
  const [ramGb, setRamGb] = useState('');
  const [dockerImage, setDockerImage] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [submittingPublicKey, setSubmittingPublicKey] = useState(false);
  const [publicKeyError, setPublicKeyError] = useState<string | null>(null);

  // ── Step 5: submit private key ───────────────────────────────────────
  const [showPrivateKeyForm, setShowPrivateKeyForm] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [submittingPrivateKey, setSubmittingPrivateKey] = useState(false);
  const [privateKeyError, setPrivateKeyError] = useState<string | null>(null);
  const [privateKeyDone, setPrivateKeyDone] = useState(false);

  const accessConfig = serverAccess ? getAccessStatusConfig(serverAccess.status) : null;
  const isSessionEnded = !!accessConfig && !accessConfig.canConnect
    && serverAccess?.status !== 'Pending'
    && serverAccess?.status !== 'Provisioning';

  // Derive what the user needs to do next
  const needsPublicKey = !serverAccess;
  const isActive = serverAccess?.status === 'Active' || serverAccess?.accessStatus === 1;
  // Private key is discarded server-side when booking ends — must re-submit each session
  const needsPrivateKey = !!serverAccess && isActive && !privateKeyDone;
  // Can connect only when Active AND private key submitted this session
  const canConnect = isActive && privateKeyDone;

  const handleSubmitPublicKey = async () => {
    if (!publicKey.trim()) { setPublicKeyError('SSH public key is required.'); return; }
    setSubmittingPublicKey(true);
    setPublicKeyError(null);
    try {
      const req: SubmitPublicKeyRequest = {
        sshPublicKey: publicKey.trim(),
        ...(gpuCount ? { requestedGpuCount: Number(gpuCount) } : {}),
        ...(cpuCores ? { requestedCpuCores: Number(cpuCores) } : {}),
        ...(ramGb ? { requestedRamGb: Number(ramGb) } : {}),
        ...(dockerImage.trim() ? { dockerImage: dockerImage.trim() } : {}),
        ...(projectDescription.trim() ? { projectDescription: projectDescription.trim() } : {}),
      };
      await computeService.submitPublicKey(bookingId, req);
      setShowPublicKeyForm(false);
      setPublicKey('');
      onAccessChange?.();
    } catch (err: any) {
      setPublicKeyError(err.message || 'Failed to submit public key.');
    } finally {
      setSubmittingPublicKey(false);
    }
  };

  const handleSubmitPrivateKey = async () => {
    if (!privateKey.trim()) { setPrivateKeyError('SSH private key is required.'); return; }
    setSubmittingPrivateKey(true);
    setPrivateKeyError(null);
    try {
      await computeService.submitPrivateKey(bookingId, privateKey.trim());
      setPrivateKeyDone(true);
      setShowPrivateKeyForm(false);
      setPrivateKey('');
    } catch (err: any) {
      setPrivateKeyError(err.message || 'Failed to submit private key.');
    } finally {
      setSubmittingPrivateKey(false);
    }
  };

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
      {/* ── Main row ── */}
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
            {serverAccess?.linuxUsername && (
              <span style={{
                fontSize: '0.62rem', fontWeight: 600, color: '#38bdf8',
                background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)',
                padding: '1px 8px', borderRadius: 20, fontFamily: 'monospace',
              }}>
                {serverAccess.linuxUsername}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.7rem', color: isSessionEnded ? '#64748b' : '#94a3b8', marginTop: '1px' }}>
            {isSessionEnded
              ? 'Session ended — SSH credentials revoked'
              : serverAccess?.status === 'Provisioning'
                ? 'Server environment is being prepared…'
                : serverAccess?.status === 'Pending'
                  ? 'Waiting for lab director to provision the server'
                  : needsPublicKey
                    ? 'Submit your SSH public key to request access'
                    : needsPrivateKey
                      ? 'Server provisioned — submit your private key to connect'
                      : privateKeyDone
                        ? 'Private key accepted — click to open the terminal'
                        : 'Click to open the terminal'}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {needsPublicKey && (
            <button
              onClick={() => setShowPublicKeyForm(v => !v)}
              style={stepBtnStyle(true)}
            >
              <Key size={13} />
              {showPublicKeyForm ? 'Cancel' : 'Submit Public Key'}
              {showPublicKeyForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

          {needsPrivateKey && !privateKeyDone && (
            <button
              onClick={() => setShowPrivateKeyForm(v => !v)}
              style={stepBtnStyle(true)}
            >
              <Upload size={13} />
              {showPrivateKeyForm ? 'Cancel' : 'Submit Private Key'}
              {showPrivateKeyForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

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
      </div>

      {/* ── Step 2: Public key form ── */}
      {showPublicKeyForm && (
        <div style={{
          padding: '12px', borderRadius: '8px',
          background: 'rgba(14,165,233,0.08)',
          border: '1px solid rgba(14,165,233,0.2)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', marginBottom: 2 }}>
            Step 1 of 2 — Submit SSH Public Key
          </div>

          <div>
            <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
              SSH Public Key <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              style={textareaStyle}
              placeholder="ssh-rsa AAAAB3NzaC1yc2E..."
              value={publicKey}
              onChange={e => setPublicKey(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>GPU Count</label>
              <input style={inputStyle} type="number" min={0} placeholder="e.g. 1" value={gpuCount} onChange={e => setGpuCount(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>CPU Cores</label>
              <input style={inputStyle} type="number" min={0} placeholder="e.g. 4" value={cpuCores} onChange={e => setCpuCores(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>RAM (GB)</label>
              <input style={inputStyle} type="number" min={0} placeholder="e.g. 16" value={ramGb} onChange={e => setRamGb(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Docker Image</label>
            <input style={inputStyle} type="text" placeholder="pytorch/pytorch:latest" value={dockerImage} onChange={e => setDockerImage(e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Project Description</label>
            <textarea
              style={{ ...textareaStyle, minHeight: '56px' }}
              placeholder="Brief description of your project…"
              value={projectDescription}
              onChange={e => setProjectDescription(e.target.value)}
            />
          </div>

          {publicKeyError && (
            <div style={{ fontSize: '0.72rem', color: '#ef4444', padding: '6px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>
              {publicKeyError}
            </div>
          )}

          <button
            onClick={handleSubmitPublicKey}
            disabled={submittingPublicKey || !publicKey.trim()}
            style={{
              ...stepBtnStyle(!submittingPublicKey && !!publicKey.trim()),
              alignSelf: 'flex-end',
              padding: '7px 18px',
            }}
          >
            {submittingPublicKey ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</> : <><Key size={13} /> Submit Public Key</>}
          </button>
        </div>
      )}

      {/* ── Step 5: Private key form ── */}
      {showPrivateKeyForm && needsPrivateKey && (
        <div style={{
          padding: '12px', borderRadius: '8px',
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.2)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399', marginBottom: 2 }}>
            Step 2 of 2 — Submit SSH Private Key
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
            Your private key is AES-256 encrypted server-side and automatically discarded when the booking ends. It is never returned to any client.
          </div>

          <div>
            <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
              SSH Private Key <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              style={{ ...textareaStyle, minHeight: '100px' }}
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
              value={privateKey}
              onChange={e => setPrivateKey(e.target.value)}
            />
          </div>

          {privateKeyError && (
            <div style={{ fontSize: '0.72rem', color: '#ef4444', padding: '6px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>
              {privateKeyError}
            </div>
          )}

          <button
            onClick={handleSubmitPrivateKey}
            disabled={submittingPrivateKey || !privateKey.trim()}
            style={{
              ...stepBtnStyle(!submittingPrivateKey && !!privateKey.trim()),
              alignSelf: 'flex-end',
              padding: '7px 18px',
              background: (!submittingPrivateKey && !!privateKey.trim()) ? '#10b981' : '#334155',
              boxShadow: (!submittingPrivateKey && !!privateKey.trim()) ? '0 3px 10px rgba(16,185,129,0.35)' : 'none',
            }}
          >
            {submittingPrivateKey ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</> : <><Upload size={13} /> Submit Private Key</>}
          </button>
        </div>
      )}

      {/* ── Session ended notice ── */}
      {isSessionEnded && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 12px', borderRadius: '8px',
          background: 'rgba(100,116,139,0.15)',
          border: '1px solid rgba(100,116,139,0.2)',
          fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500,
        }}>
          <AlertTriangle size={12} style={{ color: '#64748b', flexShrink: 0 }} />
          Server session ended. SSH credentials have been revoked.
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ComputeAccessPanel;
