import React from 'react';
import { MeetingResponse, MeetingStatus, AttendeeResponseStatus } from '@/types/meeting';
import {
    Clock,
    Video,
    Users,
    MapPin,
    CheckCircle,
    XCircle,
    AlertCircle,
    Play,
    Calendar,
    Sparkles
} from 'lucide-react';

interface ScheduleListProps {
    meetings: MeetingResponse[];
    selectedId: string | null;
    onSelect: (meeting: MeetingResponse) => void;
    projectsMap: Record<string, string>;
    usersMap: Record<string, string>;
    isSplit: boolean;
}

const getStatusInfo = (status: MeetingStatus) => {
    switch (status) {
        case MeetingStatus.Scheduled:
            return { label: 'Scheduled', color: '#3b82f6', bg: '#eff6ff', icon: <Clock size={12} /> };
        case MeetingStatus.InProgress:
            return { label: 'In Progress', color: '#f59e0b', bg: '#fffbeb', icon: <Play size={12} /> };
        case MeetingStatus.Completed:
            return { label: 'Completed', color: '#10b981', bg: '#ecfdf5', icon: <CheckCircle size={12} /> };
        case MeetingStatus.Cancelled:
            return { label: 'Cancelled', color: '#ef4444', bg: '#fef2f2', icon: <XCircle size={12} /> };
        default:
            return { label: 'Unknown', color: '#64748b', bg: '#f1f5f9', icon: <AlertCircle size={12} /> };
    }
};

const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const formatDateOnly = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const getRelativeDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    d.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    return null;
};

const formatDuration = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';

    const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;

    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
};

const ScheduleList: React.FC<ScheduleListProps> = (props) => {
    const { meetings, selectedId, onSelect, projectsMap, isSplit } = props;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {meetings.map(meeting => {
                const statusInfo = getStatusInfo(meeting.status);
                const isSelected = meeting.id === selectedId;
                const relDate = getRelativeDate(meeting.startTime);
                const durationLabel = formatDuration(meeting.startTime, meeting.endTime);
                const acceptedCount = meeting.attendees?.filter(a => a.responseStatus === AttendeeResponseStatus.Accepted).length || 0;
                const totalAttendees = meeting.attendees?.length || 0;

                return (
                    <div
                        key={meeting.id}
                        onClick={() => onSelect(meeting)}
                        style={{
                            padding: '12px 14px',
                            borderRadius: '14px',
                            background: '#fff',
                            border: isSelected
                                ? '1.5px solid rgba(232, 114, 12, 0.9)'
                                : '1px solid #e4ebf3',
                            cursor: 'pointer',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: isSelected
                                ? '0 10px 24px rgba(232, 114, 12, 0.14)'
                                : '0 2px 10px rgba(15, 23, 42, 0.05)'
                        }}
                        onMouseEnter={e => {
                            if (!isSelected) {
                                e.currentTarget.style.borderColor = '#d2dde9';
                                e.currentTarget.style.background = '#fcfdff';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 8px 18px rgba(15, 23, 42, 0.08)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (!isSelected) {
                                e.currentTarget.style.borderColor = '#e4ebf3';
                                e.currentTarget.style.background = '#fff';
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = '0 2px 10px rgba(15, 23, 42, 0.05)';
                            }
                        }}
                    >
                        <div
                            style={{
                                position: 'absolute',
                                top: '-46px',
                                right: '-34px',
                                width: '110px',
                                height: '110px',
                                borderRadius: '50%',
                                background: isSelected
                                    ? 'radial-gradient(circle, rgba(232,114,12,0.18), rgba(232,114,12,0))'
                                    : 'radial-gradient(circle, rgba(148,163,184,0.14), rgba(148,163,184,0))',
                                pointerEvents: 'none'
                            }}
                        />

                        <div style={{ position: 'relative', zIndex: 1 }}>
                            {/* Top: Title & Status */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h4 style={{
                                        margin: 0,
                                        fontSize: '0.98rem',
                                        fontWeight: 800,
                                        color: 'var(--text-primary)',
                                        lineHeight: 1.35,
                                        display: '-webkit-box',
                                        WebkitLineClamp: isSplit ? 1 : 2,
                                        WebkitBoxOrient: 'vertical' as const,
                                        overflow: 'hidden'
                                    }}>
                                        {meeting.title || 'Untitled Meeting'}
                                    </h4>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: '5px',
                                    flexShrink: 0,
                                    flexWrap: 'wrap' as const
                                }}>
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '3px 9px',
                                        borderRadius: '999px',
                                        fontSize: '0.67rem',
                                        fontWeight: 700,
                                        background: '#f8fafc',
                                        color: statusInfo.color,
                                        border: `1px solid ${statusInfo.color}33`,
                                        whiteSpace: 'nowrap' as const,
                                        lineHeight: 1.2
                                    }}>
                                        {statusInfo.icon} {statusInfo.label}
                                    </span>

                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '0.63rem',
                                        fontWeight: 600,
                                        padding: '3px 8px',
                                        borderRadius: '999px',
                                        background: '#f8fafc',
                                        color: meeting.hasEmbedding ? '#15803d' : '#64748b',
                                        border: `1px solid ${meeting.hasEmbedding ? '#86efac' : '#dbe3ed'}`,
                                        whiteSpace: 'nowrap' as const,
                                        lineHeight: 1.2
                                    }}>
                                        <Sparkles size={10} />
                                        {meeting.hasEmbedding ? 'Semantic Ready' : 'No Semantic'}
                                    </span>

                                    {relDate && (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '3px 8px',
                                            borderRadius: '999px',
                                            fontSize: '0.64rem',
                                            fontWeight: 700,
                                            color: relDate === 'Today' ? '#b45309' : '#64748b',
                                            background: '#f8fafc',
                                            border: relDate === 'Today' ? '1px solid #fdba74' : '1px solid #dbe3ed',
                                            whiteSpace: 'nowrap' as const,
                                            lineHeight: 1.2
                                        }}>
                                            <Clock size={10} />
                                            {relDate}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Middle: Date/Time chips */}
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap' as const,
                                alignItems: 'center',
                                gap: '6px',
                                marginBottom: '8px'
                            }}>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 9px',
                                    borderRadius: '999px',
                                    background: 'rgba(232, 114, 12, 0.09)',
                                    color: 'var(--accent-color)',
                                    border: '1px solid rgba(232, 114, 12, 0.18)'
                                }}>
                                    <Calendar size={12} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                                        {formatDateOnly(meeting.startTime)}
                                    </span>
                                </div>

                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 9px',
                                    borderRadius: '999px',
                                    background: '#f8fafc',
                                    color: '#475569',
                                    border: '1px solid #e2e8f0'
                                }}>
                                    <Clock size={12} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 650 }}>
                                        {formatTime(meeting.startTime)} — {formatTime(meeting.endTime)}
                                    </span>
                                </div>

                                {durationLabel && (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '4px 8px',
                                        borderRadius: '999px',
                                        background: '#f8fafc',
                                        color: '#64748b',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.72rem',
                                        fontWeight: 700
                                    }}>
                                        {durationLabel}
                                    </div>
                                )}
                            </div>

                            {/* Bottom: Meta chips */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' as const }}>
                                {meeting.projectId && projectsMap[meeting.projectId] && (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '4px 8px',
                                        borderRadius: '999px',
                                        fontSize: '0.71rem',
                                        color: '#475569',
                                        fontWeight: 600,
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        <MapPin size={11} color="#94a3b8" />
                                        <span style={{
                                            maxWidth: isSplit ? '100px' : '180px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap' as const
                                        }}>
                                            {projectsMap[meeting.projectId]}
                                        </span>
                                    </div>
                                )}

                                {totalAttendees > 0 && (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '4px 8px',
                                        borderRadius: '999px',
                                        fontSize: '0.71rem',
                                        color: '#475569',
                                        fontWeight: 700,
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        <Users size={11} color="#94a3b8" />
                                        {acceptedCount}/{totalAttendees}
                                    </div>
                                )}

                                {meeting.googleMeetLink && (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '4px 8px',
                                        borderRadius: '999px',
                                        fontSize: '0.71rem',
                                        color: '#0f766e',
                                        fontWeight: 700,
                                        background: '#f0fdfa',
                                        border: '1px solid #99f6e4'
                                    }}>
                                        <Video size={11} />
                                        Google Meet
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ScheduleList;
