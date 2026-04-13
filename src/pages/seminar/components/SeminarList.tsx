import React from 'react';
import { SeminarMeetingResponse } from '@/types/seminar';
import {
    Presentation,
    Calendar,
    Folder,
    ChevronDown,
    ChevronRight,
    Search
} from 'lucide-react';

interface SeminarListProps {
    meetings: SeminarMeetingResponse[];
    selectedId: string | null;
    onSelect: (meeting: SeminarMeetingResponse) => void;
    usersMap: Record<string, string>;
}

const formatDateOnly = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

// Helper removed as unused

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

const isUpcoming = (dateStr: string) => new Date(dateStr).getTime() > Date.now();

const SeminarList: React.FC<SeminarListProps> = ({
    meetings,
    selectedId,
    onSelect,
    usersMap,
}) => {
    const [expandedSeries, setExpandedSeries] = React.useState<Record<string, boolean>>({});

    const toggleSeries = (seriesId: string) => {
        setExpandedSeries(prev => ({
            ...prev,
            [seriesId]: !prev[seriesId]
        }));
    };

    // Group meetings by seminarId
    const grouped = React.useMemo(() => {
        const groups: Record<string, { title: string; meetings: SeminarMeetingResponse[] }> = {};
        
        meetings.forEach(m => {
            const sid = m.seminarId || 'uncategorized';
            if (!groups[sid]) {
                // Take name before the first '-' as series name
                const baseTitle = m.title && m.title.includes(' - ') 
                    ? m.title.split(' - ')[0].trim() 
                    : (m.title || 'Unlimited Seminar Series');
                groups[sid] = { title: baseTitle, meetings: [] };
            }
            groups[sid].meetings.push(m);
        });

        // Sort meetings within groups by date descending
        Object.values(groups).forEach(g => {
            g.meetings.sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());
        });

        return groups;
    }, [meetings]);

    const seriesIds = Object.keys(grouped);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {seriesIds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
                    <Search size={40} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>No seminars found match your criteria.</p>
                </div>
            ) : (
                seriesIds.map(sid => {
                    const group = grouped[sid];
                    const isExpanded = expandedSeries[sid] ?? false;
                    const hasSelected = group.meetings.some(m => m.seminarMeetingId === selectedId);

                    return (
                        <div key={sid} style={{ 
                            background: '#fff', 
                            borderRadius: '16px', 
                            border: '1px solid var(--border-color)',
                            overflow: 'hidden',
                            boxShadow: 'var(--shadow-sm)'
                        }}>
                            {/* Parent Header */}
                            <div 
                                onClick={() => toggleSeries(sid)}
                                style={{
                                    padding: '12px 16px',
                                    background: hasSelected ? 'rgba(232, 114, 12, 0.03)' : '#f8fafc',
                                    borderBottom: isExpanded ? '1px solid var(--border-light)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        background: hasSelected ? 'var(--accent-color)' : 'var(--primary-color)',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <Folder size={16} />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.title}</div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                            {group.meetings.length} Sessions
                                        </div>
                                    </div>
                                </div>
                                {isExpanded ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
                            </div>

                            {/* Child List */}
                            {isExpanded && (
                                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {group.meetings.map(meeting => {
                                        const isSelected = meeting.seminarMeetingId === selectedId;
                                        const relDate = getRelativeDate(meeting.meetingDate);
                                        const upcoming = isUpcoming(meeting.meetingDate);
                                        const presenterName = usersMap[meeting.presenterId] || 'Unknown Presenter';

                                        return (
                                            <div
                                                key={meeting.seminarMeetingId}
                                                onClick={(e) => { e.stopPropagation(); onSelect(meeting); }}
                                                style={{
                                                    padding: '12px 14px',
                                                    borderRadius: '10px',
                                                    background: isSelected
                                                        ? 'linear-gradient(135deg, rgba(232, 114, 12, 0.06), rgba(255, 150, 67, 0.04))'
                                                        : 'transparent',
                                                    border: isSelected
                                                        ? '1.5px solid var(--accent-color)'
                                                        : '1px solid transparent',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    position: 'relative',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '4px'
                                                }}
                                                onMouseEnter={e => {
                                                    if (!isSelected) {
                                                        e.currentTarget.style.background = 'var(--surface-hover)';
                                                        e.currentTarget.style.borderColor = 'var(--border-light)';
                                                    }
                                                }}
                                                onMouseLeave={e => {
                                                    if (!isSelected) {
                                                        e.currentTarget.style.background = 'transparent';
                                                        e.currentTarget.style.borderColor = 'transparent';
                                                    }
                                                }}
                                            >
                                                {/* Session Title & Status */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ 
                                                        fontSize: '0.82rem', 
                                                        fontWeight: 700, 
                                                        color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)',
                                                        flex: 1,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {meeting.title && meeting.title.includes(' - ') 
                                                            ? meeting.title.split(' - ').slice(1).join(' - ')
                                                            : (meeting.title || 'Untitled Session')}
                                                    </span>
                                                    <div style={{
                                                        fontSize: '0.65rem',
                                                        fontWeight: 800,
                                                        color: upcoming ? '#3b82f6' : '#10b981',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: upcoming ? '#3b82f6' : '#10b981' }} />
                                                        {upcoming ? 'Upcoming' : 'Completed'}
                                                    </div>
                                                </div>

                                                {/* Mini Stats Line */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                        <Calendar size={12} />
                                                        <span>{formatDateOnly(meeting.meetingDate)}</span>
                                                        {relDate && <span style={{ color: 'var(--accent-color)', fontSize: '0.65rem', marginLeft: '4px' }}>[{relDate}]</span>}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                        <Presentation size={12} />
                                                        <span>{presenterName}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default SeminarList;
