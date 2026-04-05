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
    Calendar
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

const ScheduleList: React.FC<ScheduleListProps> = (props) => {
    const { meetings, selectedId, onSelect, projectsMap, isSplit } = props;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {meetings.map(meeting => {
                const statusInfo = getStatusInfo(meeting.status);
                const isSelected = meeting.id === selectedId;
                const relDate = getRelativeDate(meeting.startTime);
                const acceptedCount = meeting.attendees?.filter(a => a.responseStatus === AttendeeResponseStatus.Accepted).length || 0;
                const totalAttendees = meeting.attendees?.length || 0;

                return (
                    <div
                        key={meeting.id}
                        onClick={() => onSelect(meeting)}
                        style={{
                            padding: '14px 16px',
                            borderRadius: '12px',
                            background: isSelected
                                ? 'linear-gradient(135deg, rgba(232, 114, 12, 0.06), rgba(255, 150, 67, 0.04))'
                                : '#fff',
                            border: isSelected
                                ? '1.5px solid var(--accent-color)'
                                : '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseEnter={e => {
                            if (!isSelected) {
                                e.currentTarget.style.borderColor = 'var(--accent-light)';
                                e.currentTarget.style.background = 'var(--surface-hover)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (!isSelected) {
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                e.currentTarget.style.background = '#fff';
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = 'none';
                            }
                        }}
                    >
                        {/* Top: Title & Status */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                            <h4 style={{
                                margin: 0,
                                fontSize: '0.9rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                lineHeight: 1.3,
                                display: '-webkit-box',
                                WebkitLineClamp: isSplit ? 1 : 2,
                                WebkitBoxOrient: 'vertical' as const,
                                overflow: 'hidden',
                                flex: 1
                            }}>
                                {meeting.title || 'Untitled Meeting'}
                            </h4>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '20px',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                background: statusInfo.bg,
                                color: statusInfo.color,
                                flexShrink: 0,
                                whiteSpace: 'nowrap' as const
                            }}>
                                {statusInfo.icon} {statusInfo.label}
                            </span>
                        </div>

                        {/* Middle: Time & Date */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '8px',
                            padding: '8px 10px',
                            background: 'var(--background-color)',
                            borderRadius: '8px',
                            border: '1px solid var(--border-light)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Calendar size={13} color="var(--accent-color)" />
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {formatDateOnly(meeting.startTime)}
                                </span>
                            </div>
                            <div style={{ width: '1px', height: '14px', background: 'var(--border-color)' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={13} color="var(--text-muted)" />
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {formatTime(meeting.startTime)} — {formatTime(meeting.endTime)}
                                </span>
                            </div>
                            {relDate && (
                                <>
                                    <div style={{ width: '1px', height: '14px', background: 'var(--border-color)' }} />
                                    <span style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 700,
                                        color: relDate === 'Today' ? '#f59e0b' : 'var(--accent-color)',
                                        background: relDate === 'Today' ? '#fffbeb' : 'var(--accent-bg)',
                                        padding: '2px 6px',
                                        borderRadius: '4px'
                                    }}>
                                        {relDate}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Bottom: Meta info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' as const }}>
                            {meeting.projectId && projectsMap[meeting.projectId] && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    <MapPin size={12} color="var(--text-muted)" />
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    <Users size={12} color="var(--text-muted)" />
                                    {acceptedCount}/{totalAttendees}
                                </div>
                            )}
                            {meeting.googleMeetLink && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>
                                    <Video size={12} />
                                    Google Meet
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ScheduleList;
