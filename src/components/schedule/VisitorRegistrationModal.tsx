import React, { useState, useRef } from 'react';
import Modal from '@/components/common/Modal';
import { visitorRegistrationService } from '@/services/visitorRegistrationService';
import { Upload, X, CheckCircle2, Loader2, ScanLine } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface FormState {
    FullName: string;
    Email: string;
    ContactEmail: string;
    AppointmentDateTime: string;
}

const ACCEPTED = 'image/jpeg,image/jpg,image/png,image/webp';
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const emptyForm: FormState = {
    FullName: '',
    Email: '',
    ContactEmail: '',
    AppointmentDateTime: '',
};

const VisitorRegistrationModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const [form, setForm] = useState<FormState>(emptyForm);
    const [photo, setPhoto] = useState<File | null>(null);
    const [cccdImage, setCccdImage] = useState<File | null>(null);
    const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'photo' | 'cccdImage' | 'general', string>>>({});
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [cccdPreview, setCccdPreview] = useState<string | null>(null);
    const [cccdExtracting, setCccdExtracting] = useState(false);
    const [cccdExtractError, setCccdExtractError] = useState<string | null>(null);

    const photoRef = useRef<HTMLInputElement>(null);
    const cccdRef = useRef<HTMLInputElement>(null);

    const toTitleCase = (str: string) =>
        str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    const handleExtractCccd = async () => {
        if (!cccdImage) return;
        setCccdExtracting(true);
        setCccdExtractError(null);
        try {
            const result = await visitorRegistrationService.extractCccd(cccdImage);
            setForm(prev => ({ ...prev, FullName: toTitleCase(result.fullName) }));
            setErrors(prev => ({ ...prev, FullName: undefined }));
            if (result.faceImageBase64) {
                const res = await fetch(result.faceImageBase64);
                const blob = await res.blob();
                const file = new File([blob], 'cccd-portrait.jpg', { type: blob.type || 'image/jpeg' });
                setPhoto(file);
                setPhotoPreview(prev => { if (prev) URL.revokeObjectURL(prev); return result.faceImageBase64!; });
                setErrors(prev => ({ ...prev, photo: undefined }));
            }
        } catch (err: any) {
            const code = err?.response?.data?.messageCode
                || err?.response?.data?.MessageCode
                || err?.response?.data?.errorCode;
            if (err?.response?.status === 422 || code === 'US063') {
                setCccdExtractError('Could not read the card. Please use a clear, well-lit photo of the front side.');
            } else {
                setCccdExtractError('Failed to connect to OCR service. Please try again.');
            }
        } finally {
            setCccdExtracting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (errors[name as keyof typeof errors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const validateFile = (file: File, fieldName: 'photo' | 'cccdImage'): string | undefined => {
        if (file.size > MAX_SIZE) return 'File exceeds 10 MB limit';
        if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
            return 'Invalid format (only jpg/jpeg/png/webp)';
        }
        return undefined;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'photo' | 'cccdImage') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const err = validateFile(file, field);
        if (err) {
            setErrors(prev => ({ ...prev, [field]: err }));
            return;
        }
        setErrors(prev => ({ ...prev, [field]: undefined }));
        const url = URL.createObjectURL(file);
        if (field === 'photo') {
            setPhoto(file);
            setPhotoPreview(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
        } else {
            setCccdImage(file);
            setCccdPreview(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
            setCccdExtractError(null);
        }
    };

    const validate = (): boolean => {
        const newErrors: typeof errors = {};
        if (!form.FullName.trim()) newErrors.FullName = 'Full name is required';
        if (!form.Email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.Email)) newErrors.Email = 'Invalid email address';
        if (!form.ContactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ContactEmail)) newErrors.ContactEmail = 'Invalid contact email address';
        if (!form.AppointmentDateTime) {
            newErrors.AppointmentDateTime = 'Please select an appointment date & time';
        } else if (new Date(form.AppointmentDateTime) <= new Date()) {
            newErrors.AppointmentDateTime = 'Appointment must be in the future';
        }
        if (!photo) newErrors.photo = 'Please upload your photo';
        if (!cccdImage) newErrors.cccdImage = 'Please upload your ID card photo';
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
            fd.append('contactorEmail', form.ContactEmail.trim());
            fd.append('appointmentDateTime', new Date(form.AppointmentDateTime).toISOString());
            fd.append('photo', photo!);
            fd.append('cccdImage', cccdImage!);
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
        setCccdImage(null);
        if (photoPreview) { URL.revokeObjectURL(photoPreview); setPhotoPreview(null); }
        if (cccdPreview) { URL.revokeObjectURL(cccdPreview); setCccdPreview(null); }
        setErrors({});
        setCccdExtractError(null);
        setSuccess(false);
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
            maxHeight="680px"
            disableBackdropClose={true}
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.75rem', borderTop: '1px solid var(--border-color)' }}>
                    <button className="btn btn-secondary" onClick={handleClose} disabled={submitting}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{ minWidth: '110px' }}>
                        {submitting ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }} />Submitting...</> : 'Submit'}
                    </button>
                </div>
            }
        >
            <div style={{ padding: '1.25rem 1.75rem' }}>
                {errors.general && (
                    <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', color: '#e11d48', fontSize: '0.88rem', marginBottom: '1rem' }}>
                        {errors.general}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    {/* Left column — text fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

                        {/* Contact Email */}
                        <div>
                            <label style={labelStyle}>Lab Member's Email <span style={{ color: '#e11d48' }}>*</span></label>
                            <input name="ContactEmail" type="email" value={form.ContactEmail} onChange={handleChange} style={inputStyle(errors.ContactEmail)} placeholder="labmember@aitlab.com" maxLength={255} />
                            {errors.ContactEmail && <p style={errorStyle}>{errors.ContactEmail}</p>}
                        </div>

                        {/* Appointment */}
                        <div>
                            <label style={labelStyle}>Appointment Date & Time <span style={{ color: '#e11d48' }}>*</span></label>
                            <input name="AppointmentDateTime" type="datetime-local" value={form.AppointmentDateTime} onChange={handleChange} style={inputStyle(errors.AppointmentDateTime)} min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} />
                            {errors.AppointmentDateTime && <p style={errorStyle}>{errors.AppointmentDateTime}</p>}
                        </div>

                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                            Your information will be sent to the Lab member for review. You will receive an email notification with the result.
                        </p>
                    </div>

                    {/* Right column — photo uploads */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                                    background: photo ? '#f0fdf4' : 'var(--surface-hover)',
                                    transition: 'border-color 0.2s',
                                    height: '150px',
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
                                        <img src={photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
                            <input ref={photoRef} type="file" accept={ACCEPTED} style={{ display: 'none' }} onChange={e => handleFileChange(e, 'photo')} />
                            {errors.photo && <p style={errorStyle}>{errors.photo}</p>}
                        </div>

                        {/* ID Card */}
                        <div>
                            <label style={labelStyle}>ID Card Photo <span style={{ color: '#e11d48' }}>*</span></label>
                            <div
                                onClick={() => cccdRef.current?.click()}
                                style={{
                                    border: `1.5px dashed ${errors.cccdImage ? '#e11d48' : 'var(--border-color)'}`,
                                    borderRadius: 'var(--radius-sm)',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: cccdImage ? '#f0fdf4' : 'var(--surface-hover)',
                                    transition: 'border-color 0.2s',
                                    height: '150px',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                {cccdImage && cccdPreview ? (
                                    <div style={{ position: 'absolute', inset: 0 }}>
                                        <img src={cccdPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); setCccdImage(null); setCccdPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null; }); setCccdExtractError(null); if (cccdRef.current) cccdRef.current.value = ''; }}
                                            style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', cursor: 'pointer', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                        >
                                            <X size={13} color="#fff" />
                                        </button>
                                        <span style={{ position: 'absolute', bottom: '4px', left: '4px', right: '4px', fontSize: '0.68rem', color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: '3px', padding: '1px 4px', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{cccdImage.name}</span>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={20} color="var(--text-muted)" />
                                        <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>jpg/png/webp, max 10 MB</p>
                                    </>
                                )}
                            </div>
                            <input ref={cccdRef} type="file" accept={ACCEPTED} style={{ display: 'none' }} onChange={e => handleFileChange(e, 'cccdImage')} />
                            {errors.cccdImage && <p style={errorStyle}>{errors.cccdImage}</p>}
                            {cccdImage && (
                                <button
                                    type="button"
                                    onClick={handleExtractCccd}
                                    disabled={cccdExtracting}
                                    style={{
                                        marginTop: '0.5rem',
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        padding: '0.45rem 0.75rem',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--accent-color)',
                                        background: cccdExtracting ? 'var(--surface-hover)' : 'transparent',
                                        color: 'var(--accent-color)',
                                        fontSize: '0.82rem',
                                        fontWeight: 600,
                                        cursor: cccdExtracting ? 'not-allowed' : 'pointer',
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    {cccdExtracting
                                        ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Reading ID Card...</>
                                        : <><ScanLine size={13} /> Load from ID Card</>}
                                </button>
                            )}
                            {cccdExtractError && (
                                <p style={{ ...errorStyle, marginTop: '0.35rem', lineHeight: 1.4 }}>{cccdExtractError}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default VisitorRegistrationModal;
