import React, { useState, useEffect, useRef } from 'react';
import { SeminarMeetingResponse, UpdateSeminarMeetingRequest, CreateSeminarSwapRequest } from '@/types/seminar';
import seminarService from '@/services/seminarService';
import { API_BASE_URL } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useToastStore } from '@/store/slices/toastSlice';
import ConfirmModal from '@/components/common/ConfirmModal';
import {
    Save,
    Loader2,
    ExternalLink,
    Presentation,
    Link2,
    Play,
    Calendar,
    MapPin,
    FileText,
    ArrowLeftRight,
    Sparkles,
    ChevronDown,
    ChevronUp,
    Upload,
    Download,
    X,
    Pencil,
    Clock,
    Video,
} from 'lucide-react';

interface SeminarPanelProps {
    meetingId: string | null;
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string) => void;
    onTitleChange?: (title: string) => void;
    usersMap: Record<string, string>;
    emailsMap: Record<string, string>;
    onToggleAINote?: () => void;
    showAINote?: boolean;
    initialData?: SeminarMeetingResponse;
    isCreating?: boolean;
    projectsMap?: Record<string, string>;
    openSwapOnLoad?: boolean;
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

const formatDateOnly = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${weekdays[d.getDay()]}, ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

type SeminarTimingStatus = 'upcoming' | 'in-progress' | 'completed';

const combineSeminarDateAndTime = (meetingDate: string, timeValue: string) => {
    const baseDate = new Date(meetingDate);
    if (isNaN(baseDate.getTime())) return null;

    if (!timeValue) {
        return baseDate;
    }

    if (timeValue.includes('T')) {
        const parsed = new Date(timeValue);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
    }

    const rawTime = timeValue.includes('T') ? timeValue.split('T')[1] : timeValue;
    const sanitizedTime = rawTime
        .replace('Z', '')
        .replace(/([+-]\d{2}:?\d{2})$/, '')
        .split('.')[0];
    const timeMatch = sanitizedTime.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?$/);
    if (!timeMatch) return null;

    const [, hourPart, minutePart, secondPart] = timeMatch;

    const nextDate = new Date(baseDate);
    nextDate.setHours(
        Number(hourPart || 0),
        Number(minutePart || 0),
        Number(secondPart || 0),
        0
    );

    return isNaN(nextDate.getTime()) ? null : nextDate;
};

const getSeminarTimingStatus = (meeting: SeminarMeetingResponse | null): SeminarTimingStatus => {
    if (!meeting) return 'upcoming';

    const now = Date.now();
    const startAt = combineSeminarDateAndTime(meeting.meetingDate, meeting.startTime);
    const endAt = combineSeminarDateAndTime(meeting.meetingDate, meeting.endTime);

    if (startAt && endAt) {
        const startTime = startAt.getTime();
        const endTime = endAt.getTime();

        if (now < startTime) return 'upcoming';
        if (now > endTime) return 'completed';
        return 'in-progress';
    }

    const meetingDateTime = new Date(meeting.meetingDate).getTime();
    return meetingDateTime > now ? 'upcoming' : 'completed';
};

const SeminarPanel: React.FC<SeminarPanelProps> = ({
    meetingId,
    onClose,
    onSaved,
    onTitleChange,
    usersMap,
    emailsMap,
    onToggleAINote,
    showAINote,
    initialData,
    openSwapOnLoad = false,
}) => {
    const { user } = useAuth();
    const [meeting, setMeeting] = useState<SeminarMeetingResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [descExpanded, setDescExpanded] = useState(false);
    const [swapAccordionOpen, setSwapAccordionOpen] = useState(false);
    const { addToast } = useToastStore();

    // Editable fields
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [slideUrl, setSlideUrl] = useState('');
    const [slideFile, setSlideFile] = useState<File | null>(null);

    // Swap request
    const [allMeetings, setAllMeetings] = useState<SeminarMeetingResponse[]>([]);
    const [swapTargetId, setSwapTargetId] = useState('');
    const [swapReason, setSwapReason] = useState('');
    const [swapExpiry, setSwapExpiry] = useState('');
    const [submittingSwap, setSubmittingSwap] = useState(false);
    const [showSwapConfirm, setShowSwapConfirm] = useState(false);
    const swapOnLoadHandledRef = useRef<string | null>(null);

    useEffect(() => {
        if (meetingId) {
            setIsEditMode(false);
            setDescExpanded(false);
            if (initialData && initialData.seminarMeetingId === meetingId) {
                setMeeting(initialData);
                setTitle(initialData.title || '');
                setDescription(initialData.description || '');
                setLocation(initialData.location || '');
                setSlideUrl(initialData.slideUrl || '');
                setSlideFile(null);
                onTitleChange?.(initialData.title || 'Seminar');
                loadMeetingFromList(meetingId, true);
            } else {
                setMeeting(null);
                setTitle('');
                setDescription('');
                setLocation('');
                setSlideUrl('');
                setSlideFile(null);
                setSwapAccordionOpen(false);
                setAllMeetings([]);
                setSwapTargetId('');
                setSwapReason('');
                setSwapExpiry('');
                loadMeetingFromList(meetingId, false);
            }
        }
    }, [meetingId]);

    const loadMeetingFromList = async (id: string, silent: boolean = false) => {
        if (!silent) setLoading(true);
        try {
            let allM = await seminarService.getMySeminarMeetings();
            let found = allM.find(m => m.seminarMeetingId === id);
            if (!found) {
                allM = await seminarService.getAllSeminarMeetings();
                found = allM.find(m => m.seminarMeetingId === id);
            }
            if (found) {
                setMeeting(found);
                setTitle(found.title || '');
                setDescription(found.description || '');
                setLocation(found.location || '');
                setSlideUrl(found.slideUrl || '');
                setSlideFile(null);
                onTitleChange?.(found.title || 'Seminar');
            }
        } catch (err) {
            console.error('Failed to load seminar meeting:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleOpenSwapForm = async () => {
        if (allMeetings.length === 0) {
            try {
                const data = await seminarService.getAllSeminarMeetings();
                const threeDaysFromNow = Date.now() + 3 * 24 * 60 * 60 * 1000;
                const filtered = Array.isArray(data) ? data.filter(m =>
                    m.seminarMeetingId !== meetingId &&
                    m.seminarId === meeting?.seminarId &&
                    m.presenterId !== meeting?.presenterId &&
                    new Date(m.meetingDate).getTime() > threeDaysFromNow
                ) : [];
                filtered.sort((a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime());
                setAllMeetings(filtered);
            } catch (err) {
                console.error('Failed to load meetings for swap:', err);
            }
        }
    };

    const handleSubmitSwap = async () => {
        if (!meetingId || !swapTargetId) return;
        if (swapExpiry && new Date(swapExpiry) <= new Date()) {
            addToast('Expiry date must be in the future.', 'error');
            return;
        }
        setSubmittingSwap(true);
        try {
            const req: CreateSeminarSwapRequest = {
                sourceSeminarMeetingId: meetingId,
                targetSeminarMeetingId: swapTargetId,
                reason: swapReason.trim() || null,
                expiresAtUtc: swapExpiry ? new Date(swapExpiry).toISOString() : null
            };
            await seminarService.createSwapRequest(req);
            setSwapAccordionOpen(false);
            setSwapTargetId('');
            setSwapReason('');
            setSwapExpiry('');
            onSaved(false, 'Swap request submitted successfully.');
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to submit swap request.';
            addToast(msg, 'error');
        } finally {
            setSubmittingSwap(false);
        }
    };

    const handleSave = async () => {
        if (!meetingId || !meeting) return;
        setSaving(true);
        try {
            const req: UpdateSeminarMeetingRequest = {
                title: title.trim() || null,
                description: description.trim() || null,
                location: location.trim() || null,
                slideUrl: slideUrl.trim() || null,
                file: slideFile || null
            };
            await seminarService.updateSeminarMeeting(meetingId, req);
            setIsEditMode(false);
            onSaved(false, 'Seminar meeting updated successfully.');
            loadMeetingFromList(meetingId);
        } catch (err: any) {
            console.error('Save failed:', err);
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to update seminar meeting.';
            addToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        if (!meeting) return;
        setTitle(meeting.title || '');
        setDescription(meeting.description || '');
        setLocation(meeting.location || '');
        setSlideUrl(meeting.slideUrl || '');
        setSlideFile(null);
        setIsEditMode(false);
    };

    // ---- derived (must be before any return) ----
    const presenterName = usersMap[meeting?.presenterId ?? ''] || 'Unknown Presenter';
    const seminarTimingStatus = getSeminarTimingStatus(meeting);
    const isUpcoming = seminarTimingStatus === 'upcoming';
    const isInProgress = seminarTimingStatus === 'in-progress';
    const canOpenAiNote = !!onToggleAINote && (isInProgress || seminarTimingStatus === 'completed');
    const presenterEmail = meeting ? emailsMap[meeting.presenterId] : undefined;
    const canEdit = !!user?.email && !!presenterEmail && user.email.toLowerCase() === presenterEmail.toLowerCase();

    useEffect(() => {
        if (!openSwapOnLoad || !canEdit || !meetingId) return;
        if (swapOnLoadHandledRef.current === meetingId) return;
        swapOnLoadHandledRef.current = meetingId;
        setSwapAccordionOpen(true);
        handleOpenSwapForm();
    }, [openSwapOnLoad, canEdit, meetingId]);

    // ---- early returns ----
    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
            </div>
        );
    }

    if (!meeting) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--text-muted)' }}>
                <p>Select a seminar meeting to view details.</p>
            </div>
        );
    }

    const hasSlides = !!meeting.slideUrl;

    const getCountdown = () => {
        const d = new Date(meeting.meetingDate);
        d.setHours(0, 0, 0, 0);
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Tomorrow';
        if (diff === -1) return 'Yesterday';
        if (diff > 1) return `in ${diff} days`;
        return `${Math.abs(diff)} days ago`;
    };

    // ===================== EDIT MODE =====================
    if (isEditMode) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Edit header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    marginBottom: '20px', paddingBottom: '12px',
                    borderBottom: '2px solid var(--accent-color)',
                }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '10px',
                        background: 'var(--accent-color)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                        <Pencil size={15} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>Edit Seminar</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--accent-color)', fontWeight: 600 }}>Editing mode — changes are not saved yet</div>
                    </div>
                    {canOpenAiNote && (
                        <button
                            onClick={() => onToggleAINote?.()}
                            title={showAINote ? 'Close AI Notes' : 'Open AI Notes'}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                                fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s',
                                minWidth: '108px', whiteSpace: 'nowrap' as const, flexShrink: 0,
                                ...(showAINote
                                    ? { border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 16px rgba(99,102,241,0.45)' }
                                    : { border: '1.5px solid #c4b5fd', background: '#faf5ff', color: '#7c3aed' })
                            }}
                        >
                            <Sparkles size={14} /> {showAINote ? 'Close Notes' : 'AI Notes'}
                        </button>
                    )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                    <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}>Title</label>
                        <input
                            style={inputStyle}
                            value={title}
                            onChange={e => { setTitle(e.target.value); onTitleChange?.(e.target.value || 'Seminar'); }}
                            placeholder="Seminar title..."
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}>Description</label>
                        <textarea
                            style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' as const }}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Seminar description, topics to cover..."
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}><MapPin size={12} /> Location</label>
                        <input
                            style={inputStyle}
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            placeholder="Room 101, Building A..."
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    {/* Slide */}
                    <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}><FileText size={12} /> Slide Document</label>

                        {meeting.slideUrl && !slideFile && (() => {
                            const isCloudinary = meeting.slideUrl!.includes('cloudinary.com');
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: isCloudinary ? '#f5f3ff' : '#eff6ff', border: `1px solid ${isCloudinary ? '#e9d5ff' : '#bfdbfe'}`, borderRadius: '8px', marginBottom: '8px' }}>
                                    <FileText size={14} color={isCloudinary ? '#7c3aed' : '#3b82f6'} style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isCloudinary ? '#6d28d9' : '#1d4ed8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {isCloudinary ? 'Current slide file' : meeting.slideUrl}
                                    </span>
                                    {isCloudinary ? (
                                        <button type="button" onClick={async () => {
                                            try {
                                                const token = sessionStorage.getItem('token');
                                                let res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/Seminars/meetings/${meetingId}/slide-document/download`, { headers: { Authorization: `Bearer ${token}` } });
                                                if (res.status === 401 && res.url) res = await fetch(res.url);
                                                if (!res.ok) throw new Error('Download failed');
                                                const blob = await res.blob();
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                const cd = res.headers.get('content-disposition');
                                                a.download = cd?.match(/filename="?([^"]+)"?/)?.[1] || meeting.slideUrl!.split('/').pop() || 'slide';
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            } catch { addToast('Failed to download slide.', 'error'); }
                                        }} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#7c3aed', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
                                            <Download size={12} /> Download
                                        </button>
                                    ) : (
                                        <a href={meeting.slideUrl!} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#3b82f6', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                                            <ExternalLink size={12} /> Open
                                        </a>
                                    )}
                                </div>
                            );
                        })()}

                        {slideFile ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: '8px', marginBottom: '8px' }}>
                                <Upload size={14} color="#10b981" style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#065f46', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slideFile.name}</span>
                                <button type="button" onClick={() => setSlideFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0 }}>
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <label style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                padding: '11px', borderRadius: '10px', border: '2px dashed var(--border-color)',
                                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)',
                                background: 'var(--background-color)', transition: 'all 0.2s', marginBottom: '8px'
                            }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.color = 'var(--accent-color)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            >
                                <Upload size={16} /> Upload slide file (PDF, PPTX...)
                                <input type="file" accept=".pdf,.ppt,.pptx" style={{ display: 'none' }} onChange={e => {
                                    const file = e.target.files?.[0] || null;
                                    if (file && file.size > 10485760) { addToast('File must be under 10 MB.', 'error'); e.target.value = ''; return; }
                                    setSlideFile(file);
                                }} />
                            </label>
                        )}

                        <label style={{ ...labelStyle, fontSize: '0.65rem', marginBottom: '4px' }}>
                            <Link2 size={11} /> Or link to external slides (optional)
                        </label>
                        <input
                            style={inputStyle}
                            value={slideUrl}
                            onChange={e => setSlideUrl(e.target.value)}
                            placeholder="https://docs.google.com/presentation/..."
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>
                </div>

                {/* Edit footer */}
                <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: 'auto' }}>
                    <button
                        onClick={handleCancelEdit}
                        style={{ padding: '8px 20px', borderRadius: '10px', border: '1px solid var(--border-color)', background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{ padding: '8px 24px', borderRadius: '10px', border: 'none', background: saving ? '#94a3b8' : 'var(--accent-color)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: saving ? 'none' : '0 4px 12px rgba(232,114,12,0.25)' }}
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save Changes
                    </button>
                </div>
            </div>
        );
    }

    // ===================== VIEW MODE =====================
    const seminarStatusInfo = isInProgress
        ? { label: 'In Progress', color: '#b45309', bg: '#fffbeb', countdownColor: '#b45309' }
        : isUpcoming
            ? { label: 'Upcoming', color: '#3b82f6', bg: '#eff6ff', countdownColor: '#f59e0b' }
            : { label: 'Completed', color: '#10b981', bg: '#ecfdf5', countdownColor: '#94a3b8' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* View header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Presentation size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {meeting.title || 'Seminar Details'}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '3px' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: seminarStatusInfo.color, background: seminarStatusInfo.bg, padding: '2px 8px', borderRadius: '12px' }}>
                                {seminarStatusInfo.label}
                            </span>
                            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: seminarStatusInfo.countdownColor }}>
                                {getCountdown()}
                            </span>
                            {hasSlides ? (
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1px 6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <FileText size={9} /> Slides ready
                                </span>
                            ) : isUpcoming ? (
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '1px 6px' }}>
                                    No slides
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
                {canOpenAiNote && (
                    <button
                        onClick={() => onToggleAINote?.()}
                        title={showAINote ? 'Close AI Notes' : 'Open AI Notes'}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                            fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.2s',
                            minWidth: '108px', whiteSpace: 'nowrap' as const, flexShrink: 0,
                            ...(showAINote
                                ? { border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 4px 16px rgba(99,102,241,0.45)' }
                                : { border: '1.5px solid #c4b5fd', background: '#faf5ff', color: '#7c3aed' })
                        }}
                    >
                        <Sparkles size={14} /> {showAINote ? 'Close Notes' : 'AI Notes'}
                    </button>
                )}
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">

                {/* ── Schedule highlight block ── */}
                <div style={{
                    background: 'linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: '14px',
                    padding: '14px 16px',
                    marginBottom: '14px',
                }}>
                    {/* Date row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Calendar size={14} />
                        </div>
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e3a5f', letterSpacing: '-0.2px' }}>
                            {formatDateOnly(meeting.meetingDate)}
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {/* Time */}
                        <div style={{ background: '#fff', borderRadius: '10px', padding: '10px 12px', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={14} color="#3b82f6" style={{ flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Time</div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e3a5f' }}>
                                    {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
                                </div>
                            </div>
                        </div>

                        {/* Presenter */}
                        <div style={{ background: '#fff', borderRadius: '10px', padding: '10px 12px', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '26px', height: '26px', flexShrink: 0, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>
                                {presenterName[0]?.toUpperCase() || 'P'}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Presenter</div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e3a5f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{presenterName}</div>
                            </div>
                        </div>

                        {/* Location */}
                        {meeting.location && (
                            <div style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: '10px', padding: '10px 12px', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <MapPin size={14} color="#3b82f6" style={{ flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Location</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e3a5f' }}>{meeting.location}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Meeting Link */}
                {meeting.meetingLink && (
                    <div style={{ background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px 14px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Video size={16} color="#10b981" />
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' as const }}>Meeting Link</div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#065f46' }}>Join online</div>
                            </div>
                        </div>
                        <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer" style={{ background: '#10b981', color: '#fff', padding: '7px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}>
                            <ExternalLink size={12} /> Join
                        </a>
                    </div>
                )}

                {/* Recording */}
                {meeting.recordingLink && (
                    <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '12px 14px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Play size={16} color="#3b82f6" />
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1d4ed8' }}>Recording Available</span>
                        </div>
                        <a href={meeting.recordingLink} target="_blank" rel="noopener noreferrer" style={{ background: '#3b82f6', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                            <ExternalLink size={12} /> Watch
                        </a>
                    </div>
                )}

                {/* Description */}
                {meeting.description && (
                    <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.7px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <FileText size={11} /> Description
                        </div>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.65,
                                maxHeight: descExpanded ? 'none' : '80px', overflow: 'hidden',
                                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            }}>
                                {meeting.description}
                            </div>
                            {!descExpanded && (
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '30px', background: 'linear-gradient(transparent, #fff)', pointerEvents: 'none' }} />
                            )}
                        </div>
                        <button onClick={() => setDescExpanded(p => !p)} style={{ marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '3px', padding: 0 }}>
                            {descExpanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
                        </button>
                    </div>
                )}

                {/* Slides */}
                <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.7px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <FileText size={11} /> Slides
                    </div>
                    {meeting.slideUrl ? (() => {
                        const isCloudinary = meeting.slideUrl!.includes('cloudinary.com');
                        return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: isCloudinary ? '#f5f3ff' : '#eff6ff', border: `1px solid ${isCloudinary ? '#e9d5ff' : '#bfdbfe'}`, borderRadius: '10px' }}>
                                <FileText size={16} color={isCloudinary ? '#7c3aed' : '#3b82f6'} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isCloudinary ? '#6d28d9' : '#1d4ed8', flex: 1 }}>
                                    {isCloudinary ? 'Slide document uploaded' : meeting.slideUrl}
                                </span>
                                {isCloudinary ? (
                                    <button type="button" onClick={async () => {
                                        try {
                                            const token = sessionStorage.getItem('token');
                                            let res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/Seminars/meetings/${meetingId}/slide-document/download`, { headers: { Authorization: `Bearer ${token}` } });
                                            if (res.status === 401 && res.url) res = await fetch(res.url);
                                            if (!res.ok) throw new Error('Download failed');
                                            const blob = await res.blob();
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a'); a.href = url;
                                            const cd = res.headers.get('content-disposition');
                                            a.download = cd?.match(/filename="?([^"]+)"?/)?.[1] || meeting.slideUrl!.split('/').pop() || 'slide';
                                            a.click(); URL.revokeObjectURL(url);
                                        } catch { addToast('Failed to download slide.', 'error'); }
                                    }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', background: isCloudinary ? '#7c3aed' : '#3b82f6', color: '#fff', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                                        <Download size={12} /> Download
                                    </button>
                                ) : (
                                    <a href={meeting.slideUrl!} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', background: '#3b82f6', color: '#fff', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                                        <ExternalLink size={12} /> Open
                                    </a>
                                )}
                            </div>
                        );
                    })() : (
                        <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>
                            No slides uploaded yet.
                        </div>
                    )}
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Created {formatDisplayDate(meeting.createdAt)}</span>
                    {meeting.updatedAt && <><span>·</span><span>Updated {formatDisplayDate(meeting.updatedAt)}</span></>}
                </div>
            </div>

            {/* View footer */}
            <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: 'auto' }}>
                <div>
                    {canEdit && isUpcoming && (
                        <button
                            onClick={() => { setSwapAccordionOpen(p => !p); if (!swapAccordionOpen) handleOpenSwapForm(); }}
                            style={{ padding: '8px 16px', borderRadius: '10px', border: swapAccordionOpen ? '1.5px solid #7c3aed' : '1px solid #e9d5ff', background: swapAccordionOpen ? '#f5f3ff' : '#faf5ff', color: '#7c3aed', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <ArrowLeftRight size={14} /> Request Swap
                            {swapAccordionOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: '10px', border: '1px solid var(--border-color)', background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                        Close
                    </button>
                    {canEdit && (
                        <button
                            onClick={() => setIsEditMode(true)}
                            style={{ padding: '8px 20px', borderRadius: '10px', border: '1.5px solid var(--accent-color)', background: '#fff', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Pencil size={14} /> Edit
                        </button>
                    )}
                </div>
            </div>

            {/* Swap Modal */}
            {canEdit && swapAccordionOpen && (
                <div onClick={() => setSwapAccordionOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.38)', backdropFilter: 'blur(4px)', zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div onClick={e => e.stopPropagation()} style={{ width: 'min(820px, 96vw)', maxHeight: 'min(82vh, 760px)', background: '#fff', borderRadius: '18px', border: '1px solid #e9d5ff', boxShadow: '0 25px 50px -12px rgba(15,23,42,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #efe7ff', background: 'linear-gradient(135deg, #faf5ff, #f5f3ff)' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase' as const, letterSpacing: '0.7px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ArrowLeftRight size={13} /> Request Session Swap
                            </div>
                            <button onClick={() => setSwapAccordionOpen(false)} style={{ border: 'none', background: 'transparent', color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ padding: '14px 16px', overflowY: 'auto' }} className="custom-scrollbar">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }}>
                                        Swap With <span style={{ color: '#ef4444' }}>*</span>
                                    </div>
                                    <div style={{ border: `1.5px solid ${swapTargetId ? '#7c3aed' : '#e9d5ff'}`, borderRadius: '10px', overflow: 'hidden', maxHeight: '220px', overflowY: 'auto', background: '#fff' }} className="custom-scrollbar">
                                        {allMeetings.length === 0 ? (
                                            <div style={{ padding: '10px 12px', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>No other sessions available.</div>
                                        ) : allMeetings.map(m => {
                                            const isSel = swapTargetId === m.seminarMeetingId;
                                            return (
                                                <div key={m.seminarMeetingId} onClick={() => setSwapTargetId(m.seminarMeetingId)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', background: isSel ? '#f5f3ff' : 'transparent', borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                                                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#faf5ff'; }}
                                                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <div style={{ width: '14px', height: '14px', flexShrink: 0, borderRadius: '50%', border: `2px solid ${isSel ? '#7c3aed' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {isSel && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7c3aed' }} />}
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.8rem', fontWeight: isSel ? 700 : 600, color: isSel ? '#6d28d9' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title || 'Untitled'}</div>
                                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{new Date(m.meetingDate).toLocaleDateString('vi-VN')}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '4px' }}>
                                            Reason <span style={{ fontWeight: 500, textTransform: 'none' as const }}>(optional)</span>
                                        </div>
                                        <textarea value={swapReason} onChange={e => setSwapReason(e.target.value)} placeholder="Why do you need to swap?" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e9d5ff', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', minHeight: '84px', resize: 'vertical' as const, background: '#fff', boxSizing: 'border-box' as const }}
                                            onFocus={e => { e.currentTarget.style.borderColor = '#7c3aed'; }}
                                            onBlur={e => { e.currentTarget.style.borderColor = '#e9d5ff'; }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 16px', borderTop: '1px solid #efe7ff', background: '#fff' }}>
                            <button onClick={() => setSwapAccordionOpen(false)} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                                Cancel
                            </button>
                            <button onClick={() => setShowSwapConfirm(true)} disabled={!swapTargetId}
                                style={{ padding: '8px 14px', borderRadius: '10px', border: 'none', background: !swapTargetId ? '#e2e8f0' : '#7c3aed', color: '#fff', cursor: !swapTargetId ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: !swapTargetId ? 'none' : '0 4px 12px rgba(124,58,237,0.3)' }}>
                                <ArrowLeftRight size={13} /> Submit Swap Request
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={showSwapConfirm}
                onClose={() => setShowSwapConfirm(false)}
                onConfirm={() => { setShowSwapConfirm(false); handleSubmitSwap(); }}
                title="Confirm Swap Request"
                message={<span>Are you sure you want to submit this swap request?<br />The other presenter will be notified and must accept before the swap takes effect.</span>}
                confirmText={submittingSwap ? 'Submitting...' : 'Submit Swap'}
                cancelText="Go Back"
                variant="info"
            />
        </div>
    );
};

export default SeminarPanel;
