import React, { useState, useRef, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import { visitorRegistrationService } from '@/services/visitorRegistrationService';
import { contactorService } from '@/services/contactorService';
import { ContactorResponse } from '@/types/visitorRegistration';
import { Upload, X, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface FormState {
    FullName: string;
    Email: string;
    PhoneNumber: string;
    ContactorEmail: string;
    AppointmentDateTime: string;
    Notes: string;
    CccdNumber: string;
}

const ACCEPTED = 'image/jpeg,image/jpg,image/png,image/webp';
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const emptyForm: FormState = {
    FullName: '',
    Email: '',
    PhoneNumber: '',
    ContactorEmail: '',
    AppointmentDateTime: '',
    Notes: '',
    CccdNumber: '',
};

const PHONE_REGEX = /^(\+[1-9]\d{6,14}|0\d{9})$/;
const PHONE_ERROR = 'Phone number must be in international format (+84...) or Vietnamese local format (0xxxxxxxxx).';
const CCCD_REGEX = /^\d{9,12}$/;

const VisitorRegistrationModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const [form, setForm] = useState<FormState>(emptyForm);
    const [photo, setPhoto] = useState<File | null>(null);
    const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'photo' | 'general', string>>>({});
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState('');
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [contactors, setContactors] = useState<ContactorResponse[]>([]);
    const [contactorLoading, setContactorLoading] = useState(false);
    const [contactorOpen, setContactorOpen] = useState(false);
    const [contactorSearch, setContactorSearch] = useState('');
    const [selectedContactor, setSelectedContactor] = useState<ContactorResponse | null>(null);

    const photoRef = useRef<HTMLInputElement>(null);
    const contactorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        setContactorLoading(true);
        contactorService.getAll()
            .then(data => setContactors(data))
            .catch(() => {})
            .finally(() => setContactorLoading(false));
    }, [isOpen]);

    useEffect(() => {
        if (!contactorOpen) return;
        const handleOutside = (e: MouseEvent) => {
            if (contactorRef.current && !contactorRef.current.contains(e.target as Node)) {
                setContactorOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [contactorOpen]);

    const handleSelectContactor = (c: ContactorResponse) => {
        setSelectedContactor(c);
        setForm(prev => ({ ...prev, ContactorEmail: c.id }));
        setErrors(prev => ({ ...prev, ContactorEmail: undefined }));
        setContactorOpen(false);
        setContactorSearch('');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (errors[name as keyof typeof errors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_SIZE) {
            setErrors(prev => ({ ...prev, photo: 'File exceeds 10 MB limit' }));
            return;
        }
        if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
            setErrors(prev => ({ ...prev, photo: 'Invalid format (only jpg/jpeg/png/webp)' }));
            return;
        }
        setErrors(prev => ({ ...prev, photo: undefined }));
        const url = URL.createObjectURL(file);
        setPhoto(file);
        setPhotoPreview(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    };

    const validate = (): boolean => {
        const newErrors: typeof errors = {};
        if (!form.FullName.trim()) newErrors.FullName = 'Full name is required';
        if (!form.Email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.Email)) newErrors.Email = 'Invalid email address';
        if (!form.PhoneNumber.trim()) newErrors.PhoneNumber = 'Phone number is required';
        else if (!PHONE_REGEX.test(form.PhoneNumber.trim())) newErrors.PhoneNumber = PHONE_ERROR;
        if (!form.ContactorEmail) newErrors.ContactorEmail = 'Please select a contactor';
        if (!form.AppointmentDateTime) {
            newErrors.AppointmentDateTime = 'Please select an appointment date & time';
        } else if (new Date(form.AppointmentDateTime) <= new Date()) {
            newErrors.AppointmentDateTime = 'Appointment must be in the future';
        }
        if (form.Notes.length > 1000) newErrors.Notes = 'Notes must not exceed 1000 characters';
        if (!photo) newErrors.photo = 'Please upload your photo';
        if (!form.CccdNumber.trim()) newErrors.CccdNumber = 'ID number is required';
        else if (!CCCD_REGEX.test(form.CccdNumber.trim())) newErrors.CccdNumber = 'ID number must be 9–12 digits';
        if (!turnstileToken) newErrors.general = 'Please complete the human verification challenge.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('fullName', form.FullName.trim());
            fd.append('email', form.Email.trim());
            fd.append('phoneNumber', form.PhoneNumber.trim());
            fd.append('contactorEmail', form.ContactorEmail);
            fd.append('appointmentDateTime', new Date(form.AppointmentDateTime).toISOString());
            if (form.Notes.trim()) fd.append('notes', form.Notes.trim());
            fd.append('cccdNumber', form.CccdNumber.trim());
            fd.append('TurnstileToken', turnstileToken);
            const safeName = form.FullName.trim().replace(/\s+/g, '_');
            const safeDate = new Date(form.AppointmentDateTime).toISOString().slice(0, 16).replace(/:/g, '-');
            const photoExt = photo!.name.split('.').pop() || 'jpg';
            fd.append('photo', photo!, `${safeName}_${safeDate}.${photoExt}`);
            await visitorRegistrationService.create(fd);
            setSuccess(true);
        } catch (err: any) {
            const msgCode = err?.response?.data?.messageCode || err?.response?.data?.MessageCode;
            const msgMap: Record<string, string> = {
                US020: 'File is missing or invalid',
                US021: 'File exceeds 10 MB limit',
                US022: 'Unsupported file format',
                US030: 'Appointment must be in the future',
            };
            setErrors({ general: msgMap[msgCode] || 'An error occurred. Please try again.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setForm(emptyForm);
        setPhoto(null);
        if (photoPreview) { URL.revokeObjectURL(photoPreview); setPhotoPreview(null); }
        setErrors({});
        setContactorOpen(false);
        setContactorSearch('');
        setSelectedContactor(null);
        setSuccess(false);
        setTurnstileToken('');
        onClose();
    };

    const inputStyle = (hasError?: string): React.CSSProperties => ({
        width: '100%',
        padding: '0.6rem 0.85rem',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${hasError ? '#e11d48' : 'var(--border-color)'}`,
        fontSize: '0.9rem',
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        color: 'var(--text-primary)',
        background: 'white',
    });

    const labelStyle: React.CSSProperties = {
        fontSize: '0.83rem',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        display: 'block',
        marginBottom: '0.35rem',
    };

    const errorStyle: React.CSSProperties = {
        fontSize: '0.76rem',
        color: '#e11d48',
        marginTop: '0.25rem',
    };

    if (success) {
        return (
            <Modal isOpen={isOpen} onClose={handleClose} title="Registration Submitted" variant="success" maxWidth="480px">
                <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
                    <CheckCircle2 size={56} color="#16a34a" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ margin: '0 0 0.5rem', color: '#16a34a', fontSize: '1.1rem' }}>Your request has been sent!</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                        Your visit registration was submitted successfully. You will receive an email notification once it has been reviewed.
                    </p>
                    <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={handleClose}>
                        Close
                    </button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Book a Meeting"
            maxWidth="720px"
            maxHeight="640px"
            disableBackdropClose={true}
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.75rem', borderTop: '1px solid var(--border-color)' }}>
                    <button className="btn btn-secondary" onClick={handleClose} disabled={submitting}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !turnstileToken} style={{ minWidth: '110px' }}>
                        {submitting ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }} />Submitting...</> : 'Submit'}
                    </button>
                </div>
            }
        >
            <div style={{ padding: '0.85rem 1.75rem' }}>
                {errors.general && (
                    <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', color: '#e11d48', fontSize: '0.88rem', marginBottom: '1rem' }}>
                        {errors.general}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    {/* Left column — text fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {/* Full Name */}
                        <div>
                            <label style={labelStyle}>Full Name <span style={{ color: '#e11d48' }}>*</span></label>
                            <input name="FullName" value={form.FullName} onChange={handleChange} style={inputStyle(errors.FullName)} placeholder="John Doe" maxLength={255} />
                            {errors.FullName && <p style={errorStyle}>{errors.FullName}</p>}
                        </div>

                        {/* Email */}
                        <div>
                            <label style={labelStyle}>Your Email <span style={{ color: '#e11d48' }}>*</span></label>
                            <input name="Email" type="email" value={form.Email} onChange={handleChange} style={inputStyle(errors.Email)} placeholder="visitor@example.com" maxLength={255} />
                            {errors.Email && <p style={errorStyle}>{errors.Email}</p>}
                        </div>

                        {/* Phone Number */}
                        <div>
                            <label style={labelStyle}>Phone Number <span style={{ color: '#e11d48' }}>*</span></label>
                            <input name="PhoneNumber" type="tel" value={form.PhoneNumber} onChange={handleChange} style={inputStyle(errors.PhoneNumber)} placeholder="0912345678 or +84912345678" maxLength={16} />
                            {errors.PhoneNumber && <p style={errorStyle}>{errors.PhoneNumber}</p>}
                        </div>

                        {/* Contactor picker */}
                        <div ref={contactorRef} style={{ position: 'relative' }}>
                            <label style={labelStyle}>Contactor <span style={{ color: '#e11d48' }}>*</span></label>
                            <button
                                type="button"
                                onClick={() => !contactorLoading && setContactorOpen(prev => !prev)}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.85rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: `1px solid ${errors.ContactorEmail ? '#e11d48' : 'var(--border-color)'}`,
                                    fontSize: '0.9rem',
                                    background: 'white',
                                    cursor: contactorLoading ? 'default' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem',
                                    textAlign: 'left',
                                    boxSizing: 'border-box',
                                    fontFamily: 'inherit',
                                    color: selectedContactor ? 'var(--text-primary)' : 'var(--text-muted)',
                                }}
                            >
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                                    {contactorLoading
                                        ? 'Loading contactors...'
                                        : selectedContactor
                                            ? (selectedContactor.labPosition
                                                ? `${selectedContactor.fullName} — ${selectedContactor.labPosition}`
                                                : selectedContactor.fullName)
                                            : 'Select a contactor'}
                                </span>
                                {contactorLoading
                                    ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                                    : <ChevronDown size={14} style={{ flexShrink: 0, transform: contactorOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />}
                            </button>
                            {contactorOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    zIndex: 100,
                                    background: 'white',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    marginTop: '4px',
                                }}>
                                    <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, background: 'white' }}>
                                        <input
                                            type="text"
                                            placeholder="Search by name or position..."
                                            value={contactorSearch}
                                            onChange={e => setContactorSearch(e.target.value)}
                                            style={{ ...inputStyle(), fontSize: '0.83rem', padding: '0.4rem 0.65rem' }}
                                            autoFocus
                                        />
                                    </div>
                                    {(() => {
                                        const filtered = contactors.filter(c => {
                                            const q = contactorSearch.toLowerCase();
                                            return c.fullName.toLowerCase().includes(q) ||
                                                (c.labPosition || '').toLowerCase().includes(q);
                                        });
                                        return filtered.length === 0 ? (
                                            <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                                                No contactors found
                                            </div>
                                        ) : filtered.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => handleSelectContactor(c)}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    width: '100%',
                                                    padding: '0.6rem 0.85rem',
                                                    border: 'none',
                                                    borderBottom: '1px solid var(--border-color)',
                                                    background: selectedContactor?.id === c.id ? 'var(--surface-hover)' : 'white',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    gap: '2px',
                                                    boxSizing: 'border-box',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = selectedContactor?.id === c.id ? 'var(--surface-hover)' : 'white')}
                                            >
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{c.fullName}</span>
                                                {c.labPosition && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.labPosition}</span>}
                                            </button>
                                        ));
                                    })()}
                                </div>
                            )}
                            {errors.ContactorEmail && <p style={errorStyle}>{errors.ContactorEmail}</p>}
                        </div>

                        {/* Appointment */}
                        <div>
                            <label style={labelStyle}>Appointment Date & Time <span style={{ color: '#e11d48' }}>*</span></label>
                            <input name="AppointmentDateTime" type="datetime-local" value={form.AppointmentDateTime} onChange={handleChange} style={inputStyle(errors.AppointmentDateTime)} min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} />
                            {errors.AppointmentDateTime && <p style={errorStyle}>{errors.AppointmentDateTime}</p>}
                        </div>

                        {/* Notes */}
                        <div>
                            <label style={labelStyle}>Notes <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                            <textarea
                                name="Notes"
                                value={form.Notes}
                                onChange={e => { setForm(prev => ({ ...prev, Notes: e.target.value })); if (errors.Notes) setErrors(prev => ({ ...prev, Notes: undefined })); }}
                                placeholder="Any additional information..."
                                maxLength={1000}
                                rows={3}
                                style={{ ...inputStyle(errors.Notes), resize: 'none', height: 'auto' }}
                            />
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0', textAlign: 'right' }}>{form.Notes.length}/1000</p>
                            {errors.Notes && <p style={errorStyle}>{errors.Notes}</p>}
                        </div>

                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                            Your information will be sent to the Lab member for review. You will receive an email notification with the result.
                        </p>
                    </div>

                    {/* Right column — photo & ID number */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {/* Photo */}
                        <div>
                            <label style={labelStyle}>Your Photo <span style={{ color: '#e11d48' }}>*</span></label>
                            <div
                                onClick={() => photoRef.current?.click()}
                                style={{
                                    border: `1.5px dashed ${errors.photo ? '#e11d48' : 'var(--border-color)'}`,
                                    borderRadius: 'var(--radius-sm)',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: photo ? '#f8fafc' : 'var(--surface-hover)',
                                    transition: 'border-color 0.2s',
                                    height: '160px',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                {photo && photoPreview ? (
                                    <div style={{ position: 'absolute', inset: 0 }}>
                                        <img src={photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f8fafc', display: 'block' }} />
                                        <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); setPhoto(null); setPhotoPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null; }); if (photoRef.current) photoRef.current.value = ''; }}
                                            style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', cursor: 'pointer', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                        >
                                            <X size={13} color="#fff" />
                                        </button>
                                        <span style={{ position: 'absolute', bottom: '4px', left: '4px', right: '4px', fontSize: '0.68rem', color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: '3px', padding: '1px 4px', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{photo.name}</span>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={20} color="var(--text-muted)" />
                                        <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>jpg/png/webp, max 10 MB</p>
                                    </>
                                )}
                            </div>
                            <input ref={photoRef} type="file" accept={ACCEPTED} style={{ display: 'none' }} onChange={handlePhotoChange} />
                            {errors.photo && <p style={errorStyle}>{errors.photo}</p>}
                        </div>

                        {/* CCCD Number */}
                        <div>
                            <label style={labelStyle}>ID Card Number <span style={{ color: '#e11d48' }}>*</span></label>
                            <input
                                name="CccdNumber"
                                value={form.CccdNumber}
                                onChange={handleChange}
                                style={inputStyle(errors.CccdNumber)}
                                placeholder="Enter your 9–12 digit ID number"
                                maxLength={12}
                                inputMode="numeric"
                                pattern="\d*"
                            />
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                                Enter the number on your Citizen ID / CCCD card (9–12 digits).
                            </p>
                            {errors.CccdNumber && <p style={errorStyle}>{errors.CccdNumber}</p>}
                        </div>

                        {/* Human verification */}
                        <div>
                            <Turnstile
                                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                                onSuccess={setTurnstileToken}
                                onExpire={() => setTurnstileToken('')}
                                onError={() => setTurnstileToken('')}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default VisitorRegistrationModal;
