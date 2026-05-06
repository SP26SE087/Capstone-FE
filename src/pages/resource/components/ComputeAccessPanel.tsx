import React, { useState } from 'react';
import { Server, Terminal, Clock, CheckCircle2, AlertTriangle, Ban, Key, ChevronDown, ChevronUp, Loader2, Upload, RefreshCw, Download } from 'lucide-react';
import { ComputeAccess, ComputeAccessStatus } from '@/types/booking';
import { ServerAccess, computeService, SubmitPublicKeyRequest } from '@/services/computeService';

// ── Web Crypto RSA key generation ─────────────────────────────────────────────
async function generateSSHKeyPair(): Promise<{ publicKey: string; privateKeyPem: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );

  // Private key → PKCS#8 PEM
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const pkcs8B64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
  const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${pkcs8B64.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----`;

  // Public key → OpenSSH wire format (ssh-rsa AAAA...)
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

  function uint32(n: number) {
    return new Uint8Array([(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
  }
  function sshString(s: string) {
    const b = new TextEncoder().encode(s);
    return new Uint8Array([...uint32(b.length), ...b]);
  }
  function sshMpint(b64url: string) {
    const raw = Uint8Array.from(atob(b64url.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const padded = raw[0] & 0x80 ? new Uint8Array([0, ...raw]) : raw;
    return new Uint8Array([...uint32(padded.length), ...padded]);
  }

  const wire = new Uint8Array([
    ...sshString('ssh-rsa'),
    ...sshMpint(jwk.e!),
    ...sshMpint(jwk.n!),
  ]);
  const publicKey = `ssh-rsa ${btoa(String.fromCharCode(...wire))} labsync-key`;

  return { publicKey, privateKeyPem };
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

interface ComputeAccessPanelProps {
  bookingId: string;
  /** Called when user wants to open terminal (private key already submitted to server) */
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

const actionBtnStyle = (active: boolean, color = '#0ea5e9'): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '5px',
  padding: '6px 13px', borderRadius: '7px', border: 'none',
  background: active ? color : '#334155',
  color: active ? '#fff' : '#64748b',
  cursor: active ? 'pointer' : 'not-allowed',
  fontWeight: 700, fontSize: '0.75rem',
  boxShadow: active ? `0 3px 10px ${color}55` : 'none',
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
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [keyGenerated, setKeyGenerated] = useState(false);

  // ── Private key — in-memory only, never sent to server ─
  const [showPrivateKeyForm, setShowPrivateKeyForm] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [privateKeyError, setPrivateKeyError] = useState<string | null>(null);

  const accessConfig = serverAccess ? getAccessStatusConfig(serverAccess.status) : null;
  const isSessionEnded = !!accessConfig && !accessConfig.canConnect
    && serverAccess?.status !== 'Pending'
    && serverAccess?.status !== 'Provisioning';

  const isActive = serverAccess?.status === 'Active' || serverAccess?.accessStatus === 1;
  const needsPublicKey = !serverAccess;
  const needsPrivateKey = isActive && !privateKey.trim();
  const canConnect = isActive && !!privateKey.trim();

  const handleGenerateKeys = async () => {
    setGeneratingKeys(true);
    setKeyGenerated(false);
    try {
      const { publicKey: pub, privateKeyPem } = await generateSSHKeyPair();
      setPublicKey(pub);
      downloadText(privateKeyPem, 'labsync_key.pem');
      setKeyGenerated(true);
    } catch {
      setPublicKeyError('Failed to generate key pair. Please use ssh-keygen instead.');
    } finally {
      setGeneratingKeys(false);
    }
  };

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

  const handleConfirmPrivateKey = () => {
    if (!privateKey.trim()) { setPrivateKeyError('SSH private key is required.'); return; }
    setPrivateKeyError(null);
    setShowPrivateKeyForm(false);
  };

  const handleOpenTerminal = () => {
    const access: ComputeAccess = {
      id: bookingId,
      bookingId,
      tierId: '',
      tierName: '',
      status: ComputeAccessStatus.Active,
      privateKey: privateKey.trim(),
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
                color: accessConfig.color, background: accessConfig.bg,
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
                      ? 'Server ready — enter your private key to connect'
                      : 'Private key ready — click to open the terminal'}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {needsPublicKey && (
            <button type="button"
              onClick={() => setShowPublicKeyForm(v => !v)}
              style={actionBtnStyle(true)}
            >
              <Key size={13} />
              {showPublicKeyForm ? 'Cancel' : 'Submit Public Key'}
              {showPublicKeyForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

          {isActive && (
            <button type="button"
              onClick={() => setShowPrivateKeyForm(v => !v)}
              style={actionBtnStyle(true, '#10b981')}
            >
              <Upload size={13} />
              {showPrivateKeyForm ? 'Cancel' : (privateKey.trim() ? 'Change Key' : 'Enter Private Key')}
              {showPrivateKeyForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

          <button type="button"
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
            Submit SSH Public Key
          </div>

          {/* Generate key pair button */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 10px', borderRadius: '7px',
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          }}>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
              {keyGenerated
                ? <span style={{ color: '#34d399' }}>✓ Key pair generated — private key downloaded as <code style={{ color: '#a5f3fc' }}>labsync_key.pem</code>. Keep it safe.</span>
                : 'Generate a key pair automatically in the browser, or paste your own below.'}
            </div>
            <button
              type="button"
              onClick={handleGenerateKeys}
              disabled={generatingKeys}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
                padding: '5px 12px', borderRadius: '6px', border: 'none', marginLeft: '10px',
                background: generatingKeys ? '#334155' : '#6366f1',
                color: generatingKeys ? '#64748b' : '#fff',
                cursor: generatingKeys ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.72rem',
                boxShadow: generatingKeys ? 'none' : '0 2px 8px rgba(99,102,241,0.4)',
              }}
            >
              {generatingKeys
                ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                : <><Download size={12} /> {keyGenerated ? 'Regenerate' : 'Generate Key Pair'}</>}
            </button>
          </div>

          <div>
            <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
              SSH Public Key <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea style={textareaStyle} placeholder="ssh-rsa AAAAB3NzaC1yc2E..."
              value={publicKey} onChange={e => setPublicKey(e.target.value)} />
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
            <textarea style={{ ...textareaStyle, minHeight: '56px' }}
              placeholder="Brief description of your project…"
              value={projectDescription} onChange={e => setProjectDescription(e.target.value)} />
          </div>

          {publicKeyError && (
            <div style={{ fontSize: '0.72rem', color: '#ef4444', padding: '6px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>
              {publicKeyError}
            </div>
          )}

          <button type="button"
            onClick={handleSubmitPublicKey}
            disabled={submittingPublicKey || !publicKey.trim()}
            style={{ ...actionBtnStyle(!submittingPublicKey && !!publicKey.trim()), alignSelf: 'flex-end', padding: '7px 18px' }}
          >
            {submittingPublicKey
              ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</>
              : <><Key size={13} /> Submit Public Key</>}
          </button>
        </div>
      )}

      {/* ── Private key — collected in-memory, never sent to server ── */}
      {showPrivateKeyForm && isActive && (
        <div style={{
          padding: '12px', borderRadius: '8px',
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.2)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399', marginBottom: 2 }}>
            Enter SSH Private Key
          </div>
          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
            Your private key stays <strong style={{ color: '#94a3b8' }}>in memory only</strong> — it is never sent to the server.
            It is passed directly in the encrypted WebSocket connection.
            {' '}If you used "Generate Key Pair" earlier, open <code style={{ color: '#a5f3fc' }}>labsync_key.pem</code> and paste its contents below.
          </div>

          <div>
            <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
              SSH Private Key <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              style={{ ...textareaStyle, minHeight: '100px' }}
              placeholder={'-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'}
              value={privateKey}
              onChange={e => setPrivateKey(e.target.value)}
            />
          </div>

          {privateKeyError && (
            <div style={{ fontSize: '0.72rem', color: '#ef4444', padding: '6px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>
              {privateKeyError}
            </div>
          )}

          <button type="button"
            onClick={handleConfirmPrivateKey}
            disabled={!privateKey.trim()}
            style={{
              ...actionBtnStyle(!!privateKey.trim(), '#10b981'),
              alignSelf: 'flex-end', padding: '7px 18px',
            }}
          >
            <Key size={13} /> Confirm Key
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
