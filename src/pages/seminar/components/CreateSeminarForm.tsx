import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { CreateRecurringSeminarRequest, SeminarSlot } from '@/types/seminar';
import { PresenterInfo } from '@/types/meeting';
import seminarService from '@/services/seminarService';
import { userService, membershipService } from '@/services';
import { useToastStore } from '@/store/slices/toastSlice';
import {
    Save,
    Loader2,
    Calendar,
    Clock,
    Users,
    Plus,
    X,
    Presentation,
    Hash,
    Repeat,
    Search,
    Check,
    AlertCircle
} from 'lucide-react';
import { validateTextField } from '@/utils/validation';

interface CreateSeminarFormProps {
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string) => void;
    onTitleChange?: (title: string) => void;
    projectsMap: Record<string, string>;
    hideHeader?: boolean;
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1.5px solid var(--border-color)',
    fontSize: '0.85rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    background: '#fff'
};

const labelStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
};

const sectionStyle: React.CSSProperties = {
    padding: '20px',
    background: 'var(--background-color)',
    borderRadius: '12px',
    border: '1px solid var(--border-light)',
    marginBottom: '20px'
};

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Get current date string for min attribute (date only)
const getMinDate = () => new Date().toISOString().split('T')[0];

const CreateSeminarForm: React.FC<CreateSeminarFormProps> = ({
    onClose,
    onSaved,
    onTitleChange,
    projectsMap,
    hideHeader = false,
}) => {
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [seriesDateError, setSeriesDateError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{ title?: string; description?: string }>({});
    const { addToast } = useToastStore();

    // Core
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [seriesStartDate, setSeriesStartDate] = useState('');
    const [numberOfWeeks, setNumberOfWeeks] = useState(10);
    const [slots, setSlots] = useState<SeminarSlot[]>([
        { dayOfWeek: 1, startTime: '09:00', durationMinutes: 60 },
    ]);

    // Derived
    const totalMeetings = slots.length * numberOfWeeks;

    // Presenters
    const [presenters, setPresenters] = useState<PresenterInfo[]>([]);
    const [presenterError, setPresenterError] = useState('');
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    // Presenter picker tabs: 'users' | 'project' | 'manual'
    const [presenterTab, setPresenterTab] = useState<'users' | 'project' | 'manual'>('users');
    const [presenterSearch, setPresenterSearch] = useState('');
    const [presenterProjectId, setPresenterProjectId] = useState('');
    const [presenterProjectMembers, setPresenterProjectMembers] = useState<any[]>([]);
    const [presenterProjectLoading, setPresenterProjectLoading] = useState(false);
    const [presenterManualInputs, setPresenterManualInputs] = useState<string[]>(['']);

    // Modal state for presenter picker
    const [showPresenterModal, setShowPresenterModal] = useState(false);

    // Load project members when presenter project changes
    useEffect(() => {
        if (!presenterProjectId) { setPresenterProjectMembers([]); return; }
        setPresenterProjectLoading(true);
        membershipService.getProjectMembers(presenterProjectId)
            .then(d => setPresenterProjectMembers(Array.isArray(d) ? d : []))
            .catch(() => setPresenterProjectMembers([]))
            .finally(() => setPresenterProjectLoading(false));
    }, [presenterProjectId]);

    // Load all users for presenter picker
    useEffect(() => {
        const loadUsers = async () => {
            setUsersLoading(true);
            try {
                const data = await userService.getAll();
                setAllUsers(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error('Failed to load users:', e);
            } finally {
                setUsersLoading(false);
            }
        };
        loadUsers();
    }, []);

    const filteredPresenterUsers = useMemo(() => {
        if (!presenterSearch.trim()) return allUsers;
        const q = presenterSearch.toLowerCase();
        return allUsers.filter(u =>
            (u.fullName || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        );
    }, [allUsers, presenterSearch]);

    const isPresenterSelected = (email: string) =>
        presenters.some(p => p.email?.toLowerCase() === email.toLowerCase());

    const togglePresenter = (email: string, name: string) => {
        if (isPresenterSelected(email)) {
            setPresenters(presenters.filter(p => p.email?.toLowerCase() !== email.toLowerCase()));
            setPresenterError('');
        } else {
            if (presenters.length >= totalMeetings) {
                setPresenterError(`Maximum ${totalMeetings} presenter${totalMeetings !== 1 ? 's' : ''} allowed (one per meeting).`);
                return;
            }
            setPresenters([...presenters, { email, name, topic: null }]);
            setPresenterError('');
        }
    };

    const _updatePresenterTopic = (email: string, topic: string) => {
        setPresenters(prev => prev.map(p =>
            p.email?.toLowerCase() === email.toLowerCase()
                ? { ...p, topic: topic || null }
                : p
        ));
    };

    const removePresenter = (email: string) => {
        setPresenters(presenters.filter(p => p.email?.toLowerCase() !== email.toLowerCase()));
        setPresenterError('');
    };

    // Trim presenters if totalMeetings is reduced below current count
    useEffect(() => {
        if (presenters.length > totalMeetings) {
            setPresenters(prev => prev.slice(0, totalMeetings));
            setPresenterError(`Presenter list trimmed to ${totalMeetings} (one per meeting).`);
        } else if (presenters.length <= totalMeetings) {
            setPresenterError('');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalMeetings]);

    const handleSeriesStartDateChange = (value: string) => {
        setSeriesStartDate(value);
        if (!value) { setSeriesDateError(''); return; }
        const selected = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setSeriesDateError(selected < today ? 'Series start date cannot be in the past' : '');
    };

    const handleAddSlot = () => {
        setSlots(prev => [...prev, { dayOfWeek: 1, startTime: '09:00', durationMinutes: 60 }]);
    };

    const handleRemoveSlot = (idx: number) => {
        if (slots.length <= 1) return;
        setSlots(prev => prev.filter((_, i) => i !== idx));
    };

    const handleUpdateSlot = (idx: number, field: keyof SeminarSlot, value: string | number) => {
        setSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
    };

    const handleSave = async () => {
        if (!title.trim() || !seriesStartDate || slots.length === 0) return;

        const titleErr = validateTextField(title, 'Title', { required: true });
        const descErr = validateTextField(description, 'Description');
        if (titleErr || descErr) {
            setFieldErrors({ title: titleErr, description: descErr });
            return;
        }
        setFieldErrors({});

        if (seriesDateError) return;

        setSaving(true);
        try {
            const req: CreateRecurringSeminarRequest = {
                title: title.trim(),
                description: description.trim() || null,
                seriesStartDate,
                numberOfWeeks,
                slots,
                presenters: presenters.length > 0 ? presenters : null,
            };
            await seminarService.createRecurringSeminar(req);
            addToast('Recurring seminar created successfully.', 'success');
            setSaved(true);
            setTitle('');
            setDescription('');
            setSeriesStartDate('');
            setSeriesDateError('');
            setNumberOfWeeks(10);
            setSlots([{ dayOfWeek: 1, startTime: '09:00', durationMinutes: 60 }]);
            setPresenters([]);
            setPresenterSearch('');
            setPresenterProjectId('');
            setPresenterProjectMembers([]);
            setPresenterManualInputs(['']);
            setShowPresenterModal(false);
            onSaved(false);
        } catch (err: any) {
            console.error('Create recurring seminar failed:', err);
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to create recurring seminar.';
            addToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header — hidden when used inside timetable sidebar (banner handles it) */}
            {!hideHeader && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Plus size={16} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Create Recurring Seminar
                </h3>
            </div>
            )}

            {/* Scrollable Form */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                {/* Basic Info */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><Hash size={12} /> Basic Information</div>

                    <div style={{ marginBottom: '18px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Title *</label>
                        <input
                            style={{ ...inputStyle, ...(fieldErrors.title ? { borderColor: '#ef4444' } : {}) }}
                            value={title}
                            onChange={e => {
                                setTitle(e.target.value);
                                setFieldErrors(prev => ({ ...prev, title: validateTextField(e.target.value, 'Title', { required: true }) }));
                                onTitleChange?.(e.target.value || 'New Seminar');
                            }}
                            placeholder="Seminar series title..."
                            onFocus={e => { e.currentTarget.style.borderColor = fieldErrors.title ? '#ef4444' : 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = fieldErrors.title ? '#ef4444' : 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                        {fieldErrors.title && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{fieldErrors.title}</span>}
                    </div>

                    <div style={{ marginBottom: '18px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Description</label>
                        <textarea
                            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' as const, ...(fieldErrors.description ? { borderColor: '#ef4444' } : {}) }}
                            value={description}
                            onChange={e => { setDescription(e.target.value); setFieldErrors(prev => ({ ...prev, description: validateTextField(e.target.value, 'Description') })); }}
                            placeholder="Seminar description..."
                            onFocus={e => { e.currentTarget.style.borderColor = fieldErrors.description ? '#ef4444' : 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = fieldErrors.description ? '#ef4444' : 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                        {fieldErrors.description && <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '4px', display: 'block' }}>{fieldErrors.description}</span>}
                    </div>
                </div>

                {/* Schedule Config */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><Repeat size={12} /> Recurring Schedule</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                        {/* Series Start Date */}
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}>
                                <Calendar size={12} /> Series Start Date *
                            </label>
                            <input
                                type="date"
                                style={{ ...inputStyle, ...(seriesDateError ? { borderColor: '#ef4444' } : {}) }}
                                value={seriesStartDate}
                                min={getMinDate()}
                                onChange={e => handleSeriesStartDateChange(e.target.value)}
                                onFocus={e => { e.currentTarget.style.borderColor = seriesDateError ? '#ef4444' : 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = seriesDateError ? '#ef4444' : 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                            />
                            {seriesDateError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontSize: '0.72rem', fontWeight: 600, marginTop: '6px' }}>
                                    <AlertCircle size={12} /> {seriesDateError}
                                </div>
                            )}
                        </div>

                        {/* Number of weeks */}
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}><Hash size={12} /> Number of Weeks</label>
                            <input
                                type="number"
                                style={inputStyle}
                                value={numberOfWeeks}
                                onChange={e => setNumberOfWeeks(Math.max(1, Number(e.target.value)))}
                                min={1}
                                max={52}
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
                                {totalMeetings} meeting{totalMeetings !== 1 ? 's' : ''} total &nbsp;
                                <span style={{ opacity: 0.7 }}>({slots.length} slot{slots.length !== 1 ? 's' : ''} × {numberOfWeeks} week{numberOfWeeks !== 1 ? 's' : ''})</span>
                            </div>
                        </div>
                    </div>

                    {/* Weekly Slots */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <label style={{ ...labelStyle, fontSize: '0.68rem', marginBottom: 0 }}><Clock size={12} /> Weekly Time Slots</label>
                            <button
                                type="button"
                                onClick={handleAddSlot}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '7px', border: '1px solid #c7d2fe', background: '#ede9fe', color: '#4338ca', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}
                            >
                                <Plus size={11} /> Add Slot
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {slots.map((slot, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 28px', gap: '8px', alignItems: 'end', padding: '10px 12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid var(--border-light)' }}>
                                    <div>
                                        <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '3px' }}>Day of Week</label>
                                        <select
                                            style={{ ...inputStyle, padding: '7px 10px', fontSize: '0.8rem' }}
                                            value={slot.dayOfWeek}
                                            onChange={e => handleUpdateSlot(idx, 'dayOfWeek', Number(e.target.value))}
                                        >
                                            {dayNames.map((name, d) => (
                                                <option key={d} value={d}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '3px' }}>Start Time</label>
                                        <input
                                            type="time"
                                            style={{ ...inputStyle, padding: '7px 10px', fontSize: '0.8rem' }}
                                            value={slot.startTime}
                                            onChange={e => handleUpdateSlot(idx, 'startTime', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ ...labelStyle, fontSize: '0.62rem', marginBottom: '3px' }}>Duration (min)</label>
                                        <input
                                            type="number"
                                            style={{ ...inputStyle, padding: '7px 10px', fontSize: '0.8rem' }}
                                            value={slot.durationMinutes}
                                            onChange={e => handleUpdateSlot(idx, 'durationMinutes', Math.max(15, Number(e.target.value)))}
                                            min={15}
                                            max={480}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSlot(idx)}
                                        disabled={slots.length === 1}
                                        title={slots.length === 1 ? 'At least one slot required' : 'Remove slot'}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #fecaca', background: '#fff1f2', color: slots.length === 1 ? '#fca5a5' : '#ef4444', cursor: slots.length === 1 ? 'not-allowed' : 'pointer', padding: 0, flexShrink: 0 }}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Participants — Presenters */}
                <div style={sectionStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={labelStyle}><Users size={12} /> Presenters</div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                            {presenters.length}/{totalMeetings} assigned
                        </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '7px 10px', marginBottom: '14px' }}>
                        Presenters rotate globally across all <strong>{totalMeetings}</strong> meeting{totalMeetings !== 1 ? 's' : ''} ({slots.length} slot{slots.length !== 1 ? 's' : ''} × {numberOfWeeks} week{numberOfWeeks !== 1 ? 's' : ''}).
                    </div>

                    {/* ── Presenters row ── */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Presentation size={11} />
                                </div>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#4338ca', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Rotation Order</span>
                                {presenters.length > 0 && (
                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: presenters.length >= totalMeetings ? '#ef4444' : '#6366f1', background: presenters.length >= totalMeetings ? '#fee2e2' : '#ede9fe', padding: '1px 7px', borderRadius: '10px' }}>
                                        {presenters.length}/{totalMeetings}
                                    </span>
                                )}
                            </div>
                            <button onClick={() => setShowPresenterModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '7px', border: '1px solid #c7d2fe', background: '#ede9fe', color: '#4338ca', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>
                                <Plus size={11} /> Add/Edit
                            </button>
                        </div>
                        {presenters.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {presenters.map((p, idx) => (
                                    <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: '#ede9fe', border: '1px solid #c7d2fe', fontSize: '0.68rem', fontWeight: 600, color: '#4338ca' }}>
                                        {p.name || p.email}
                                        <button onClick={() => removePresenter(p.email!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a5b4fc', padding: 0, display: 'flex', lineHeight: 1 }}>
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{
                paddingTop: '14px',
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: 'auto'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        padding: '8px 20px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: '#fff',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 700
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving || saved || !title.trim() || !seriesStartDate || !!seriesDateError || slots.length === 0}
                    style={{
                        padding: '8px 24px',
                        borderRadius: '10px',
                        border: 'none',
                        background: (saved || !title.trim() || !seriesStartDate || saving || !!seriesDateError || slots.length === 0) ? '#94a3b8' : 'var(--accent-color)',
                        color: '#fff',
                        cursor: (saved || !title.trim() || !seriesStartDate || saving || !!seriesDateError || slots.length === 0) ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: (saved || !title.trim() || !seriesStartDate || saving || !!seriesDateError || slots.length === 0) ? 'none' : '0 4px 12px rgba(232,114,12,0.25)'
                    }}
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saved ? 'Created' : 'Create Seminar Series'}
                </button>
            </div>
        </div>

            {/* ── Presenter picker modal ── */}
            {showPresenterModal && ReactDOM.createPortal(
                <div
                    onClick={() => setShowPresenterModal(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ background: '#fff', borderRadius: '16px', padding: '20px', width: '420px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Presentation size={14} />
                                </div>
                                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#4338ca' }}>Add Presenters</span>
                                {presenters.length > 0 && (
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: presenters.length >= totalMeetings ? '#ef4444' : '#6366f1', background: presenters.length >= totalMeetings ? '#fee2e2' : '#ede9fe', padding: '2px 8px', borderRadius: '10px' }}>
                                        {presenters.length}/{totalMeetings}
                                    </span>
                                )}
                            </div>
                            <button onClick={() => setShowPresenterModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex' }}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Limit error */}
                        {presenterError && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '0.72rem', fontWeight: 600, marginBottom: '10px', padding: '6px 10px', background: '#fee2e2', borderRadius: '7px', border: '1px solid #fecaca' }}>
                                <AlertCircle size={12} /> {presenterError}
                            </div>
                        )}

                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                            {(['users', 'project', 'manual'] as const).map(tab => {
                                const labels = { users: 'Users', project: 'Project', manual: 'Manual' };
                                const active = presenterTab === tab;
                                return (
                                    <button key={tab} onClick={() => setPresenterTab(tab)} style={{ padding: '5px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, border: active ? '1.5px solid #6366f1' : '1px solid #e0e7ff', background: active ? '#ede9fe' : '#fff', color: active ? '#4338ca' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                                        {labels[tab]}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Tab: Users */}
                        {presenterTab === 'users' && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div style={{ position: 'relative', marginBottom: '8px' }}>
                                    <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                    <input
                                        style={{ width: '100%', padding: '7px 9px 7px 28px', borderRadius: '7px', border: '1.5px solid #e0e7ff', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                                        placeholder="Search by name or email…"
                                        value={presenterSearch}
                                        onChange={e => setPresenterSearch(e.target.value)}
                                    />
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }} className="custom-scrollbar">
                                    {usersLoading ? (
                                        <div style={{ textAlign: 'center', padding: '1rem' }}><Loader2 size={18} className="animate-spin" style={{ color: '#6366f1' }} /></div>
                                    ) : filteredPresenterUsers.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>No users found</div>
                                    ) : filteredPresenterUsers.map(u => {
                                        const email = u.email || ''; const name = u.fullName || '';
                                        const selected = isPresenterSelected(email);
                                        const atLimit = !selected && presenters.length >= totalMeetings;
                                        return (
                                            <div key={u.userId || email} onClick={() => !atLimit && togglePresenter(email, name)}
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 9px', borderRadius: '7px', cursor: atLimit ? 'not-allowed' : 'pointer', opacity: atLimit ? 0.45 : 1, background: selected ? '#ede9fe' : '#fff', border: selected ? '1px solid #c7d2fe' : '1px solid transparent', transition: 'all 0.12s' }}
                                                onMouseEnter={e => { if (!selected && !atLimit) e.currentTarget.style.background = '#f5f3ff'; }}
                                                onMouseLeave={e => { if (!selected && !atLimit) e.currentTarget.style.background = selected ? '#ede9fe' : '#fff'; }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: selected ? '#6366f1' : 'var(--primary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 700 }}>
                                                        {name[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.77rem', fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{email}</div>
                                                    </div>
                                                </div>
                                                {selected ? <Check size={14} color="#6366f1" /> : <Plus size={13} color="var(--text-muted)" style={{ opacity: 0.4 }} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Tab: Project */}
                        {presenterTab === 'project' && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <select
                                    style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1.5px solid #e0e7ff', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', marginBottom: '8px' }}
                                    value={presenterProjectId}
                                    onChange={e => setPresenterProjectId(e.target.value)}
                                >
                                    <option value="">Choose a project…</option>
                                    {Object.entries(projectsMap).map(([id, name]) => (
                                        <option key={id} value={id}>{name}</option>
                                    ))}
                                </select>
                                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }} className="custom-scrollbar">
                                    {presenterProjectLoading ? (
                                        <div style={{ textAlign: 'center', padding: '1rem' }}><Loader2 size={18} className="animate-spin" style={{ color: '#6366f1' }} /></div>
                                    ) : !presenterProjectId ? (
                                        <div style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Select a project above</div>
                                    ) : presenterProjectMembers.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>No members in this project</div>
                                    ) : presenterProjectMembers
                                        .map(m => {
                                            const email = m.email || m.userEmail || ''; const name = m.fullName || m.userName || ''; const role = m.projectRoleName || '';
                                            const selected = isPresenterSelected(email);
                                            const atLimit = !selected && presenters.length >= totalMeetings;
                                            return (
                                                <div key={m.memberId || m.userId || email} onClick={() => email && !atLimit && togglePresenter(email, name)}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 9px', borderRadius: '7px', cursor: (email && !atLimit) ? 'pointer' : 'not-allowed', opacity: (email && !atLimit) ? 1 : 0.45, background: selected ? '#ede9fe' : '#fff', border: selected ? '1px solid #c7d2fe' : '1px solid transparent' }}
                                                    onMouseEnter={e => { if (!selected && email && !atLimit) e.currentTarget.style.background = '#f5f3ff'; }}
                                                    onMouseLeave={e => { if (!selected && email && !atLimit) e.currentTarget.style.background = selected ? '#ede9fe' : '#fff'; }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: selected ? '#6366f1' : 'var(--primary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 700 }}>
                                                            {name[0]?.toUpperCase() || '?'}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.77rem', fontWeight: 700, color: 'var(--text-primary)' }}>{name || 'Unknown'}</div>
                                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{email || 'No email'}{role ? ` · ${role}` : ''}</div>
                                                        </div>
                                                    </div>
                                                    {selected ? <Check size={14} color="#6366f1" /> : <Plus size={13} color="var(--text-muted)" style={{ opacity: 0.4 }} />}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {/* Tab: Manual */}
                        {presenterTab === 'manual' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }} className="custom-scrollbar">
                                {presenterManualInputs.map((val, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <input
                                            style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', border: '1.5px solid #e0e7ff', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', opacity: presenters.length >= totalMeetings ? 0.5 : 1 }}
                                            value={val}
                                            onChange={e => { if (presenters.length < totalMeetings) { const u = [...presenterManualInputs]; u[idx] = e.target.value; setPresenterManualInputs(u); } }}
                                            placeholder={presenters.length >= totalMeetings ? 'Limit reached' : 'Enter email address…'}
                                            readOnly={presenters.length >= totalMeetings}
                                            onKeyDown={e => {
                                                if (e.key !== 'Enter') return;
                                                const trimmed = val.trim();
                                                if (!trimmed || isPresenterSelected(trimmed) || presenters.length >= totalMeetings) return;
                                                togglePresenter(trimmed, trimmed);
                                                const u = [...presenterManualInputs]; u[idx] = ''; setPresenterManualInputs(u);
                                            }}
                                        />
                                        <button
                                            disabled={!val.trim() || presenters.length >= totalMeetings}
                                            onClick={() => {
                                                const trimmed = val.trim();
                                                if (!trimmed || isPresenterSelected(trimmed) || presenters.length >= totalMeetings) return;
                                                togglePresenter(trimmed, trimmed);
                                                const u = [...presenterManualInputs]; u[idx] = ''; setPresenterManualInputs(u);
                                            }}
                                            style={{ padding: '7px 11px', borderRadius: '7px', border: 'none', background: (val.trim() && presenters.length < totalMeetings) ? '#6366f1' : '#94a3b8', color: '#fff', cursor: (val.trim() && presenters.length < totalMeetings) ? 'pointer' : 'not-allowed', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}
                                        >
                                            Add
                                        </button>
                                        {presenterManualInputs.length > 1 && (
                                            <button onClick={() => setPresenterManualInputs(presenterManualInputs.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', display: 'flex', flexShrink: 0 }}>
                                                <X size={13} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={() => setPresenterManualInputs([...presenterManualInputs, ''])} style={{ alignSelf: 'flex-start', padding: '5px 10px', borderRadius: '7px', border: '1px dashed #c7d2fe', background: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Plus size={12} /> Add another
                                </button>
                            </div>
                        )}

                        {/* Done button */}
                        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-light)', marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowPresenterModal(false)} style={{ padding: '7px 20px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                                Done
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default CreateSeminarForm;
