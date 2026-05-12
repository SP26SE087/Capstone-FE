import React, { useEffect, useState } from 'react';
import { Loader2, Search, Send, X, UserCheck } from 'lucide-react';
import { userService, InLabUser } from '@/services/userService';
import { cameraMainService } from '@/services/cameraService';
import Modal from '@/components/common/Modal';

interface Props {
    isOpen: boolean;
    imageUrl: string;
    onClose: () => void;
    onForwarded: (memberName: string) => void;
}

const ForwardToMemberModal: React.FC<Props> = ({ isOpen, imageUrl, onClose, onForwarded }) => {
    const [members, setMembers] = useState<InLabUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<InLabUser | null>(null);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setSelected(null);
        setNote('');
        setError(null);
        setSearch('');
        setLoading(true);
        userService.getInLabUsers(12)
            .then(setMembers)
            .catch(() => setMembers([]))
            .finally(() => setLoading(false));
    }, [isOpen]);

    const filtered = members.filter(m => {
        const q = search.toLowerCase();
        return (
            m.fullName.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q) ||
            (m.studentId ?? '').toLowerCase().includes(q)
        );
    });

    const handleForward = async () => {
        if (!selected) return;
        setSubmitting(true);
        setError(null);
        try {
            await cameraMainService.forwardToMember({
                memberId: selected.userId,
                imageUrl,
                message: note.trim() || undefined,
            });
            onForwarded(selected.fullName);
            onClose();
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to forward. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Forward to a Lab Member">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 360 }}>
                {/* Image preview */}
                {imageUrl && (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <img
                            src={imageUrl}
                            alt="Detected person"
                            style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border-color)' }}
                        />
                    </div>
                )}

                {/* Search */}
                <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search by name, email or student ID…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%', paddingLeft: 32, paddingRight: 10, height: 36, borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                </div>

                {/* Member list */}
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    {loading ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Loader2 size={18} className="animate-spin" style={{ display: 'inline' }} /> Loading…
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.83rem' }}>
                            {members.length === 0 ? 'No members currently in the lab.' : 'No results match your search.'}
                        </div>
                    ) : filtered.map(m => {
                        const isSelected = selected?.userId === m.userId;
                        return (
                            <div
                                key={m.userId}
                                onClick={() => setSelected(m)}
                                style={{
                                    padding: '10px 14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    cursor: 'pointer',
                                    background: isSelected ? 'var(--accent-bg, rgba(99,102,241,0.08))' : 'transparent',
                                    borderBottom: '1px solid var(--border-color)',
                                    transition: 'background 0.15s',
                                }}
                            >
                                <div style={{
                                    width: 32, height: 32, borderRadius: '50%',
                                    background: isSelected ? 'var(--accent-color)' : '#e2e8f0',
                                    color: isSelected ? 'white' : '#64748b',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
                                }}>
                                    {isSelected ? <UserCheck size={15} /> : m.fullName[0]?.toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{m.fullName}</p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {m.studentId ? `${m.studentId} · ` : ''}{m.email}
                                    </p>
                                </div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    In since {new Date(m.checkedInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Note field */}
                <textarea
                    placeholder="Optional note to the member… (e.g. Please verify this person)"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    maxLength={300}
                    style={{ resize: 'vertical', borderRadius: 8, border: '1px solid var(--border-color)', padding: '8px 10px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />

                {error && (
                    <p style={{ margin: 0, color: '#ef4444', fontSize: '0.82rem' }}>{error}</p>
                )}

                {/* Footer actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={onClose} disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <X size={14} /> Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleForward}
                        disabled={!selected || submitting}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        {submitting ? 'Forwarding…' : `Forward${selected ? ` to ${selected.fullName.split(' ').pop()}` : ''}`}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ForwardToMemberModal;
