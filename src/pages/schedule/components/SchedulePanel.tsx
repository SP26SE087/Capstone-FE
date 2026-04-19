import React, { useState, useEffect, useMemo, useRef } from 'react';
import ConfirmModal from '@/components/common/ConfirmModal';
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
import CalendarPicker from '@/components/common/CalendarPicker';
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
    RefreshCw,
    Sparkles,
    ArrowRight,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Timer,
    Info,
    Search
} from 'lucide-react';

interface SchedulePanelProps {
    meetingId: string | null;
    actualMeetingId?: string | null;
    isCreating: boolean;
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string, newEventId?: string) => void;
    onTitleChange?: (title: string) => void;
    projectsMap: Record<string, string>;
    onToggleAINote?: () => void;
    showAINote?: boolean;
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

const DURATION_MIN_MINUTES = 15;
const DURATION_MAX_MINUTES = 480;
const DURATION_STEP_MINUTES = 15;
const DURATION_PRESETS = [30, 45, 60, 90];

const clampDurationMinutes = (value: number) =>
    Math.max(DURATION_MIN_MINUTES, Math.min(DURATION_MAX_MINUTES, value));

const formatTimeToAmPm = (date: Date) => {
    const h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
};

const formatDurationReadable = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
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
    actualMeetingId,
    isCreating,
    onClose,
    onSaved,
    onTitleChange,
    projectsMap,
    onToggleAINote,
    showAINote,
    initialData
}) => {
    const { user } = useAuth();
    const [meeting, setMeeting] = useState<MeetingResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [indexing, setIndexing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);

    // Form fields
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [meetingDate, setMeetingDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [startTime, setStartTime] = useState(() => {
        const d = new Date();
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return `${date}T09:00`;
    });
    const [durationMinutes, setDurationMinutes] = useState(45);
    const [projectId, setProjectId] = useState('');
    const startTimeInputRef = useRef<HTMLInputElement | null>(null);
    const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
    const [projectSearch, setProjectSearch] = useState('');
    const projectDropdownRef = useRef<HTMLDivElement | null>(null);
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

    useEffect(() => {
        if (!projectDropdownOpen) return;

        const handleOutsideClick = (event: MouseEvent) => {
            if (
                projectDropdownRef.current &&
                !projectDropdownRef.current.contains(event.target as Node)
            ) {
                setProjectDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [projectDropdownOpen]);

    useEffect(() => {
        if (!isCreating) {
            setProjectDropdownOpen(false);
            setProjectSearch('');
        }
    }, [isCreating]);

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
        const st = formatDateForInput(m.startTime);
        const et = formatDateForInput(m.endTime);
        setMeetingDate(st.split('T')[0] || '');
        setStartTime(st);
        if (st && et) {
            const diffMs = new Date(m.endTime).getTime() - new Date(m.startTime).getTime();
            setDurationMinutes(Math.max(15, Math.round(diffMs / 60000)));
        }
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
        setDateError('');
        return true;
    };

    const handleMeetingDateChange = (newDate: string) => {
        setMeetingDate(newDate);
        const getTime = (t: string) => (t.includes('T') ? t.split('T')[1].slice(0, 5) : null);
        const st = getTime(startTime);
        setStartTime(st ? `${newDate}T${st}` : `${newDate}T09:00`);
        if (dateError) setDateError('');
    };

    const handleStartTimeChange = (val: string) => {
        setStartTime(val);
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
                const computedEnd = startTime ? new Date(new Date(startTime).getTime() + durationMinutes * 60000) : null;
                const req: CreateMeetingRequest = {
                    title: title.trim(),
                    description: description.trim() || null,
                    startTime: new Date(startTime).toISOString(),
                    endTime: computedEnd ? computedEnd.toISOString() : new Date(startTime).toISOString(),
                    projectId: projectId || null,
                    attendeeEmails: selectedAttendees.length > 0 ? selectedAttendees.map(a => a.email) : null
                };
                const created = await meetingService.createMeeting(req);
                onSaved(false, 'Schedule created successfully.', created.id || '');
            } else if (meetingId) {
                const computedEnd = startTime ? new Date(new Date(startTime).getTime() + durationMinutes * 60000) : null;
                const req: UpdateMeetingRequest = {
                    title: title.trim(),
                    description: description.trim() || null,
                    startTime: startTime ? new Date(startTime).toISOString() : null,
                    endTime: computedEnd ? computedEnd.toISOString() : null,
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

    const handleIndexing = async () => {
        const idToUse = actualMeetingId || meeting?.id;
        if (!idToUse) return;
        setIndexing(true);
        try {
            await meetingService.ensureEmbedding(idToUse);
            onSaved(false, 'AI Indexing started.');
            if (meetingId) loadMeeting(meetingId, true);
        } catch {
            alert('Indexing failed.');
        } finally {
            setIndexing(false);
        }
    };

    const handleDelete = () => {
        if (!meetingId) return;
        setConfirmDelete(true);
    };

    const handleConfirmDelete = async () => {
        setConfirmDelete(false);
        setDeleting(true);
        try {
            await meetingService.deleteMeeting(meetingId!);
            onSaved(true, 'Schedule deleted successfully.');
        } catch (err) {
            console.error('Delete failed:', err);
        } finally {
            setDeleting(false);
        }
    };

    const handleCancel = () => {
        if (!meetingId) return;
        setConfirmCancel(true);
    };

    const handleConfirmCancel = async () => {
        setConfirmCancel(false);
        setCancelling(true);
        try {
            const req: UpdateMeetingRequest = {
                title: title.trim(),
                description: description.trim() || null,
                startTime: startTime ? new Date(startTime).toISOString() : null,
                endTime: startTime ? new Date(new Date(startTime).getTime() + durationMinutes * 60000).toISOString() : null,
                attendeeEmails: selectedAttendees.length > 0 ? selectedAttendees.map(a => a.email) : null,
                status: MeetingStatus.Cancelled
            };
            await meetingService.updateMeeting(meetingId!, req);
            onSaved(false, 'Meeting cancelled successfully.');
            loadMeeting(meetingId!);
        } catch (err: any) {
            console.error('Cancel failed:', err);
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to cancel meeting.';
            alert(msg);
        } finally {
            setCancelling(false);
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
    const isOwner = meeting?.createdByEmail?.toLowerCase() === user?.email?.toLowerCase();
    
    // Business Rules
    const canDelete = !isCreating && isOwner && meeting?.status === MeetingStatus.Scheduled;
    const canCancel = !isCreating && isOwner && (meeting?.status === MeetingStatus.Scheduled || meeting?.status === MeetingStatus.InProgress);
    
    // Can edit: only before or on the meeting day
    const canEdit = isCreating || (isOwner && (() => {
        if (!meeting?.startTime) return false;
        const meetingDate = new Date(meeting.startTime);
        const today = new Date();
        // Reset time to compare only dates
        meetingDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        return meetingDate >= today;
    })());

    const clampedDurationMinutes = clampDurationMinutes(durationMinutes);
    const parsedStartTime = startTime ? new Date(startTime) : null;
    const validStartTime = parsedStartTime && !isNaN(parsedStartTime.getTime()) ? parsedStartTime : null;
    const startTimeDisplay = validStartTime ? formatTimeToAmPm(validStartTime) : '--:--';
    const endTimeDisplay = validStartTime
        ? formatTimeToAmPm(new Date(validStartTime.getTime() + clampedDurationMinutes * 60000))
        : '--:--';
    const durationReadable = formatDurationReadable(clampedDurationMinutes);
    const selectedTimeValue = startTime
        ? (startTime.includes('T') ? startTime.split('T')[1].slice(0, 5) : startTime.slice(0, 5))
        : '09:00';
    const projectEntries = useMemo(
        () => Object.entries(projectsMap).sort(([, a], [, b]) => a.localeCompare(b)),
        [projectsMap]
    );
    const filteredProjectEntries = useMemo(() => {
        const q = projectSearch.trim().toLowerCase();
        if (!q) return projectEntries;
        return projectEntries.filter(([, name]) => name.toLowerCase().includes(q));
    }, [projectEntries, projectSearch]);
    const selectedProjectName = projectId ? projectsMap[projectId] : '';

    return (
        <>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: '3px',
                                    fontSize: '0.65rem', fontWeight: 500, padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: meeting?.hasEmbedding ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : '#f1f5f9',
                                    color: meeting?.hasEmbedding ? '#166534' : '#64748b',
                                    border: `1px solid ${meeting?.hasEmbedding ? '#bbf7d0' : '#e2e8f0'}`
                                }}>
                                    <Sparkles size={11} />
                                    {meeting?.hasEmbedding ? 'Can Semantic Search' : 'Cannot Semantic Search'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {!isCreating && onToggleAINote && (
                        <button
                            onClick={onToggleAINote}
                            title="AI Notes"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '7px 14px', borderRadius: '10px', cursor: 'pointer',
                                fontSize: '0.78rem', fontWeight: 800,
                                border: 'none',
                                background: showAINote
                                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                    : 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                                color: showAINote ? '#fff' : '#6366f1',
                                boxShadow: showAINote
                                    ? '0 4px 14px rgba(99,102,241,0.4)'
                                    : '0 2px 8px rgba(99,102,241,0.15)',
                                transition: 'all 0.2s',
                                letterSpacing: '0.01em'
                            }}
                            onMouseEnter={e => {
                                if (!showAINote) {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.35)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!showAINote) {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #f5f3ff, #ede9fe)';
                                    e.currentTarget.style.color = '#6366f1';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.15)';
                                }
                            }}
                        >
                            <Sparkles size={13} /> AI Notes
                        </button>
                    )}
                    {!isCreating && meetingId && canCancel && (
                        <button
                            onClick={handleCancel}
                            disabled={cancelling}
                            title="Cancel this meeting"
                            style={{
                                background: '#fff7ed',
                                border: '1px solid #fed7aa',
                                color: '#ea580c',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                cursor: cancelling ? 'not-allowed' : 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s',
                                opacity: cancelling ? 0.6 : 1
                            }}
                        >
                            {cancelling ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                            Cancel Meeting
                        </button>
                    )}
                    {!isCreating && meetingId && canDelete && (
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            title="Delete this meeting (only Scheduled meetings)"
                            style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#ef4444',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                cursor: deleting ? 'not-allowed' : 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s',
                                opacity: deleting ? 0.6 : 1
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

                    <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}><Calendar size={12} /> Date</label>
                        <CalendarPicker
                            value={meetingDate}
                            onChange={canEdit ? handleMeetingDateChange : () => {}}
                            minDate={isCreating ? (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })() : undefined}
                            disabled={!canEdit}
                        />
                    </div>

                    {/* Time + Duration — split by edit vs view */}
                    {canEdit ? (
                        <>
                            {/* Edit/Create: native time picker with polished input styling */}
                            <div style={{ marginBottom: '14px' }}>
                                <label style={labelStyle}>Start Time</label>
                                <div style={{
                                    position: 'relative',
                                    border: '1.5px solid #dbe4ee',
                                    borderRadius: '10px',
                                    background: '#fff',
                                    transition: 'border-color 0.2s, box-shadow 0.2s',
                                    cursor: canEdit ? 'pointer' : 'not-allowed'
                                }}
                                    onClick={() => {
                                        if (!canEdit || !startTimeInputRef.current) return;
                                        const pickerInput = startTimeInputRef.current as HTMLInputElement & { showPicker?: () => void };
                                        if (typeof pickerInput.showPicker === 'function') {
                                            pickerInput.showPicker();
                                        } else {
                                            startTimeInputRef.current.focus();
                                        }
                                    }
                                }>
                                    <input
                                        ref={startTimeInputRef}
                                        type="time"
                                        step={900}
                                        disabled={!canEdit}
                                        value={selectedTimeValue}
                                        onChange={e => {
                                            const t = e.target.value;
                                            if (t) handleStartTimeChange(`${meetingDate}T${t}`);
                                        }}
                                        style={{
                                            ...inputStyle,
                                            border: 'none',
                                            boxShadow: 'none',
                                            padding: '10px 12px',
                                            fontWeight: 700,
                                            fontVariantNumeric: 'tabular-nums',
                                            cursor: canEdit ? 'pointer' : 'not-allowed'
                                        }}
                                        onFocus={e => {
                                            const wrapper = e.currentTarget.parentElement as HTMLElement | null;
                                            if (wrapper) {
                                                wrapper.style.borderColor = 'var(--accent-color)';
                                                wrapper.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)';
                                            }
                                        }}
                                        onBlur={e => {
                                            const wrapper = e.currentTarget.parentElement as HTMLElement | null;
                                            if (wrapper) {
                                                wrapper.style.borderColor = '#dbe4ee';
                                                wrapper.style.boxShadow = 'none';
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ ...labelStyle, marginBottom: '8px' }}><Clock size={12} /> Duration</label>
                                <div style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '14px',
                                    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                                    padding: '10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                }}>
                                    <div style={{
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '12px',
                                        padding: '9px 10px',
                                        background: '#fff',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr auto 1fr',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#94a3b8' }}>Start</div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{startTimeDisplay}</div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                                            <ArrowRight size={14} color="#94a3b8" />
                                            <span style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 700 }}>{durationReadable}</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#94a3b8' }}>End</div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#047857', fontVariantNumeric: 'tabular-nums' }}>{endTimeDisplay}</div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
                                        {DURATION_PRESETS.map((val) => (
                                            <button
                                                key={val}
                                                type="button"
                                                onClick={() => setDurationMinutes(val)}
                                                style={{
                                                    padding: '8px 10px',
                                                    borderRadius: '10px',
                                                    border: clampedDurationMinutes === val ? '1.5px solid #fb923c' : '1.2px solid #dbe4ee',
                                                    background: clampedDurationMinutes === val
                                                        ? 'linear-gradient(135deg, rgba(251,146,60,0.18), rgba(249,115,22,0.06))'
                                                        : '#fff',
                                                    color: clampedDurationMinutes === val ? '#c2410c' : '#475569',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.16s',
                                                    boxShadow: clampedDurationMinutes === val ? '0 4px 10px rgba(249,115,22,0.2)' : 'none'
                                                }}
                                            >
                                                {formatDurationReadable(val)}
                                            </button>
                                        ))}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', gap: '8px', alignItems: 'stretch' }}>
                                        <button
                                            type="button"
                                            disabled={clampedDurationMinutes <= DURATION_MIN_MINUTES}
                                            onClick={() => setDurationMinutes(d => clampDurationMinutes(d - DURATION_STEP_MINUTES))}
                                            style={{
                                                borderRadius: '12px',
                                                border: '1.2px solid #dbe4ee',
                                                background: '#fff',
                                                color: '#475569',
                                                fontSize: '1.05rem',
                                                fontWeight: 800,
                                                cursor: clampedDurationMinutes <= DURATION_MIN_MINUTES ? 'not-allowed' : 'pointer',
                                                opacity: clampedDurationMinutes <= DURATION_MIN_MINUTES ? 0.45 : 1,
                                                transition: 'all 0.15s',
                                                lineHeight: 1
                                            }}
                                            onMouseEnter={e => {
                                                if (clampedDurationMinutes > DURATION_MIN_MINUTES) {
                                                    e.currentTarget.style.borderColor = '#fb923c';
                                                    e.currentTarget.style.background = '#fff7ed';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.borderColor = '#dbe4ee';
                                                e.currentTarget.style.background = '#fff';
                                            }}
                                        >
                                            -
                                        </button>

                                        <div style={{
                                            border: '1.2px solid #dbe4ee',
                                            borderRadius: '12px',
                                            background: '#fff',
                                            minHeight: '58px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '8px 12px',
                                            gap: '10px'
                                        }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                    <input
                                                        type="number"
                                                        min={DURATION_MIN_MINUTES}
                                                        max={DURATION_MAX_MINUTES}
                                                        step={DURATION_STEP_MINUTES}
                                                        disabled={!canEdit}
                                                        value={clampedDurationMinutes}
                                                        className="no-spinner"
                                                        onChange={e => {
                                                            const v = parseInt(e.target.value, 10);
                                                            if (!isNaN(v)) setDurationMinutes(clampDurationMinutes(v));
                                                        }}
                                                        style={{
                                                            width: '58px',
                                                            border: 'none',
                                                            background: 'transparent',
                                                            textAlign: 'right',
                                                            fontSize: '1rem',
                                                            fontWeight: 900,
                                                            color: 'var(--text-primary)',
                                                            outline: 'none',
                                                            padding: 0
                                                        }}
                                                    />
                                                    <span style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)' }}>minutes</span>
                                                </div>
                                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>
                                                    Duration: {durationReadable}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={clampedDurationMinutes >= DURATION_MAX_MINUTES}
                                            onClick={() => setDurationMinutes(d => clampDurationMinutes(d + DURATION_STEP_MINUTES))}
                                            style={{
                                                borderRadius: '12px',
                                                border: '1.2px solid #dbe4ee',
                                                background: '#fff',
                                                color: '#475569',
                                                fontSize: '1.05rem',
                                                fontWeight: 800,
                                                cursor: clampedDurationMinutes >= DURATION_MAX_MINUTES ? 'not-allowed' : 'pointer',
                                                opacity: clampedDurationMinutes >= DURATION_MAX_MINUTES ? 0.45 : 1,
                                                transition: 'all 0.15s',
                                                lineHeight: 1
                                            }}
                                            onMouseEnter={e => {
                                                if (clampedDurationMinutes < DURATION_MAX_MINUTES) {
                                                    e.currentTarget.style.borderColor = '#fb923c';
                                                    e.currentTarget.style.background = '#fff7ed';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.borderColor = '#dbe4ee';
                                                e.currentTarget.style.background = '#fff';
                                            }}
                                        >
                                            +
                                        </button>
                                    </div>

                                </div>
                            </div>
                        </>
                    ) : (
                        /* View: time range card — neutral, AM/PM */
                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ ...labelStyle, marginBottom: '8px' }}><Clock size={12} /> Schedule</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', borderRadius: '12px', background: '#f8fafc', border: '1.5px solid #e2e8f0' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px' }}>Start</div>
                                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                        {startTime ? (() => { const d = new Date(startTime); const h = d.getHours(); const m = d.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12; return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ap}`; })() : '--:--'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                    <ArrowRight size={15} color="#94a3b8" />
                                    <span style={{ fontSize: '0.58rem', color: '#94a3b8', fontWeight: 700 }}>
                                        {(() => { const h = Math.floor(durationMinutes / 60); const m = durationMinutes % 60; if (h === 0) return `${m}m`; if (m === 0) return `${h}h`; return `${h}h ${m}m`; })()}
                                    </span>
                                </div>
                                <div style={{ flex: 1, textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px' }}>End</div>
                                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                                        {startTime ? (() => { const e = new Date(new Date(startTime).getTime() + durationMinutes * 60000); const h = e.getHours(); const m = e.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12; return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ap}`; })() : '--:--'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
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
                            <label style={labelStyle}>Project</label>
                            <div ref={projectDropdownRef} style={{ position: 'relative' }}>
                                <button
                                    type="button"
                                    onClick={() => setProjectDropdownOpen(v => !v)}
                                    style={{
                                        width: '100%',
                                        border: projectDropdownOpen ? '1.5px solid #0ea5e9' : '1.5px solid #dbe4ee',
                                        borderRadius: '14px',
                                        background: projectId ? 'linear-gradient(135deg, #f0f9ff, #ffffff)' : '#fff',
                                        padding: '10px 12px',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr auto',
                                        alignItems: 'center',
                                        gap: '8px',
                                        cursor: 'pointer',
                                        boxShadow: projectDropdownOpen ? '0 8px 24px rgba(14,165,233,0.16)' : '0 2px 8px rgba(15,23,42,0.05)',
                                        transition: 'all 0.18s'
                                    }}
                                >
                                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                                        <div style={{
                                            fontSize: '0.61rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.08em',
                                            fontWeight: 800,
                                            color: '#64748b',
                                            marginBottom: '2px'
                                        }}>
                                            Project Context
                                        </div>
                                        <div style={{
                                            fontSize: '0.83rem',
                                            fontWeight: projectId ? 700 : 600,
                                            color: projectId ? '#0f172a' : '#94a3b8',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {projectId ? selectedProjectName : 'Choose a project for this meeting'}
                                        </div>
                                    </div>
                                    <ChevronDown
                                        size={14}
                                        color="#64748b"
                                        style={{
                                            transform: projectDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                            transition: 'transform 0.15s',
                                            flexShrink: 0
                                        }}
                                    />
                                </button>

                                {projectDropdownOpen && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 9px)',
                                        left: 0,
                                        right: 0,
                                        zIndex: 40,
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '14px',
                                        background: '#fff',
                                        boxShadow: '0 20px 34px rgba(15,23,42,0.18)',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            padding: '9px',
                                            background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                                            borderBottom: '1px solid #e2e8f0'
                                        }}>
                                            <div style={{ position: 'relative' }}>
                                                <Search
                                                    size={13}
                                                    style={{
                                                        position: 'absolute',
                                                        left: '9px',
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        color: '#94a3b8'
                                                    }}
                                                />
                                                <input
                                                    value={projectSearch}
                                                    onChange={(e) => setProjectSearch(e.target.value)}
                                                    placeholder="Search by project name..."
                                                    style={{
                                                        width: '100%',
                                                        border: '1px solid #dbe4ee',
                                                        borderRadius: '9px',
                                                        fontSize: '0.78rem',
                                                        fontFamily: 'inherit',
                                                        padding: '8px 10px 8px 30px',
                                                        outline: 'none',
                                                        background: '#fff'
                                                    }}
                                                    onFocus={e => { e.currentTarget.style.borderColor = '#0ea5e9'; }}
                                                    onBlur={e => { e.currentTarget.style.borderColor = '#dbe4ee'; }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '8px', background: '#f8fafc' }} className="custom-scrollbar">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setProjectId('');
                                                    setProjectDropdownOpen(false);
                                                    setProjectSearch('');
                                                }}
                                                style={{
                                                    width: '100%',
                                                    border: !projectId ? '1.5px solid #7dd3fc' : '1px solid #e2e8f0',
                                                    borderRadius: '10px',
                                                    background: !projectId ? '#ecfeff' : '#fff',
                                                    padding: '9px 10px',
                                                    textAlign: 'left',
                                                    cursor: 'pointer',
                                                    marginBottom: '7px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '8px'
                                                }}
                                            >
                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: !projectId ? '#0369a1' : '#334155' }}>
                                                    No Project (Independent meeting)
                                                </span>
                                                {!projectId && <CheckCircle2 size={15} color="#0284c7" />}
                                            </button>

                                            {filteredProjectEntries.length === 0 ? (
                                                <div style={{
                                                    border: '1px dashed #cbd5e1',
                                                    borderRadius: '10px',
                                                    background: '#fff',
                                                    textAlign: 'center',
                                                    padding: '14px 10px',
                                                    color: '#64748b',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600
                                                }}>
                                                    No projects found with this keyword
                                                </div>
                                            ) : filteredProjectEntries.map(([id, name]) => {
                                                const selected = projectId === id;
                                                return (
                                                    <button
                                                        key={id}
                                                        type="button"
                                                        onClick={() => {
                                                            setProjectId(id);
                                                            setProjectDropdownOpen(false);
                                                            setProjectSearch('');
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            border: selected ? '1.5px solid #7dd3fc' : '1px solid #e2e8f0',
                                                            borderRadius: '10px',
                                                            background: selected ? '#ecfeff' : '#fff',
                                                            padding: '8px 10px',
                                                            marginBottom: '7px',
                                                            textAlign: 'left',
                                                            cursor: 'pointer',
                                                            display: 'grid',
                                                            gridTemplateColumns: '1fr auto',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            transition: 'all 0.14s'
                                                        }}
                                                        onMouseEnter={e => {
                                                            if (!selected) e.currentTarget.style.background = '#f0f9ff';
                                                        }}
                                                        onMouseLeave={e => {
                                                            if (!selected) e.currentTarget.style.background = '#fff';
                                                        }}
                                                    >
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{
                                                                fontSize: '0.79rem',
                                                                fontWeight: selected ? 700 : 600,
                                                                color: selected ? '#075985' : '#1e293b',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }}>
                                                                {name}
                                                            </div>
                                                            <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 600 }}>
                                                                Use this project as context
                                                            </div>
                                                        </div>
                                                        {selected && <CheckCircle2 size={15} color="#0284c7" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div style={{
                                    marginTop: '8px',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: projectId ? '#0369a1' : '#64748b',
                                    lineHeight: 1.35
                                }}>
                                    {projectId
                                        ? `Selected project: ${selectedProjectName}`
                                        : 'No project selected. You can still invite attendees manually.'}
                                </div>
                            </div>
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
                        <button onClick={() => setShowAttendees(!showAttendees)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showAttendees ? '12px' : 0 }}>
                            <span style={labelStyle}>
                                <Users size={12} /> Attendees
                                <span style={{ marginLeft: '6px', fontSize: '0.65rem', fontWeight: 700, background: '#e0e7ff', color: '#6366f1', padding: '1px 7px', borderRadius: '10px' }}>
                                    {meeting.attendees.length}
                                </span>
                            </span>
                            {showAttendees ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                        </button>

                        {showAttendees && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {meeting.attendees.map((att, idx) => {
                                    const rsConfig: Record<number, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
                                        [AttendeeResponseStatus.Accepted]:    { color: '#059669', bg: '#d1fae5', icon: <CheckCircle2 size={12} />, label: 'Accepted' },
                                        [AttendeeResponseStatus.Declined]:    { color: '#dc2626', bg: '#fee2e2', icon: <XCircle size={12} />,      label: 'Declined' },
                                        [AttendeeResponseStatus.Tentative]:   { color: '#d97706', bg: '#fef3c7', icon: <HelpCircle size={12} />,   label: 'Maybe' },
                                        [AttendeeResponseStatus.NeedsAction]: { color: '#94a3b8', bg: '#f1f5f9', icon: <Timer size={12} />,        label: 'Pending' },
                                    };
                                    const rs = rsConfig[att.responseStatus] ?? rsConfig[AttendeeResponseStatus.NeedsAction];
                                    const name = att.displayName || att.email || 'Unknown';
                                    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=64&background=6366f1&color=ffffff&bold=true&rounded=true`;
                                    return (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '10px', background: '#fafafa', border: '1px solid var(--border-light)', transition: 'background 0.15s' }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = '#fafafa'; }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <img
                                                    src={avatarUrl}
                                                    alt={name}
                                                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                                    onError={e => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextSibling as HTMLElement)?.style.setProperty('display', 'flex'); }}
                                                />
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1e293b', color: '#fff', display: 'none', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                                                    {name[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{name}</div>
                                                    {att.displayName && att.email && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>{att.email}</div>}
                                                </div>
                                            </div>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 700, color: rs.color, background: rs.bg, padding: '3px 8px', borderRadius: '10px', flexShrink: 0 }}>
                                                {rs.icon} {rs.label}
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
                    <div style={{ ...sectionStyle, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div style={{ ...labelStyle, marginBottom: '10px' }}><Info size={12} /> Meeting Info</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {/* Created at */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Calendar size={14} color="#6366f1" />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created</div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatDisplayDate(meeting.createdAt)}</div>
                                </div>
                            </div>

                            {/* Status */}
                            {meeting.status !== undefined && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <CheckCircle2 size={14} color="#10b981" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {typeof meeting.status === 'number'
                                                ? ['Scheduled', 'In Progress', 'Completed', 'Cancelled'][meeting.status] ?? `Status ${meeting.status}`
                                                : String(meeting.status)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Project */}
                            {meeting.projectId && projectsMap[meeting.projectId] && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <MapPin size={14} color="var(--accent-color)" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Project</div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-color)' }}>{projectsMap[meeting.projectId]}</div>
                                    </div>
                                </div>
                            )}

                            {/* Attendee count */}
                            {meeting.attendees && meeting.attendees.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Users size={14} color="#0ea5e9" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attendees</div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {meeting.attendees.length} people · {meeting.attendees.filter(a => a.responseStatus === AttendeeResponseStatus.Accepted).length} accepted
                                        </div>
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
                justifyContent: isCreating ? 'flex-end' : 'space-between',
                alignItems: 'center',
                gap: '10px',
                marginTop: 'auto'
            }}>
                {!isCreating && meeting?.id && (
                    <button
                        onClick={handleIndexing}
                        disabled={indexing}
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
                        <RefreshCw size={13} className={indexing ? 'animate-spin' : ''} />
                        Insert to Semantic Search
                    </button>
                )}
                {canEdit && (
                    <button
                        onClick={handleSave}
                        disabled={saving || !title.trim() || !!dateError}
                        style={{
                            padding: isCreating ? '10px 26px' : '9px 24px',
                            borderRadius: '12px',
                            border: 'none',
                            background: (!title.trim() || saving || !!dateError)
                                ? '#94a3b8'
                                : (isCreating
                                    ? 'linear-gradient(135deg, #fb923c, #ea580c)'
                                    : 'linear-gradient(135deg, var(--accent-color), #f59e0b)'),
                            color: '#fff',
                            cursor: (!title.trim() || saving || !!dateError) ? 'not-allowed' : 'pointer',
                            fontSize: '0.81rem',
                            fontWeight: 800,
                            letterSpacing: '0.01em',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: isCreating ? '0px' : '7px',
                            minWidth: isCreating ? '156px' : '150px',
                            transition: 'all 0.2s',
                            boxShadow: (!title.trim() || saving || !!dateError)
                                ? 'none'
                                : (isCreating
                                    ? '0 10px 24px rgba(234,88,12,0.34)'
                                    : '0 6px 14px rgba(232,114,12,0.28)')
                        }}
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : (!isCreating && <Save size={14} />)}
                        {isCreating ? 'Create Schedule' : 'Save Changes'}
                    </button>
                )}
            </div>
        </div>
        
        <ConfirmModal
            isOpen={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            onConfirm={handleConfirmDelete}
            title="Delete Meeting"
            message="Are you sure you want to delete this meeting? This action cannot be undone. Only Scheduled meetings can be deleted."
            confirmText="Delete"
            cancelText="Cancel"
            variant="danger"
        />

        <ConfirmModal
            isOpen={confirmCancel}
            onClose={() => setConfirmCancel(false)}
            onConfirm={handleConfirmCancel}
            title="Cancel Meeting"
            message="Are you sure you want to cancel this meeting? All attendees will be notified."
            confirmText="Cancel Meeting"
            cancelText="Keep Meeting"
            variant="info"
        />
        </>
    );
};

export default SchedulePanel;
