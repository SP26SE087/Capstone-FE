import React, { useState, useEffect, useMemo } from 'react';
import { CreateRecurringSeminarRequest, DateOfWeek } from '@/types/seminar';
import { PresenterInfo } from '@/types/meeting';
import seminarService from '@/services/seminarService';
import { userService, membershipService } from '@/services';
import { useToastStore } from '@/store/slices/toastSlice';
import DateTimePicker from '@/components/common/DateTimePicker';
import {
    Save,
    Loader2,
    Calendar,
    Clock,
    MapPin,
    Users,
    FileText,
    Plus,
    X,
    Presentation,
    Hash,
    Repeat,
    Search,
    Check,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Briefcase,
    Mail
} from 'lucide-react';
import AttendeeSelector, { SelectedAttendee } from '@/components/common/AttendeeSelector';

interface CreateSeminarFormProps {
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string) => void;
    onTitleChange?: (title: string) => void;
    projectsMap: Record<string, string>;
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

// Get current datetime string for min attribute
const getMinDatetime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
};

const CreateSeminarForm: React.FC<CreateSeminarFormProps> = ({
    onClose,
    onSaved,
    onTitleChange,
    projectsMap
}) => {
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [dateError, setDateError] = useState('');
    const { addToast } = useToastStore();

    // Core
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [firstSessionStartTime, setFirstSessionStartTime] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [numberOfWeeks, setNumberOfWeeks] = useState(10);
    const [dayOfWeek, setDayOfWeek] = useState<DateOfWeek>(DateOfWeek.Monday);
    const [projectId, setProjectId] = useState('');
    const [location, setLocation] = useState('');
    const [selectedAttendees, setSelectedAttendees] = useState<SelectedAttendee[]>([]);

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

    // Collapse state for participant sub-panels (default closed)
    const [presenterOpen, setPresenterOpen] = useState(false);
    const [attendeeOpen, setAttendeeOpen] = useState(false);

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
        const attendeeEmails = new Set(selectedAttendees.map(a => a.email.toLowerCase()));
        const base = allUsers.filter(u => !attendeeEmails.has((u.email || '').toLowerCase()));
        if (!presenterSearch.trim()) return base;
        const q = presenterSearch.toLowerCase();
        return base.filter(u =>
            (u.fullName || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        );
    }, [allUsers, presenterSearch, selectedAttendees]);

    const isPresenterSelected = (email: string) =>
        presenters.some(p => p.email?.toLowerCase() === email.toLowerCase());

    const togglePresenter = (email: string, name: string) => {
        if (isPresenterSelected(email)) {
            setPresenters(presenters.filter(p => p.email?.toLowerCase() !== email.toLowerCase()));
            setPresenterError('');
        } else {
            if (presenters.length >= numberOfWeeks) {
                setPresenterError(`Maximum ${numberOfWeeks} presenter${numberOfWeeks !== 1 ? 's' : ''} allowed (one per session).`);
                return;
            }
            setPresenters([...presenters, { email, name, topic: null }]);
            setPresenterError('');
        }
    };

    const updatePresenterTopic = (email: string, topic: string) => {
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

    // Trim presenters if numberOfWeeks is reduced below current count
    useEffect(() => {
        if (presenters.length > numberOfWeeks) {
            setPresenters(prev => prev.slice(0, numberOfWeeks));
            setPresenterError(`Presenter list trimmed to ${numberOfWeeks} (one per session).`);
        } else if (presenters.length <= numberOfWeeks) {
            setPresenterError('');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [numberOfWeeks]);

    // Validate date is not in the past
    const validateDate = (dateStr: string) => {
        if (!dateStr) {
            setDateError('');
            return true;
        }
        const selected = new Date(dateStr);
        const now = new Date();
        if (selected < now) {
            setDateError('Cannot select a date in the past');
            return false;
        }
        setDateError('');
        return true;
    };

    const handleDateChange = (value: string) => {
        setFirstSessionStartTime(value);
        validateDate(value);
        if (value) setDayOfWeek(new Date(value).getDay() as DateOfWeek);
    };

    const handleSave = async () => {
        if (!title.trim() || !firstSessionStartTime) return;

        // Validate date before saving
        if (!validateDate(firstSessionStartTime)) return;

        setSaving(true);
        try {
            const req: CreateRecurringSeminarRequest = {
                title: title.trim(),
                description: description.trim() || null,
                firstSessionStartTime: new Date(firstSessionStartTime).toISOString(),
                durationMinutes,
                numberOfWeeks,
                dayOfWeek,
                projectId: projectId || null,
                presenters: presenters.length > 0 ? presenters : null,
                additionalAttendeeEmails: selectedAttendees.length > 0
                    ? selectedAttendees.map(a => a.email)
                    : null,
                location: location.trim() || null
            };
            await seminarService.createRecurringSeminar(req);
            // Show success toast, clear form, lock button
            addToast('Recurring seminar created successfully.', 'success');
            setSaved(true);
            setTitle('');
            setDescription('');
            setFirstSessionStartTime('');
            setDurationMinutes(60);
            setNumberOfWeeks(10);
            setDayOfWeek(DateOfWeek.Monday);
            setProjectId('');
            setLocation('');
            setPresenters([]);
            setSelectedAttendees([]);
            setPresenterSearch('');
            setPresenterProjectId('');
            setPresenterProjectMembers([]);
            setPresenterManualInputs(['']);
            setPresenterOpen(false);
            setAttendeeOpen(false);
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
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

            {/* Scrollable Form */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                {/* Basic Info */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={12} /> Basic Information</div>

                    <div style={{ marginBottom: '18px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Title *</label>
                        <input
                            style={inputStyle}
                            value={title}
                            onChange={e => {
                                setTitle(e.target.value);
                                onTitleChange?.(e.target.value || 'New Seminar');
                            }}
                            placeholder="Seminar series title..."
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div style={{ marginBottom: '18px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Description</label>
                        <textarea
                            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' as const }}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Seminar description..."
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}><MapPin size={12} /> Location</label>
                            <input
                                style={inputStyle}
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                placeholder="Room, building..."
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            />
                        </div>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}><FileText size={12} /> Project</label>
                            <select style={inputStyle} value={projectId} onChange={e => setProjectId(e.target.value)}>
                                <option value="">No Project</option>
                                {Object.entries(projectsMap).map(([id, name]) => (
                                    <option key={id} value={id}>{name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Schedule Config */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><Repeat size={12} /> Recurring Schedule</div>

                    {/* First session */}
                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>
                            <Calendar size={12} /> First Session Date &amp; Time *
                        </label>
                        <DateTimePicker
                            value={firstSessionStartTime}
                            onChange={v => handleDateChange(v)}
                            min={getMinDatetime()}
                        />
                        {dateError && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontSize: '0.72rem', fontWeight: 600, marginTop: '6px' }}>
                                <AlertCircle size={12} /> {dateError}
                            </div>
                        )}
                    </div>

                    {/* Repeats-on pill — auto derived */}
                    {firstSessionStartTime && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 12px', borderRadius: '8px', marginBottom: '14px',
                            background: '#f5f3ff', border: '1px solid #e9d5ff'
                        }}>
                            <Repeat size={13} color="#7c3aed" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#5b21b6' }}>
                                Repeats every&nbsp;
                                <strong>{dayNames[new Date(firstSessionStartTime).getDay()]}</strong>
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#7c3aed', marginLeft: 'auto' }}>auto-detected</span>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        {/* Duration */}
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}><Clock size={12} /> Each Session Duration</label>
                            <input
                                type="number"
                                style={inputStyle}
                                value={durationMinutes}
                                onChange={e => setDurationMinutes(Number(e.target.value))}
                                min={15}
                                max={480}
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
                                {durationMinutes >= 60
                                    ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60 > 0 ? `${durationMinutes % 60}m` : ''}`.trim()
                                    : `${durationMinutes} minutes`}
                            </div>
                        </div>

                        {/* Number of weeks */}
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}><Hash size={12} /> Total Sessions</label>
                            <input
                                type="number"
                                style={inputStyle}
                                value={numberOfWeeks}
                                onChange={e => setNumberOfWeeks(Number(e.target.value))}
                                min={1}
                                max={52}
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                            />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
                                {firstSessionStartTime && numberOfWeeks > 0 ? (() => {
                                    const end = new Date(firstSessionStartTime);
                                    end.setDate(end.getDate() + (numberOfWeeks - 1) * 7);
                                    return `Ends ${end.getDate().toString().padStart(2, '0')}/${(end.getMonth() + 1).toString().padStart(2, '0')}/${end.getFullYear()}`;
                                })() : `${numberOfWeeks} week${numberOfWeeks !== 1 ? 's' : ''}`}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Participants — Presenters + Attendees (mutually exclusive) */}
                <div style={sectionStyle}>
                    {/* Section Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={labelStyle}><Users size={12} /> Participants</div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                            {presenters.length + selectedAttendees.length} assigned
                        </span>
                    </div>

                    {/* Role rule banner */}
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                        padding: '8px 12px', borderRadius: '8px', marginBottom: '16px',
                        background: '#f0fdf4', border: '1px solid #bbf7d0',
                        fontSize: '0.72rem', fontWeight: 600, color: '#065f46', lineHeight: 1.5
                    }}>
                        <span>Each person can only hold <strong>one role</strong>: either a <strong>Presenter</strong> or an <strong>Attendee</strong>. Selecting someone in one role automatically hides them in the other.</span>
                    </div>

                    {/* ── Presenters ── */}
                    <div style={{
                        borderRadius: '10px', border: '1.5px solid #c7d2fe',
                        background: '#fafafe', padding: '14px', marginBottom: '12px'
                    }}>
                        {/* Collapsible header */}
                        <button
                            onClick={() => setPresenterOpen(o => !o)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                                padding: 0, marginBottom: presenterOpen ? '10px' : 0
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{
                                    width: '22px', height: '22px', borderRadius: '6px',
                                    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                                    color: '#fff', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Presentation size={12} />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4338ca', textTransform: 'uppercase' as const, letterSpacing: '0.6px' }}>
                                    Presenters
                                </span>
                                {presenters.length > 0 && (
                                    <span style={{
                                        fontSize: '0.65rem', fontWeight: 700,
                                        color: presenters.length >= numberOfWeeks ? '#ef4444' : '#6366f1',
                                        background: presenters.length >= numberOfWeeks ? '#fee2e2' : '#ede9fe',
                                        padding: '2px 8px', borderRadius: '10px'
                                    }}>
                                        {presenters.length} / {numberOfWeeks} max
                                    </span>
                                )}
                            </div>
                            {presenterOpen
                                ? <ChevronUp size={14} color="#6366f1" />
                                : <ChevronDown size={14} color="#6366f1" />
                            }
                        </button>

                        {presenterOpen && (<>

                            {/* Presenter limit error */}
                            {presenterError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '0.72rem', fontWeight: 600, marginBottom: '8px', padding: '6px 10px', background: '#fee2e2', borderRadius: '7px', border: '1px solid #fecaca' }}>
                                    <AlertCircle size={12} /> {presenterError}
                                </div>
                            )}

                            {/* Selected presenter chips */}
                            {presenters.length > 0 && (
                                <div style={{
                                    display: 'flex', flexDirection: 'column', gap: '6px',
                                    marginBottom: '10px'
                                }}>
                                    {presenters.map((p, idx) => (
                                        <div key={idx} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '8px 10px', borderRadius: '8px',
                                            background: '#fff', border: '1px solid #c7d2fe'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    width: '28px', height: '28px', borderRadius: '50%',
                                                    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                                                    color: '#fff', display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700,
                                                    flexShrink: 0
                                                }}>
                                                    {(p.name || p.email || 'P')[0].toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {p.name || p.email}
                                                    </div>
                                                    {p.name && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{p.email}</div>}
                                                </div>
                                                <input
                                                    style={{
                                                        ...inputStyle,
                                                        width: '130px', flexShrink: 0,
                                                        padding: '5px 9px', fontSize: '0.75rem',
                                                        border: '1px solid #e0e7ff'
                                                    }}
                                                    placeholder="Topic (optional)"
                                                    value={p.topic || ''}
                                                    onChange={e => updatePresenterTopic(p.email!, e.target.value)}
                                                    onClick={e => e.stopPropagation()}
                                                />
                                            </div>
                                            <button
                                                onClick={() => removePresenter(p.email!)}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    color: '#ef4444', padding: '4px', marginLeft: '6px', flexShrink: 0
                                                }}
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Presenter picker — tabbed (mirrors AttendeeSelector) */}
                            <div style={{
                                background: '#fff', borderRadius: '10px',
                                border: '1px solid #e0e7ff', padding: '12px'
                            }}>
                                {/* Tabs */}
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                    {(['users', 'project', 'manual'] as const).map(tab => {
                                        const labels = { users: 'From Users', project: 'From Project', manual: 'Manual' };
                                        const icons = { users: <Users size={13} />, project: <Briefcase size={13} />, manual: <Mail size={13} /> };
                                        const active = presenterTab === tab;
                                        return (
                                            <button key={tab} onClick={() => setPresenterTab(tab)} style={{
                                                padding: '6px 11px', borderRadius: '7px', cursor: 'pointer',
                                                fontSize: '0.72rem', fontWeight: 700,
                                                display: 'flex', alignItems: 'center', gap: '5px',
                                                border: active ? '1.5px solid #6366f1' : '1px solid #e0e7ff',
                                                background: active ? '#ede9fe' : '#fff',
                                                color: active ? '#4338ca' : 'var(--text-secondary)',
                                                transition: 'all 0.15s'
                                            }}>
                                                {icons[tab]} {labels[tab]}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Exclusion hint */}
                                {selectedAttendees.length > 0 && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '5px 9px', borderRadius: '7px', marginBottom: '8px',
                                        background: '#fffbeb', border: '1px solid #fde68a',
                                        fontSize: '0.68rem', fontWeight: 600, color: '#92400e'
                                    }}>
                                        <span>⚠</span>
                                        {selectedAttendees.length} {selectedAttendees.length === 1 ? 'person is' : 'people are'} hidden — already an attendee
                                    </div>
                                )}

                                {/* Tab: From Users */}
                                {presenterTab === 'users' && (
                                    <div>
                                        <div style={{ position: 'relative', marginBottom: '6px' }}>
                                            <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                            <input
                                                style={{ width: '100%', padding: '7px 9px 7px 28px', borderRadius: '7px', border: '1.5px solid #e0e7ff', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none' }}
                                                placeholder="Search by name or email…"
                                                value={presenterSearch}
                                                onChange={e => setPresenterSearch(e.target.value)}
                                                onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; }}
                                                onBlur={e => { e.currentTarget.style.borderColor = '#e0e7ff'; }}
                                            />
                                        </div>
                                        <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }} className="custom-scrollbar">
                                            {usersLoading ? (
                                                <div style={{ textAlign: 'center', padding: '1rem' }}><Loader2 size={18} className="animate-spin" style={{ color: '#6366f1' }} /></div>
                                            ) : filteredPresenterUsers.length === 0 ? (
                                                <div style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>No users found</div>
                                            ) : filteredPresenterUsers.map(u => {
                                                const email = u.email || ''; const name = u.fullName || '';
                                                const selected = isPresenterSelected(email);
                                                const atLimit = !selected && presenters.length >= numberOfWeeks;
                                                return (
                                                    <div key={u.userId || email} onClick={() => !atLimit && togglePresenter(email, name)}
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 9px', borderRadius: '7px', cursor: atLimit ? 'not-allowed' : 'pointer', opacity: atLimit ? 0.45 : 1, background: selected ? '#ede9fe' : '#fff', border: selected ? '1px solid #c7d2fe' : '1px solid transparent', transition: 'all 0.12s' }}
                                                        onMouseEnter={e => { if (!selected && !atLimit) e.currentTarget.style.background = '#f5f3ff'; }}
                                                        onMouseLeave={e => { if (!selected && !atLimit) e.currentTarget.style.background = '#fff'; }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: selected ? '#6366f1' : 'var(--primary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700 }}>
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

                                {/* Tab: From Project */}
                                {presenterTab === 'project' && (
                                    <div>
                                        <select
                                            style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1.5px solid #e0e7ff', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', marginBottom: '6px' }}
                                            value={presenterProjectId}
                                            onChange={e => setPresenterProjectId(e.target.value)}
                                        >
                                            <option value="">Choose a project…</option>
                                            {Object.entries(projectsMap).map(([id, name]) => (
                                                <option key={id} value={id}>{name}</option>
                                            ))}
                                        </select>
                                        <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }} className="custom-scrollbar">
                                            {presenterProjectLoading ? (
                                                <div style={{ textAlign: 'center', padding: '1rem' }}><Loader2 size={18} className="animate-spin" style={{ color: '#6366f1' }} /></div>
                                            ) : !presenterProjectId ? (
                                                <div style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Select a project above</div>
                                            ) : presenterProjectMembers.length === 0 ? (
                                                <div style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>No members in this project</div>
                                            ) : presenterProjectMembers
                                                .filter(m => !selectedAttendees.some(a => a.email.toLowerCase() === (m.email || m.userEmail || '').toLowerCase()))
                                                .map(m => {
                                                    const email = m.email || m.userEmail || ''; const name = m.fullName || m.userName || ''; const role = m.projectRoleName || '';
                                                    const selected = isPresenterSelected(email);
                                                    const atLimit = !selected && presenters.length >= numberOfWeeks;
                                                    return (
                                                        <div key={m.memberId || m.userId || email} onClick={() => email && !atLimit && togglePresenter(email, name)}
                                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 9px', borderRadius: '7px', cursor: (email && !atLimit) ? 'pointer' : 'not-allowed', opacity: (email && !atLimit) ? 1 : 0.45, background: selected ? '#ede9fe' : '#fff', border: selected ? '1px solid #c7d2fe' : '1px solid transparent', transition: 'all 0.12s' }}
                                                            onMouseEnter={e => { if (!selected && email && !atLimit) e.currentTarget.style.background = '#f5f3ff'; }}
                                                            onMouseLeave={e => { if (!selected && email && !atLimit) e.currentTarget.style.background = '#fff'; }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: selected ? '#6366f1' : 'var(--primary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700 }}>
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {presenterManualInputs.map((val, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <input
                                                    style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', border: '1.5px solid #e0e7ff', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', opacity: presenters.length >= numberOfWeeks ? 0.5 : 1 }}
                                                    value={val}
                                                    onChange={e => { if (presenters.length < numberOfWeeks) { const u = [...presenterManualInputs]; u[idx] = e.target.value; setPresenterManualInputs(u); } }}
                                                    placeholder={presenters.length >= numberOfWeeks ? 'Limit reached' : 'Enter email address…'}
                                                    readOnly={presenters.length >= numberOfWeeks}
                                                    onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; }}
                                                    onBlur={e => { e.currentTarget.style.borderColor = '#e0e7ff'; }}
                                                    onKeyDown={e => {
                                                        if (e.key !== 'Enter') return;
                                                        const trimmed = val.trim();
                                                        if (!trimmed || isPresenterSelected(trimmed) || selectedAttendees.some(a => a.email.toLowerCase() === trimmed.toLowerCase()) || presenters.length >= numberOfWeeks) return;
                                                        togglePresenter(trimmed, trimmed);
                                                        const u = [...presenterManualInputs]; u[idx] = ''; setPresenterManualInputs(u);
                                                    }}
                                                />
                                                <button
                                                    disabled={!val.trim() || presenters.length >= numberOfWeeks}
                                                    onClick={() => {
                                                        const trimmed = val.trim();
                                                        if (!trimmed || isPresenterSelected(trimmed) || selectedAttendees.some(a => a.email.toLowerCase() === trimmed.toLowerCase()) || presenters.length >= numberOfWeeks) return;
                                                        togglePresenter(trimmed, trimmed);
                                                        const u = [...presenterManualInputs]; u[idx] = ''; setPresenterManualInputs(u);
                                                    }}
                                                    style={{ padding: '7px 11px', borderRadius: '7px', border: 'none', background: (val.trim() && presenters.length < numberOfWeeks) ? '#6366f1' : '#94a3b8', color: '#fff', cursor: (val.trim() && presenters.length < numberOfWeeks) ? 'pointer' : 'not-allowed', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}
                                                >
                                                    Add
                                                </button>
                                                {presenterManualInputs.length > 1 && (
                                                    <button onClick={() => setPresenterManualInputs(presenterManualInputs.filter((_, i) => i !== idx))}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', display: 'flex', flexShrink: 0 }}>
                                                        <X size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button onClick={() => setPresenterManualInputs([...presenterManualInputs, ''])}
                                            style={{ alignSelf: 'flex-start', padding: '5px 10px', borderRadius: '7px', border: '1px dashed #c7d2fe', background: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Plus size={12} /> Add another
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>)}
                    </div>

                    {/* ── Attendees ── */}
                    <div style={{
                        borderRadius: '10px', border: '1.5px solid #bfdbfe',
                        background: '#f8fbff', padding: '14px'
                    }}>
                        {/* Collapsible header */}
                        <button
                            onClick={() => setAttendeeOpen(o => !o)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                                padding: 0, marginBottom: attendeeOpen ? '10px' : 0
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{
                                    width: '22px', height: '22px', borderRadius: '6px',
                                    background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
                                    color: '#fff', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Users size={12} />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' as const, letterSpacing: '0.6px' }}>
                                    Attendees
                                </span>
                                {selectedAttendees.length > 0 && (
                                    <span style={{
                                        fontSize: '0.65rem', fontWeight: 700, color: '#3b82f6',
                                        background: '#eff6ff', padding: '2px 8px', borderRadius: '10px'
                                    }}>
                                        {selectedAttendees.length} selected
                                    </span>
                                )}
                            </div>
                            {attendeeOpen
                                ? <ChevronUp size={14} color="#3b82f6" />
                                : <ChevronDown size={14} color="#3b82f6" />
                            }
                        </button>

                        {attendeeOpen && (
                            <AttendeeSelector
                                selectedAttendees={selectedAttendees}
                                onChange={setSelectedAttendees}
                                projectsMap={projectsMap}
                                excludeEmails={presenters.map(p => p.email!).filter(Boolean)}
                            />
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
                    disabled={saving || saved || !title.trim() || !firstSessionStartTime || !!dateError}
                    style={{
                        padding: '8px 24px',
                        borderRadius: '10px',
                        border: 'none',
                        background: (saved || !title.trim() || !firstSessionStartTime || saving || !!dateError) ? '#94a3b8' : 'var(--accent-color)',
                        color: '#fff',
                        cursor: (saved || !title.trim() || !firstSessionStartTime || saving || !!dateError) ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: (saved || !title.trim() || !firstSessionStartTime || saving || !!dateError) ? 'none' : '0 4px 12px rgba(232,114,12,0.25)'
                    }}
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saved ? 'Created' : 'Create Seminar Series'}
                </button>
            </div>
        </div>
    );
};

export default CreateSeminarForm;
