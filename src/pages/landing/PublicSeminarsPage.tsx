import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    BookOpen,
    Calendar,
    ChevronDown,
    ChevronRight,
    Clock,
    ExternalLink,
    FileText,
    FileVideo,
    Folder,
    Link2,
    Mail,
    MapPin,
    Presentation,
    Search,
    User,
    Users,
    X,
} from 'lucide-react';
import seminarService from '@/services/seminarService';
import type { SeminarMeetingResponse } from '@/types/seminar';
import logo from '@/assets/aita.png';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDateOnly = (v?: string | null) => {
    if (!v) return 'N/A';
    const d = new Date(v);
    if (isNaN(d.getTime())) return 'N/A';
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const formatTimeRange = (start?: string | null, end?: string | null) => {
    const fmt = (v?: string | null) => {
        if (!v) return '';
        const match = v.match(/T(\d{2}:\d{2})/);
        if (match) return match[1];
        return v.slice(0, 5);
    };
    const s = fmt(start);
    const e = fmt(end);
    if (s && e) return `${s} – ${e}`;
    return s || e || '';
};

const getRelativeDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    d.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff <= 7) return `In ${diff} days`;
    if (diff < -1 && diff >= -7) return `${Math.abs(diff)} days ago`;
    return null;
};

const isUpcomingMeeting = (m: SeminarMeetingResponse) =>
    new Date(m.meetingDate).getTime() > Date.now();

const getMeetingStatus = (m: SeminarMeetingResponse): 'live' | 'upcoming' | 'past' => {
    const now = Date.now();
    const start = new Date(m.startTime).getTime();
    const end = new Date(m.endTime).getTime();
    if (now >= start && now <= end) return 'live';
    if (now > end) return 'past';
    return 'upcoming';
};

const getSessionLabel = (m: SeminarMeetingResponse, idx: number) =>
    m.title?.includes(' - ')
        ? m.title.split(' - ').slice(1).join(' - ')
        : (m.title || `Week ${idx + 1}`);

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
    meeting: SeminarMeetingResponse;
    weekIdx: number;
    seriesTitle: string;
    onClose: () => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ meeting, weekIdx, seriesTitle, onClose }) => {
    const status = getMeetingStatus(meeting);
    const relDate = getRelativeDate(meeting.meetingDate);
    const sessionLabel = getSessionLabel(meeting, weekIdx);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            height: '100%', overflow: 'hidden',
            background: '#fff', borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 12px -4px rgba(30,41,59,0.1)',
            animation: 'pubPanelIn 0.2s cubic-bezier(0,0,0.2,1) both',
        }}>
            {/* Red bar only for Live, none otherwise */}
            {status === 'live' && (
                <div style={{ height: '3px', background: '#ef4444', flexShrink: 0 }} />
            )}

            {/* Header */}
            <div style={{ padding: '1rem 1.1rem 0.85rem', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.6rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px', flexWrap: 'wrap' }}>
                            <span style={{
                                fontSize: '0.63rem', fontWeight: 600, color: '#64748b',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px',
                            }}>
                                {seriesTitle}
                            </span>
                            <span style={{ color: '#cbd5e1' }}>·</span>
                            {status === 'live' ? (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    fontSize: '0.63rem', fontWeight: 700, color: '#b91c1c',
                                    background: '#fee2e2', padding: '1px 6px', borderRadius: '4px',
                                }}>
                                    <span style={{
                                        width: '5px', height: '5px', borderRadius: '50%',
                                        background: '#ef4444', display: 'inline-block',
                                        animation: 'pubPulse 1.2s ease-in-out infinite',
                                    }} />
                                    Live Now
                                </span>
                            ) : (
                                <span style={{ fontSize: '0.63rem', fontWeight: 600, color: '#94a3b8' }}>
                                    {status === 'upcoming' ? 'Upcoming' : 'Completed'}
                                </span>
                            )}
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.4 }}>
                            {sessionLabel}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        title="Close (Esc)"
                        style={{
                            flexShrink: 0, width: '28px', height: '28px',
                            borderRadius: '7px', border: '1px solid #e2e8f0',
                            background: '#f8fafc', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#94a3b8',
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.1rem 1.2rem' }} className="custom-scrollbar">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>

                    {/* Date / Time / Location / Attendees */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                        gap: '0.5rem 1rem',
                        padding: '0.7rem 0.85rem',
                        background: '#f8fafc', borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                    }}>
                        <InfoCell icon={<Calendar size={12} color="#94a3b8" />} label="Date">
                            {formatDateOnly(meeting.meetingDate)}
                            {relDate && (
                                <span style={{ color: status === 'live' ? '#b91c1c' : '#94a3b8', fontSize: '0.7rem', marginLeft: '4px' }}>
                                    ({relDate})
                                </span>
                            )}
                        </InfoCell>
                        <InfoCell icon={<Clock size={12} color="#94a3b8" />} label="Time">
                            {formatTimeRange(meeting.startTime, meeting.endTime) || '—'}
                        </InfoCell>
                        {meeting.location && (
                            <InfoCell icon={<MapPin size={12} color="#94a3b8" />} label="Location" fullWidth>
                                {meeting.location}
                            </InfoCell>
                        )}
                        {meeting.attendeeCount > 0 && (
                            <InfoCell icon={<Users size={12} color="#94a3b8" />} label="Attendees">
                                {meeting.attendeeCount} registered
                            </InfoCell>
                        )}
                    </div>

                    {/* Presenter */}
                    {meeting.presenter?.name && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.65rem',
                            padding: '0.65rem 0.85rem',
                            background: '#f8fafc', borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                        }}>
                            <div style={{
                                width: '34px', height: '34px', borderRadius: '50%',
                                background: '#e2e8f0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                                <User size={16} color="#64748b" />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                                    {meeting.presenter.name}
                                </div>
                                {meeting.presenter.email && (
                                    <a
                                        href={`mailto:${meeting.presenter.email}`}
                                        style={{
                                            fontSize: '0.72rem', color: '#64748b',
                                            display: 'flex', alignItems: 'center', gap: '3px',
                                            textDecoration: 'none', marginTop: '1px',
                                        }}
                                    >
                                        <Mail size={10} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {meeting.presenter.email}
                                        </span>
                                    </a>
                                )}
                                {meeting.presenter.topic && (
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                                        {meeting.presenter.topic}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {meeting.description && (
                        <div>
                            <SectionLabel>Description</SectionLabel>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.7 }}>
                                {meeting.description}
                            </p>
                        </div>
                    )}

                    {/* Resources */}
                    {(meeting.meetingLink || meeting.recordingLink || meeting.slideUrl) && (
                        <div>
                            <SectionLabel>Resources</SectionLabel>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {meeting.meetingLink && (
                                    /* Join Meeting — primary action, keep color */
                                    <a
                                        href={meeting.meetingLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '0.55rem 0.8rem', borderRadius: '9px',
                                            background: status === 'live' ? '#fee2e2' : '#1e293b',
                                            border: status === 'live' ? '1px solid #fecaca' : 'none',
                                            color: status === 'live' ? '#b91c1c' : '#fff',
                                            textDecoration: 'none', fontWeight: 700, fontSize: '0.82rem',
                                            transition: 'opacity 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                            <Link2 size={14} />
                                            {status === 'live' ? 'Join Live Meeting' : 'Join Meeting'}
                                        </span>
                                        <ExternalLink size={12} />
                                    </a>
                                )}
                                {meeting.recordingLink && (
                                    <ResourceLink href={meeting.recordingLink} icon={<FileVideo size={14} />} label="Watch Recording" />
                                )}
                                {meeting.slideUrl && (
                                    <ResourceLink href={meeting.slideUrl} icon={<FileText size={14} />} label="View Slides" />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{
        fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px',
    }}>
        {children}
    </div>
);

const InfoCell: React.FC<{
    icon: React.ReactNode; label: string; fullWidth?: boolean; children: React.ReactNode;
}> = ({ icon, label, fullWidth, children }) => (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : undefined, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
        </span>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {icon}{children}
        </span>
    </div>
);

const ResourceLink: React.FC<{ href: string; icon: React.ReactNode; label: string }> = ({ href, icon, label }) => (
    <a
        href={href}
        target="_blank"
        rel="noreferrer"
        style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.55rem 0.8rem', borderRadius: '9px',
            background: '#f8fafc', border: '1px solid #e2e8f0',
            color: '#374151',
            textDecoration: 'none', fontWeight: 600, fontSize: '0.82rem',
            transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
        onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
    >
        <span style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#475569' }}>{icon}{label}</span>
        <ExternalLink size={12} color="#94a3b8" />
    </a>
);

// ─── Session Row ─────────────────────────────────────────────────────────────

interface SessionRowProps {
    meeting: SeminarMeetingResponse;
    weekIdx: number;
    isSelected: boolean;
    onSelect: (m: SeminarMeetingResponse) => void;
}

const SessionRow: React.FC<SessionRowProps> = ({ meeting, weekIdx, isSelected, onSelect }) => {
    const [hovered, setHovered] = React.useState(false);
    const upcoming = isUpcomingMeeting(meeting);
    const status = getMeetingStatus(meeting);
    const relDate = getRelativeDate(meeting.meetingDate);
    const sessionLabel = getSessionLabel(meeting, weekIdx);

    const borderLeft = isSelected
        ? '3px solid #1e293b'
        : status === 'live' ? '3px solid #ef4444'
        : '3px solid transparent';

    const bg = isSelected ? '#f8fafc'
        : hovered ? '#f8fafc'
        : upcoming ? '#fff' : '#fafafa';

    return (
        <div
            onClick={() => onSelect(meeting)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                padding: '9px 11px 9px 13px',
                borderRadius: '9px',
                background: bg,
                border: `1px solid ${isSelected ? '#e2e8f0' : hovered ? '#e2e8f0' : 'transparent'}`,
                borderLeft,
                transition: 'all 0.12s',
                display: 'flex', flexDirection: 'column', gap: '4px',
                opacity: upcoming ? 1 : 0.65,
                cursor: 'pointer',
            }}
        >
            {/* Title row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{
                    fontSize: '0.82rem', fontWeight: 700,
                    color: '#1e293b',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {sessionLabel}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {status === 'live' && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            fontSize: '0.6rem', fontWeight: 700, color: '#b91c1c',
                            background: '#fee2e2', borderRadius: '4px', padding: '1px 5px',
                        }}>
                            <span style={{
                                width: '5px', height: '5px', borderRadius: '50%',
                                background: '#ef4444', display: 'inline-block',
                                animation: 'pubPulse 1.2s ease-in-out infinite',
                            }} />
                            Live
                        </span>
                    )}
                    {meeting.slideUrl && <FileText size={11} color="#94a3b8" />}
                    {meeting.recordingLink && <FileVideo size={11} color="#94a3b8" />}
                    {meeting.attendeeCount > 0 && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '2px',
                            fontSize: '0.62rem', fontWeight: 600, color: '#64748b',
                            background: '#f1f5f9', borderRadius: '4px', padding: '1px 4px',
                        }}>
                            <Users size={8} />{meeting.attendeeCount}
                        </span>
                    )}
                </div>
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                    <Calendar size={10} color="#94a3b8" />
                    {formatDateOnly(meeting.meetingDate)}
                    {relDate && (
                        <span style={{ color: status === 'live' ? '#b91c1c' : '#94a3b8', marginLeft: '2px' }}>
                            · {relDate}
                        </span>
                    )}
                </span>
                {(meeting.startTime || meeting.endTime) && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                        <Clock size={10} color="#94a3b8" />{formatTimeRange(meeting.startTime, meeting.endTime)}
                    </span>
                )}
                {meeting.presenter?.name && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                        <User size={10} color="#94a3b8" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                            {meeting.presenter.name}
                        </span>
                    </span>
                )}
            </div>
        </div>
    );
};

// ─── Series Group ─────────────────────────────────────────────────────────────

interface SeriesGroupProps {
    title: string;
    meetings: SeminarMeetingResponse[];
    isExpanded: boolean;
    selectedId: string | null;
    onToggle: () => void;
    onSelect: (m: SeminarMeetingResponse) => void;
}

const SeriesGroup: React.FC<SeriesGroupProps> = ({ title, meetings, isExpanded, selectedId, onToggle, onSelect }) => {
    const upcomingMeetings = meetings.filter(isUpcomingMeeting);
    const pastMeetings = meetings.filter(m => !isUpcomingMeeting(m));
    const nextSession = upcomingMeetings[0] ?? null;
    const hasSelected = meetings.some(m => m.seminarMeetingId === selectedId);

    return (
        <div style={{
            background: '#fff',
            borderRadius: '12px',
            border: `1px solid ${hasSelected ? '#cbd5e1' : '#e2e8f0'}`,
            overflow: 'hidden',
            transition: 'border-color 0.15s',
        }}>
            <div
                onClick={onToggle}
                style={{
                    padding: '10px 14px',
                    background: hasSelected ? '#f8fafc' : '#f8fafc',
                    borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', transition: 'background 0.12s', gap: '10px',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
                        background: '#e2e8f0',
                        color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Folder size={14} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                                fontSize: '0.87rem', fontWeight: 700, color: '#1e293b',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                            }}>
                                {title}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.67rem', color: '#94a3b8', fontWeight: 500 }}>
                                {meetings.length} sessions
                            </span>
                            {upcomingMeetings.length > 0 && (
                                <>
                                    <span style={{ fontSize: '0.67rem', color: '#e2e8f0' }}>·</span>
                                    <span style={{ fontSize: '0.67rem', color: '#64748b', fontWeight: 500 }}>
                                        {upcomingMeetings.length} upcoming
                                    </span>
                                </>
                            )}
                            {pastMeetings.length > 0 && (
                                <>
                                    <span style={{ fontSize: '0.67rem', color: '#e2e8f0' }}>·</span>
                                    <span style={{ fontSize: '0.67rem', color: '#94a3b8', fontWeight: 500 }}>
                                        {pastMeetings.length} past
                                    </span>
                                </>
                            )}
                            {nextSession && (
                                <>
                                    <span style={{ fontSize: '0.67rem', color: '#e2e8f0' }}>·</span>
                                    <span style={{ fontSize: '0.67rem', color: '#94a3b8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <Calendar size={9} /> Next {formatDateOnly(nextSession.meetingDate)}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div style={{ flexShrink: 0, color: '#94a3b8' }}>
                    {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </div>
            </div>

            {isExpanded && (
                <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {meetings.map((m, idx) => (
                        <SessionRow
                            key={m.seminarMeetingId}
                            meeting={m}
                            weekIdx={idx}
                            isSelected={m.seminarMeetingId === selectedId}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Page ────────────────────────────────────────────────────────────────────

type FilterType = '' | 'upcoming' | 'past' | 'recording' | 'slides';

const PublicSeminarsPage: React.FC = () => {
    const [meetings, setMeetings] = useState<SeminarMeetingResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [selectedMeeting, setSelectedMeeting] = useState<SeminarMeetingResponse | null>(null);
    const [selectedSeriesTitle, setSelectedSeriesTitle] = useState('');
    const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('');

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await seminarService.getPublicSeminars();
                setMeetings(data);
            } catch (err: any) {
                setError(err?.response?.data?.message || 'Unable to load public seminars right now.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedMeeting(null); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    const grouped = useMemo(() => {
        const groups: Record<string, { title: string; meetings: SeminarMeetingResponse[] }> = {};
        meetings.forEach(m => {
            const sid = m.seminarId || 'uncategorized';
            if (!groups[sid]) {
                const baseTitle = m.title?.includes(' - ')
                    ? m.title.split(' - ')[0].trim()
                    : (m.title || 'Untitled Seminar Series');
                groups[sid] = { title: baseTitle, meetings: [] };
            }
            groups[sid].meetings.push(m);
        });
        Object.values(groups).forEach(g => {
            g.meetings.sort((a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime());
        });
        return groups;
    }, [meetings]);

    const stats = useMemo(() => ({
        upcoming: meetings.filter(isUpcomingMeeting).length,
        past: meetings.filter(m => !isUpcomingMeeting(m)).length,
        recording: meetings.filter(m => !!m.recordingLink).length,
        slides: meetings.filter(m => !!m.slideUrl).length,
    }), [meetings]);

    const filteredGrouped = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        const result: Record<string, { title: string; meetings: SeminarMeetingResponse[] }> = {};
        Object.entries(grouped).forEach(([sid, group]) => {
            const filtered = group.meetings.filter(m => {
                const matchSearch = !q ||
                    m.title?.toLowerCase().includes(q) ||
                    m.presenter?.name?.toLowerCase().includes(q) ||
                    m.location?.toLowerCase().includes(q) ||
                    m.description?.toLowerCase().includes(q);
                const matchFilter =
                    activeFilter === '' ? true :
                    activeFilter === 'upcoming' ? isUpcomingMeeting(m) :
                    activeFilter === 'past' ? !isUpcomingMeeting(m) :
                    activeFilter === 'recording' ? !!m.recordingLink :
                    activeFilter === 'slides' ? !!m.slideUrl : true;
                return matchSearch && matchFilter;
            });
            if (filtered.length > 0) result[sid] = { title: group.title, meetings: filtered };
        });
        return result;
    }, [grouped, searchQuery, activeFilter]);

    const seriesIds = useMemo(() => {
        return Object.keys(filteredGrouped).sort((a, b) => {
            const nextA = filteredGrouped[a].meetings.find(isUpcomingMeeting);
            const nextB = filteredGrouped[b].meetings.find(isUpcomingMeeting);
            if (nextA && nextB) return new Date(nextA.meetingDate).getTime() - new Date(nextB.meetingDate).getTime();
            if (nextA) return -1;
            if (nextB) return 1;
            const msA = filteredGrouped[a].meetings;
            const msB = filteredGrouped[b].meetings;
            const lastA = msA[msA.length - 1];
            const lastB = msB[msB.length - 1];
            return new Date(lastB?.meetingDate ?? 0).getTime() - new Date(lastA?.meetingDate ?? 0).getTime();
        });
    }, [filteredGrouped]);

    useEffect(() => {
        if (searchQuery || activeFilter) setExpandedIds(new Set(Object.keys(filteredGrouped)));
    }, [searchQuery, activeFilter]);

    const handleToggle = (sid: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.has(sid) ? next.delete(sid) : next.add(sid);
            return next;
        });
    };

    const handleSelect = (m: SeminarMeetingResponse, seriesTitle: string, weekIdx: number) => {
        if (selectedMeeting?.seminarMeetingId === m.seminarMeetingId) {
            setSelectedMeeting(null);
        } else {
            setSelectedMeeting(m);
            setSelectedSeriesTitle(seriesTitle);
            setSelectedWeekIdx(weekIdx);
        }
    };

    const clearFilters = () => { setSearchQuery(''); setActiveFilter(''); };
    const panelOpen = !!selectedMeeting;
    const hasActiveFilter = !!searchQuery || !!activeFilter;

    const FILTERS: { key: FilterType; label: string; count: number }[] = [
        { key: 'upcoming',  label: 'Upcoming',      count: stats.upcoming },
        { key: 'past',      label: 'Completed',     count: stats.past },
        { key: 'recording', label: 'Has Recording', count: stats.recording },
        { key: 'slides',    label: 'Has Slides',    count: stats.slides },
    ];

    return (
        <>
            <style>{`
                @keyframes pubSpin    { to { transform: rotate(360deg); } }
                @keyframes pubPulse  { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:.5;transform:scale(.8);} }
                @keyframes pubPanelIn { from{opacity:0;transform:translateX(12px);}to{opacity:1;transform:translateX(0);} }
            `}</style>

            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%)',
                fontFamily: 'Be Vietnam Pro, system-ui, sans-serif',
            }}>
                {/* Navbar */}
                <nav style={{
                    position: 'sticky', top: 0, zIndex: 100,
                    height: '60px', padding: '0 2rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid #e2e8f0',
                }}>
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none', color: 'inherit' }}>
                        <img src={logo} alt="AiTaLab" style={{ width: 30, height: 30 }} />
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#15243a' }}>
                            AiTaLab <em style={{ fontStyle: 'normal', color: '#e8720c' }}>LabSync</em>
                        </span>
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Link to="/public/seminars" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            textDecoration: 'none', fontWeight: 700, fontSize: '0.82rem',
                            color: '#1e293b', background: '#f1f5f9', border: '1px solid #e2e8f0',
                            padding: '0.35rem 0.8rem', borderRadius: '7px',
                        }}>
                            <Presentation size={13} /> Seminars
                        </Link>
                        <Link to="/public/papers" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            textDecoration: 'none', fontWeight: 600, fontSize: '0.82rem',
                            color: '#64748b', padding: '0.35rem 0.8rem', borderRadius: '7px',
                        }}>
                            <BookOpen size={13} /> Papers
                        </Link>
                        <Link to="/login" style={{
                            textDecoration: 'none', background: '#1e293b',
                            color: '#fff', padding: '0.38rem 1rem', borderRadius: '7px',
                            fontWeight: 700, fontSize: '0.82rem',
                        }}>Sign In</Link>
                    </div>
                </nav>

                <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.75rem 1.5rem 3rem' }}>
                    {/* Page header */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' }}>
                            Public Seminars
                        </h1>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                            Open seminar series from AiTaLab.
                            {panelOpen && <span style={{ color: '#475569' }}> Click another session to switch · Esc to close.</span>}
                        </p>
                    </div>

                    {/* Search + filter bar */}
                    {!loading && !error && meetings.length > 0 && (
                        <div style={{
                            background: '#fff', border: '1px solid #e2e8f0',
                            borderRadius: '12px', padding: '0.7rem 0.9rem',
                            marginBottom: '1.1rem',
                            position: 'sticky', top: '66px', zIndex: 50,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}>
                            <div style={{ position: 'relative', marginBottom: '0.55rem' }}>
                                <Search size={14} style={{
                                    position: 'absolute', left: '11px', top: '50%',
                                    transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none',
                                }} />
                                <input
                                    type="text"
                                    placeholder="Search by title, presenter, location..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%', boxSizing: 'border-box',
                                        height: '36px', paddingLeft: '34px', paddingRight: searchQuery ? '34px' : '10px',
                                        border: '1px solid #e2e8f0', borderRadius: '8px',
                                        background: '#f8fafc', fontSize: '0.84rem', fontFamily: 'inherit',
                                        color: '#1e293b', outline: 'none',
                                    }}
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} style={{
                                        position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
                                        display: 'flex', alignItems: 'center', padding: 0,
                                    }}>
                                        <X size={13} />
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                {FILTERS.map(({ key, label, count }) => {
                                    const isActive = activeFilter === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setActiveFilter(isActive ? '' : key)}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                padding: '4px 10px', borderRadius: '7px', cursor: 'pointer',
                                                fontSize: '0.75rem', fontWeight: 600,
                                                border: `1px solid ${isActive ? '#94a3b8' : '#e2e8f0'}`,
                                                background: isActive ? '#1e293b' : '#f8fafc',
                                                color: isActive ? '#fff' : '#475569',
                                                transition: 'all 0.12s',
                                            }}
                                        >
                                            {label}
                                            <span style={{
                                                fontSize: '0.68rem', fontWeight: 700,
                                                color: isActive ? 'rgba(255,255,255,0.7)' : '#94a3b8',
                                            }}>
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                                {hasActiveFilter && (
                                    <button onClick={clearFilters} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        padding: '4px 10px', borderRadius: '7px', cursor: 'pointer',
                                        fontSize: '0.75rem', fontWeight: 600,
                                        border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b',
                                        marginLeft: 'auto', transition: 'all 0.12s',
                                    }}>
                                        <X size={11} /> Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                            <div style={{
                                width: '24px', height: '24px',
                                border: '2px solid #e2e8f0', borderTopColor: '#64748b',
                                borderRadius: '50%', animation: 'pubSpin 0.7s linear infinite',
                            }} />
                        </div>
                    )}

                    {/* Error */}
                    {!loading && error && (
                        <div style={{
                            border: '1px solid #fecaca', background: '#fef2f2',
                            color: '#b91c1c', padding: '0.85rem 1rem',
                            borderRadius: '10px', fontSize: '0.84rem', fontWeight: 600,
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Empty */}
                    {!loading && !error && meetings.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                            <Presentation size={40} style={{ display: 'block', margin: '0 auto 0.75rem', opacity: 0.2 }} />
                            <p style={{ margin: '0 0 4px', fontSize: '0.9rem', fontWeight: 700, color: '#475569' }}>No Public Seminars Yet</p>
                            <p style={{ margin: 0, fontSize: '0.82rem' }}>Check back soon for upcoming series.</p>
                        </div>
                    )}

                    {/* No results */}
                    {!loading && !error && meetings.length > 0 && seriesIds.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '3rem 2rem', color: '#94a3b8' }}>
                            <Search size={32} style={{ display: 'block', margin: '0 auto 0.75rem', opacity: 0.2 }} />
                            <p style={{ margin: '0 0 12px', fontSize: '0.88rem', fontWeight: 600, color: '#475569' }}>No sessions match your search.</p>
                            <button onClick={clearFilters} style={{
                                padding: '5px 14px', borderRadius: '7px', cursor: 'pointer',
                                border: '1px solid #e2e8f0', background: '#f8fafc',
                                color: '#475569', fontWeight: 600, fontSize: '0.8rem',
                            }}>
                                Clear filters
                            </button>
                        </div>
                    )}

                    {/* 50/50 split */}
                    {!loading && !error && seriesIds.length > 0 && (
                        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                            {/* Left */}
                            <div style={{ flex: '1 1 0', minWidth: 0 }}>
                                <div style={{
                                    fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8',
                                    letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px',
                                }}>
                                    {seriesIds.length} series · {Object.values(filteredGrouped).reduce((s, g) => s + g.meetings.length, 0)} sessions
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {seriesIds.map(sid => (
                                        <SeriesGroup
                                            key={sid}
                                            title={filteredGrouped[sid].title}
                                            meetings={filteredGrouped[sid].meetings}
                                            isExpanded={expandedIds.has(sid)}
                                            selectedId={selectedMeeting?.seminarMeetingId ?? null}
                                            onToggle={() => handleToggle(sid)}
                                            onSelect={(m) => {
                                                const idx = filteredGrouped[sid].meetings.findIndex(x => x.seminarMeetingId === m.seminarMeetingId);
                                                handleSelect(m, filteredGrouped[sid].title, idx);
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Right — sticky detail panel */}
                            <div style={{
                                flex: '1 1 0', minWidth: 0,
                                position: 'sticky', top: '76px',
                                maxHeight: 'calc(100vh - 96px)',
                                display: 'flex', flexDirection: 'column',
                            }}>
                                {panelOpen ? (
                                    <DetailPanel
                                        meeting={selectedMeeting!}
                                        weekIdx={selectedWeekIdx}
                                        seriesTitle={selectedSeriesTitle}
                                        onClose={() => setSelectedMeeting(null)}
                                    />
                                ) : (
                                    <div style={{
                                        flex: 1, display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center',
                                        border: '2px dashed #e2e8f0', borderRadius: '12px',
                                        padding: '3rem', textAlign: 'center',
                                        minHeight: '280px',
                                    }}>
                                        <Presentation size={32} style={{ marginBottom: '0.65rem', opacity: 0.15 }} />
                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
                                            Select a session to view details
                                        </p>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
                                            Expand a series then click any session row
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default PublicSeminarsPage;
