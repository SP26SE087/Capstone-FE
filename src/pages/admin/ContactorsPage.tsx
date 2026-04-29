import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { contactorService } from '@/services/contactorService';
import { ContactorResponse } from '@/types/visitorRegistration';
import Modal from '@/components/common/Modal';
import { Plus, Pencil, Trash2, Loader2, Users, Mail, Phone } from 'lucide-react';

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

    // Create / Edit modal
    const [editTarget, setEditTarget] = useState<ContactorResponse | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [formErrors, setFormErrors] = useState<Partial<FormState>>({});
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

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

    const openCreate = () => {
        setEditTarget(null);
        setForm(emptyForm);
        setFormErrors({});
        setFormError(null);
        setShowForm(true);
    };

    const openEdit = (c: ContactorResponse) => {
        setEditTarget(c);
        setForm({ fullName: c.fullName, email: c.email, phone: c.phone });
        setFormErrors({});
        setFormError(null);
        setShowForm(true);
    };

    const validateForm = (): boolean => {
        const errs: Partial<FormState> = {};
        if (!form.fullName.trim())          errs.fullName = 'Full name is required';
        else if (form.fullName.length > 255) errs.fullName = 'Max 255 characters';
        if (!editTarget) {
            if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                errs.email = 'A valid email is required';
            else if (form.email.length > 255) errs.email = 'Max 255 characters';
        }
        if (!form.phone.trim())           errs.phone = 'Phone is required';
        else if (form.phone.length > 50)  errs.phone = 'Max 50 characters';
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
            setShowForm(false);
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
            <div className="page-container">
                {/* Header */}
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>Contactors</h1>
                        <p>Lab members who can be contacted by visitors.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Plus size={15} /> Add Contactor
                        </button>
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
                        <button className="btn btn-primary" onClick={openCreate} style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Plus size={14} /> Add Contactor
                        </button>
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
                                        style={{ borderBottom: idx < contactors.length - 1 ? '1px solid var(--border-light)' : 'none', transition: 'background 0.15s' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
                                                <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => openEdit(c)}>
                                                    <Pencil size={12} /> Edit
                                                </button>
                                                <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.78rem', background: '#dc2626', borderColor: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    onClick={() => { setDeleteError(null); setDeleteTarget(c); }}>
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

            {/* Create / Edit Modal */}
            <Modal
                isOpen={showForm}
                onClose={() => !formSubmitting && setShowForm(false)}
                title={editTarget ? 'Edit Contactor' : 'Add Contactor'}
                maxWidth="440px"
                disableBackdropClose={formSubmitting}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.75rem', borderTop: '1px solid var(--border-color)' }}>
                        <button className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={formSubmitting}>Cancel</button>
                        <button className="btn btn-primary" onClick={submitForm} disabled={formSubmitting} style={{ minWidth: '90px' }}>
                            {formSubmitting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }} />Saving...</> : (editTarget ? 'Save' : 'Add')}
                        </button>
                    </div>
                }
            >
                <div style={{ padding: '1.25rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {formError && (
                        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', color: '#e11d48', fontSize: '0.88rem' }}>{formError}</div>
                    )}
                    <div>
                        <label style={labelStyle}>Full Name <span style={{ color: '#e11d48' }}>*</span></label>
                        <input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} style={inputStyle(formErrors.fullName)} placeholder="Nguyễn Văn A" maxLength={255} />
                        {formErrors.fullName && <p style={errStyle}>{formErrors.fullName}</p>}
                    </div>
                    {!editTarget ? (
                        <div>
                            <label style={labelStyle}>Email <span style={{ color: '#e11d48' }}>*</span></label>
                            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inputStyle(formErrors.email)} placeholder="a@lab.vn" maxLength={255} />
                            {formErrors.email && <p style={errStyle}>{formErrors.email}</p>}
                        </div>
                    ) : (
                        <div>
                            <label style={labelStyle}>Email</label>
                            <input value={form.email} disabled style={{ ...inputStyle(), background: 'var(--surface-hover)', color: 'var(--text-muted)', cursor: 'not-allowed' }} />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Email cannot be changed after creation.</p>
                        </div>
                    )}
                    <div>
                        <label style={labelStyle}>Phone <span style={{ color: '#e11d48' }}>*</span></label>
                        <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={inputStyle(formErrors.phone)} placeholder="0901234567" maxLength={50} />
                        {formErrors.phone && <p style={errStyle}>{formErrors.phone}</p>}
                    </div>
                </div>
            </Modal>

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
