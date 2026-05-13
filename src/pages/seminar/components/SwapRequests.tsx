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
    Inbox,
    Calendar,
    User,
    Presentation,
} from 'lucide-react';

interface SwapRequestsProps {
    usersMap: Record<string, string>;
    emailsMap: Record<string, string>;
    onActionComplete: () => void;
}

const getSwapStatusInfo = (status: SeminarSwapRequestStatus | string) => {
    const s = typeof status === 'string' ? status.toLowerCase() : status;
    if (s === SeminarSwapRequestStatus.PendingTarget || s === SeminarSwapRequestStatus.PendingOrganizer || s === 'pendingtarget' || s === 'pendingorganizer')
        return { label: 'Pending', color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', icon: <Clock size={11} /> };
    if (s === SeminarSwapRequestStatus.Approved || s === 'approved')
        return { label: 'Approved', color: '#059669', bg: '#ecfdf5', border: '#6ee7b7', dot: '#10b981', icon: <CheckCircle size={11} /> };
    if (s === SeminarSwapRequestStatus.RejectedByTarget || s === SeminarSwapRequestStatus.RejectedByOrganizer || s === 'rejectedbytarget' || s === 'rejectedbyorganizer')
        return { label: 'Rejected', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444', icon: <XCircle size={11} /> };
    if (s === SeminarSwapRequestStatus.Cancelled || s === 'cancelled')
        return { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444', icon: <XCircle size={11} /> };
    if (s === SeminarSwapRequestStatus.Expired || s === 'expired')
        return { label: 'Expired', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', dot: '#94a3b8', icon: <AlertCircle size={11} /> };
    return { label: String(status), color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', dot: '#94a3b8', icon: <AlertCircle size={11} /> };
};

const isPendingStatus = (status: SeminarSwapRequestStatus | string) => {
    const s = typeof status === 'string' ? status.toLowerCase() : status;
    return s === SeminarSwapRequestStatus.PendingTarget || s === SeminarSwapRequestStatus.PendingOrganizer
        || s === 'pendingtarget' || s === 'pendingorganizer';
};

const formatSessionDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const formatDateTime = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

// Parse HH:MM directly from ISO string without timezone conversion
// (backend already sends local time with Z suffix)
const formatTimeRaw = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const match = dateStr.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : null;
};

const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
const getAvatarColor = (str: string) => AVATAR_COLORS[str.charCodeAt(0) % AVATAR_COLORS.length];

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

    const currentUserId = user?.userId || '';
    const incoming = currentUserId
        ? swapRequests.filter(s => s.targetUserId === currentUserId)
        : swapRequests;
    const sent = currentUserId
        ? swapRequests.filter(s => s.requestedByUserId === currentUserId)
        : swapRequests;
    const displayed = tab === 'incoming' ? incoming : sent;

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2.5rem' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
            </div>
        );
    }

    return (
        <div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                {([
                    { id: 'incoming', label: 'Incoming', icon: <Inbox size={13} />, count: incoming.length },
                    { id: 'sent', label: 'Sent', icon: <Send size={13} />, count: sent.length }
                ] as const).map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '7px 16px', borderRadius: '10px', cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 700,
                            border: tab === t.id ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                            background: tab === t.id ? 'var(--accent-bg)' : '#fff',
                            color: tab === t.id ? 'var(--accent-color)' : 'var(--text-secondary)',
                            transition: 'all 0.15s'
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
                <div style={{
                    textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)',
                    background: '#fafafa', borderRadius: '14px', border: '1px dashed var(--border-color)'
                }}>
                    <ArrowLeftRight size={36} style={{ marginBottom: '12px', opacity: 0.2 }} />
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                        {tab === 'incoming' ? 'No incoming swap requests' : 'No sent swap requests'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                    {displayed.map(swap => {
                        const statusInfo = getSwapStatusInfo(swap.status ?? '');
                        const isPending = isPendingStatus(swap.status ?? '');
                        const isResponding = respondingId === swap.swapRequestId;
                        const canRespond = tab === 'incoming' && isPending;

                        const fromName = swap.requestedByUserName || usersMap[swap.requestedByUserId] || 'Unknown';
                        const toName = swap.targetUserName || usersMap[swap.targetUserId] || 'Unknown';

                        return (
                            <div key={swap.swapRequestId} style={{
                                borderRadius: '14px',
                                background: '#fff',
                                border: `1.5px solid ${statusInfo.border}`,
                                overflow: 'hidden',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
                            }}>
                                {/* Card Header */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px 14px',
                                    background: statusInfo.bg,
                                    borderBottom: `1px solid ${statusInfo.border}`
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                        <Presentation size={13} color={statusInfo.color} />
                                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: statusInfo.color }}>
                                            {swap.seminarName || 'Seminar Swap'}
                                        </span>
                                    </div>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        padding: '3px 9px', borderRadius: '20px',
                                        fontSize: '0.68rem', fontWeight: 700,
                                        background: '#fff', color: statusInfo.color,
                                        border: `1px solid ${statusInfo.border}`
                                    }}>
                                        <span style={{
                                            width: 6, height: 6, borderRadius: '50%',
                                            background: statusInfo.dot, flexShrink: 0
                                        }} />
                                        {statusInfo.label}
                                    </span>
                                </div>

                                {/* Swap Visual — A ⇄ B */}
                                <div style={{ padding: '14px 14px 10px' }}>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 40px 1fr',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        {/* Left: Source person */}
                                        <div style={{
                                            padding: '10px 12px', borderRadius: '10px',
                                            background: 'var(--background-color)',
                                            border: '1px solid var(--border-color)',
                                            minWidth: 0
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                                                <div style={{
                                                    width: 28, height: 28, borderRadius: '50%',
                                                    background: getAvatarColor(fromName),
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#fff' }}>
                                                        {getInitials(fromName)}
                                                    </span>
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1 }}>Requester</div>
                                                    <div
                                                        title={fromName}
                                                        style={{
                                                            fontSize: '0.78rem', fontWeight: 700,
                                                            color: 'var(--text-primary)',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                        }}>{fromName}</div>
                                                </div>
                                            </div>
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '5px',
                                                padding: '5px 8px', borderRadius: '7px',
                                                background: '#fff', border: '1px solid var(--border-light)'
                                            }}>
                                                <Calendar size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                                    {formatSessionDate(swap.sourceMeetingDate)}
                                                    {formatTimeRaw(swap.sourceStartTime) && (
                                                        <span style={{ marginLeft: 4, color: 'var(--text-muted)', fontWeight: 600 }}>
                                                            {formatTimeRaw(swap.sourceStartTime)}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Center arrow */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: '50%',
                                                background: 'var(--accent-bg)',
                                                border: '1.5px solid var(--accent-color)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <ArrowLeftRight size={15} color="var(--accent-color)" />
                                            </div>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent-color)', letterSpacing: '0.5px' }}>SWAP</span>
                                        </div>

                                        {/* Right: Target person */}
                                        <div style={{
                                            padding: '10px 12px', borderRadius: '10px',
                                            background: 'var(--background-color)',
                                            border: '1px solid var(--border-color)',
                                            minWidth: 0
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                                                <div style={{
                                                    width: 28, height: 28, borderRadius: '50%',
                                                    background: getAvatarColor(toName),
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#fff' }}>
                                                        {getInitials(toName)}
                                                    </span>
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1 }}>Target</div>
                                                    <div
                                                        title={toName}
                                                        style={{
                                                            fontSize: '0.78rem', fontWeight: 700,
                                                            color: 'var(--text-primary)',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                        }}>{toName}</div>
                                                </div>
                                            </div>
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '5px',
                                                padding: '5px 8px', borderRadius: '7px',
                                                background: '#fff', border: `1px solid var(--accent-color)`,
                                            }}>
                                                <Calendar size={11} color="var(--accent-color)" style={{ flexShrink: 0 }} />
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                                                    {formatSessionDate(swap.targetMeetingDate)}
                                                    {formatTimeRaw(swap.targetStartTime) && (
                                                        <span style={{ marginLeft: 4, fontWeight: 600, opacity: 0.8 }}>
                                                            {formatTimeRaw(swap.targetStartTime)}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Meta row */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        marginTop: '10px', padding: '0 2px'
                                    }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                            Requested {formatDateTime(swap.requestedAt)}
                                        </span>
                                        {swap.expiresAtUtc && (
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 700, color: '#d97706',
                                                display: 'flex', alignItems: 'center', gap: '3px'
                                            }}>
                                                <Clock size={10} /> Expires {formatDateTime(swap.expiresAtUtc)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Reason */}
                                    {swap.reason && (
                                        <div style={{
                                            marginTop: '10px', padding: '8px 10px',
                                            background: '#f8fafc', borderRadius: '8px',
                                            border: '1px solid var(--border-light)',
                                            display: 'flex', gap: '7px', alignItems: 'flex-start'
                                        }}>
                                            <MessageSquare size={12} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '1px' }} />
                                            <div>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Reason</div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>{swap.reason}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Response Note */}
                                    {swap.responseNote && (
                                        <div style={{
                                            marginTop: '8px', padding: '8px 10px',
                                            background: '#ecfdf5', borderRadius: '8px',
                                            border: '1px solid #6ee7b7',
                                            display: 'flex', gap: '7px', alignItems: 'flex-start'
                                        }}>
                                            <CheckCircle size={12} color="#059669" style={{ flexShrink: 0, marginTop: '1px' }} />
                                            <div>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Response Note</div>
                                                <div style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 500 }}>{swap.responseNote}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions — only for incoming pending */}
                                {canRespond && (
                                    <div style={{ padding: '0 14px 14px' }}>
                                        <div style={{ height: '1px', background: 'var(--border-light)', marginBottom: '12px' }} />
                                        {isResponding ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <MessageSquare size={12} color="var(--text-muted)" />
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Add a note (optional)</span>
                                                </div>
                                                <input
                                                    style={{
                                                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                                                        border: '1.5px solid var(--border-color)', boxSizing: 'border-box',
                                                        fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none',
                                                        background: '#fafafa'
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
                                                            padding: '6px 16px', borderRadius: '8px', border: 'none',
                                                            background: '#fef2f2', color: '#dc2626',
                                                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                                                            fontSize: '0.75rem', fontWeight: 700,
                                                            display: 'flex', alignItems: 'center', gap: '5px'
                                                        }}
                                                    >
                                                        {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Decline
                                                    </button>
                                                    <button
                                                        onClick={() => handleRespond(swap.swapRequestId, true)}
                                                        disabled={actionLoading}
                                                        style={{
                                                            padding: '6px 16px', borderRadius: '8px', border: 'none',
                                                            background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
                                                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                                                            fontSize: '0.75rem', fontWeight: 700,
                                                            display: 'flex', alignItems: 'center', gap: '5px',
                                                            boxShadow: '0 2px 6px rgba(16,185,129,0.3)'
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
                                                    width: '100%', padding: '9px', borderRadius: '9px',
                                                    border: '1.5px solid var(--accent-color)', background: 'var(--accent-bg)',
                                                    color: 'var(--accent-color)', cursor: 'pointer',
                                                    fontSize: '0.78rem', fontWeight: 700, transition: 'all 0.15s',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
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
