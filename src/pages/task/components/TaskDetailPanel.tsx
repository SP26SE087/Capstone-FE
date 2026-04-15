import React, { useState, useEffect, useCallback } from 'react';
import { Task, TaskStatus } from '@/types';
import { taskService } from '@/services';
import ConfirmModal from '@/components/common/ConfirmModal';
import {
    X, Target, Loader2, Upload, Paperclip, Check, Play, Send,
    RotateCw, CheckCircle2, FileText, User, Users
} from 'lucide-react';
import { getStatusStyle, getPriorityStyle, formatDate } from '../taskHelpers';

const ALLOWED_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv',
    '.zip', '.rar', '.7z',
    '.mp4', '.avi', '.mov', '.mkv', '.flv',
    '.pdf',
]);
const ALLOWED_ACCEPT = Array.from(ALLOWED_EXTENSIONS).join(',');

interface TaskDetailPanelProps {
    taskId: string;
    onClose: () => void;
    onTaskUpdated: () => void;
}

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({ taskId, onClose, onTaskUpdated }) => {
    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(false);
    const [serverEvidences, setServerEvidences] = useState<any[]>([]);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
    const [isStartConfirmOpen, setIsStartConfirmOpen] = useState(false);
    const [reasonModal, setReasonModal] = useState<{ mode: 'approve' | 'reject' } | null>(null);
    const [reasonText, setReasonText] = useState('');
    const [reasonError, setReasonError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setPendingFiles([]);
        try {
            const [t, ev] = await Promise.all([
                taskService.getById(taskId),
                taskService.getEvidences(taskId),
            ]);
            setTask(t);
            setServerEvidences(ev || []);
        } catch {
            setError('Failed to load task details.');
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    useEffect(() => { load(); }, [load]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const MAX = 10 * 1024 * 1024;
        const MAX_FILES = 5;
        const newFiles = Array.from(e.target.files);

        const invalidExt = newFiles.filter(f => {
            const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
            return !ALLOWED_EXTENSIONS.has(ext);
        });
        if (invalidExt.length > 0) {
            setError(`File type not allowed: ${invalidExt.map(f => f.name).join(', ')}. Accepted: images, documents, text, archives, videos, PDF.`);
            e.target.value = '';
            return;
        }

        const largeFiles = newFiles.filter(f => f.size > MAX);
        if (largeFiles.length > 0) {
            setError(`Files exceed 10 MB limit: ${largeFiles.map(f => f.name).join(', ')}`);
            e.target.value = '';
            return;
        }

        const alreadyCount = serverEvidences.length + pendingFiles.length;
        if (alreadyCount + newFiles.length > MAX_FILES) {
            setError(`Maximum ${MAX_FILES} files allowed. You already have ${serverEvidences.length} uploaded and ${pendingFiles.length} pending.`);
            e.target.value = '';
            return;
        }

        setError(null);
        const available = MAX_FILES - alreadyCount;
        setPendingFiles(prev => [...prev, ...newFiles.slice(0, available)]);
        e.target.value = '';
    };

    const handleUploadOnly = async () => {
        if (pendingFiles.length === 0) return;
        setSubmitting(true);
        setError(null);
        try {
            await taskService.uploadEvidences(taskId, pendingFiles);
            setPendingFiles([]);
            const evidences = await taskService.getEvidences(taskId);
            setServerEvidences(evidences || []);
        } catch (err: any) {
            setError(err.message || 'Upload failed.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteEvidence = async (evidenceId: number) => {
        try {
            await taskService.deleteEvidence(taskId, evidenceId);
            setServerEvidences(prev => prev.filter((e: any) => e.id !== evidenceId));
        } catch (err: any) {
            setError(err.message || 'Delete failed.');
        }
    };

    const handleStatusAction = async (newStatus: TaskStatus, reason?: string) => {
        if (newStatus === TaskStatus.Submitted) {
            if (pendingFiles.length > 0) { setError('Upload pending files first before submitting.'); return; }
            if (serverEvidences.length === 0) { setError('Upload at least 1 evidence before submitting.'); return; }
        }
        setSubmitting(true);
        setError(null);
        try {
            await taskService.updateStatus(taskId, newStatus, reason);
            await load();
            onTaskUpdated();
        } catch (err: any) {
            setError(err.message || 'Action failed.');
        } finally {
            setSubmitting(false);
        }
    };

    const openReasonModal = (mode: 'approve' | 'reject') => {
        setReasonText('');
        setReasonError('');
        setReasonModal({ mode });
    };

    const handleReasonSubmit = async () => {
        if (!reasonModal) return;
        if (reasonModal.mode === 'reject' && !reasonText.trim()) {
            setReasonError('Reason is required when requesting adjustment.');
            return;
        }
        if (reasonText.length > 2000) {
            setReasonError('Reason must not exceed 2000 characters.');
            return;
        }
        const newStatus = reasonModal.mode === 'approve' ? TaskStatus.Completed : TaskStatus.Adjusting;
        setReasonModal(null);
        await handleStatusAction(newStatus, reasonText.trim() || undefined);
    };

    const canUpload = task && task.status !== TaskStatus.Completed;
    const totalFiles = serverEvidences.length + pendingFiles.length;

    return (
        <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            maxHeight: 'calc(100vh - 6rem)',
        }}>
                {/* Header */}
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px', background: 'white', flexShrink: 0 }}>
                    <Target size={18} style={{ color: 'var(--primary-color)' }} />
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', flex: 1, color: '#1e293b' }}>Task Context</h4>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: '6px', borderRadius: '50%', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="custom-scrollbar">
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: '#94a3b8' }}>
                            <Loader2 size={24} className="animate-spin" />
                        </div>
                    ) : !task ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Task not found.</div>
                    ) : (
                        <>
                            {/* Name + Badges */}
                            <div>
                                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>{task.name}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {(() => {
                                        const s = getStatusStyle(task.status);
                                        return <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '5px', background: s.bg, color: s.color, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{s.icon}{s.label}</span>;
                                    })()}
                                    {(() => {
                                        const p = getPriorityStyle(task.priority);
                                        return <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '5px', background: '#f8fafc', color: p.color, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #e2e8f0' }}>{p.icon}{p.label} Priority</span>;
                                    })()}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>Description</label>
                                <div style={{ fontSize: '0.82rem', color: '#445469', lineHeight: 1.6, background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                                    {task.description || 'No description provided.'}
                                </div>
                            </div>

                            {/* Timeline */}
                            <div style={{ background: '#f8fafc', padding: '0.875rem', borderRadius: '12px', border: '1px solid #f1f5f9', display: 'flex', gap: '2rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Start</label>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>{formatDate(task.startDate)}</div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Due</label>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>{formatDate(task.dueDate)}</div>
                                </div>
                            </div>

                            {/* Assignee + Collaborators */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Assignee</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '28px', height: '28px', background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={14} color="#64748b" />
                                        </div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                                            {(task as any).assigneeName || task.assignedToName || (task as any).member?.fullName || 'Unassigned'}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                                        <Users size={12} />
                                        Collaborators ({(task as any).members?.length ?? 0})
                                    </label>
                                    {((task as any).members?.length ?? 0) === 0 ? (
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>No collaborators</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            {(task as any).members.map((m: any, idx: number) => (
                                                <div key={m.memberId || m.userId || idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '24px', height: '24px', background: 'var(--accent-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>
                                                        {(m.fullName || m.name || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <span style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 500 }}>{m.fullName || m.name || m.email || 'Unknown'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Evidence */}
                            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                                        Evidence {serverEvidences.length > 0 && `(${serverEvidences.length})`}
                                    </span>
                                    {canUpload && serverEvidences.length === 0 && pendingFiles.length === 0 && (
                                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444' }} title="Evidence required to submit" />
                                    )}
                                </div>

                                {canUpload && (
                                    totalFiles >= 5 ? (
                                        <div style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', background: '#fef9c3', border: '1px solid #fde047', fontSize: '0.65rem', fontWeight: 700, color: '#854d0e', textAlign: 'center' }}>
                                            Maximum 5 files reached. Remove a file to upload more.
                                        </div>
                                    ) : (
                                        <label style={{ position: 'relative', padding: '0.75rem', border: '1.5px dashed #cbd5e1', borderRadius: '10px', textAlign: 'center', background: 'white', cursor: 'pointer', display: 'block', opacity: submitting ? 0.6 : 1, pointerEvents: submitting ? 'none' : 'auto' }}>
                                            <input type="file" multiple accept={ALLOWED_ACCEPT} onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} disabled={submitting} />
                                            <Upload size={16} style={{ color: '#94a3b8', marginBottom: '3px' }} />
                                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>Click or drag files (max 10MB, {5 - totalFiles} slot{5 - totalFiles !== 1 ? 's' : ''} left)</div>
                                        </label>
                                    )
                                )}

                                {serverEvidences.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {serverEvidences.map((ev: any) => (
                                            <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.68rem' }}>
                                                <Check size={12} color="#10b981" />
                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#475569', fontWeight: 500 }}>{ev.fileName || ev.name}</span>
                                                {canUpload && !submitting && (
                                                    <button onClick={() => handleDeleteEvidence(ev.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex' }}>
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {pendingFiles.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {pendingFiles.map((f, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.68rem' }}>
                                                <Paperclip size={12} color="#64748b" />
                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#475569', fontWeight: 500 }}>{f.name}</span>
                                                {!submitting && (
                                                    <button onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', display: 'flex' }}>
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {pendingFiles.length > 0 && (
                                    <button type="button" onClick={handleUploadOnly} disabled={submitting}
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.72rem', background: 'white', color: 'var(--primary-color)', border: '1.5px solid var(--primary-color)', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: submitting ? 0.7 : 1 }}>
                                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                        UPLOAD ({pendingFiles.length})
                                    </button>
                                )}

                                {error && <div style={{ color: '#ef4444', fontSize: '0.65rem', fontWeight: 700 }}>{error}</div>}
                            </div>

                            {/* Status Actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {task.status === TaskStatus.Todo && (
                                    <button onClick={() => setIsStartConfirmOpen(true)} disabled={submitting}
                                        style={{ padding: '0.8rem', background: 'white', color: 'var(--primary-color)', border: '1.5px solid var(--primary-color)', borderRadius: '12px', fontWeight: 700, fontSize: '0.78rem', cursor: submitting ? 'not-allowed' : 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: submitting ? 0.7 : 1 }}>
                                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                                        START THIS TASK
                                    </button>
                                )}

                                {[TaskStatus.InProgress, TaskStatus.Adjusting, TaskStatus.Missed].includes(task.status) && (
                                    <button type="button"
                                        onClick={() => {
                                            if (pendingFiles.length > 0) { setError('Upload pending files first before submitting.'); return; }
                                            if (serverEvidences.length === 0) { setError('Upload at least 1 evidence before submitting.'); return; }
                                            setError(null);
                                            setIsSubmitConfirmOpen(true);
                                        }}
                                        disabled={submitting || serverEvidences.length === 0 || pendingFiles.length > 0}
                                        style={{
                                            padding: '0.8rem', borderRadius: '12px', fontWeight: 800, fontSize: '0.78rem',
                                            cursor: (submitting || serverEvidences.length === 0 || pendingFiles.length > 0) ? 'not-allowed' : 'pointer',
                                            background: (serverEvidences.length === 0 || pendingFiles.length > 0) ? '#f1f5f9' : 'white',
                                            color: (serverEvidences.length === 0 || pendingFiles.length > 0) ? '#94a3b8' : 'var(--accent-color)',
                                            border: `2px solid ${(serverEvidences.length === 0 || pendingFiles.length > 0) ? '#e2e8f0' : 'var(--accent-color)'}`,
                                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        }}>
                                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                        {serverEvidences.length === 0
                                            ? 'SUBMIT BLOCKED — UPLOAD EVIDENCE'
                                            : pendingFiles.length > 0
                                                ? 'SUBMIT BLOCKED — UPLOAD FILES FIRST'
                                                : 'SUBMIT FOR REVIEW'}
                                    </button>
                                )}

                                {task.status === TaskStatus.Submitted && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => openReasonModal('reject')} disabled={submitting}
                                            style={{ flex: 1, padding: '0.75rem', background: '#fff1f2', color: '#e11d48', border: '1.5px solid #fecdd3', borderRadius: '12px', fontWeight: 800, fontSize: '0.72rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                            <RotateCw size={13} /> REQUEST ADJUST
                                        </button>
                                        <button onClick={() => openReasonModal('approve')} disabled={submitting}
                                            style={{ flex: 1, padding: '0.75rem', background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0', borderRadius: '12px', fontWeight: 800, fontSize: '0.72rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                            <CheckCircle2 size={13} /> APPROVE TASK
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

            <ConfirmModal
                isOpen={isStartConfirmOpen}
                onClose={() => setIsStartConfirmOpen(false)}
                onConfirm={async () => { setIsStartConfirmOpen(false); await handleStatusAction(TaskStatus.InProgress); }}
                title="Start Task"
                message="Mark this task as In Progress? You won't be able to revert to To Do."
                confirmText="Start"
                cancelText="Cancel"
                variant="info"
            />
            <ConfirmModal
                isOpen={isSubmitConfirmOpen}
                onClose={() => setIsSubmitConfirmOpen(false)}
                onConfirm={async () => { setIsSubmitConfirmOpen(false); await handleStatusAction(TaskStatus.Submitted); }}
                title="Confirm Submit"
                message="Submit this task for review? Make sure your evidence is correct and complete."
                confirmText="Submit"
                cancelText="Cancel"
                variant="info"
            />
            {/* Reason Modal for Approve / Request Adjust */}
            {reasonModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)' }} onClick={() => setReasonModal(null)} />
                    <div style={{ position: 'relative', background: 'white', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: '2rem', width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '1.25rem', margin: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {reasonModal.mode === 'reject'
                                ? <RotateCw size={20} color="#e11d48" />
                                : <CheckCircle2 size={20} color="#16a34a" />}
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                                {reasonModal.mode === 'reject' ? 'Request Adjustment' : 'Approve Task'}
                            </h3>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6 }}>
                            {reasonModal.mode === 'reject'
                                ? 'Send this task back for adjustment. The assignee will need to revise and resubmit.'
                                : 'Mark this task as Completed. This confirms the work is done and accepted.'}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Reason{reasonModal.mode === 'reject' ? <span style={{ color: '#e11d48' }}> *</span> : <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> (optional)</span>}
                            </label>
                            <textarea
                                rows={4}
                                maxLength={2000}
                                placeholder={reasonModal.mode === 'reject' ? 'Describe what needs to be adjusted...' : 'Leave a note for the assignee (optional)...'}
                                value={reasonText}
                                onChange={e => { setReasonText(e.target.value); if (reasonError) setReasonError(''); }}
                                style={{ resize: 'vertical', padding: '0.75rem', borderRadius: '10px', border: `1.5px solid ${reasonError ? '#fca5a5' : '#e2e8f0'}`, fontSize: '0.85rem', color: '#1e293b', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6, background: reasonError ? '#fff5f5' : '#f8fafc' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {reasonError
                                    ? <span style={{ fontSize: '0.72rem', color: '#e11d48', fontWeight: 600 }}>{reasonError}</span>
                                    : <span />}
                                <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{reasonText.length}/2000</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setReasonModal(null)} style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', fontWeight: 600, fontSize: '0.82rem', border: '1px solid #e2e8f0', background: 'white', color: '#374151', cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button onClick={handleReasonSubmit} style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', fontWeight: 700, fontSize: '0.82rem', border: 'none', background: reasonModal.mode === 'reject' ? '#e11d48' : '#16a34a', color: 'white', cursor: 'pointer' }}>
                                {reasonModal.mode === 'reject' ? 'Request Adjust' : 'Approve'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskDetailPanel;
