import React, { useState, useEffect } from 'react';
import { SeminarSwapRequestResponse, SeminarSwapRequestStatus } from '@/types/seminar';
import seminarService from '@/services/seminarService';
import { useAuth } from '@/hooks/useAuth';
import { useToastStore } from '@/store/slices/toastSlice';
import {
    ArrowLeftRight,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Loader2,
    MessageSquare,
    Check,
    X,
    Send,
    Inbox
} from 'lucide-react';

interface SwapRequestsProps {
    usersMap: Record<string, string>;
    emailsMap: Record<string, string>;
    onActionComplete: () => void;
}

const getSwapStatusInfo = (status: SeminarSwapRequestStatus | string) => {
    const s = typeof status === 'string' ? status.toLowerCase() : status;
    if (s === SeminarSwapRequestStatus.PendingTarget || s === SeminarSwapRequestStatus.PendingOrganizer || s === 'pendingtarget' || s === 'pendingorganizer')
        return { label: 'Pending', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', icon: <Clock size={12} /> };
    if (s === SeminarSwapRequestStatus.Approved || s === 'approved')
        return { label: 'Approved', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', icon: <CheckCircle size={12} /> };
    if (s === SeminarSwapRequestStatus.RejectedByTarget || s === SeminarSwapRequestStatus.RejectedByOrganizer || s === 'rejectedbytarget' || s === 'rejectedbyorganizer')
        return { label: 'Rejected', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: <XCircle size={12} /> };
    if (s === SeminarSwapRequestStatus.Cancelled || s === 'cancelled')
        return { label: 'Cancelled', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: <XCircle size={12} /> };
    if (s === SeminarSwapRequestStatus.Expired || s === 'expired')
        return { label: 'Expired', color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', icon: <AlertCircle size={12} /> };
    return { label: String(status), color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', icon: <AlertCircle size={12} /> };
};

const isPendingStatus = (status: SeminarSwapRequestStatus | string) => {
    const s = typeof status === 'string' ? status.toLowerCase() : status;
    return s === SeminarSwapRequestStatus.PendingTarget || s === SeminarSwapRequestStatus.PendingOrganizer
        || s === 'pendingtarget' || s === 'pendingorganizer';
};

const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const SwapRequests: React.FC<SwapRequestsProps> = ({ usersMap, emailsMap, onActionComplete }) => {
    const { user } = useAuth();
    const [swapRequests, setSwapRequests] = useState<SeminarSwapRequestResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [respondingId, setRespondingId] = useState<string | null>(null);
    const [respondNote, setRespondNote] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [tab, setTab] = useState<'incoming' | 'sent'>('incoming');
    const { addToast } = useToastStore();

    useEffect(() => {
        fetchSwapRequests();
    }, []);

    const fetchSwapRequests = async () => {
        setLoading(true);
        try {
            const data = await seminarService.getMySwapRequests();
            setSwapRequests(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch swap requests:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRespond = async (swapRequestId: string, accept: boolean) => {
        setActionLoading(true);
        try {
            await seminarService.respondToSwapRequest(swapRequestId, {
                accept,
                note: respondNote.trim() || null
            });
            setRespondingId(null);
            setRespondNote('');
            addToast(accept ? 'Swap request accepted.' : 'Swap request declined.', accept ? 'success' : 'info');
            fetchSwapRequests();
            onActionComplete();
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to respond to swap request.';
            addToast(msg, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const currentEmail = user?.email?.toLowerCase() || '';
    const incoming = currentEmail
        ? swapRequests.filter(s => emailsMap[s.targetUserId]?.toLowerCase() === currentEmail)
        : swapRequests;
    const sent = currentEmail
        ? swapRequests.filter(s => emailsMap[s.requestedByUserId]?.toLowerCase() === currentEmail)
        : swapRequests;
    const displayed = tab === 'incoming' ? incoming : sent;

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
            </div>
        );
    }

    return (
        <div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {([
                    { id: 'incoming', label: 'Incoming', icon: <Inbox size={14} />, count: incoming.length },
                    { id: 'sent', label: 'Sent', icon: <Send size={14} />, count: sent.length }
                ] as const).map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '7px 14px', borderRadius: '10px', cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 700,
                            border: tab === t.id ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                            background: tab === t.id ? 'var(--accent-bg)' : '#fff',
                            color: tab === t.id ? 'var(--accent-color)' : 'var(--text-secondary)',
                            transition: 'all 0.2s'
                        }}
                    >
                        {t.icon} {t.label}
                        <span style={{
                            padding: '1px 7px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 800,
                            background: tab === t.id ? 'var(--accent-color)' : '#e2e8f0',
                            color: tab === t.id ? '#fff' : 'var(--text-secondary)'
                        }}>{t.count}</span>
                    </button>
                ))}
            </div>

            {/* List */}
            {displayed.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    <ArrowLeftRight size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {tab === 'incoming' ? 'No incoming swap requests' : 'No sent swap requests'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {displayed.map(swap => {
                        const statusInfo = getSwapStatusInfo(swap.status);
                        const isPending = isPendingStatus(swap.status);
                        const isResponding = respondingId === swap.swapRequestId;
                        const canRespond = tab === 'incoming' && isPending;

                        return (
                            <div key={swap.swapRequestId} style={{
                                padding: '14px 16px',
                                borderRadius: '12px',
                                background: '#fff',
                                border: `1px solid ${statusInfo.border}`,
                                transition: 'all 0.2s'
                            }}>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <ArrowLeftRight size={16} color="var(--accent-color)" />
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {tab === 'incoming' ? 'Received Swap Request' : 'Sent Swap Request'}
                                        </span>
                                    </div>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        padding: '3px 8px', borderRadius: '20px',
                                        fontSize: '0.65rem', fontWeight: 700,
                                        background: statusInfo.bg, color: statusInfo.color
                                    }}>
                                        {statusInfo.icon} {statusInfo.label}
                                    </span>
                                </div>

                                {/* Details */}
                                <div style={{
                                    padding: '10px', background: 'var(--background-color)',
                                    borderRadius: '8px', marginBottom: '10px',
                                    fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '6px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {usersMap[swap.requestedByUserId] || swap.requestedByUserId.substring(0, 8) + '...'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {usersMap[swap.targetUserId] || swap.targetUserId.substring(0, 8) + '...'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Requested at:</span>
                                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{formatDate(swap.requestedAt)}</span>
                                    </div>
                                    {swap.expiresAtUtc && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Expires:</span>
                                            <span style={{ fontWeight: 600, color: '#f59e0b' }}>{formatDate(swap.expiresAtUtc)}</span>
                                        </div>
                                    )}
                                    {swap.reason && (
                                        <div style={{ marginTop: '4px', padding: '8px', background: '#fff', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '2px' }}>Reason</div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>{swap.reason}</div>
                                        </div>
                                    )}
                                    {swap.responseNote && (
                                        <div style={{ marginTop: '4px', padding: '8px', background: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#059669', marginBottom: '2px' }}>Response Note</div>
                                            <div style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 500 }}>{swap.responseNote}</div>
                                        </div>
                                    )}
                                    {swap.respondedAt && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Responded at:</span>
                                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{formatDate(swap.respondedAt)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions — only for incoming pending */}
                                {canRespond && (
                                    <div>
                                        {isResponding ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <MessageSquare size={14} color="var(--text-muted)" />
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Add a note (optional)</span>
                                                </div>
                                                <input
                                                    style={{
                                                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                                                        border: '1.5px solid var(--border-color)',
                                                        fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none'
                                                    }}
                                                    value={respondNote}
                                                    onChange={e => setRespondNote(e.target.value)}
                                                    placeholder="Optional note..."
                                                />
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={() => { setRespondingId(null); setRespondNote(''); }}
                                                        style={{
                                                            padding: '6px 14px', borderRadius: '8px',
                                                            border: '1px solid var(--border-color)', background: '#fff',
                                                            color: 'var(--text-secondary)', cursor: 'pointer',
                                                            fontSize: '0.75rem', fontWeight: 700
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => handleRespond(swap.swapRequestId, false)}
                                                        disabled={actionLoading}
                                                        style={{
                                                            padding: '6px 14px', borderRadius: '8px', border: 'none',
                                                            background: '#fef2f2', color: '#ef4444',
                                                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                                                            fontSize: '0.75rem', fontWeight: 700,
                                                            display: 'flex', alignItems: 'center', gap: '4px'
                                                        }}
                                                    >
                                                        {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Decline
                                                    </button>
                                                    <button
                                                        onClick={() => handleRespond(swap.swapRequestId, true)}
                                                        disabled={actionLoading}
                                                        style={{
                                                            padding: '6px 14px', borderRadius: '8px', border: 'none',
                                                            background: '#10b981', color: '#fff',
                                                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                                                            fontSize: '0.75rem', fontWeight: 700,
                                                            display: 'flex', alignItems: 'center', gap: '4px'
                                                        }}
                                                    >
                                                        {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Accept
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setRespondingId(swap.swapRequestId)}
                                                style={{
                                                    width: '100%', padding: '8px', borderRadius: '8px',
                                                    border: '1px solid var(--accent-color)', background: 'var(--accent-bg)',
                                                    color: 'var(--accent-color)', cursor: 'pointer',
                                                    fontSize: '0.78rem', fontWeight: 700, transition: 'all 0.2s'
                                                }}
                                            >
                                                Respond to Request
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SwapRequests;
