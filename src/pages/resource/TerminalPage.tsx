import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Terminal, FolderOpen, Loader2, AlertCircle, Clock, Zap } from 'lucide-react';
import { computeService } from '@/services/computeService';
import ServerTerminal, { ServerTerminalHandle } from './components/ServerTerminal';
import TerminalFileManager from './components/TerminalFileManager';

type Tab = 'terminal' | 'files';

const TerminalPage: React.FC = () => {
    const { bookingId } = useParams<{ bookingId: string }>();
    const navigate = useNavigate();

    const [token, setToken] = useState('');
    const [wsUrl, setWsUrl] = useState('');
    const [sessionExpiresAt, setSessionExpiresAt] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('terminal');
    const [filesEverOpened, setFilesEverOpened] = useState(false);
    const terminalRef = useRef<ServerTerminalHandle>(null);
    const fileManagerRefreshRef = useRef<(() => void) | null>(null);

    const fetchToken = async () => {
        if (!bookingId) return;
        setLoading(true);
        setError(null);
        try {
            const { token: t, wsUrl: w, expiresAt } = await computeService.getTerminalToken(bookingId);
            setToken(t);
            setWsUrl(w);
            setSessionExpiresAt(expiresAt);
        } catch (err: any) {
            setError(err.message || 'Failed to get terminal access token');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchToken();
    }, [bookingId]);

    const formatTimeRemaining = (expiresAt: string) => {
        const diffMs = new Date(expiresAt).getTime() - Date.now();
        if (diffMs <= 0) return 'Expired';
        const hours = Math.floor(diffMs / 3_600_000);
        const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
        return hours > 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${minutes}m`;
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#0f172a',
            zIndex: 9999,
        }}>
            {/* Header bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                background: '#020617',
                borderBottom: '1px solid #1e293b',
                flexShrink: 0,
            }}>
                {/* Back */}
                <button
                    onClick={() => navigate('/bookings')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'rgba(255,255,255,0.06)', border: 'none',
                        borderRadius: '8px', padding: '6px 12px',
                        color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem',
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                >
                    <ArrowLeft size={15} /> Back
                </button>

                {/* Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <div style={{
                        width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--accent-color, #0ea5e9), #6366f1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Zap size={16} color="#fff" />
                    </div>
                    <div>
                        <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2 }}>
                            Compute Terminal
                        </div>
                        {bookingId && (
                            <div style={{ color: '#475569', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                                {bookingId}
                            </div>
                        )}
                    </div>
                </div>

                {/* Session expiry */}
                {sessionExpiresAt && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        color: '#64748b', fontSize: '0.75rem',
                    }}>
                        <Clock size={13} />
                        {formatTimeRemaining(sessionExpiresAt)} remaining
                    </div>
                )}

                {/* Tab switcher */}
                {!loading && !error && (
                    <div style={{
                        display: 'flex', alignItems: 'center',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '8px', padding: '3px', gap: '2px',
                    }}>
                        {(['terminal', 'files'] as Tab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => {
                                    setActiveTab(tab);
                                    if (tab === 'files') setFilesEverOpened(true);
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    padding: '5px 14px', borderRadius: '6px', border: 'none',
                                    background: activeTab === tab ? 'rgba(255,255,255,0.12)' : 'none',
                                    color: activeTab === tab ? '#f1f5f9' : '#64748b',
                                    cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
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
                {!loading && !error && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '4px 10px', borderRadius: '20px',
                        background: connected ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)',
                        color: connected ? '#22c55e' : '#fbbf24',
                        fontSize: '0.72rem', fontWeight: 600,
                    }}>
                        <div style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: 'currentColor',
                            animation: connected ? 'none' : 'termPulse 1.5s ease-in-out infinite',
                        }} />
                        {connected ? 'Connected' : 'Connecting…'}
                    </div>
                )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {loading ? (
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#475569',
                    }}>
                        <Loader2 size={32} style={{ animation: 'termSpin 1s linear infinite' }} />
                        <p style={{ margin: 0 }}>Establishing secure connection…</p>
                    </div>
                ) : error ? (
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#94a3b8',
                    }}>
                        <AlertCircle size={40} style={{ color: '#ef4444' }} />
                        <p style={{ margin: 0, color: '#ef4444', textAlign: 'center', maxWidth: 400 }}>{error}</p>
                        <button
                            onClick={fetchToken}
                            style={{
                                padding: '8px 20px', borderRadius: '8px', border: 'none',
                                background: '#0ea5e9', color: '#fff', cursor: 'pointer',
                                fontWeight: 600, fontSize: '0.85rem',
                            }}
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        <div style={{ display: activeTab === 'terminal' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
                            <ServerTerminal
                                ref={terminalRef}
                                wsUrl={wsUrl}
                                token={token}
                                onConnectionChange={setConnected}
                                style={{ flex: 1, borderRadius: 0, border: 'none' }}
                            />
                        </div>
                        <div style={{ display: activeTab === 'files' ? 'flex' : 'none', flex: 1, overflow: 'hidden', position: 'relative' }}>
                            {filesEverOpened && (
                                <TerminalFileManager
                                    bookingId={bookingId!}
                                    terminalToken={token}
                                    active={activeTab === 'files'}
                                    onSendCommand={(cmd) => {
                                        // Send silently over WebSocket, stay on Files tab
                                        terminalRef.current?.sendCommand(cmd);
                                        // Refresh file list after command likely completes
                                        setTimeout(() => fileManagerRefreshRef.current?.(), 1500);
                                    }}
                                    onRegisterRefresh={(fn) => { fileManagerRefreshRef.current = fn; }}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>

            <style>{`
                @keyframes termSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes termPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
            `}</style>
        </div>
    );
};

export default TerminalPage;
