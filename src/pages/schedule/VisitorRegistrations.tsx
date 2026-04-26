import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { visitorRegistrationService } from '@/services/visitorRegistrationService';
import {
    VisitorRegistrationResponse,
    VisitorRegistrationStatus,
    AssigneeTransferRequestResponse,
} from '@/types/visitorRegistration';
import Modal from '@/components/common/Modal';
import {
    UserCheck, Clock, CheckCircle2, XCircle, Loader2, RefreshCw, Eye,
    ArrowRightLeft, CheckCheck, X, Wifi, WifiOff, User, List, GitPullRequest,
} from 'lucide-react';

// ─── Status configs ────────────────────────────────────────────────────────────

const REG_STATUS = {
    [VisitorRegistrationStatus.Pending]:  { label: 'Pending',  color: '#d97706', bg: '#fef3c7', icon: <Clock       size={12} /> },
    [VisitorRegistrationStatus.Approved]: { label: 'Approved', color: '#16a34a', bg: '#dcfce7', icon: <CheckCircle2 size={12} /> },
    [VisitorRegistrationStatus.Rejected]: { label: 'Rejected', color: '#dc2626', bg: '#fee2e2', icon: <XCircle      size={12} /> },
};

const ACTION_COLORS: Record<string, { color: string; bg: string }> = {
    Assigned:          { color: '#2563eb', bg: '#dbeafe' },
    TransferRequested: { color: '#d97706', bg: '#fef3c7' },
    TransferAccepted:  { color: '#16a34a', bg: '#dcfce7' },
    TransferRejected:  { color: '#dc2626', bg: '#fee2e2' },
    Approved:          { color: '#16a34a', bg: '#dcfce7' },
    Rejected:          { color: '#dc2626', bg: '#fee2e2' },
    LabAccessOpened:   { color: '#0891b2', bg: '#cffafe' },
    LabAccessClosed:   { color: '#64748b', bg: '#f1f5f9' },
};

// ─── Modal state types ─────────────────────────────────────────────────────────

interface ApproveState {
    registrationId: string;
    fullName: string;
    appointmentDateTime: string;
    reason: string;
    activeFrom: string;
    durationHours: string;
}

interface RejectState {
    registrationId: string;
    fullName: string;
    reason: string;
}

interface TransferState {
    registrationId: string;
    fullName: string;
    toAssigneeEmail: string;
}

interface RespondState {
    transfer: AssigneeTransferRequestResponse;
    accept: boolean;
    reason: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatDt = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

const ERR_MAP: Record<string, string> = {
    US031: 'Invalid status value',
    US032: 'Registration not found',
    US033: 'You are not authorized to perform this action',
    US034: 'This registration has already been processed',
    US042: 'Email does not exist in the system',
    US043: 'Duration hours is required when approving',
    US044: 'A pending transfer request already exists for this registration',
    US045: 'Cannot transfer to yourself',
    US046: 'Transfer request not found',
};

const getErrMsg = (err: any): string => {
    const code = err?.response?.data?.messageCode
        || err?.response?.data?.MessageCode
        || err?.response?.data?.errorCode;
    return ERR_MAP[code] || 'An error occurred. Please try again.';
};

// ─── Component ─────────────────────────────────────────────────────────────────

const VisitorRegistrations: React.FC = () => {
    const { user } = useAuth();
    const [tab, setTab] = useState<'registrations' | 'transfers'>('registrations');

    // Registrations
    const [registrations, setRegistrations] = useState<VisitorRegistrationResponse[]>([]);
    const [regLoading, setRegLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Transfers
    const [transfers, setTransfers] = useState<AssigneeTransferRequestResponse[]>([]);
    const [transLoading, setTransLoading] = useState(false);

    // Detail (fetched by id for full logs)
    const [detailId, setDetailId] = useState<string | null>(null);
    const [detail, setDetail] = useState<VisitorRegistrationResponse | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Approve
    const [approveState, setApproveState] = useState<ApproveState | null>(null);
    const [approveSubmitting, setApproveSubmitting] = useState(false);
    const [approveError, setApproveError] = useState<string | null>(null);

    // Reject
    const [rejectState, setRejectState] = useState<RejectState | null>(null);
    const [rejectSubmitting, setRejectSubmitting] = useState(false);
    const [rejectError, setRejectError] = useState<string | null>(null);

    // Transfer
    const [transferState, setTransferState] = useState<TransferState | null>(null);
    const [transferSubmitting, setTransferSubmitting] = useState(false);
    const [transferError, setTransferError] = useState<string | null>(null);

    // Respond transfer
    const [respondState, setRespondState] = useState<RespondState | null>(null);
    const [respondSubmitting, setRespondSubmitting] = useState(false);
    const [respondError, setRespondError] = useState<string | null>(null);

    const fetchRegistrations = useCallback(async (silent = false) => {
        if (!silent) setRegLoading(true);
        else setRefreshing(true);
        try {
            const data = await visitorRegistrationService.getMyList();
            setRegistrations(data);
        } catch { /* ignore */ } finally {
            setRegLoading(false);
            setRefreshing(false);
        }
    }, []);

    const fetchTransfers = useCallback(async () => {
        setTransLoading(true);
        try {
            const data = await visitorRegistrationService.getPendingTransfers();
            setTransfers(data);
        } catch { /* ignore */ } finally {
            setTransLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRegistrations();
        fetchTransfers();
    }, [fetchRegistrations, fetchTransfers]);

    // Load detail when detailId changes
    useEffect(() => {
        if (!detailId) { setDetail(null); return; }
        setDetailLoading(true);
        visitorRegistrationService.getById(detailId)
            .then(setDetail)
            .catch(() => setDetail(null))
            .finally(() => setDetailLoading(false));
    }, [detailId]);

    // ── Approve ──────────────────────────────────────────────────────────────
    const submitApprove = async () => {
        if (!approveState) return;
        const dh = parseInt(approveState.durationHours, 10);
        if (!approveState.durationHours || isNaN(dh) || dh < 2 || dh > 24) {
            setApproveError('Duration must be between 2 and 24 hours');
            return;
        }
        setApproveSubmitting(true);
        setApproveError(null);
        try {
            const body: any = { status: 1, durationHours: dh };
            if (approveState.reason.trim())  body.reason     = approveState.reason.trim();
            if (approveState.activeFrom)     body.activeFrom = new Date(approveState.activeFrom).toISOString();
            const updated = await visitorRegistrationService.updateStatus(approveState.registrationId, body);
            setRegistrations(prev => prev.map(r => r.id === updated.id ? updated : r));
            setApproveState(null);
            if (detailId === updated.id) setDetailId(updated.id); // refresh detail
        } catch (err: any) {
            setApproveError(getErrMsg(err));
        } finally {
            setApproveSubmitting(false);
        }
    };

    // ── Reject ───────────────────────────────────────────────────────────────
    const submitReject = async () => {
        if (!rejectState) return;
        setRejectSubmitting(true);
        setRejectError(null);
        try {
            const body: any = { status: 2 };
            if (rejectState.reason.trim()) body.reason = rejectState.reason.trim();
            const updated = await visitorRegistrationService.updateStatus(rejectState.registrationId, body);
            setRegistrations(prev => prev.map(r => r.id === updated.id ? updated : r));
            setRejectState(null);
            if (detailId === updated.id) setDetailId(updated.id);
        } catch (err: any) {
            setRejectError(getErrMsg(err));
        } finally {
            setRejectSubmitting(false);
        }
    };

    // ── Transfer ─────────────────────────────────────────────────────────────
    const submitTransfer = async () => {
        if (!transferState) return;
        if (!transferState.toAssigneeEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(transferState.toAssigneeEmail)) {
            setTransferError('Please enter a valid email address');
            return;
        }
        setTransferSubmitting(true);
        setTransferError(null);
        try {
            await visitorRegistrationService.requestTransfer(transferState.registrationId, {
                toAssigneeEmail: transferState.toAssigneeEmail.trim(),
            });
            setTransferState(null);
            fetchRegistrations(true);
        } catch (err: any) {
            setTransferError(getErrMsg(err));
        } finally {
            setTransferSubmitting(false);
        }
    };

    // ── Respond to transfer ──────────────────────────────────────────────────
    const submitRespond = async () => {
        if (!respondState) return;
        setRespondSubmitting(true);
        setRespondError(null);
        try {
            const body: any = { accept: respondState.accept };
            if (respondState.reason.trim()) body.reason = respondState.reason.trim();
            await visitorRegistrationService.respondToTransfer(respondState.transfer.id, body);
            setRespondState(null);
            setTransfers(prev => prev.filter(t => t.id !== respondState.transfer.id));
            fetchRegistrations(true);
        } catch (err: any) {
            setRespondError(getErrMsg(err));
        } finally {
            setRespondSubmitting(false);
        }
    };

    // ── UI helpers ───────────────────────────────────────────────────────────

    const openApprove = (item: VisitorRegistrationResponse) => {
        setApproveError(null);
        setApproveState({ registrationId: item.id, fullName: item.fullName, appointmentDateTime: item.appointmentDateTime, reason: '', activeFrom: '', durationHours: '' });
    };
    const openReject = (item: VisitorRegistrationResponse) => {
        setRejectError(null);
        setRejectState({ registrationId: item.id, fullName: item.fullName, reason: '' });
    };
    const openTransfer = (item: VisitorRegistrationResponse) => {
        setTransferError(null);
        setTransferState({ registrationId: item.id, fullName: item.fullName, toAssigneeEmail: '' });
    };

    const statusBadge = (status: VisitorRegistrationStatus) => {
        const cfg = REG_STATUS[status];
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: cfg.bg, color: cfg.color, borderRadius: '999px', padding: '3px 10px', fontSize: '0.76rem', fontWeight: 600 }}>
                {cfg.icon} {cfg.label}
            </span>
        );
    };

    const labAccessBadge = (labAccess: boolean) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: labAccess ? '#cffafe' : '#f1f5f9', color: labAccess ? '#0891b2' : '#94a3b8', borderRadius: '999px', padding: '3px 10px', fontSize: '0.76rem', fontWeight: 600 }}>
            {labAccess ? <Wifi size={11} /> : <WifiOff size={11} />}
            {labAccess ? 'In Lab' : 'Not In Lab'}
        </span>
    );

    const fieldRow = (label: string, value: React.ReactNode) => (
        <div key={label} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.45rem 0', borderBottom: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '145px', fontWeight: 600, paddingTop: '1px', flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', flex: 1 }}>{value}</span>
        </div>
    );

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '0.55rem 0.85rem', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-color)', fontSize: '0.9rem', outline: 'none',
        boxSizing: 'border-box', fontFamily: 'inherit',
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem',
    };

    const errorBanner = (msg: string) => (
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', color: '#e11d48', fontSize: '0.88rem' }}>{msg}</div>
    );

    const imgPreviewStyle: React.CSSProperties = {
        width: '100%', borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid var(--border-color)', maxHeight: '180px',
    };

    const pendingTransferCount = transfers.length;

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">
                {/* Header */}
                <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                        <h1>Visitor Registrations</h1>
                        <p>Manage visit requests assigned to you.</p>
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={() => { fetchRegistrations(true); if (tab === 'transfers') fetchTransfers(); }}
                        disabled={refreshing}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', marginBottom: '1.5rem' }}>
                    {[
                        { key: 'registrations', label: 'Registrations', icon: <List size={14} /> },
                        { key: 'transfers', label: 'Transfer Requests', icon: <GitPullRequest size={14} />, badge: pendingTransferCount },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key as any)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '0.65rem 1.25rem', border: 'none', background: 'none', cursor: 'pointer',
                                fontSize: '0.88rem', fontWeight: 600,
                                color: tab === t.key ? 'var(--accent-color)' : 'var(--text-muted)',
                                borderBottom: tab === t.key ? '2px solid var(--accent-color)' : '2px solid transparent',
                                marginBottom: '-2px', transition: 'color 0.15s',
                            }}
                        >
                            {t.icon} {t.label}
                            {t.badge !== undefined && t.badge > 0 && (
                                <span style={{ background: '#dc2626', color: '#fff', borderRadius: '999px', padding: '1px 6px', fontSize: '0.7rem', fontWeight: 700 }}>{t.badge}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Tab: Registrations ── */}
                {tab === 'registrations' && (
                    <>
                        {/* Stats */}
                        {!regLoading && registrations.length > 0 && (
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                {([VisitorRegistrationStatus.Pending, VisitorRegistrationStatus.Approved, VisitorRegistrationStatus.Rejected] as VisitorRegistrationStatus[]).map(status => {
                                    const count = registrations.filter(r => r.status === status).length;
                                    const cfg = REG_STATUS[status];
                                    return (
                                        <div key={status} className="card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '10px', minWidth: '130px' }}>
                                            <span style={{ background: cfg.bg, color: cfg.color, borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cfg.icon}</span>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{count}</p>
                                                <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-muted)' }}>{cfg.label}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {regLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} color="var(--accent-color)" />
                            </div>
                        ) : registrations.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon"><UserCheck size={36} /></div>
                                <h2>No registrations yet</h2>
                                <p>When someone requests a visit with you, it will appear here.</p>
                            </div>
                        ) : (
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border-color)' }}>
                                            {['Visitor', 'Email', 'Appointment', 'Assignee', 'Lab Access', 'Status', ''].map(h => (
                                                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {registrations.map((item, idx) => (
                                            <tr key={item.id}
                                                style={{ borderBottom: idx < registrations.length - 1 ? '1px solid var(--border-light)' : 'none', transition: 'background 0.15s' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                                        <img src={item.photoUrl} alt={item.fullName} style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)', flexShrink: 0 }} />
                                                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.fullName}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.email}</td>
                                                <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDt(item.appointmentDateTime)}</td>
                                                <td style={{ padding: '0.85rem 1rem', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <User size={12} color="var(--text-muted)" />
                                                        <span>{item.assigneeFullName || item.assigneeEmail}</span>
                                                        {item.isAssignee && (
                                                            <span style={{ fontSize: '0.68rem', background: '#dbeafe', color: '#2563eb', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>You</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem' }}>{labAccessBadge(item.labAccess)}</td>
                                                <td style={{ padding: '0.85rem 1rem' }}>{statusBadge(item.status)}</td>
                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                        <button className="btn btn-secondary" style={{ padding: '3px 9px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setDetailId(item.id)}>
                                                            <Eye size={12} /> Details
                                                        </button>
                                                        {item.status === VisitorRegistrationStatus.Pending && item.isAssignee && (
                                                            <>
                                                                <button className="btn btn-primary" style={{ padding: '3px 9px', fontSize: '0.78rem', background: '#16a34a', borderColor: '#16a34a' }} onClick={() => openApprove(item)}>
                                                                    Approve
                                                                </button>
                                                                <button className="btn btn-primary" style={{ padding: '3px 9px', fontSize: '0.78rem', background: '#dc2626', borderColor: '#dc2626' }} onClick={() => openReject(item)}>
                                                                    Reject
                                                                </button>
                                                                <button className="btn btn-secondary" style={{ padding: '3px 9px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => openTransfer(item)}>
                                                                    <ArrowRightLeft size={12} /> Transfer
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {/* ── Tab: Transfer Requests ── */}
                {tab === 'transfers' && (
                    transLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} color="var(--accent-color)" />
                        </div>
                    ) : transfers.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon"><GitPullRequest size={36} /></div>
                            <h2>No pending transfer requests</h2>
                            <p>When someone transfers a visitor registration to you, it will appear here.</p>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border-color)' }}>
                                        {['From Assignee', 'Registration', 'Requested', ''].map(h => (
                                            <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {transfers.map((t, idx) => (
                                        <tr key={t.id}
                                            style={{ borderBottom: idx < transfers.length - 1 ? '1px solid var(--border-light)' : 'none', transition: 'background 0.15s' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.88rem', fontWeight: 500 }}>{t.fromAssigneeEmail}</td>
                                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.76rem' }} onClick={() => setDetailId(t.registrationId)}>
                                                    {t.registrationId.slice(0, 8)}… <Eye size={11} style={{ marginLeft: '4px' }} />
                                                </button>
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDt(t.createdAt)}</td>
                                            <td style={{ padding: '0.85rem 1rem' }}>
                                                <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                                                    <button className="btn btn-primary" style={{ padding: '3px 9px', fontSize: '0.78rem', background: '#16a34a', borderColor: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        onClick={() => { setRespondError(null); setRespondState({ transfer: t, accept: true, reason: '' }); }}>
                                                        <CheckCheck size={12} /> Accept
                                                    </button>
                                                    <button className="btn btn-primary" style={{ padding: '3px 9px', fontSize: '0.78rem', background: '#dc2626', borderColor: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        onClick={() => { setRespondError(null); setRespondState({ transfer: t, accept: false, reason: '' }); }}>
                                                        <X size={12} /> Decline
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            {/* ════════════════ MODALS ════════════════ */}

            {/* Detail Modal */}
            <Modal isOpen={!!detailId} onClose={() => setDetailId(null)} title="Registration Details" maxWidth="620px">
                {detailLoading || !detail ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} color="var(--accent-color)" />
                    </div>
                ) : (
                    <div style={{ padding: '1.25rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Photos */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <p style={{ margin: '0 0 0.35rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Portrait</p>
                                <img src={detail.photoUrl} alt="Photo" style={imgPreviewStyle} />
                            </div>
                            <div>
                                <p style={{ margin: '0 0 0.35rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ID Card</p>
                                <img src={detail.cccdImageUrl} alt="CCCD" style={imgPreviewStyle} />
                            </div>
                        </div>

                        {/* Info */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', padding: '0 0.75rem' }}>
                            {fieldRow('Full Name',    <strong>{detail.fullName}</strong>)}
                            {fieldRow('Visitor Email', detail.email)}
                            {fieldRow('Contact Email', detail.contactEmail)}
                            {fieldRow('Appointment',   formatDt(detail.appointmentDateTime))}
                            {fieldRow('Created At',    formatDt(detail.createdAt))}
                            {fieldRow('Assignee', (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    {detail.assigneeFullName} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({detail.assigneeEmail})</span>
                                    {detail.isAssignee && <span style={{ fontSize: '0.68rem', background: '#dbeafe', color: '#2563eb', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>You</span>}
                                </span>
                            ))}
                            {fieldRow('Status',     statusBadge(detail.status))}
                            {fieldRow('Lab Access', labAccessBadge(detail.labAccess))}
                            {detail.reason     && fieldRow('Reason',       detail.reason)}
                            {detail.activeFrom && fieldRow('Active From',  formatDt(detail.activeFrom))}
                            {detail.activeUntil && fieldRow('Active Until', formatDt(detail.activeUntil))}
                        </div>

                        {/* Action buttons */}
                        {detail.status === VisitorRegistrationStatus.Pending && detail.isAssignee && (
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button className="btn btn-primary" style={{ flex: 1, background: '#16a34a', borderColor: '#16a34a' }}
                                    onClick={() => { setDetailId(null); openApprove(detail); }}>Approve</button>
                                <button className="btn btn-primary" style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626' }}
                                    onClick={() => { setDetailId(null); openReject(detail); }}>Reject</button>
                                <button className="btn btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                    onClick={() => { setDetailId(null); openTransfer(detail); }}>
                                    <ArrowRightLeft size={13} /> Transfer
                                </button>
                            </div>
                        )}

                        {/* Logs timeline */}
                        {detail.logs && detail.logs.length > 0 && (
                            <div>
                                <p style={{ margin: '0 0 0.75rem', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Activity Log</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {detail.logs.map(log => {
                                        const clr = ACTION_COLORS[log.actionType] ?? { color: '#64748b', bg: '#f1f5f9' };
                                        return (
                                            <div key={log.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.6rem 0.85rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                                <span style={{ background: clr.bg, color: clr.color, borderRadius: '6px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: '1px' }}>
                                                    {log.actionType}
                                                </span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{log.actorEmail}</span>
                                                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDt(log.occurredAt)}</span>
                                                    </div>
                                                    {log.fromAssigneeEmail && log.toAssigneeEmail && (
                                                        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{log.fromAssigneeEmail} → {log.toAssigneeEmail}</p>
                                                    )}
                                                    {log.reason && <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{log.reason}</p>}
                                                    {log.activeFrom && (
                                                        <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                                            Access: {formatDt(log.activeFrom)} – {log.activeUntil ? formatDt(log.activeUntil) : '?'}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Approve Modal */}
            <Modal
                isOpen={!!approveState}
                onClose={() => !approveSubmitting && setApproveState(null)}
                title="Approve Visit Request"
                variant="success"
                maxWidth="480px"
                disableBackdropClose={approveSubmitting}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.75rem', borderTop: '1px solid var(--border-color)' }}>
                        <button className="btn btn-secondary" onClick={() => setApproveState(null)} disabled={approveSubmitting}>Cancel</button>
                        <button className="btn btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a', minWidth: '100px' }} onClick={submitApprove} disabled={approveSubmitting}>
                            {approveSubmitting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }} />Processing...</> : 'Approve'}
                        </button>
                    </div>
                }
            >
                {approveState && (
                    <div style={{ padding: '1.25rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {approveError && errorBanner(approveError)}
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Approving visit request from <strong>{approveState.fullName}</strong>.
                        </p>
                        <div>
                            <label style={labelStyle}>Reason <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                            <input value={approveState.reason} onChange={e => setApproveState(p => p && ({ ...p, reason: e.target.value }))} maxLength={500} placeholder="Agreed to meet..." style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>
                                Lab Access Starts <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — defaults to appointment time)</span>
                            </label>
                            <input type="datetime-local" value={approveState.activeFrom} onChange={e => setApproveState(p => p && ({ ...p, activeFrom: e.target.value }))} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>
                                Duration (hours) <span style={{ color: '#e11d48' }}>*</span>{' '}
                                <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(2–24)</span>
                            </label>
                            <input
                                type="number" min={2} max={24}
                                value={approveState.durationHours}
                                onChange={e => setApproveState(p => p && ({ ...p, durationHours: e.target.value }))}
                                placeholder="e.g. 4"
                                style={{ ...inputStyle, borderColor: approveError && !approveState.durationHours ? '#e11d48' : 'var(--border-color)' }}
                            />
                        </div>
                    </div>
                )}
            </Modal>

            {/* Reject Modal */}
            <Modal
                isOpen={!!rejectState}
                onClose={() => !rejectSubmitting && setRejectState(null)}
                title="Reject Visit Request"
                variant="danger"
                maxWidth="450px"
                disableBackdropClose={rejectSubmitting}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.75rem', borderTop: '1px solid var(--border-color)' }}>
                        <button className="btn btn-secondary" onClick={() => setRejectState(null)} disabled={rejectSubmitting}>Cancel</button>
                        <button className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626', minWidth: '100px' }} onClick={submitReject} disabled={rejectSubmitting}>
                            {rejectSubmitting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }} />Processing...</> : 'Reject'}
                        </button>
                    </div>
                }
            >
                {rejectState && (
                    <div style={{ padding: '1.25rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {rejectError && errorBanner(rejectError)}
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            You are about to reject the visit request from <strong>{rejectState.fullName}</strong>.
                        </p>
                        <div>
                            <label style={labelStyle}>Reason <span style={{ color: '#e11d48' }}>(recommended)</span></label>
                            <textarea rows={3} maxLength={500} value={rejectState.reason}
                                onChange={e => setRejectState(p => p && ({ ...p, reason: e.target.value }))}
                                placeholder="Schedule is full..."
                                style={{ ...inputStyle, resize: 'vertical' as const }}
                            />
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>{rejectState.reason.length}/500</p>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Transfer Modal */}
            <Modal
                isOpen={!!transferState}
                onClose={() => !transferSubmitting && setTransferState(null)}
                title="Transfer to Another Assignee"
                maxWidth="420px"
                disableBackdropClose={transferSubmitting}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.75rem', borderTop: '1px solid var(--border-color)' }}>
                        <button className="btn btn-secondary" onClick={() => setTransferState(null)} disabled={transferSubmitting}>Cancel</button>
                        <button className="btn btn-primary" style={{ minWidth: '110px' }} onClick={submitTransfer} disabled={transferSubmitting}>
                            {transferSubmitting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }} />Sending...</> : 'Send Request'}
                        </button>
                    </div>
                }
            >
                {transferState && (
                    <div style={{ padding: '1.25rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {transferError && errorBanner(transferError)}
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Transfer the visit request from <strong>{transferState.fullName}</strong> to another lab member. They will need to accept.
                        </p>
                        <div>
                            <label style={labelStyle}>Recipient Email <span style={{ color: '#e11d48' }}>*</span></label>
                            <input type="email" value={transferState.toAssigneeEmail}
                                onChange={e => setTransferState(p => p && ({ ...p, toAssigneeEmail: e.target.value }))}
                                placeholder="colleague@lab.vn"
                                style={inputStyle}
                            />
                        </div>
                    </div>
                )}
            </Modal>

            {/* Respond Transfer Modal */}
            <Modal
                isOpen={!!respondState}
                onClose={() => !respondSubmitting && setRespondState(null)}
                title={respondState?.accept ? 'Accept Transfer Request' : 'Decline Transfer Request'}
                variant={respondState?.accept ? 'success' : 'danger'}
                maxWidth="420px"
                disableBackdropClose={respondSubmitting}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.75rem', borderTop: '1px solid var(--border-color)' }}>
                        <button className="btn btn-secondary" onClick={() => setRespondState(null)} disabled={respondSubmitting}>Cancel</button>
                        <button
                            className="btn btn-primary"
                            style={respondState?.accept ? { background: '#16a34a', borderColor: '#16a34a', minWidth: '100px' } : { background: '#dc2626', borderColor: '#dc2626', minWidth: '100px' }}
                            onClick={submitRespond}
                            disabled={respondSubmitting}
                        >
                            {respondSubmitting
                                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }} />Processing...</>
                                : (respondState?.accept ? 'Accept' : 'Decline')}
                        </button>
                    </div>
                }
            >
                {respondState && (
                    <div style={{ padding: '1.25rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {respondError && errorBanner(respondError)}
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            {respondState.accept ? 'Accepting' : 'Declining'} transfer from <strong>{respondState.transfer.fromAssigneeEmail}</strong>.
                            {respondState.accept ? ' You will become the new assignee for this registration.' : ''}
                        </p>
                        <div>
                            <label style={labelStyle}>Reason <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                            <textarea rows={2} maxLength={500} value={respondState.reason}
                                onChange={e => setRespondState(p => p && ({ ...p, reason: e.target.value }))}
                                placeholder="Add a note..."
                                style={{ ...inputStyle, resize: 'none' as const }}
                            />
                        </div>
                    </div>
                )}
            </Modal>
        </MainLayout>
    );
};

export default VisitorRegistrations;
