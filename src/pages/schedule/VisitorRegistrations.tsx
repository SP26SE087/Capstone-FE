import React, { useEffect, useState, useCallback, useRef } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { visitorRegistrationService } from '@/services/visitorRegistrationService';
import { contactorService } from '@/services/contactorService';
import { userService } from '@/services/userService';
import {
    VisitorRegistrationResponse,
    VisitorRegistrationStatus,
    AssigneeTransferRequestResponse,
    ContactorResponse,
} from '@/types/visitorRegistration';
import Modal from '@/components/common/Modal';
import {
    UserCheck, Clock, CheckCircle2, XCircle, Loader2, Eye, EyeOff,
    ArrowRightLeft, CheckCheck, X, Wifi, WifiOff, User, List, GitPullRequest,
    Users, Mail, Phone, Plus, Trash2, ChevronDown, Search,
} from 'lucide-react';

// ─── Status configs ────────────────────────────────────────────────────────────

const REG_STATUS = {
    [VisitorRegistrationStatus.Pending]:  { label: 'Pending',  color: '#d97706', bg: '#fef3c7', icon: <Clock       size={12} /> },
    [VisitorRegistrationStatus.Approved]: { label: 'Approved', color: '#16a34a', bg: '#dcfce7', icon: <CheckCircle2 size={12} /> },
    [VisitorRegistrationStatus.Rejected]: { label: 'Rejected', color: '#dc2626', bg: '#fee2e2', icon: <XCircle      size={12} /> },
};

const ACTION_COLORS: Record<string, { color: string; bg: string }> = {
    Assigned:          { color: '#16a34a', bg: '#f0fdf4' },  // green — positive action
    TransferRequested: { color: '#64748b', bg: '#f1f5f9' },  // slate — neutral/pending
    TransferAccepted:  { color: '#16a34a', bg: '#f0fdf4' },  // green — accepted
    TransferRejected:  { color: '#dc2626', bg: '#fee2e2' },  // red — rejected
    Approved:          { color: '#16a34a', bg: '#f0fdf4' },  // green — approved
    Rejected:          { color: '#dc2626', bg: '#fee2e2' },  // red — rejected
    LabAccessOpened:   { color: '#16a34a', bg: '#f0fdf4' },  // green — opened
    LabAccessClosed:   { color: '#64748b', bg: '#f1f5f9' },  // slate — closed
};

const ACTION_LEGEND = [
    { color: '#16a34a', label: 'Assigned / Approved / Transfer Accepted / Lab Opened' },
    { color: '#64748b', label: 'Transfer Requested / Lab Closed' },
    { color: '#dc2626', label: 'Rejected' },
];

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
    const isLabDirector = Number(user.role) === 2;
    const [tab, setTab] = useState<'registrations' | 'transfers' | 'contactors'>('registrations');

    // Registrations
    const [registrations, setRegistrations] = useState<VisitorRegistrationResponse[]>([]);
    const [regLoading, setRegLoading] = useState(true);

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

    // CCCD reveal
    const [showCccd, setShowCccd] = useState(false);

    // ── Contactors state ──────────────────────────────────────────────────────
    const [contactors, setContactors] = useState<ContactorResponse[]>([]);
    const [contactorsLoading, setContactorsLoading] = useState(false);
    const [cEditTarget, setCEditTarget] = useState<ContactorResponse | null>(null);
    const [cFormMode, setCFormMode] = useState<'external' | 'member'>('external');
    const [cForm, setCForm] = useState<{ fullName: string; email: string; phone: string }>({ fullName: '', email: '', phone: '' });
    const [cFormErrors, setCFormErrors] = useState<{ fullName?: string; email?: string; phone?: string }>({});
    const [cFormSubmitting, setCFormSubmitting] = useState(false);
    const [cFormError, setCFormError] = useState<string | null>(null);
    const [cLabMembers, setCLabMembers] = useState<any[]>([]);
    const [cMembersLoading, setCMembersLoading] = useState(false);
    const [cMemberSearch, setCMemberSearch] = useState('');
    const [cMemberOpen, setCMemberOpen] = useState(false);
    const [cSelectedMember, setCSelectedMember] = useState<any | null>(null);
    const [cDeleteTarget, setCDeleteTarget] = useState<ContactorResponse | null>(null);
    const [cDeleteSubmitting, setCDeleteSubmitting] = useState(false);
    const [cDeleteError, setCDeleteError] = useState<string | null>(null);
    const cMemberPickerRef = useRef<HTMLDivElement>(null);

    // Transfer contactor dropdown
    const [transferEmailError, setTransferEmailError] = useState<string | null>(null);
    const [transferContactorOpen, setTransferContactorOpen] = useState(false);
    const transferContactorRef = useRef<HTMLDivElement>(null);
    const [transferMode, setTransferMode] = useState<'contactor' | 'member'>('contactor');
    const [transferMemberOpen, setTransferMemberOpen] = useState(false);
    const [transferMemberSearch, setTransferMemberSearch] = useState('');
    const [transferContactorSearch, setTransferContactorSearch] = useState('');
    const transferMemberPickerRef = useRef<HTMLDivElement>(null);

    const fetchRegistrations = useCallback(async () => {
        setRegLoading(true);
        try {
            const data = await visitorRegistrationService.getMyList();
            setRegistrations(data);
        } catch { /* ignore */ } finally {
            setRegLoading(false);
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

    // ── Contactors logic ──────────────────────────────────────────────────────
    const fetchContactors = useCallback(async () => {
        setContactorsLoading(true);
        try { setContactors(await contactorService.getAll()); }
        catch { /* ignore */ } finally { setContactorsLoading(false); }
    }, []);

    useEffect(() => { fetchContactors(); }, [fetchContactors]);

    useEffect(() => {
        setCMembersLoading(true);
        userService.getAll()
            .then(all => setCLabMembers(Array.isArray(all) ? all : []))
            .catch(() => setCLabMembers([]))
            .finally(() => setCMembersLoading(false));
    }, []);

    useEffect(() => {
        if (!cMemberOpen) return;
        const handler = (e: MouseEvent) => {
            if (cMemberPickerRef.current && !cMemberPickerRef.current.contains(e.target as Node))
                setCMemberOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [cMemberOpen]);

    useEffect(() => {
        if (!transferContactorOpen) return;
        const handler = (e: MouseEvent) => {
            if (transferContactorRef.current && !transferContactorRef.current.contains(e.target as Node))
                setTransferContactorOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [transferContactorOpen]);

    useEffect(() => {
        if (!transferMemberOpen) return;
        const handler = (e: MouseEvent) => {
            if (transferMemberPickerRef.current && !transferMemberPickerRef.current.contains(e.target as Node))
                setTransferMemberOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [transferMemberOpen]);

    const cOpenCreate = () => { setCEditTarget(null); setCForm({ fullName: '', email: '', phone: '' }); setCFormErrors({}); setCFormError(null); setCFormMode('external'); setCSelectedMember(null); setCMemberSearch(''); };
    const cOpenEdit = (c: ContactorResponse) => { setCEditTarget(c); setCForm({ fullName: c.fullName, email: c.email, phone: c.phone }); setCFormErrors({}); setCFormError(null); };
    const cSwitchMode = (mode: 'external' | 'member') => { setCFormMode(mode); setCForm({ fullName: '', email: '', phone: '' }); setCFormErrors({}); setCFormError(null); setCSelectedMember(null); setCMemberSearch(''); };
    const cSelectMember = (m: any) => { setCSelectedMember(m); setCForm(p => ({ ...p, fullName: m.fullName || '', email: m.email || '', phone: m.phoneNumber || m.phone || '' })); setCFormErrors({}); setCMemberOpen(false); setCMemberSearch(''); };

    const PHONE_REGEX = /^(\+[1-9]\d{6,14}|0\d{9})$/;

    const cValidate = (): boolean => {
        const errs: { fullName?: string; email?: string; phone?: string } = {};
        if (cFormMode === 'member' && !cEditTarget) {
            if (!cSelectedMember) { setCFormError('Please select a lab member.'); return false; }
            if (!cForm.phone.trim()) errs.phone = 'Phone is required';
            else if (!PHONE_REGEX.test(cForm.phone.trim())) errs.phone = 'Invalid phone number (e.g. 0912345678 or +84912345678)';
        } else {
            if (!cForm.fullName.trim()) errs.fullName = 'Full name is required';
            else if (cForm.fullName.length > 255) errs.fullName = 'Max 255 characters';
            if (!cEditTarget) {
                if (!cForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cForm.email)) errs.email = 'A valid email is required';
                else if (cForm.email.length > 255) errs.email = 'Max 255 characters';
            }
            if (!cForm.phone.trim()) errs.phone = 'Phone is required';
            else if (!PHONE_REGEX.test(cForm.phone.trim())) errs.phone = 'Invalid phone number (e.g. 0912345678 or +84912345678)';
        }
        setCFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const cSubmitForm = async () => {
        if (!cValidate()) return;
        setCFormSubmitting(true); setCFormError(null);
        try {
            if (cEditTarget) {
                const updated = await contactorService.update(cEditTarget.id, { fullName: cForm.fullName.trim(), phone: cForm.phone.trim() });
                setContactors(prev => prev.map(c => c.id === updated.id ? updated : c));
            } else {
                const created = await contactorService.create({ fullName: cForm.fullName.trim(), email: cForm.email.trim(), phone: cForm.phone.trim() });
                setContactors(prev => [created, ...prev]);
            }
            cOpenCreate();
        } catch (err: any) {
            const code = err?.response?.data?.messageCode || err?.response?.data?.MessageCode;
            if (code === 'US040') setCFormError('This email already exists in the contactor list.');
            else setCFormError('An error occurred. Please try again.');
        } finally { setCFormSubmitting(false); }
    };

    const cSubmitDelete = async () => {
        if (!cDeleteTarget) return;
        setCDeleteSubmitting(true); setCDeleteError(null);
        try {
            await contactorService.deleteById(cDeleteTarget.id);
            setContactors(prev => prev.filter(c => c.id !== cDeleteTarget.id));
            setCDeleteTarget(null);
        } catch { setCDeleteError('Failed to delete contactor. Please try again.'); }
        finally { setCDeleteSubmitting(false); }
    };

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
        const email = transferState.toAssigneeEmail.trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setTransferEmailError('Please enter a valid email address');
            return;
        }
        setTransferSubmitting(true);
        setTransferError(null);
        try {
            await visitorRegistrationService.requestTransfer(transferState.registrationId, {
                toAssigneeEmail: transferState.toAssigneeEmail.trim(),
            });
            setTransferState(null);
            fetchRegistrations();
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
            fetchRegistrations();
        } catch (err: any) {
            setRespondError(getErrMsg(err));
        } finally {
            setRespondSubmitting(false);
        }
    };

    // ── UI helpers ───────────────────────────────────────────────────────────

    const openApprove = (item: VisitorRegistrationResponse) => {
        setApproveError(null);
        const apptLocal = item.appointmentDateTime ? new Date(item.appointmentDateTime).toLocaleString('sv-SE', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).slice(0, 16) : '';
        setApproveState({ registrationId: item.id, fullName: item.fullName, appointmentDateTime: item.appointmentDateTime, reason: '', activeFrom: apptLocal, durationHours: '2' });
    };
    const openReject = (item: VisitorRegistrationResponse) => {
        setRejectError(null);
        setRejectState({ registrationId: item.id, fullName: item.fullName, reason: '' });
    };
    const openTransfer = (item: VisitorRegistrationResponse) => {
        setTransferError(null);
        setTransferEmailError(null);
        setTransferContactorOpen(false);
        setTransferMemberOpen(false);
        setTransferMemberSearch('');
        setTransferContactorSearch('');
        setTransferMode('contactor');
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
        width: '100%', borderRadius: 'var(--radius-sm)', objectFit: 'contain', border: '1px solid var(--border-color)', maxHeight: '130px', background: 'var(--surface-hover)',
    };

    const pendingTransferCount = transfers.length;

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container" style={{ maxWidth: '1600px', margin: '0 auto' }}>
                {/* Header */}
                <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                        <h1>Visitor Registrations</h1>
                        <p>Manage visit requests assigned to you.</p>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', marginBottom: '1.5rem' }}>
                    {[
                        { key: 'registrations', label: 'Registrations', icon: <List size={14} /> },
                        { key: 'transfers', label: 'Transfer Requests', icon: <GitPullRequest size={14} />, badge: pendingTransferCount },
                        ...(isLabDirector ? [{ key: 'contactors', label: 'Contactors', icon: <Users size={14} /> }] : []),
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
                                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border-color)' }}>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '14%' }}>Visitor</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '16%' }}>Email</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '13%' }}>Appointment</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '13%' }}>Assignee</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '10%' }}>Lab Access</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '9%' }}>Status</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '25%' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {registrations.map((item, idx) => (
                                            <tr key={item.id}
                                                style={{ borderBottom: idx < registrations.length - 1 ? '1px solid var(--border-light)' : 'none', transition: 'background 0.15s' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <td style={{ padding: '0.85rem 1rem', overflow: 'hidden' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                                        <img src={item.photoUrl} alt={item.fullName} style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)', flexShrink: 0 }} />
                                                        <span style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.fullName}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</td>
                                                <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDt(item.appointmentDateTime)}</td>
                                                <td style={{ padding: '0.85rem 1rem', fontSize: '0.83rem', color: 'var(--text-secondary)', overflow: 'hidden' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                                                        <User size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.assigneeFullName || item.assigneeEmail}</span>
                                                        {item.isAssignee && (
                                                            <span style={{ fontSize: '0.68rem', background: '#dbeafe', color: '#2563eb', borderRadius: '4px', padding: '1px 5px', fontWeight: 700, flexShrink: 0 }}>You</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem' }}>{labAccessBadge(item.labAccess)}</td>
                                                <td style={{ padding: '0.85rem 1rem' }}>{statusBadge(item.status)}</td>
                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        <button className="btn btn-secondary" style={{ width: '72px', flexShrink: 0, padding: '4px 6px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', whiteSpace: 'nowrap' }} onClick={() => setDetailId(item.id)}>
                                                            <Eye size={11} /> Details
                                                        </button>
                                                        {item.status === VisitorRegistrationStatus.Pending && item.isAssignee && (
                                                            <>
                                                                <button className="btn btn-primary" style={{ flex: 1, padding: '4px 6px', fontSize: '0.76rem', background: '#16a34a', borderColor: '#16a34a', whiteSpace: 'nowrap' }} onClick={() => openApprove(item)}>
                                                                    Approve
                                                                </button>
                                                                <button className="btn btn-primary" style={{ flex: 1, padding: '4px 6px', fontSize: '0.76rem', background: '#dc2626', borderColor: '#dc2626', whiteSpace: 'nowrap' }} onClick={() => openReject(item)}>
                                                                    Reject
                                                                </button>
                                                                <button className="btn btn-secondary" style={{ flex: 1, padding: '4px 6px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', whiteSpace: 'nowrap' }} onClick={() => openTransfer(item)}>
                                                                    <ArrowRightLeft size={11} /> Transfer
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
                                            <td style={{ padding: '0.85rem 1rem' }}>
                                                <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }} onClick={() => setDetailId(t.registrationId)}>
                                                    <Eye size={11} /> View Registration
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

            {/* ── Tab: Contactors ── */}
            {tab === 'contactors' && isLabDirector && (
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                    {/* Table */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {contactorsLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} color="var(--accent-color)" />
                            </div>
                        ) : contactors.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon"><Users size={36} /></div>
                                <h2>No contactors yet</h2>
                                <p>Add your first contactor using the form on the right.</p>
                            </div>
                        ) : (
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border-color)' }}>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '30%' }}>Full Name</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '30%' }}>Email</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '20%' }}>Phone</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '14%' }}>Added</th>
                                            <th style={{ padding: '0.75rem 1rem', width: '6%' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {contactors.map((c, idx) => (
                                            <tr
                                                key={c.id}
                                                style={{ borderBottom: idx < contactors.length - 1 ? '1px solid var(--border-light)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                                                onClick={() => cOpenEdit(c)}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = '')}
                                            >
                                                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fullName}</td>
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Mail size={13} style={{ flexShrink: 0 }} />{c.email}</span>
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Phone size={13} style={{ flexShrink: 0 }} />{c.phone}</span>
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB') : '—'}
                                                </td>
                                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => { setCDeleteTarget(c); setCDeleteError(null); }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Side Panel */}
                    <div style={{ width: '400px', flexShrink: 0 }}>
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700 }}>{cEditTarget ? 'Edit Contactor' : 'Add Contactor'}</h3>

                            {/* Mode toggle (only for new) */}
                            {!cEditTarget && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                    {(['external', 'member'] as const).map(m => (
                                        <button
                                            key={m}
                                            onClick={() => cSwitchMode(m)}
                                            style={{
                                                flex: 1, padding: '0.4rem', border: '1px solid', borderRadius: 'var(--radius-sm)',
                                                fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s',
                                                borderColor: cFormMode === m ? 'var(--accent-color)' : 'var(--border-color)',
                                                background: cFormMode === m ? 'var(--accent-color)' : 'transparent',
                                                color: cFormMode === m ? '#fff' : 'var(--text-primary)',
                                            }}
                                        >
                                            {m === 'external' ? 'External' : 'Lab Member'}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Member picker */}
                            {cFormMode === 'member' && !cEditTarget && (
                                <div ref={cMemberPickerRef} style={{ position: 'relative', marginBottom: '0.85rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>Lab Member</label>
                                    <button
                                        type="button"
                                        onClick={() => setCMemberOpen(o => !o)}
                                        style={{
                                            width: '100%', padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: '#fff', cursor: 'pointer',
                                            fontSize: '0.85rem', color: cSelectedMember ? 'var(--text-primary)' : 'var(--text-muted)',
                                        }}
                                    >
                                        {cSelectedMember ? cSelectedMember.fullName : (cMembersLoading ? 'Loading…' : 'Select a member')}
                                        <ChevronDown size={14} />
                                    </button>
                                    {cMemberOpen && (
                                        <div style={{
                                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '2px',
                                            background: '#fff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflow: 'hidden',
                                        }}>
                                            <div style={{ padding: '6px', borderBottom: '1px solid var(--border-light)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                                                    <Search size={13} color="var(--text-muted)" />
                                                    <input
                                                        autoFocus
                                                        value={cMemberSearch}
                                                        onChange={e => setCMemberSearch(e.target.value)}
                                                        placeholder="Search..."
                                                        style={{ border: 'none', outline: 'none', background: 'none', fontSize: '0.82rem', width: '100%' }}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ overflowY: 'auto', maxHeight: '152px' }} className="custom-scrollbar">
                                                {cLabMembers
                                                    .filter(m => (m.fullName || '').toLowerCase().includes(cMemberSearch.toLowerCase()))
                                                    .map(m => (
                                                        <div
                                                            key={m.id}
                                                            onClick={() => cSelectMember(m)}
                                                            style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.1s' }}
                                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                                                        >
                                                            <div style={{ fontWeight: 600 }}>{m.fullName}</div>
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{m.email}</div>
                                                        </div>
                                                    ))}
                                                {cLabMembers.filter(m => (m.fullName || '').toLowerCase().includes(cMemberSearch.toLowerCase())).length === 0 && (
                                                    <div style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.83rem', textAlign: 'center' }}>No members found</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Full Name (external or edit mode) */}
                            {(cFormMode === 'external' || cEditTarget) && (
                                <div style={{ marginBottom: '0.85rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>Full Name <span style={{ color: '#dc2626' }}>*</span></label>
                                    <input
                                        value={cForm.fullName}
                                        onChange={e => setCForm(p => ({ ...p, fullName: e.target.value }))}
                                        placeholder="Full name"
                                        style={{
                                            width: '100%', padding: '0.5rem 0.75rem', border: `1px solid ${cFormErrors.fullName ? '#dc2626' : 'var(--border-color)'}`,
                                            borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
                                        }}
                                    />
                                    {cFormErrors.fullName && <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#dc2626' }}>{cFormErrors.fullName}</p>}
                                </div>
                            )}

                            {/* Email (only on create) */}
                            {!cEditTarget && (
                                <div style={{ marginBottom: '0.85rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>Email <span style={{ color: '#dc2626' }}>*</span></label>
                                    <input
                                        value={cForm.email}
                                        onChange={e => setCForm(p => ({ ...p, email: e.target.value }))}
                                        disabled={cFormMode === 'member' && !!cSelectedMember}
                                        placeholder="email@example.com"
                                        style={{
                                            width: '100%', padding: '0.5rem 0.75rem',
                                            border: `1px solid ${cFormErrors.email ? '#dc2626' : 'var(--border-color)'}`,
                                            borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
                                            background: cFormMode === 'member' && !!cSelectedMember ? 'var(--surface-hover)' : '#fff',
                                        }}
                                    />
                                    {cFormErrors.email && <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#dc2626' }}>{cFormErrors.email}</p>}
                                </div>
                            )}

                            {/* Phone */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>Phone <span style={{ color: '#dc2626' }}>*</span></label>
                                <input
                                    value={cForm.phone}
                                    onChange={e => {
                                        const v = e.target.value;
                                        setCForm(p => ({ ...p, phone: v }));
                                        if (v.trim() && !PHONE_REGEX.test(v.trim()))
                                            setCFormErrors(p => ({ ...p, phone: 'Invalid phone number (e.g. 0912345678 or +84912345678)' }));
                                        else
                                            setCFormErrors(p => ({ ...p, phone: undefined }));
                                    }}
                                    placeholder="e.g. 0912345678 or +84912345678"
                                    style={{
                                        width: '100%', padding: '0.5rem 0.75rem', border: `1px solid ${cFormErrors.phone ? '#dc2626' : 'var(--border-color)'}`,
                                        borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                                {cFormErrors.phone && <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#dc2626' }}>{cFormErrors.phone}</p>}
                            </div>

                            {cFormError && <p style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{cFormError}</p>}

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={cSubmitForm}
                                    disabled={cFormSubmitting}
                                    style={{
                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        padding: '0.5rem', border: 'none', borderRadius: 'var(--radius-sm)',
                                        background: 'var(--accent-color)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                                    }}
                                >
                                    {cFormSubmitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
                                    {cEditTarget ? 'Save Changes' : 'Add Contactor'}
                                </button>
                                {cEditTarget && (
                                    <button
                                        onClick={cOpenCreate}
                                        style={{
                                            padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)',
                                        }}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════ MODALS ════════════════ */}

            {/* Detail Modal */}
            <Modal isOpen={!!detailId} onClose={() => { setDetailId(null); setShowCccd(false); }} title="Registration Details" maxWidth="1020px" disableBackdropClose>
                {detailLoading || !detail ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} color="var(--accent-color)" />
                    </div>
                ) : (
                    <div style={{ padding: '0.85rem 1.75rem', display: 'grid', gridTemplateColumns: (detail.logs && detail.logs.length > 0) || (detail.status === VisitorRegistrationStatus.Pending && detail.isAssignee) ? '1fr 400px' : '1fr', gap: '1.25rem', alignItems: 'start' }}>
                        {/* Left column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Photos */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <p style={{ margin: '0 0 0.35rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Portrait</p>
                                    <img src={detail.photoUrl} alt="Photo" style={imgPreviewStyle} />
                                </div>
                                <div>
                                    <p style={{ margin: '0 0 0.35rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ID Card</p>
                                    <div
                                        style={{ position: 'relative', cursor: 'pointer', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}
                                        onClick={() => setShowCccd(v => !v)}
                                        title={showCccd ? 'Click to hide' : 'Click to reveal'}
                                    >
                                        <img src={detail.cccdImageUrl} alt="CCCD" style={{ ...imgPreviewStyle, filter: showCccd ? 'none' : 'blur(10px)', transition: 'filter 0.25s' }} />
                                        {!showCccd && (
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(0,0,0,0.18)' }}>
                                                <Eye size={20} color="#fff" />
                                                <span style={{ fontSize: '0.68rem', color: '#fff', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>Click to reveal</span>
                                            </div>
                                        )}
                                        {showCccd && (
                                            <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.45)', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <EyeOff size={12} color="#fff" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Visitor info */}
                            <div>
                                <p style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Visitor (Requester)</p>
                                <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', padding: '0 0.75rem' }}>
                                    {fieldRow('Full Name',         <strong>{detail.fullName}</strong>)}
                                    {fieldRow('Email',             detail.email)}
                                    {fieldRow('Wants to Contact',  detail.contactEmail)}
                                    {fieldRow('Appointment',       formatDt(detail.appointmentDateTime))}
                                    {fieldRow('Submitted At',      formatDt(detail.createdAt))}
                                </div>
                            </div>

                            {/* Assignee / request status info */}
                            <div>
                                <p style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Request Info</p>
                                <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', padding: '0 0.75rem' }}>
                                    {fieldRow('Assigned To', (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            {detail.assigneeFullName} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({detail.assigneeEmail})</span>
                                            {detail.isAssignee && <span style={{ fontSize: '0.68rem', background: '#dbeafe', color: '#2563eb', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>You</span>}
                                        </span>
                                    ))}
                                    {fieldRow('Status',     statusBadge(detail.status))}
                                    {fieldRow('Lab Access', labAccessBadge(detail.labAccess))}
                                    {detail.reason      && fieldRow('Reason',       detail.reason)}
                                    {detail.activeFrom  && fieldRow('Active From',  formatDt(detail.activeFrom))}
                                    {detail.activeUntil && fieldRow('Active Until', formatDt(detail.activeUntil))}
                                </div>
                            </div>

                        </div>

                        {/* Right column — Actions + Activity Log */}
                        {((detail.logs && detail.logs.length > 0) || (detail.status === VisitorRegistrationStatus.Pending && detail.isAssignee)) && (
                            <div style={{ borderLeft: '1px solid var(--border-light)', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {detail.logs && detail.logs.length > 0 && <>
                                {/* Header + legend */}
                                <p style={{ margin: '0 0 0.5rem', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Activity Log</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '0.85rem' }}>
                                    {ACTION_LEGEND.map(({ color, label }) => (
                                        <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                            {label}
                                        </span>
                                    ))}
                                </div>

                                <div className={detail.logs.length >= 2 ? 'custom-scrollbar' : ''} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', ...(detail.logs.length >= 2 ? { maxHeight: (detail.status === VisitorRegistrationStatus.Pending && detail.isAssignee) ? '220px' : '420px', overflowY: 'auto' } : {}), paddingRight: '4px' }}>
                                    {detail.logs.map(log => {
                                        const clr = ACTION_COLORS[log.actionType] ?? { color: '#64748b', bg: '#f1f5f9' };
                                        return (
                                            <div key={log.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)', border: `1px solid var(--border-light)`, borderLeft: `3px solid ${clr.color}` }}>
                                                {/* Dot */}
                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: clr.color, flexShrink: 0, marginTop: '5px' }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    {/* Action label + time */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '3px' }}>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: clr.color }}>
                                                            {log.actionType.replace(/([A-Z])/g, ' $1').trim()}
                                                        </span>
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDt(log.occurredAt)}</span>
                                                    </div>
                                                    {/* Performed by */}
                                                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Performed by: </span>{log.actorEmail}
                                                    </p>
                                                    {log.fromAssigneeEmail && log.toAssigneeEmail && (
                                                        <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                                            <span style={{ fontWeight: 500 }}>Transfer: </span>{log.fromAssigneeEmail} → {log.toAssigneeEmail}
                                                        </p>
                                                    )}
                                                    {log.reason && (
                                                        <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                                                            <span style={{ fontWeight: 500 }}>Reason: </span>{log.reason}
                                                        </p>
                                                    )}
                                                    {log.activeFrom && (
                                                        <p style={{ margin: '3px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                                            <span style={{ fontWeight: 500 }}>Access: </span>{formatDt(log.activeFrom)} – {log.activeUntil ? formatDt(log.activeUntil) : '?'}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                </>}
                                {/* Action buttons */}
                                {detail.status === VisitorRegistrationStatus.Pending && detail.isAssignee && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <p style={{ margin: '0 0 0.25rem', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actions</p>
                                        <button className="btn btn-primary" style={{ width: '100%', background: '#16a34a', borderColor: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                            onClick={() => { setDetailId(null); setShowCccd(false); openApprove(detail); }}>
                                            <CheckCircle2 size={14} /> Approve
                                        </button>
                                        <button className="btn btn-primary" style={{ width: '100%', background: '#dc2626', borderColor: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                            onClick={() => { setDetailId(null); setShowCccd(false); openReject(detail); }}>
                                            <XCircle size={14} /> Reject
                                        </button>
                                        <button className="btn btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                            onClick={() => { setDetailId(null); setShowCccd(false); openTransfer(detail); }}>
                                            <ArrowRightLeft size={13} /> Transfer
                                        </button>
                                    </div>
                                )}
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
                disableBackdropClose
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
                            <label style={labelStyle}>
                                Lab Access Starts <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — defaults to appointment time)</span>
                            </label>
                            <input type="datetime-local" value={approveState.activeFrom} min={new Date().toLocaleString('sv-SE', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).slice(0, 16)} onChange={e => setApproveState(p => p && ({ ...p, activeFrom: e.target.value }))} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>
                                Duration (hours) <span style={{ color: '#e11d48' }}>*</span>{' '}
                                <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(2–24)</span>
                            </label>
                            <input
                                type="number" min={2} max={24}
                                value={approveState.durationHours}
                                onChange={e => {
                                    const v = e.target.value;
                                    setApproveState(p => p && ({ ...p, durationHours: v }));
                                    const dh = parseInt(v, 10);
                                    if (!v || isNaN(dh) || dh < 2 || dh > 24)
                                        setApproveError('Duration must be between 2 and 24 hours');
                                    else
                                        setApproveError(null);
                                }}
                                placeholder="e.g. 4"
                                style={{ ...inputStyle, borderColor: approveError && (!approveState.durationHours || parseInt(approveState.durationHours,10) < 2 || parseInt(approveState.durationHours,10) > 24) ? '#e11d48' : 'var(--border-color)' }}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Reason <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                            <textarea
                                rows={4}
                                maxLength={500}
                                value={approveState.reason}
                                onChange={e => setApproveState(p => p && ({ ...p, reason: e.target.value }))}
                                placeholder="Agreed to meet..."
                                className="custom-scrollbar"
                                style={{ ...inputStyle, resize: 'none', overflow: 'auto', height: '96px' }}
                            />
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>{approveState.reason.length}/500</p>
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
                disableBackdropClose
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
                            <textarea
                                rows={4}
                                maxLength={500}
                                value={rejectState.reason}
                                onChange={e => setRejectState(p => p && ({ ...p, reason: e.target.value }))}
                                placeholder="Schedule is full..."
                                className="custom-scrollbar"
                                style={{ ...inputStyle, resize: 'none', overflow: 'auto', height: '96px' }}
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
                maxWidth="500px"
                maxHeight="580px"
                disableBackdropClose
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

                        {/* Mode toggle */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {(['contactor', 'member'] as const).map(m => (
                                <button key={m} type="button"
                                    onClick={() => { setTransferMode(m); setTransferState(p => p && ({ ...p, toAssigneeEmail: '' })); setTransferEmailError(null); setTransferContactorOpen(false); setTransferMemberOpen(false); setTransferMemberSearch(''); setTransferContactorSearch(''); }}
                                    style={{
                                        flex: 1, padding: '0.4rem', border: '1px solid', borderRadius: 'var(--radius-sm)',
                                        fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s',
                                        borderColor: transferMode === m ? 'var(--accent-color)' : 'var(--border-color)',
                                        background: transferMode === m ? 'var(--accent-color)' : 'transparent',
                                        color: transferMode === m ? '#fff' : 'var(--text-primary)',
                                    }}
                                >
                                    {m === 'contactor' ? 'Contactor' : 'Lab Member'}
                                </button>
                            ))}
                        </div>

                        {/* Contactor picker */}
                        {transferMode === 'contactor' && (
                            <div ref={transferContactorRef} style={{ position: 'relative' }}>
                                <label style={labelStyle}>Select Contactor <span style={{ color: '#e11d48' }}>*</span></label>
                                <button type="button"
                                    onClick={() => setTransferContactorOpen(o => !o)}
                                    style={{
                                        width: '100%', padding: '0.55rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        border: `1px solid ${transferEmailError ? '#e11d48' : 'var(--border-color)'}`, borderRadius: 'var(--radius-sm)',
                                        background: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit',
                                        color: transferState.toAssigneeEmail ? 'var(--text-primary)' : 'var(--text-muted)',
                                    }}
                                >
                                    <span>{transferState.toAssigneeEmail
                                        ? (contactors.find(c => c.email === transferState.toAssigneeEmail)?.fullName || transferState.toAssigneeEmail)
                                        : (contactorsLoading ? 'Loading…' : 'Select a contactor…')}</span>
                                    <ChevronDown size={14} />
                                </button>
                                {transferContactorOpen && (
                                    <div style={{
                                        position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 100,
                                        background: '#fff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflow: 'hidden',
                                    }}>
                                        <div style={{ padding: '6px', borderBottom: '1px solid var(--border-light)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                                                <Search size={13} color="var(--text-muted)" />
                                                <input autoFocus value={transferContactorSearch}
                                                    onChange={e => setTransferContactorSearch(e.target.value)}
                                                    placeholder="Search…"
                                                    style={{ border: 'none', outline: 'none', background: 'none', fontSize: '0.82rem', width: '100%' }}
                                                />
                                            </div>
                                        </div>
                                        <div style={{ overflowY: 'auto', maxHeight: '152px' }} className="custom-scrollbar">
                                            {contactors.filter(c => {
                                                const q = transferContactorSearch.toLowerCase();
                                                return !q || c.fullName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
                                            }).map(c => (
                                                <div key={c.id}
                                                    onClick={() => { setTransferState(p => p && ({ ...p, toAssigneeEmail: c.email })); setTransferEmailError(null); setTransferContactorOpen(false); setTransferContactorSearch(''); }}
                                                    style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid var(--border-light)' }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                                                >
                                                    <div style={{ fontWeight: 600 }}>{c.fullName}</div>
                                                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{c.email}</div>
                                                </div>
                                            ))}
                                            {contactors.filter(c => { const q = transferContactorSearch.toLowerCase(); return !q || c.fullName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q); }).length === 0 && (
                                                <div style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.83rem', textAlign: 'center' }}>No contactors found</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Lab Member picker */}
                        {transferMode === 'member' && (
                            <div ref={transferMemberPickerRef} style={{ position: 'relative' }}>
                                <label style={labelStyle}>Select Lab Member <span style={{ color: '#e11d48' }}>*</span></label>
                                <button type="button"
                                    onClick={() => setTransferMemberOpen(o => !o)}
                                    style={{
                                        width: '100%', padding: '0.55rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        border: `1px solid ${transferEmailError ? '#e11d48' : 'var(--border-color)'}`, borderRadius: 'var(--radius-sm)',
                                        background: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit',
                                        color: transferState.toAssigneeEmail ? 'var(--text-primary)' : 'var(--text-muted)',
                                    }}
                                >
                                    <span>{transferState.toAssigneeEmail
                                        ? (cLabMembers.find(m => m.email === transferState.toAssigneeEmail)?.fullName || transferState.toAssigneeEmail)
                                        : (cMembersLoading ? 'Loading…' : 'Select a member…')}</span>
                                    <ChevronDown size={14} />
                                </button>
                                {transferMemberOpen && (
                                    <div style={{
                                        position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 100,
                                        background: '#fff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflow: 'hidden',
                                    }}>
                                        <div style={{ padding: '6px', borderBottom: '1px solid var(--border-light)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                                                <Search size={13} color="var(--text-muted)" />
                                                <input autoFocus value={transferMemberSearch}
                                                    onChange={e => setTransferMemberSearch(e.target.value)}
                                                    placeholder="Search…"
                                                    style={{ border: 'none', outline: 'none', background: 'none', fontSize: '0.82rem', width: '100%' }}
                                                />
                                            </div>
                                        </div>
                                        <div style={{ overflowY: 'auto', maxHeight: '152px' }} className="custom-scrollbar">
                                            {cLabMembers.filter(m => {
                                                const q = transferMemberSearch.toLowerCase();
                                                return !q || (m.fullName || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
                                            }).map(m => (
                                                <div key={m.id}
                                                    onClick={() => { setTransferState(p => p && ({ ...p, toAssigneeEmail: m.email })); setTransferEmailError(null); setTransferMemberOpen(false); setTransferMemberSearch(''); }}
                                                    style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid var(--border-light)' }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                                                >
                                                    <div style={{ fontWeight: 600 }}>{m.fullName}</div>
                                                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{m.email}</div>
                                                </div>
                                            ))}
                                            {cLabMembers.filter(m => { const q = transferMemberSearch.toLowerCase(); return !q || (m.fullName || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q); }).length === 0 && (
                                                <div style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.83rem', textAlign: 'center' }}>No members found</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Manual email input */}
                        <div>
                            <label style={labelStyle}>Recipient Email <span style={{ color: '#e11d48' }}>*</span></label>
                            <input
                                type="email"
                                value={transferState.toAssigneeEmail}
                                onChange={e => {
                                    const v = e.target.value;
                                    setTransferState(p => p && ({ ...p, toAssigneeEmail: v }));
                                    if (v.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))
                                        setTransferEmailError('Please enter a valid email address');
                                    else
                                        setTransferEmailError(null);
                                }}
                                placeholder="colleague@lab.vn"
                                style={{ ...inputStyle, borderColor: transferEmailError ? '#e11d48' : 'var(--border-color)' }}
                            />
                            {transferEmailError && <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#e11d48' }}>{transferEmailError}</p>}
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
                disableBackdropClose
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

            {/* Delete Contactor Modal */}
            <Modal
                isOpen={!!cDeleteTarget}
                onClose={() => setCDeleteTarget(null)}
                title="Delete Contactor"
                maxWidth="400px"
                variant="danger"
                disableBackdropClose
                footer={
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => setCDeleteTarget(null)}
                            disabled={cDeleteSubmitting}
                            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={cSubmitDelete}
                            disabled={cDeleteSubmitting}
                            style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: 'var(--radius-sm)', background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            {cDeleteSubmitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                            Delete
                        </button>
                    </div>
                }
            >
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                    Are you sure you want to delete <strong>{cDeleteTarget?.fullName}</strong>? This action cannot be undone.
                </p>
                {cDeleteError && <p style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: '0.75rem' }}>{cDeleteError}</p>}
            </Modal>
        </MainLayout>
    );
};

export default VisitorRegistrations;
