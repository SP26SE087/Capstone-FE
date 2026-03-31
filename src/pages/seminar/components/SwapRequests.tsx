import React, { useState, useEffect } from 'react';
import { SeminarSwapRequestResponse, SeminarSwapRequestStatus } from '@/types/seminar';
import seminarService from '@/services/seminarService';
import {
    ArrowLeftRight,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Loader2,
    MessageSquare,
    Check,
    X
} from 'lucide-react';

interface SwapRequestsProps {
    usersMap: Record<string, string>;
    onActionComplete: () => void;
}

const getSwapStatusInfo = (status: SeminarSwapRequestStatus) => {
    switch (status) {
        case SeminarSwapRequestStatus.PendingTarget:
        case SeminarSwapRequestStatus.PendingOrganizer:
            return { label: 'Pending', color: '#f59e0b', bg: '#fffbeb', icon: <Clock size={12} /> };
        case SeminarSwapRequestStatus.Approved:
            return { label: 'Approved', color: '#10b981', bg: '#ecfdf5', icon: <CheckCircle size={12} /> };
        case SeminarSwapRequestStatus.RejectedByTarget:
        case SeminarSwapRequestStatus.RejectedByOrganizer:
            return { label: 'Rejected', color: '#ef4444', bg: '#fef2f2', icon: <XCircle size={12} /> };
        case SeminarSwapRequestStatus.Cancelled:
            return { label: 'Cancelled', color: '#ef4444', bg: '#fef2f2', icon: <XCircle size={12} /> };
        case SeminarSwapRequestStatus.Expired:
            return { label: 'Expired', color: '#64748b', bg: '#f1f5f9', icon: <AlertCircle size={12} /> };
        default:
            return { label: 'Unknown', color: '#64748b', bg: '#f1f5f9', icon: <AlertCircle size={12} /> };
    }
};

const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const SwapRequests: React.FC<SwapRequestsProps> = ({ usersMap, onActionComplete }) => {
    const [swapRequests, setSwapRequests] = useState<SeminarSwapRequestResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [respondingId, setRespondingId] = useState<string | null>(null);
    const [respondNote, setRespondNote] = useState('');

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
        try {
            await seminarService.respondToSwapRequest(swapRequestId, {
                accept,
                note: respondNote.trim() || null
            });
            setRespondingId(null);
            setRespondNote('');
            fetchSwapRequests();
            onActionComplete();
        } catch (err) {
            console.error('Failed to respond to swap:', err);
            alert('Failed to respond to swap request.');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
            </div>
        );
    }

    if (swapRequests.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <ArrowLeftRight size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>No swap requests</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {swapRequests.map(swap => {
                const statusInfo = getSwapStatusInfo(swap.status);
                const isPending = swap.status === SeminarSwapRequestStatus.PendingTarget || swap.status === SeminarSwapRequestStatus.PendingOrganizer;
                const isResponding = respondingId === swap.swapRequestId;

                return (
                    <div key={swap.swapRequestId} style={{
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: '#fff',
                        border: '1px solid var(--border-color)',
                        transition: 'all 0.2s'
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ArrowLeftRight size={16} color="var(--accent-color)" />
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Swap Request
                                </span>
                            </div>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '20px',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                background: statusInfo.bg,
                                color: statusInfo.color
                            }}>
                                {statusInfo.icon} {statusInfo.label}
                            </span>
                        </div>

                        {/* Details */}
                        <div style={{
                            padding: '10px',
                            background: 'var(--background-color)',
                            borderRadius: '8px',
                            marginBottom: '10px',
                            fontSize: '0.78rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Requested by:</span>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {usersMap[swap.requestedByUserId] || 'Unknown'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Target:</span>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {usersMap[swap.targetUserId] || 'Unknown'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Requested at:</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {formatDate(swap.requestedAt)}
                                </span>
                            </div>
                            {swap.reason && (
                                <div style={{ marginTop: '4px', padding: '8px', background: '#fff', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '2px' }}>Reason</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>{swap.reason}</div>
                                </div>
                            )}
                            {swap.responseNote && (
                                <div style={{ marginTop: '4px', padding: '8px', background: '#fff', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '2px' }}>Response Note</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>{swap.responseNote}</div>
                                </div>
                            )}
                        </div>

                        {/* Actions for pending requests */}
                        {isPending && (
                            <div>
                                {isResponding ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <MessageSquare size={14} color="var(--text-muted)" />
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Add a note (optional)</span>
                                        </div>
                                        <input
                                            style={{
                                                width: '100%',
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                border: '1.5px solid var(--border-color)',
                                                fontSize: '0.8rem',
                                                fontFamily: 'inherit',
                                                outline: 'none'
                                            }}
                                            value={respondNote}
                                            onChange={e => setRespondNote(e.target.value)}
                                            placeholder="Optional note..."
                                        />
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => { setRespondingId(null); setRespondNote(''); }}
                                                style={{
                                                    padding: '6px 14px',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--border-color)',
                                                    background: '#fff',
                                                    color: 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700
                                                }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleRespond(swap.swapRequestId, false)}
                                                style={{
                                                    padding: '6px 14px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    background: '#fef2f2',
                                                    color: '#ef4444',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <X size={12} /> Decline
                                            </button>
                                            <button
                                                onClick={() => handleRespond(swap.swapRequestId, true)}
                                                style={{
                                                    padding: '6px 14px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    background: '#10b981',
                                                    color: '#fff',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <Check size={12} /> Accept
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setRespondingId(swap.swapRequestId)}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--accent-color)',
                                            background: 'var(--accent-bg)',
                                            color: 'var(--accent-color)',
                                            cursor: 'pointer',
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            transition: 'all 0.2s'
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
    );
};

export default SwapRequests;
