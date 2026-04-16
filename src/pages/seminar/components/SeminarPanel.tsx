import React, { useState, useEffect } from 'react';
import { SeminarMeetingResponse, UpdateSeminarMeetingRequest, CreateSeminarSwapRequest } from '@/types/seminar';
import seminarService from '@/services/seminarService';
import { API_BASE_URL } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useToastStore } from '@/store/slices/toastSlice';
import DateTimePicker from '@/components/common/DateTimePicker';
import Modal from '@/components/common/Modal';
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
    Lock,
    ArrowLeftRight,
    Mic,
    FileSearch,
    Upload,
    Download,
    X
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
    padding: '16px',
    background: 'var(--background-color)',
    borderRadius: '12px',
    border: '1px solid var(--border-light)',
    marginBottom: '16px'
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
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
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
    initialData
}) => {
    const { user } = useAuth();
    const [meeting, setMeeting] = useState<SeminarMeetingResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { addToast } = useToastStore();

    // Editable fields
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [slideUrl, setSlideUrl] = useState('');
    const [slideFile, setSlideFile] = useState<File | null>(null);

    // Swap request
    const [showSwapForm, setShowSwapForm] = useState(false);
    const [allMeetings, setAllMeetings] = useState<SeminarMeetingResponse[]>([]);
    const [swapTargetId, setSwapTargetId] = useState('');
    const [swapReason, setSwapReason] = useState('');
    const [swapExpiry, setSwapExpiry] = useState('');
    const [submittingSwap, setSubmittingSwap] = useState(false);
    const [showSwapConfirm, setShowSwapConfirm] = useState(false);

    useEffect(() => {
        if (meetingId) {
            // If we have initial data, use it immediately to avoid "loading..." flicker
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
                setShowSwapForm(false);
                setAllMeetings([]);
                setSwapTargetId('');
                setSwapReason('');
                setSwapExpiry('');
                loadMeetingFromList(meetingId, false); // Normal load with spinner
            }
        }
    }, [meetingId]);

    const loadMeetingFromList = async (id: string, silent: boolean = false) => {
        if (!silent) setLoading(true);
        try {
            // Try to find in My Meetings first
            let allMeetings = await seminarService.getMySeminarMeetings();
            let found = allMeetings.find(m => m.seminarMeetingId === id);
            
            // If not found, try All Meetings (public view)
            if (!found) {
                allMeetings = await seminarService.getAllSeminarMeetings();
                found = allMeetings.find(m => m.seminarMeetingId === id);
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
        setShowSwapForm(true);
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
            setShowSwapForm(false);
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

    const presenterName = usersMap[meeting.presenterId] || 'Unknown Presenter';
    const isUpcoming = new Date(meeting.meetingDate).getTime() > Date.now();
    const presenterEmail = emailsMap[meeting.presenterId];
    const canEdit = !!user?.email && !!presenterEmail && user.email.toLowerCase() === presenterEmail.toLowerCase();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Panel Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <Presentation size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {meeting.title || 'Seminar Details'}
                        </h3>
                        <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: isUpcoming ? '#3b82f6' : '#10b981',
                            background: isUpcoming ? '#eff6ff' : '#ecfdf5',
                            padding: '2px 8px',
                            borderRadius: '12px'
                        }}>
                            {isUpcoming ? 'Upcoming' : 'Completed'}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                    {onToggleAINote && (
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
                </div>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                {/* Meeting Link */}
                {meeting.meetingLink && (
                    <div style={{
                        ...sectionStyle,
                        background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Link2 size={18} color="#10b981" />
                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' as const }}>Meeting Link</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#065f46' }}>Join online</div>
                            </div>
                        </div>
                        <a
                            href={meeting.meetingLink}
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
                                textDecoration: 'none',
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                            }}
                        >
                            <ExternalLink size={14} /> Join
                        </a>
                    </div>
                )}

                {/* Recording Link */}
                {meeting.recordingLink && (
                    <div style={{
                        ...sectionStyle,
                        background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                        border: '1px solid #bfdbfe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Play size={18} color="#3b82f6" />
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1d4ed8' }}>Recording Available</span>
                        </div>
                        <a
                            href={meeting.recordingLink}
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
                                textDecoration: 'none'
                            }}
                        >
                            <ExternalLink size={12} /> Watch
                        </a>
                    </div>
                )}

                {/* Meeting Info (readonly) */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><Calendar size={12} /> Schedule Info</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>Date</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {formatDateOnly(meeting.meetingDate)}
                            </div>
                        </div>
                        <div style={{ padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>Time</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {formatTime(meeting.startTime)} — {formatTime(meeting.endTime)}
                            </div>
                        </div>
                        <div style={{ padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>Presenter</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    flexShrink: 0,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.65rem',
                                    fontWeight: 700
                                }}>
                                    {presenterName[0]?.toUpperCase() || 'P'}
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{presenterName}</span>
                            </div>
                        </div>
                        {meeting.location && (
                            <div style={{ padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>Location</div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <MapPin size={14} color="var(--accent-color)" />
                                    {meeting.location}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Editable Details / Readonly Notice */}
                {!canEdit && (
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
                                Only the presenter can edit this seminar session.
                            </div>
                        </div>
                    </div>
                )}

                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={12} /> {canEdit ? 'Editable Details' : 'Details'}</div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Title</label>
                        <input
                            style={{ ...inputStyle, ...(canEdit ? {} : { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' }) }}
                            value={title}
                            onChange={e => {
                                if (!canEdit) return;
                                setTitle(e.target.value);
                                onTitleChange?.(e.target.value || 'Seminar');
                            }}
                            readOnly={!canEdit}
                            placeholder="Seminar title..."
                            onFocus={e => { if (canEdit) { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; } }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Description</label>
                        <textarea
                            style={{ ...inputStyle, minHeight: '80px', resize: canEdit ? ('vertical' as const) : ('none' as const), ...(canEdit ? {} : { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' }) }}
                            value={description}
                            onChange={e => { if (canEdit) setDescription(e.target.value); }}
                            readOnly={!canEdit}
                            placeholder="Seminar description, topics to cover..."
                            onFocus={e => { if (canEdit) { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; } }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    {/* Location (editable) */}
                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}><MapPin size={12} /> Location</label>
                        <input
                            style={{ ...inputStyle, ...(canEdit ? {} : { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' }) }}
                            value={location}
                            onChange={e => { if (canEdit) setLocation(e.target.value); }}
                            readOnly={!canEdit}
                            placeholder="Room 101, Building A..."
                            onFocus={e => { if (canEdit) { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; } }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    {/* Slide Document */}
                    <div>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>
                            <FileText size={12} /> Slide Document
                        </label>

                        {/* Existing slide link */}
                        {meeting.slideUrl && !slideFile && (() => {
                            const isCloudinary = meeting.slideUrl!.includes('cloudinary.com');
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: isCloudinary ? '#f5f3ff' : '#eff6ff', border: `1px solid ${isCloudinary ? '#e9d5ff' : '#bfdbfe'}`, borderRadius: '8px', marginBottom: '8px' }}>
                                    <FileText size={14} color={isCloudinary ? '#7c3aed' : '#3b82f6'} style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isCloudinary ? '#6d28d9' : '#1d4ed8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {isCloudinary ? 'Current slide file' : meeting.slideUrl}
                                    </span>
                                    {isCloudinary ? (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    const token = sessionStorage.getItem('token');
                                                    let res = await fetch(
                                                        `${API_BASE_URL.replace(/\/$/, '')}/api/Seminars/meetings/${meetingId}/slide-document/download`,
                                                        { headers: { Authorization: `Bearer ${token}` } }
                                                    );
                                                    if (res.status === 401 && res.url) {
                                                        res = await fetch(res.url);
                                                    }
                                                    if (!res.ok) throw new Error('Download failed');
                                                    const blob = await res.blob();
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    const cd = res.headers.get('content-disposition');
                                                    a.download = cd?.match(/filename="?([^"]+)"?/)?.[1]
                                                        || meeting.slideUrl!.split('/').pop() || 'slide';
                                                    a.click();
                                                    URL.revokeObjectURL(url);
                                                } catch {
                                                    addToast('Failed to download slide.', 'error');
                                                }
                                            }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#7c3aed', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}
                                        >
                                            <Download size={12} /> Download
                                        </button>
                                    ) : (
                                        <a
                                            href={meeting.slideUrl!}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#3b82f6', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
                                        >
                                            <ExternalLink size={12} /> Open
                                        </a>
                                    )}
                                </div>
                            );
                        })()}

                        {/* File picker (edit only) */}
                        {canEdit && (
                            <>
                                {slideFile ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: '8px', marginBottom: '8px' }}>
                                        <Upload size={14} color="#10b981" style={{ flexShrink: 0 }} />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#065f46', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {slideFile.name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setSlideFile(null)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0 }}
                                        >
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
                                                        if (file && file.size > 10485760) {
                                                            addToast('File must be under 10 MB.', 'error');
                                                            e.target.value = '';
                                                            return;
                                                        }
                                                        setSlideFile(file);
                                                    }} />
                                    </label>
                                )}

                                {/* Optional external link */}
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
                            </>
                        )}

                        {/* Read-only: show external link if any */}
                        {!canEdit && slideUrl && (
                            <a href={slideUrl} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#6366f1', fontWeight: 700, textDecoration: 'underline' }}>
                                <ExternalLink size={12} /> Open External Slides
                            </a>
                        )}
                    </div>
                </div>

                {/* Meta */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={12} /> Record Information</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ padding: '8px 12px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>Created At</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatDisplayDate(meeting.createdAt)}</div>
                        </div>
                        {meeting.updatedAt && (
                            <div style={{ padding: '8px 12px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>Updated At</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatDisplayDate(meeting.updatedAt)}</div>
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
                justifyContent: 'space-between',
                gap: '10px',
                marginTop: 'auto'
            }}>
                <div>
                    {canEdit && (
                        <button
                            onClick={handleOpenSwapForm}
                            style={{
                                padding: '8px 16px', borderRadius: '10px',
                                border: '1px solid #e9d5ff', background: '#f5f3ff',
                                color: '#7c3aed', cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <ArrowLeftRight size={14} /> Request Swap
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
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
                            fontWeight: 700,
                            transition: 'all 0.2s'
                        }}
                    >
                        Close
                    </button>
                    {canEdit && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                padding: '8px 24px',
                                borderRadius: '10px',
                                border: 'none',
                                background: saving ? '#94a3b8' : 'var(--accent-color)',
                                color: '#fff',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s',
                                boxShadow: saving ? 'none' : '0 4px 12px rgba(232,114,12,0.25)'
                            }}
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save Changes
                        </button>
                    )}
                </div>
            </div>

            {/* Swap Request Modal */}
            <Modal
                isOpen={showSwapForm}
                onClose={() => { setShowSwapForm(false); setSwapTargetId(''); setSwapReason(''); setSwapExpiry(''); }}
                title="Request Session Swap"
                maxWidth="780px"
                disableBackdropClose={true}
                footer={
                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                        <button
                            onClick={() => { setShowSwapForm(false); setSwapTargetId(''); setSwapReason(''); setSwapExpiry(''); }}
                            className="btn btn-secondary"
                            style={{ flex: 1, padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600, border: '1px solid #e2e8f0' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => setShowSwapConfirm(true)}
                            disabled={!swapTargetId}
                            style={{
                                flex: 2, padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none',
                                background: !swapTargetId ? '#e2e8f0' : '#7c3aed',
                                color: '#fff', cursor: !swapTargetId ? 'not-allowed' : 'pointer',
                                fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                boxShadow: !swapTargetId ? 'none' : '0 4px 12px rgba(124,58,237,0.3)',
                                transition: 'all 0.2s'
                            }}
                        >
                            <ArrowLeftRight size={15} /> Review & Submit
                        </button>
                    </div>
                }
            >
                <div style={{ padding: '0 1.75rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
                    {/* LEFT: Swap visual */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {/* Your session (readonly chip) */}
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Your Session</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '12px 12px 0 0', borderBottom: 'none' }}>
                            <div style={{ width: '28px', height: '28px', flexShrink: 0, borderRadius: '8px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Presentation size={14} color="#6366f1" />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                                    {meeting.title || 'Untitled'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '1px' }}>
                                    {new Date(meeting.meetingDate).toLocaleDateString('vi-VN')}
                                </div>
                            </div>
                        </div>

                        {/* Arrow connector */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '28px', background: '#f5f3ff', borderLeft: '1px solid #e9d5ff', borderRight: '1px solid #e9d5ff', position: 'relative' }}>
                            <div style={{ width: '1px', height: '100%', background: '#c4b5fd', position: 'absolute' }} />
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                                <ArrowLeftRight size={12} color="#fff" />
                            </div>
                        </div>

                        {/* Target session list */}
                        <div style={{ border: `1.5px solid ${swapTargetId ? '#7c3aed' : '#e9d5ff'}`, borderRadius: '0 0 12px 12px', transition: 'all 0.2s', overflow: 'hidden' }}>
                            <div style={{ padding: '6px 14px 4px', fontSize: '0.65rem', fontWeight: 700, color: swapTargetId ? '#7c3aed' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', background: swapTargetId ? '#faf5ff' : '#fff' }}>
                                Swap With <span style={{ color: '#ef4444' }}>*</span>
                            </div>
                            <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#fff' }} className="custom-scrollbar">
                                {allMeetings.length === 0 ? (
                                    <div style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>No other sessions available.</div>
                                ) : (
                                    allMeetings.map(m => {
                                        const isSelected = swapTargetId === m.seminarMeetingId;
                                        return (
                                            <div
                                                key={m.seminarMeetingId}
                                                onClick={() => setSwapTargetId(m.seminarMeetingId)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '10px',
                                                    padding: '8px 14px', cursor: 'pointer', transition: 'background 0.15s',
                                                    background: isSelected ? '#f5f3ff' : 'transparent',
                                                    borderTop: '1px solid #f1f5f9'
                                                }}
                                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#faf5ff'; }}
                                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <div style={{ width: '16px', height: '16px', flexShrink: 0, borderRadius: '50%', border: `2px solid ${isSelected ? '#7c3aed' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                                                    {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7c3aed' }} />}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: isSelected ? 700 : 600, color: isSelected ? '#6d28d9' : 'var(--text-primary)', lineHeight: 1.3 }}>
                                                        {m.title || 'Untitled'}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                        {new Date(m.meetingDate).toLocaleDateString('vi-VN')}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Reason + Expires At */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* Reason */}
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}>
                                Reason <span style={{ color: 'var(--text-muted)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                            </label>
                            <textarea
                                value={swapReason}
                                onChange={e => setSwapReason(e.target.value)}
                                placeholder="Briefly explain why you need to swap..."
                                style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #e9d5ff', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', minHeight: '90px', resize: 'none' as const, background: '#fff', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                                onFocus={e => { e.currentTarget.style.borderColor = '#7c3aed'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = '#e9d5ff'; }}
                            />
                        </div>

                        {/* Expires At */}
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.68rem' }}>
                                Expires At <span style={{ color: 'var(--text-muted)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                            </label>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input
                                    type="date"
                                    min={new Date().toISOString().split('T')[0]}
                                    value={swapExpiry ? swapExpiry.split('T')[0] : ''}
                                    onChange={e => {
                                        const d = e.target.value;
                                        const h = swapExpiry ? new Date(swapExpiry).getHours() : 17;
                                        setSwapExpiry(d ? `${d}T${String(h).padStart(2, '0')}:00:00` : '');
                                    }}
                                    style={{ flex: 1, padding: '8px 8px', borderRadius: '10px', border: '1.5px solid #e9d5ff', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', background: '#fff', color: 'var(--text-primary)', minWidth: 0 }}
                                />
                                <select
                                    value={swapExpiry ? new Date(swapExpiry).getHours() : ''}
                                    onChange={e => {
                                        const h = e.target.value;
                                        const d = swapExpiry ? swapExpiry.split('T')[0] : new Date().toISOString().split('T')[0];
                                        setSwapExpiry(h !== '' ? `${d}T${String(h).padStart(2, '0')}:00:00` : '');
                                    }}
                                    disabled={!swapExpiry}
                                    style={{ width: '80px', flexShrink: 0, padding: '8px 6px', borderRadius: '10px', border: '1.5px solid #e9d5ff', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', background: swapExpiry ? '#fff' : '#f8fafc', color: swapExpiry ? 'var(--text-primary)' : '#94a3b8', cursor: swapExpiry ? 'pointer' : 'not-allowed' }}
                                >
                                    {[7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map(i => (
                                        <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                                    ))}
                                </select>
                            </div>
                            {swapExpiry && (
                                <button
                                    type="button"
                                    onClick={() => setSwapExpiry('')}
                                    style={{ marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#94a3b8', padding: 0, display: 'flex', alignItems: 'center', gap: '3px' }}
                                >
                                    <X size={11} /> Clear expiry
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Swap Confirm Modal */}
            <ConfirmModal
                isOpen={showSwapConfirm}
                onClose={() => setShowSwapConfirm(false)}
                onConfirm={() => { setShowSwapConfirm(false); handleSubmitSwap(); }}
                title="Confirm Swap Request"
                message={
                    <span>
                        Are you sure you want to submit this swap request?<br />
                        The other presenter will be notified and must accept before the swap takes effect.
                    </span>
                }
                confirmText={submittingSwap ? 'Submitting...' : 'Submit Swap'}
                cancelText="Go Back"
                variant="info"
            />
        </div>
    );
};

export default SeminarPanel;
