import React, { useEffect, useState, useCallback, useRef } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { contactorService } from '@/services/contactorService';
import { userService } from '@/services/userService';
import { ContactorResponse } from '@/types/visitorRegistration';
import Modal from '@/components/common/Modal';
import { Plus, Trash2, Loader2, Users, Mail, Phone, ChevronDown, Search, X } from 'lucide-react';

interface FormState {
    fullName: string;
    email: string;
    phone: string;
}

const emptyForm: FormState = { fullName: '', email: '', phone: '' };

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' });

const ContactorsPage: React.FC = () => {
    const { user } = useAuth();
    const [contactors, setContactors] = useState<ContactorResponse[]>([]);
    const [loading, setLoading] = useState(true);

    // Create / Edit panel
    const [editTarget, setEditTarget] = useState<ContactorResponse | null>(null);
    const [formMode, setFormMode] = useState<'external' | 'member'>('external');
    const [form, setForm] = useState<FormState>(emptyForm);
    const [formErrors, setFormErrors] = useState<Partial<FormState>>({});
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Lab member picker
    const [labMembers, setLabMembers] = useState<any[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [memberOpen, setMemberOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<any | null>(null);
    const memberPickerRef = useRef<HTMLDivElement>(null);

    // Delete modal
    const [deleteTarget, setDeleteTarget] = useState<ContactorResponse | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const fetchContactors = useCallback(async () => {
        setLoading(true);
        try {
            const data = await contactorService.getAll();
            setContactors(data);
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchContactors(); }, [fetchContactors]);

    // Pre-fetch lab members on mount
    useEffect(() => {
        setMembersLoading(true);
        userService.getAll()
            .then(all => setLabMembers(Array.isArray(all) ? all : []))
            .catch(() => setLabMembers([]))
            .finally(() => setMembersLoading(false));
    }, []);

    // Close member picker on outside click
    useEffect(() => {
        if (!memberOpen) return;
        const handler = (e: MouseEvent) => {
            if (memberPickerRef.current && !memberPickerRef.current.contains(e.target as Node))
                setMemberOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [memberOpen]);

    const openCreate = () => {
        setEditTarget(null);
        setForm(emptyForm);
        setFormErrors({});
        setFormError(null);
        setFormMode('external');
        setSelectedMember(null);
        setMemberSearch('');
    };

    const openEdit = (c: ContactorResponse) => {
        setEditTarget(c);
        setForm({ fullName: c.fullName, email: c.email, phone: c.phone });
        setFormErrors({});
        setFormError(null);
    };

    const switchMode = (mode: 'external' | 'member') => {
        setFormMode(mode);
        setForm(emptyForm);
        setFormErrors({});
        setFormError(null);
        setSelectedMember(null);
        setMemberSearch('');
    };

    const selectMember = (m: any) => {
        setSelectedMember(m);
        setForm(prev => ({ ...prev, fullName: m.fullName || '', email: m.email || '' }));
        setMemberOpen(false);
        setMemberSearch('');
    };

    const validateForm = (): boolean => {
        const errs: Partial<FormState> = {};
        if (formMode === 'member' && !editTarget) {
            if (!selectedMember) { setFormError('Please select a lab member.'); return false; }
            if (!form.phone.trim()) errs.phone = 'Phone is required';
            else if (form.phone.length > 50) errs.phone = 'Max 50 characters';
        } else {
            if (!form.fullName.trim())           errs.fullName = 'Full name is required';
            else if (form.fullName.length > 255)  errs.fullName = 'Max 255 characters';
            if (!editTarget) {
                if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                    errs.email = 'A valid email is required';
                else if (form.email.length > 255) errs.email = 'Max 255 characters';
            }
            if (!form.phone.trim())           errs.phone = 'Phone is required';
            else if (form.phone.length > 50)  errs.phone = 'Max 50 characters';
        }
        setFormErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const submitForm = async () => {
        if (!validateForm()) return;
        setFormSubmitting(true);
        setFormError(null);
        try {
            if (editTarget) {
                const updated = await contactorService.update(editTarget.id, {
                    fullName: form.fullName.trim(),
                    phone: form.phone.trim(),
                });
                setContactors(prev => prev.map(c => c.id === updated.id ? updated : c));
            } else {
                const created = await contactorService.create({
                    fullName: form.fullName.trim(),
                    email: form.email.trim(),
                    phone: form.phone.trim(),
                });
                setContactors(prev => [created, ...prev]);
            }
            // reset to create mode after success
            openCreate();
        } catch (err: any) {
            const code = err?.response?.data?.messageCode
                || err?.response?.data?.MessageCode
                || err?.response?.data?.errorCode;
            if (code === 'US040') setFormError('This email already exists in the contactor list.');
            else setFormError('An error occurred. Please try again.');
        } finally {
            setFormSubmitting(false);
        }
    };

    const submitDelete = async () => {
        if (!deleteTarget) return;
        setDeleteSubmitting(true);
        setDeleteError(null);
        try {
            await contactorService.deleteById(deleteTarget.id);
            setContactors(prev => prev.filter(c => c.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch {
            setDeleteError('Failed to delete contactor. Please try again.');
        } finally {
            setDeleteSubmitting(false);
        }
    };

    const inputStyle = (hasErr?: string): React.CSSProperties => ({
        width: '100%', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)',
        border: `1px solid ${hasErr ? '#e11d48' : 'var(--border-color)'}`,
        fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
        fontFamily: 'inherit', color: 'var(--text-primary)', background: 'white',
    });

    const labelStyle: React.CSSProperties = {
        fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-secondary)',
        display: 'block', marginBottom: '0.35rem',
    };

    const errStyle: React.CSSProperties = {
        fontSize: '0.76rem', color: '#e11d48', marginTop: '0.25rem',
    };

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Header */}
                    <div className="page-header" style={{ marginBottom: '2rem' }}>
                        <div>
                            <h1>Contactors</h1>
                            <p>Lab members who can be contacted by visitors.</p>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} color="var(--accent-color)" />
                        </div>
                    ) : contactors.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon"><Users size={36} /></div>
                            <h2>No contactors yet</h2>
                            <p>Add lab members so visitors can request to meet them.</p>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border-color)' }}>
                                        {['Full Name', 'Email', 'Phone', 'Added', ''].map(h => (
                                            <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {contactors.map((c, idx) => (
                                        <tr key={c.id}
                                            onClick={() => openEdit(c)}
                                            style={{ borderBottom: idx < contactors.length - 1 ? '1px solid var(--border-light)' : 'none', transition: 'background 0.15s', cursor: 'pointer', background: editTarget?.id === c.id ? 'var(--accent-light, #eff6ff)' : undefined }}
                                            onMouseEnter={e => { if (editTarget?.id !== c.id) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = editTarget?.id === c.id ? 'var(--accent-light, #eff6ff)' : 'transparent'; }}
                                        >
                                            <td style={{ padding: '0.85rem 1rem', fontWeight: 600, fontSize: '0.9rem' }}>{c.fullName}</td>
                                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <Mail size={12} color="var(--text-muted)" /> {c.email}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <Phone size={12} color="var(--text-muted)" /> {c.phone}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', fontSize: '0.83rem', color: 'var(--text-muted)' }}>{formatDate(c.createdAt)}</td>
                                            <td style={{ padding: '0.85rem 1rem' }}>
                                                <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                                                    <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.78rem', background: '#dc2626', borderColor: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        onClick={e => { e.stopPropagation(); setDeleteError(null); setDeleteTarget(c); }}>
                                                        <Trash2 size={12} /> Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Side panel – always visible, offset to align with table */}
                <div style={{
                        width: '340px', flexShrink: 0, marginTop: '5rem',
                        background: 'white', border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                        display: 'flex', flexDirection: 'column',
                    }}>
                        {/* Panel header */}
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                {editTarget ? 'Edit Contactor' : 'Add Contactor'}
                            </span>
                            {editTarget && (
                                <button onClick={openCreate} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }} title="Back to Add">
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Panel body */}
                        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                            {formError && (
                                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.9rem', color: '#e11d48', fontSize: '0.85rem' }}>{formError}</div>
                            )}

                            {/* Mode toggle – only when creating */}
                            {!editTarget && (
                                <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', overflow: 'hidden', fontSize: '0.83rem' }}>
                                    {(['external', 'member'] as const).map(m => (
                                        <button key={m} onClick={() => switchMode(m)} style={{
                                            flex: 1, padding: '0.45rem 0', border: 'none', cursor: 'pointer', fontWeight: 600,
                                            background: formMode === m ? 'var(--accent-color)' : 'white',
                                            color: formMode === m ? 'white' : 'var(--text-secondary)',
                                            transition: 'background 0.15s, color 0.15s',
                                        }}>
                                            {m === 'external' ? 'External' : 'Lab Member'}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Lab member picker */}
                            {!editTarget && formMode === 'member' && (
                                <div>
                                    <label style={labelStyle}>Select Member <span style={{ color: '#e11d48' }}>*</span></label>
                                    <div ref={memberPickerRef} style={{ position: 'relative' }}>
                                        <button type="button" onClick={() => setMemberOpen(o => !o)} style={{
                                            width: '100%', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--border-color)', background: 'white', textAlign: 'left',
                                            fontSize: '0.88rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            color: selectedMember ? 'var(--text-primary)' : 'var(--text-muted)',
                                            boxSizing: 'border-box',
                                        }}>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                {selectedMember ? `${selectedMember.fullName} (${selectedMember.email})` : 'Search and select...'}
                                            </span>
                                            {membersLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} /> : <ChevronDown size={13} style={{ flexShrink: 0 }} />}
                                        </button>
                                        {memberOpen && (
                                            <div style={{
                                                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                                                background: 'white', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                                                boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: '200px', overflow: 'hidden',
                                                display: 'flex', flexDirection: 'column',
                                            }}>
                                                <div style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <Search size={12} color="var(--text-muted)" />
                                                    <input autoFocus value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                                                        placeholder="Search name or email..." style={{ border: 'none', outline: 'none', fontSize: '0.84rem', flex: 1, color: 'var(--text-primary)' }} />
                                                </div>
                                                <div style={{ overflowY: 'auto', flex: 1 }}>
                                                    {labMembers
                                                        .filter(m => !contactors.some(c => c.email === m.email))
                                                        .filter(m => {
                                                            const q = memberSearch.toLowerCase();
                                                            return !q || (m.fullName || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
                                                        })
                                                        .map(m => (
                                                            <div key={m.userId || m.email} onClick={() => selectMember(m)} style={{
                                                                padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem',
                                                                borderBottom: '1px solid var(--border-light)',
                                                            }}
                                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                            >
                                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.fullName}</div>
                                                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{m.email}</div>
                                                            </div>
                                                        ))}
                                                    {labMembers.filter(m => !contactors.some(c => c.email === m.email)).length === 0 && (
                                                        <div style={{ padding: '0.85rem', color: 'var(--text-muted)', fontSize: '0.84rem', textAlign: 'center' }}>No members available</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Full Name */}
                            {(editTarget || formMode === 'external') && (
                                <div>
                                    <label style={labelStyle}>Full Name <span style={{ color: '#e11d48' }}>*</span></label>
                                    <input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} style={inputStyle(formErrors.fullName)} placeholder="Nguyễn Văn A" maxLength={255} />
                                    {formErrors.fullName && <p style={errStyle}>{formErrors.fullName}</p>}
                                </div>
                            )}

                            {/* Email */}
                            {!editTarget && formMode === 'external' ? (
                                <div>
                                    <label style={labelStyle}>Email <span style={{ color: '#e11d48' }}>*</span></label>
                                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inputStyle(formErrors.email)} placeholder="a@lab.vn" maxLength={255} />
                                    {formErrors.email && <p style={errStyle}>{formErrors.email}</p>}
                                </div>
                            ) : editTarget ? (
                                <div>
                                    <label style={labelStyle}>Email</label>
                                    <input value={form.email} disabled style={{ ...inputStyle(), background: 'var(--surface-hover)', color: 'var(--text-muted)', cursor: 'not-allowed' }} />
                                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Email cannot be changed after creation.</p>
                                </div>
                            ) : null}

                            {/* Phone */}
                            <div>
                                <label style={labelStyle}>Phone <span style={{ color: '#e11d48' }}>*</span></label>
                                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={inputStyle(formErrors.phone)} placeholder="0901234567" maxLength={50} />
                                {formErrors.phone && <p style={errStyle}>{formErrors.phone}</p>}
                            </div>
                        </div>

                        {/* Panel footer */}
                        <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                            {editTarget && (
                                <button className="btn btn-secondary" onClick={openCreate} disabled={formSubmitting}>Cancel</button>
                            )}
                            <button className="btn btn-primary" onClick={submitForm} disabled={formSubmitting} style={{ minWidth: '80px' }}>
                                {formSubmitting ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite', marginRight: '5px' }} />Saving...</> : (editTarget ? 'Save' : 'Add')}
                            </button>
                        </div>
                    </div>
            </div>

            {/* Delete Confirm Modal */}
            <Modal
                isOpen={!!deleteTarget}
                onClose={() => !deleteSubmitting && setDeleteTarget(null)}
                title="Delete Contactor"
                variant="danger"
                maxWidth="400px"
                disableBackdropClose={deleteSubmitting}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.75rem', borderTop: '1px solid var(--border-color)' }}>
                        <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleteSubmitting}>Cancel</button>
                        <button className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626', minWidth: '90px' }} onClick={submitDelete} disabled={deleteSubmitting}>
                            {deleteSubmitting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }} />Deleting...</> : 'Delete'}
                        </button>
                    </div>
                }
            >
                {deleteTarget && (
                    <div style={{ padding: '1.25rem 1.75rem' }}>
                        {deleteError && (
                            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', color: '#e11d48', fontSize: '0.88rem', marginBottom: '1rem' }}>{deleteError}</div>
                        )}
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Are you sure you want to delete <strong>{deleteTarget.fullName}</strong> ({deleteTarget.email})? This action cannot be undone.
                        </p>
                    </div>
                )}
            </Modal>
        </MainLayout>
    );
};

export default ContactorsPage;
