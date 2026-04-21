import React from 'react';
import { SeminarMeetingResponse } from '@/types/seminar';
import {
    Presentation,
    Calendar,
    Folder,
    ChevronDown,
    ChevronRight,
    Search,
    FileText,
    AlertCircle,
} from 'lucide-react';

interface SeminarListProps {
    meetings: SeminarMeetingResponse[];
    selectedId: string | null;
    onSelect: (meeting: SeminarMeetingResponse) => void;
    usersMap: Record<string, string>;
    filterTimeframe?: string;
    allExpanded?: boolean;
}

const formatDateOnly = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const getRelativeDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    d.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    return null;
};

const isUpcoming = (dateStr: string) => new Date(dateStr).getTime() > Date.now();

const SeminarList: React.FC<SeminarListProps> = ({ meetings, selectedId, onSelect, usersMap, filterTimeframe, allExpanded }) => {
    const [expandedSeries, setExpandedSeries] = React.useState<Record<string, boolean>>({});

    const grouped = React.useMemo(() => {
        const groups: Record<string, { title: string; meetings: SeminarMeetingResponse[] }> = {};
        meetings.forEach(m => {
            const sid = m.seminarId || 'uncategorized';
            if (!groups[sid]) {
                const baseTitle = m.title && m.title.includes(' - ')
                    ? m.title.split(' - ')[0].trim()
                    : (m.title || 'Unlimited Seminar Series');
                groups[sid] = { title: baseTitle, meetings: [] };
            }
            groups[sid].meetings.push(m);
        });
        Object.values(groups).forEach(g => {
            g.meetings.sort((a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime());
        });
        return groups;
    }, [meetings]);

    // Sort groups: upcoming sessions first, sorted by nearest upcoming date
    const seriesIds = React.useMemo(() => {
        return Object.keys(grouped).sort((a, b) => {
            const nextA = grouped[a].meetings.find(m => isUpcoming(m.meetingDate));
            const nextB = grouped[b].meetings.find(m => isUpcoming(m.meetingDate));
            if (nextA && nextB) return new Date(nextA.meetingDate).getTime() - new Date(nextB.meetingDate).getTime();
            if (nextA) return -1;
            if (nextB) return 1;
            // Both all-past: sort by most recent
            const lastA = grouped[a].meetings[grouped[a].meetings.length - 1];
            const lastB = grouped[b].meetings[grouped[b].meetings.length - 1];
            return new Date(lastB.meetingDate).getTime() - new Date(lastA.meetingDate).getTime();
        });
    }, [grouped]);

    // Auto-expand when user actively changes filter (skip initial mount)
    const isFirstFilterRender = React.useRef(true);
    React.useEffect(() => {
        if (isFirstFilterRender.current) { isFirstFilterRender.current = false; return; }
        if (filterTimeframe && filterTimeframe !== '') {
            const next: Record<string, boolean> = {};
            seriesIds.forEach(sid => { next[sid] = true; });
            setExpandedSeries(next);
        }
    }, [filterTimeframe]);

    // Expand / collapse all on demand
    const prevAllExpanded = React.useRef<boolean | undefined>(undefined);
    React.useEffect(() => {
        if (prevAllExpanded.current === allExpanded) return;
        prevAllExpanded.current = allExpanded;
        if (allExpanded === undefined) return;
        const next: Record<string, boolean> = {};
        if (allExpanded) seriesIds.forEach(sid => { next[sid] = true; });
        setExpandedSeries(next);
    }, [allExpanded, seriesIds]);

    const toggleSeries = (sid: string) => {
        setExpandedSeries(prev => ({ ...prev, [sid]: !prev[sid] }));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {seriesIds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
                    <Search size={40} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>No seminars found match your criteria.</p>
                </div>
            ) : seriesIds.map(sid => {
                const group = grouped[sid];
                const isExpanded = expandedSeries[sid] ?? false;
                const hasSelected = group.meetings.some(m => m.seminarMeetingId === selectedId);
                const upcomingMeetings = group.meetings.filter(m => isUpcoming(m.meetingDate));
                const pastMeetings = group.meetings.filter(m => !isUpcoming(m.meetingDate));
                const nextSession = upcomingMeetings[0] ?? null;

                return (
                    <div key={sid} style={{
                        background: '#fff',
                        borderRadius: '14px',
                        border: `1px solid ${hasSelected ? 'var(--accent-color)' : 'var(--border-color)'}`,
                        overflow: 'hidden',
                        boxShadow: hasSelected ? '0 0 0 3px rgba(232,114,12,0.08)' : 'var(--shadow-sm)',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}>
                        {/* Group Header */}
                        <div
                            onClick={() => toggleSeries(sid)}
                            style={{
                                padding: '10px 14px',
                                background: hasSelected ? 'rgba(232,114,12,0.03)' : '#f8fafc',
                                borderBottom: isExpanded ? '1px solid var(--border-light)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                cursor: 'pointer', transition: 'background 0.15s',
                                gap: '10px',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <div style={{
                                    width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
                                    background: hasSelected ? 'var(--accent-color)' : 'var(--primary-color)',
                                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Folder size={15} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {group.title}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' as const }}>
                                        {upcomingMeetings.length > 0 && (
                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#2563eb' }}>
                                                {upcomingMeetings.length} upcoming
                                            </span>
                                        )}
                                        {upcomingMeetings.length > 0 && pastMeetings.length > 0 && (
                                            <span style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>·</span>
                                        )}
                                        {pastMeetings.length > 0 && (
                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8' }}>
                                                {pastMeetings.length} past
                                            </span>
                                        )}
                                        {nextSession && (
                                            <>
                                                <span style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>·</span>
                                                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <Calendar size={10} />
                                                    Next: {formatDateOnly(nextSession.meetingDate)}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {isExpanded
                                ? <ChevronDown size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                : <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
                        </div>

                        {/* Session List */}
                        {isExpanded && (
                            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {group.meetings.map(meeting => {
                                    const isSelected = meeting.seminarMeetingId === selectedId;
                                    const upcoming = isUpcoming(meeting.meetingDate);
                                    const relDate = getRelativeDate(meeting.meetingDate);
                                    const presenterName = usersMap[meeting.presenterId] || 'Unknown';
                                    const hasSlides = !!meeting.slideUrl;
                                    const missingSlides = upcoming && !hasSlides;

                                    return (
                                        <div
                                            key={meeting.seminarMeetingId}
                                            onClick={(e) => { e.stopPropagation(); onSelect(meeting); }}
                                            style={{
                                                padding: '10px 12px 10px 14px',
                                                borderRadius: '9px',
                                                background: isSelected
                                                    ? 'linear-gradient(135deg, rgba(232,114,12,0.06), rgba(255,150,67,0.04))'
                                                    : upcoming ? '#fff' : '#fafafa',
                                                border: isSelected ? '1.5px solid var(--accent-color)' : '1px solid transparent',
                                                borderLeft: isSelected
                                                    ? '3px solid var(--accent-color)'
                                                    : upcoming
                                                    ? '3px solid #bfdbfe'
                                                    : '3px solid #e2e8f0',
                                                cursor: 'pointer', transition: 'all 0.15s',
                                                display: 'flex', flexDirection: 'column', gap: '4px',
                                                opacity: upcoming ? 1 : 0.7,
                                            }}
                                            onMouseEnter={e => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = 'var(--surface-hover)';
                                                    e.currentTarget.style.borderColor = 'var(--border-light)';
                                                    e.currentTarget.style.opacity = '1';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.background = upcoming ? '#fff' : '#fafafa';
                                                    e.currentTarget.style.borderColor = 'transparent';
                                                    e.currentTarget.style.opacity = upcoming ? '1' : '0.7';
                                                }
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                                <span style={{
                                                    fontSize: '0.82rem', fontWeight: 700,
                                                    color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)',
                                                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {meeting.title?.includes(' - ')
                                                        ? meeting.title.split(' - ').slice(1).join(' - ')
                                                        : (meeting.title || 'Untitled Session')}
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                                    {hasSlides && (
                                                        <span title="Slides uploaded" style={{ display: 'flex', alignItems: 'center', color: '#2563eb' }}>
                                                            <FileText size={12} />
                                                        </span>
                                                    )}
                                                    {missingSlides && (
                                                        <span style={{
                                                            display: 'flex', alignItems: 'center', gap: '3px',
                                                            fontSize: '0.62rem', fontWeight: 800, color: '#d97706',
                                                            background: '#fffbeb', border: '1px solid #fde68a',
                                                            borderRadius: '5px', padding: '1px 5px',
                                                        }}>
                                                            <AlertCircle size={9} />
                                                            No Slides
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.71rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                    <Calendar size={11} />
                                                    <span>{formatDateOnly(meeting.meetingDate)}</span>
                                                    {relDate && (
                                                        <span style={{ color: 'var(--accent-color)', fontSize: '0.65rem', marginLeft: '2px' }}>
                                                            [{relDate}]
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.71rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                    <Presentation size={11} />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{presenterName}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default SeminarList;
