import React, { useState, useEffect } from 'react';
import {
    MeetingResponse,
    MeetingStatus,
    CreateMeetingRequest,
    UpdateMeetingRequest,
    AttendeeResponseStatus
} from '@/types/meeting';
import meetingService from '@/services/meetingService';
import { useAuth } from '@/hooks/useAuth';
import AttendeeSelector, { SelectedAttendee } from '@/components/common/AttendeeSelector';
import DateTimePicker from '@/components/common/DateTimePicker';
import {
    Save,
    Trash2,
    Loader2,
    ExternalLink,
    Video,
    Clock,
    Calendar,
    Users,
    MapPin,
    Play,
    FileText,
    Plus,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Lock,
    X,
    Mic,
    FileSearch
} from 'lucide-react';

interface SchedulePanelProps {
    meetingId: string | null;
    isCreating: boolean;
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string, newEventId?: string) => void;
    onTitleChange?: (title: string) => void;
    projectsMap: Record<string, string>;
    onToggleAINote?: () => void;
    showAINote?: boolean;
    onGetTranscribe?: () => void;
    initialData?: MeetingResponse;
}

const getStatusInfo = (status: MeetingStatus) => {
    switch (status) {
        case MeetingStatus.Scheduled: return { label: 'Scheduled', color: '#3b82f6', bg: '#eff6ff' };
        case MeetingStatus.InProgress: return { label: 'In Progress', color: '#f59e0b', bg: '#fffbeb' };
        case MeetingStatus.Completed: return { label: 'Completed', color: '#10b981', bg: '#ecfdf5' };
        case MeetingStatus.Cancelled: return { label: 'Cancelled', color: '#ef4444', bg: '#fef2f2' };
        default: return { label: 'Unknown', color: '#64748b', bg: '#f1f5f9' };
    }
};

const formatDateForInput = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    // Use local time so the picker shows the user's timezone (e.g. UTC+7)
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
};

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
    padding: '16px',
    background: 'var(--background-color)',
    borderRadius: '12px',
    border: '1px solid var(--border-light)',
    marginBottom: '16px'
};

const SchedulePanel: React.FC<SchedulePanelProps> = ({
    meetingId,
    isCreating,
    onClose,
    onSaved,
    onTitleChange,
    projectsMap,
    onToggleAINote,
    showAINote,
    onGetTranscribe,
    initialData
}) => {
    const { user } = useAuth();
    const [meeting, setMeeting] = useState<MeetingResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Form fields
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [projectId, setProjectId] = useState('');
    const [selectedAttendees, setSelectedAttendees] = useState<SelectedAttendee[]>([]);

    // Detail sections collapse
    const [showAttendees, setShowAttendees] = useState(true);
    const [showInviteSection, setShowInviteSection] = useState(true);
    const [dateError, setDateError] = useState('');
    const [attendeeError, setAttendeeError] = useState('');

    // Load meeting details
    useEffect(() => {
        if (!isCreating && meetingId) {
            if (initialData && (initialData.googleCalendarEventId === meetingId || initialData.id === meetingId)) {
                setMeeting(initialData);
                populateForm(initialData);
                loadMeeting(meetingId, true); // Silent load
            } else {
                loadMeeting(meetingId, false); // Normal load with spinner
            }
        }
    }, [meetingId, isCreating]);

    const loadMeeting = async (eventId: string, silent: boolean = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await meetingService.getMeetingById(eventId);
            setMeeting(data);
            populateForm(data);
        } catch (err) {
            console.error('Failed to load meeting:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const populateForm = (m: MeetingResponse) => {
        setTitle(m.title || '');
        setDescription(m.description || '');
        setStartTime(formatDateForInput(m.startTime));
        setEndTime(formatDateForInput(m.endTime));
        setProjectId(m.projectId || '');
        setSelectedAttendees(
            m.attendees?.filter(a => a.email).map(a => ({
                email: a.email!,
                name: a.displayName || undefined,
                source: 'user' as const
            })) || []
        );
        onTitleChange?.(m.title || 'Schedule');
    };

    const handleTitleInputChange = (val: string) => {
        setTitle(val);
        onTitleChange?.(val || 'New Schedule');
    };

    // Validate dates not in past (only for create mode)
    const validateDates = (): boolean => {
        if (!isCreating) return true;
        const now = new Date();
        if (startTime && new Date(startTime) < now) {
            setDateError('Start time cannot be in the past');
            return false;
        }
        if (endTime && new Date(endTime) < now) {
            setDateError('End time cannot be in the past');
            return false;
        }
        if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
            setDateError('End time must be after start time');
            return false;
        }
        setDateError('');
        return true;
    };

    const handleStartTimeChange = (val: string) => {
        setStartTime(val);
        if (dateError) setDateError('');
    };

    const handleEndTimeChange = (val: string) => {
        setEndTime(val);
        if (dateError) setDateError('');
    };

    const handleSave = async () => {
        if (!title.trim()) return;
        if (!validateDates()) return;
        if (isCreating && selectedAttendees.length === 0) {
            setAttendeeError('Please select at least one attendee.');
            return;
        }
        setAttendeeError('');

        setSaving(true);
        try {
            if (isCreating) {
                const req: CreateMeetingRequest = {
                    title: title.trim(),
                    description: description.trim() || null,
                    startTime: new Date(startTime).toISOString(),
                    endTime: new Date(endTime).toISOString(),
                    projectId: projectId || null,
                    attendeeEmails: selectedAttendees.length > 0 ? selectedAttendees.map(a => a.email) : null
                };
                const created = await meetingService.createMeeting(req);
                onSaved(false, 'Schedule created successfully.', created.id || '');
            } else if (meetingId) {
                const req: UpdateMeetingRequest = {
                    title: title.trim(),
                    description: description.trim() || null,
                    startTime: startTime ? new Date(startTime).toISOString() : null,
                    endTime: endTime ? new Date(endTime).toISOString() : null,
                    attendeeEmails: selectedAttendees.length > 0 ? selectedAttendees.map(a => a.email) : null
                };
                await meetingService.updateMeeting(meetingId, req);
                onSaved(false, 'Schedule updated successfully.');
                loadMeeting(meetingId);
            }
        } catch (err: any) {
            console.error('Save failed:', err);
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to save schedule.';
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!meetingId) return;
        if (!confirm('Are you sure you want to delete this schedule?')) return;
        setDeleting(true);
        try {
            await meetingService.deleteMeeting(meetingId);
            onSaved(true, 'Schedule deleted successfully.');
        } catch (err) {
            console.error('Delete failed:', err);
            alert((err as any).message || 'Failed to delete schedule.');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
            </div>
        );
    }

    const statusInfo = meeting ? getStatusInfo(meeting.status) : null;
    const isOwner = meeting?.createdBy === user?.userId;
    const canEdit = isCreating || isOwner;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Panel Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        background: isCreating ? 'var(--accent-color)' : 'var(--primary-color)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {isCreating ? <Plus size={16} /> : <Calendar size={16} />}
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {isCreating ? 'New Schedule' : (meeting?.title || 'Schedule Details')}
                        </h3>
                        {!isCreating && statusInfo && (
                            <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: statusInfo.color,
                                background: statusInfo.bg,
                                padding: '2px 8px',
                                borderRadius: '12px'
                            }}>
                                {statusInfo.label}
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {!isCreating && onToggleAINote && (
                        <button
                            onClick={onToggleAINote}
                            title="AI Notes"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                                fontSize: '0.75rem', fontWeight: 700,
                                border: showAINote ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                                background: showAINote ? '#f5f3ff' : '#fff',
                                color: showAINote ? '#6366f1' : '#64748b',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Mic size={13} /> AI Notes
                        </button>
                    )}
                    {!isCreating && meetingId && onGetTranscribe && (
                        <button
                            onClick={onGetTranscribe}
                            title="Get Transcribe"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                                fontSize: '0.75rem', fontWeight: 700,
                                border: '1px solid #e2e8f0',
                                background: '#fff',
                                color: '#64748b',
                                transition: 'all 0.2s'
                            }}
                        >
                            <FileSearch size={13} /> Get Transcribe
                        </button>
                    )}
                    {!isCreating && meetingId && isOwner && (
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#ef4444',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                            }}
                        >
                            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            Delete
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        title="Close"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '32px', height: '32px', borderRadius: '8px',
                            border: '1px solid #e2e8f0', background: '#fff',
                            color: '#94a3b8', cursor: 'pointer', flexShrink: 0,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLButtonElement).style.color = '#475569'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>

            {/* Scrollable Form Area */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                {/* Google Meet Link (readonly) */}
                {!isCreating && meeting?.googleMeetLink && (
                    <div style={{
                        ...sectionStyle,
                        background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Video size={18} color="#10b981" />
                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Google Meet</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#065f46' }}>Meeting link available</div>
                            </div>
                        </div>
                        <a
                            href={meeting.googleMeetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                background: '#10b981',
                                color: '#fff',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                textDecoration: 'underline',
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                            }}
                        >
                            <ExternalLink size={14} /> Join Meet
                        </a>
                    </div>
                )}

                {/* Recording URL */}
                {!isCreating && meeting?.recordingUrl && (
                    <div style={{
                        ...sectionStyle,
                        background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                        border: '1px solid #bfdbfe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '16px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Play size={18} color="#3b82f6" />
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1d4ed8' }}>Recording Available</span>
                        </div>
                        <a
                            href={meeting.recordingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                background: '#3b82f6',
                                color: '#fff',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                textDecoration: 'underline'
                            }}
                        >
                            <ExternalLink size={12} /> Watch
                        </a>
                    </div>
                )}

                {/* Read Only Notice */}
                {!isCreating && !canEdit && (
                    <div style={{
                        ...sectionStyle,
                        background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
                        border: '1px solid #fde68a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <Lock size={16} color="#d97706" />
                        <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e' }}>Read Only</div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 500, color: '#a16207' }}>
                                Only the meeting creator can edit this schedule.
                            </div>
                        </div>
                    </div>
                )}

                {/* Core Fields */}
                <div style={sectionStyle}>
                    <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}><FileText size={12} /> Title</label>
                        <input
                            style={{ ...inputStyle, ...(canEdit ? {} : { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' }) }}
                            value={title}
                            onChange={e => { if (canEdit) handleTitleInputChange(e.target.value); }}
                            readOnly={!canEdit}
                            placeholder="Meeting title..."
                            onFocus={e => { if (canEdit) { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; } }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}><FileText size={12} /> Description</label>
                        <textarea
                            style={{ ...inputStyle, minHeight: '80px', resize: canEdit ? ('vertical' as const) : ('none' as const), ...(canEdit ? {} : { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' }) }}
                            value={description}
                            onChange={e => { if (canEdit) setDescription(e.target.value); }}
                            readOnly={!canEdit}
                            placeholder="Meeting description, agenda overview..."
                            onFocus={e => { if (canEdit) { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; } }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
                        <div>
                            <label style={labelStyle}><Calendar size={12} /> Start Time</label>
                            <DateTimePicker
                                value={startTime}
                                onChange={handleStartTimeChange}
                                min={isCreating ? new Date().toISOString().slice(0, 16) : undefined}
                                disabled={!canEdit}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}><Clock size={12} /> End Time</label>
                            <DateTimePicker
                                value={endTime}
                                onChange={handleEndTimeChange}
                                min={isCreating ? new Date().toISOString().slice(0, 16) : undefined}
                                disabled={!canEdit}
                            />
                        </div>
                    </div>
                    {dateError && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            color: '#ef4444', fontSize: '0.75rem', fontWeight: 600,
                            marginBottom: '14px', padding: '8px 12px',
                            background: '#fef2f2', borderRadius: '8px',
                            border: '1px solid #fecaca'
                        }}>
                            <AlertCircle size={14} /> {dateError}
                        </div>
                    )}

                    {isCreating && (
                        <div style={{ marginBottom: '14px' }}>
                            <label style={labelStyle}><MapPin size={12} /> Project</label>
                            <select
                                style={inputStyle}
                                value={projectId}
                                onChange={e => setProjectId(e.target.value)}
                            >
                                <option value="">No Project</option>
                                {Object.entries(projectsMap).map(([id, name]) => (
                                    <option key={id} value={id}>{name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                </div>

                {/* Invite Attendees — collapsible */}
                {canEdit && (
                    <div style={sectionStyle}>
                        <button
                            type="button"
                            onClick={() => setShowInviteSection(v => !v)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                marginBottom: showInviteSection ? '12px' : 0
                            }}
                        >
                            <span style={{ ...labelStyle, marginBottom: 0 }}>
                                <Users size={12} /> Invite Attendees
                                {selectedAttendees.length > 0 && (
                                    <span style={{
                                        marginLeft: '6px', fontSize: '0.65rem', fontWeight: 700,
                                        background: 'var(--accent-color)', color: '#fff',
                                        padding: '1px 7px', borderRadius: '10px'
                                    }}>
                                        {selectedAttendees.length}
                                    </span>
                                )}
                            </span>
                            {showInviteSection
                                ? <ChevronUp size={14} color="var(--text-muted)" />
                                : <ChevronDown size={14} color="var(--text-muted)" />}
                        </button>

                        {showInviteSection && (
                            <>
                                {user?.email && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '6px 10px', borderRadius: '8px', marginBottom: '10px',
                                        background: '#f0fdf4', border: '1px solid #bbf7d0',
                                        fontSize: '0.7rem', fontWeight: 600, color: '#065f46'
                                    }}>
                                        <span style={{ fontSize: '0.85rem' }}>✓</span>
                                        You are the organizer and already included — invite others below.
                                    </div>
                                )}
                                <AttendeeSelector
                                    selectedAttendees={selectedAttendees}
                                    onChange={attendees => { setSelectedAttendees(attendees); if (attendees.length > 0) setAttendeeError(''); }}
                                    projectsMap={projectsMap}
                                    excludeEmails={user?.email ? [user.email] : []}
                                />
                                {attendeeError && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        color: '#ef4444', fontSize: '0.75rem', fontWeight: 600,
                                        marginTop: '8px', padding: '8px 12px',
                                        background: '#fef2f2', borderRadius: '8px',
                                        border: '1px solid #fecaca'
                                    }}>
                                        <AlertCircle size={14} /> {attendeeError}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Attendee List (view mode) */}
                {!isCreating && meeting?.attendees && meeting.attendees.length > 0 && (
                    <div style={sectionStyle}>
                        <button
                            onClick={() => setShowAttendees(!showAttendees)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                marginBottom: showAttendees ? '12px' : 0
                            }}
                        >
                            <span style={labelStyle}><Users size={12} /> Invitation Status ({meeting.attendees.length})</span>
                            {showAttendees ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                        </button>

                        {showAttendees && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {meeting.attendees.map((att, idx) => {
                                    const rsColors: Record<number, string> = {
                                        [AttendeeResponseStatus.Accepted]: '#10b981',
                                        [AttendeeResponseStatus.Declined]: '#ef4444',
                                        [AttendeeResponseStatus.Tentative]: '#f59e0b',
                                        [AttendeeResponseStatus.NeedsAction]: '#94a3b8'
                                    };
                                    const rsLabels: Record<number, string> = {
                                        [AttendeeResponseStatus.Accepted]: 'Accepted',
                                        [AttendeeResponseStatus.Declined]: 'Declined',
                                        [AttendeeResponseStatus.Tentative]: 'Tentative',
                                        [AttendeeResponseStatus.NeedsAction]: 'Pending'
                                    };
                                    return (
                                        <div key={idx} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            background: '#fff',
                                            border: '1px solid var(--border-light)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '50%',
                                                    background: 'var(--primary-color)',
                                                    color: '#fff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700
                                                }}>
                                                    {(att.displayName || att.email || '?')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                        {att.displayName || att.email || 'Unknown'}
                                                    </div>
                                                    {att.displayName && att.email && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{att.email}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: '0.65rem',
                                                fontWeight: 700,
                                                color: rsColors[att.responseStatus] || '#94a3b8',
                                                background: `${rsColors[att.responseStatus] || '#94a3b8'}12`,
                                                padding: '2px 8px',
                                                borderRadius: '10px'
                                            }}>
                                                {rsLabels[att.responseStatus] || 'Unknown'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Presenter Info (view mode) */}
                {!isCreating && meeting?.currentPresenter && (
                    <div style={sectionStyle}>
                        <div style={labelStyle}><Users size={12} /> Current Presenter</div>
                        <div style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: '#fff',
                            border: '1px solid var(--border-light)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, var(--accent-color), var(--accent-light))',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.85rem'
                            }}>
                                {(meeting.currentPresenter.name || meeting.currentPresenter.email || 'P')[0].toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                    {meeting.currentPresenter.name || meeting.currentPresenter.email || 'N/A'}
                                </div>
                                {meeting.currentPresenter.topic && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                        Topic: {meeting.currentPresenter.topic}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Meta Info (view mode) */}
                {!isCreating && meeting && (
                    <div style={sectionStyle}>
                        <div style={labelStyle}><FileText size={12} /> Meeting Info</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div style={{ padding: '8px 12px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)', gridColumn: '1 / -1' }}>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>Created At</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {formatDisplayDate(meeting.createdAt)}
                                </div>
                            </div>
                            {meeting.projectId && projectsMap[meeting.projectId] && (
                                <div style={{ padding: '8px 12px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)', gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>Project</div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                                        {projectsMap[meeting.projectId]}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div style={{
                paddingTop: '14px',
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: 'auto'
            }}>
                {canEdit && (
                    <button
                        onClick={handleSave}
                        disabled={saving || !title.trim() || !!dateError}
                        style={{
                            padding: '8px 24px',
                            borderRadius: '10px',
                            border: 'none',
                            background: (!title.trim() || saving || !!dateError) ? '#94a3b8' : 'var(--accent-color)',
                            color: '#fff',
                            cursor: (!title.trim() || saving || !!dateError) ? 'not-allowed' : 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                            boxShadow: (!title.trim() || saving) ? 'none' : '0 4px 12px rgba(232,114,12,0.25)'
                        }}
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {isCreating ? 'Create' : 'Save Changes'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default SchedulePanel;
