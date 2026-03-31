import React, { useState, useEffect } from 'react';
import { SeminarMeetingResponse, UpdateSeminarMeetingRequest } from '@/types/seminar';
import seminarService from '@/services/seminarService';
import {
    Save,
    Loader2,
    ExternalLink,
    Presentation,
    Link2,
    Play,
    Calendar,
    MapPin,
    FileText
} from 'lucide-react';

interface SeminarPanelProps {
    meetingId: string | null;
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string) => void;
    onTitleChange?: (title: string) => void;
    usersMap: Record<string, string>;
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
    usersMap
}) => {
    const [meeting, setMeeting] = useState<SeminarMeetingResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Editable fields
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [slideUrl, setSlideUrl] = useState('');

    useEffect(() => {
        if (meetingId) {
            loadMeetingFromList(meetingId);
        }
    }, [meetingId]);

    const loadMeetingFromList = async (id: string) => {
        setLoading(true);
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
                setSlideUrl(found.slideUrl || '');
                onTitleChange?.(found.title || 'Seminar');
            }
        } catch (err) {
            console.error('Failed to load seminar meeting:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!meetingId || !meeting) return;
        setSaving(true);
        try {
            const req: UpdateSeminarMeetingRequest = {
                title: title.trim() || null,
                description: description.trim() || null,
                slideUrl: slideUrl.trim() || null
            };
            await seminarService.updateSeminarMeeting(meetingId, req);
            onSaved(false, 'Seminar meeting updated successfully.');
            loadMeetingFromList(meetingId);
        } catch (err: any) {
            console.error('Save failed:', err);
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to update seminar meeting.';
            alert(msg);
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Panel Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                        <Presentation size={16} />
                    </div>
                    <div>
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

                {/* Editable Fields */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={12} /> Editable Details</div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Title</label>
                        <input
                            style={inputStyle}
                            value={title}
                            onChange={e => {
                                setTitle(e.target.value);
                                onTitleChange?.(e.target.value || 'Seminar');
                            }}
                            placeholder="Seminar title..."
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Description</label>
                        <textarea
                            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' as const }}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Seminar description, topics to cover..."
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>
                            <Link2 size={12} /> Slide URL
                        </label>
                        <input
                            style={inputStyle}
                            value={slideUrl}
                            onChange={e => setSlideUrl(e.target.value)}
                            placeholder="https://docs.google.com/presentation/..."
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-color)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                        {slideUrl && (
                            <a
                                href={slideUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.72rem',
                                    color: '#6366f1',
                                    fontWeight: 700,
                                    marginTop: '6px',
                                    textDecoration: 'none'
                                }}
                            >
                                <ExternalLink size={12} /> Open Slides
                            </a>
                        )}
                    </div>
                </div>

                {/* Meta */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={12} /> Metadata</div>
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
                        fontWeight: 700,
                        transition: 'all 0.2s'
                    }}
                >
                    Close
                </button>
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
            </div>
        </div>
    );
};

export default SeminarPanel;
