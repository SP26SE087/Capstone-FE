import React, { useEffect, useState } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { visitorRegistrationService } from '@/services/visitorRegistrationService';
import { VisitorRegistrationResponse, VisitorRegistrationStatus } from '@/types/visitorRegistration';
import Modal from '@/components/common/Modal';
import {
    UserCheck,
    Clock,
    CheckCircle2,
    XCircle,
    ChevronDown,
    Loader2,
    RefreshCw,
    Eye,
    Calendar,
    Mail,
} from 'lucide-react';

const STATUS_CONFIG = {
    [VisitorRegistrationStatus.Pending]: { label: 'Pending', color: '#d97706', bg: '#fef3c7', icon: <Clock size={13} /> },
    [VisitorRegistrationStatus.Approved]: { label: 'Approved', color: '#16a34a', bg: '#dcfce7', icon: <CheckCircle2 size={13} /> },
    [VisitorRegistrationStatus.Rejected]: { label: 'Rejected', color: '#dc2626', bg: '#fee2e2', icon: <XCircle size={13} /> },
};

interface ReviewState {
    registrationId: string;
    fullName: string;
    status: 1 | 2;
    reason: string;
}

const VisitorRegistrations: React.FC = () => {
    const { user } = useAuth();
    const [registrations, setRegistrations] = useState<VisitorRegistrationResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [detailItem, setDetailItem] = useState<VisitorRegistrationResponse | null>(null);
    const [reviewState, setReviewState] = useState<ReviewState | null>(null);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewError, setReviewError] = useState<string | null>(null);

    const fetchList = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const data = await visitorRegistrationService.getMyList();
            setRegistrations(data);
        } catch {
            // ignore – list will stay empty
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, []);

    const openReview = (item: VisitorRegistrationResponse, status: 1 | 2) => {
        setReviewState({ registrationId: item.id, fullName: item.fullName, status, reason: '' });
        setReviewError(null);
    };

    const submitReview = async () => {
        if (!reviewState) return;
        setReviewSubmitting(true);
        setReviewError(null);
        try {
            const updated = await visitorRegistrationService.updateStatus(reviewState.registrationId, {
                status: reviewState.status,
                reason: reviewState.reason || undefined,
            });
            setRegistrations(prev => prev.map(r => r.id === updated.id ? updated : r));
            setReviewState(null);
            setDetailItem(prev => (prev?.id === updated.id ? updated : prev));
        } catch (err: any) {
            const code = err?.response?.data?.messageCode || err?.response?.data?.MessageCode;
            const map: Record<string, string> = {
                US031: 'Invalid status value',
                US032: 'Registration not found',
                US033: 'You are not authorized to perform this action',
                US034: 'This registration has already been processed',
            };
            setReviewError(map[code] || 'An error occurred. Please try again.');
        } finally {
            setReviewSubmitting(false);
        }
    };

    const formatDt = (iso: string) =>
        new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

    const imgPreviewStyle: React.CSSProperties = {
        width: '100%',
        borderRadius: 'var(--radius-sm)',
        objectFit: 'cover',
        border: '1px solid var(--border-color)',
        maxHeight: '200px',
    };

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div className="page-container">
                {/* Header */}
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>Visitor Registrations</h1>
                        <p>People requesting to meet you at the Lab.</p>
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={() => fetchList(true)}
                        disabled={refreshing}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        Refresh
                    </button>
                </div>

                {/* Stats row */}
                {!loading && registrations.length > 0 && (
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        {[
                            { status: VisitorRegistrationStatus.Pending, label: 'Pending' },
                            { status: VisitorRegistrationStatus.Approved, label: 'Approved' },
                            { status: VisitorRegistrationStatus.Rejected, label: 'Rejected' },
                        ].map(({ status, label }) => {
                            const count = registrations.filter(r => r.status === status).length;
                            const cfg = STATUS_CONFIG[status];
                            return (
                                <div key={status} className="card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '10px', minWidth: '140px' }}>
                                    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {cfg.icon}
                                    </span>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{count}</p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Table / Empty */}
                {loading ? (
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
                                    {['Visitor', 'Visitor Email', 'Appointment', 'Created', 'Status', ''].map(h => (
                                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {registrations.map((item, idx) => {
                                    const cfg = STATUS_CONFIG[item.status];
                                    return (
                                        <tr key={item.id} style={{ borderBottom: idx < registrations.length - 1 ? '1px solid var(--border-light)' : 'none', transition: 'background 0.15s' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                            <td style={{ padding: '0.85rem 1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <img src={item.photoUrl} alt={item.fullName} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                                                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.fullName}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{item.email}</td>
                                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.88rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDt(item.appointmentDateTime)}</td>
                                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDt(item.createdAt)}</td>
                                            <td style={{ padding: '0.85rem 1rem' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: cfg.bg, color: cfg.color, borderRadius: '999px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: 600 }}>
                                                    {cfg.icon} {cfg.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem' }}>
                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        onClick={() => setDetailItem(item)}>
                                                        <Eye size={13} /> Details
                                                    </button>
                                                    {item.status === VisitorRegistrationStatus.Pending && (
                                                        <>
                                                            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem', background: '#16a34a', borderColor: '#16a34a' }}
                                                                onClick={() => openReview(item, 1)}>
                                                                Approve
                                                            </button>
                                                            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem', background: '#dc2626', borderColor: '#dc2626' }}
                                                                onClick={() => openReview(item, 2)}>
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {detailItem && (
                <Modal isOpen={!!detailItem} onClose={() => setDetailItem(null)} title="Registration Details" maxWidth="580px">
                    <div style={{ padding: '1.25rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <p style={{ margin: '0 0 0.35rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Your Photo</p>
                                <img src={detailItem.photoUrl} alt="Photo" style={imgPreviewStyle} />
                            </div>
                            <div>
                                <p style={{ margin: '0 0 0.35rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ID Card Photo</p>
                                <img src={detailItem.cccdImageUrl} alt="CCCD" style={imgPreviewStyle} />
                            </div>
                        </div>

                        {[
                            { label: 'Full Name', value: detailItem.fullName },
                            { label: 'Visitor Email', value: detailItem.email },
                            { label: 'Contact Email', value: detailItem.contactEmail },
                            { label: 'Appointment', value: formatDt(detailItem.appointmentDateTime) },
                            { label: 'Created At', value: formatDt(detailItem.createdAt) },
                        ].map(row => (
                            <div key={row.label} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', minWidth: '160px', fontWeight: 600 }}>{row.label}</span>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{row.value}</span>
                            </div>
                        ))}

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', minWidth: '160px', fontWeight: 600 }}>Status</span>
                            {(() => { const cfg = STATUS_CONFIG[detailItem.status]; return (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: cfg.bg, color: cfg.color, borderRadius: '999px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: 600 }}>
                                    {cfg.icon} {cfg.label}
                                </span>
                            ); })()}
                        </div>

                        {detailItem.status === VisitorRegistrationStatus.Pending && (
                            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                                <button className="btn btn-primary" style={{ flex: 1, background: '#16a34a', borderColor: '#16a34a' }} onClick={() => { setDetailItem(null); openReview(detailItem, 1); }}>
                                    Approve
                                </button>
                                <button className="btn btn-primary" style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626' }} onClick={() => { setDetailItem(null); openReview(detailItem, 2); }}>
                                    Reject
                                </button>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* Review Confirm Modal */}
            {reviewState && (
                <Modal
                    isOpen={!!reviewState}
                    onClose={() => !reviewSubmitting && setReviewState(null)}
                    title={reviewState.status === 1 ? 'Confirm Approval' : 'Confirm Rejection'}
                    variant={reviewState.status === 2 ? 'danger' : 'success'}
                    maxWidth="480px"
                    disableBackdropClose={reviewSubmitting}
                    footer={
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.75rem', borderTop: '1px solid var(--border-color)' }}>
                            <button className="btn btn-secondary" onClick={() => setReviewState(null)} disabled={reviewSubmitting}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                style={reviewState.status === 2 ? { background: '#dc2626', borderColor: '#dc2626' } : { background: '#16a34a', borderColor: '#16a34a' }}
                                onClick={submitReview}
                                disabled={reviewSubmitting}
                            >
                                {reviewSubmitting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }} />Processing...</> : (reviewState.status === 1 ? 'Approve' : 'Reject')}
                            </button>
                        </div>
                    }
                >
                    <div style={{ padding: '1.25rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {reviewError && (
                            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', color: '#e11d48', fontSize: '0.88rem' }}>
                                {reviewError}
                            </div>
                        )}
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            You are about to {reviewState.status === 1 ? 'approve' : 'reject'} the visit request from <strong>{reviewState.fullName}</strong>.
                            {reviewState.status === 1 ? ' The visitor will receive an email notification.' : ''}
                        </p>
                        <div>
                            <label style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                                Reason {reviewState.status === 2 ? <span style={{ color: '#e11d48' }}>(recommended)</span> : '(optional)'}
                            </label>
                            <textarea
                                rows={3}
                                maxLength={500}
                                placeholder={reviewState.status === 1 ? 'Agreed to meet at 9 AM...' : 'Reason for rejection...'}
                                value={reviewState.reason}
                                onChange={e => setReviewState(prev => prev ? { ...prev, reason: e.target.value } : prev)}
                                style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.9rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                            />
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>{reviewState.reason.length}/500</p>
                        </div>
                    </div>
                </Modal>
            )}
        </MainLayout>
    );
};

export default VisitorRegistrations;
