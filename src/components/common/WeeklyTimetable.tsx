import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Video, Presentation, X, ExternalLink, Users, FileText } from 'lucide-react';

export interface TimetableEvent {
    id: string;
    title: string;
    startTime: string; // ISO string
    endTime: string;   // ISO string
    color?: string;
    meetLink?: string | null;
    presenter?: string | null;
    creator?: string | null;
    description?: string | null;
    guests?: (string | null)[] | null;
    type?: 'meeting' | 'seminar';
}

interface PositionedEvent extends TimetableEvent {
    colOffset: number;
    colWidth: number;
}

interface WeeklyTimetableProps {
    events: TimetableEvent[];
    onEventClick?: (event: TimetableEvent) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0:00 - 23:00
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOUR_HEIGHT = 72; // px per hour

const getMonday = (d: Date): Date => {
    const result = new Date(d);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
};

const formatShortDate = (d: Date): string => {
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
};

const formatHour = (h: number): string => {
    return `${h.toString().padStart(2, '0')}:00`;
};

const formatTime = (d: Date): string => {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const EVENT_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1',
    '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4'
];

const WeeklyTimetable: React.FC<WeeklyTimetableProps> = ({ events, onEventClick }) => {
    const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
    const [activePopover, setActivePopover] = useState<{ event: TimetableEvent, x: number, y: number } | null>(null);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClose = (e: MouseEvent) => {
            const popover = document.getElementById('timetable-popover');
            if (popover && popover.contains(e.target as Node)) return;
            setActivePopover(null);
        };
        document.addEventListener('mousedown', handleClose);
        return () => {
            document.removeEventListener('mousedown', handleClose);
        };
    }, []);

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(currentMonday);
            d.setDate(d.getDate() + i);
            return d;
        });
    }, [currentMonday.getTime()]);

    const goToPrevWeek = () => {
        const prev = new Date(currentMonday);
        prev.setDate(prev.getDate() - 7);
        setCurrentMonday(prev);
    };

    const goToNextWeek = () => {
        const next = new Date(currentMonday);
        next.setDate(next.getDate() + 7);
        setCurrentMonday(next);
    };

    const goToToday = () => {
        setCurrentMonday(getMonday(new Date()));
    };

    const isToday = (d: Date): boolean => {
        const now = new Date();
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    };

    // Map events to their day columns and compute overlap positions
    const eventsByDay = useMemo(() => {
        const map: Record<number, PositionedEvent[]> = {};
        for (let i = 0; i < 7; i++) map[i] = [];

        events.forEach(evt => {
            const start = new Date(evt.startTime);
            const dayIdx = weekDays.findIndex(d =>
                d.getDate() === start.getDate() &&
                d.getMonth() === start.getMonth() &&
                d.getFullYear() === start.getFullYear()
            );
            if (dayIdx >= 0) {
                map[dayIdx].push({ ...evt, colOffset: 0, colWidth: 100 });
            }
        });

        // Resolve overlaps per day
        for (let i = 0; i < 7; i++) {
            const dayEvents = map[i];
            if (dayEvents.length === 0) continue;

            dayEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime() || new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

            const clusters: PositionedEvent[][] = [];
            let currentCluster: PositionedEvent[] = [];
            let clusterEnd = 0;

            dayEvents.forEach(evt => {
                const start = new Date(evt.startTime).getTime();
                const end = new Date(evt.endTime).getTime();
                if (currentCluster.length === 0 || start < clusterEnd) {
                    currentCluster.push(evt);
                    clusterEnd = Math.max(clusterEnd, end);
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [evt];
                    clusterEnd = end;
                }
            });
            if (currentCluster.length > 0) clusters.push(currentCluster);

            clusters.forEach(cluster => {
                const columns: PositionedEvent[][] = [];
                cluster.forEach(evt => {
                    const start = new Date(evt.startTime).getTime();
                    let placed = false;
                    for (let c = 0; c < columns.length; c++) {
                        const col = columns[c];
                        const lastEvt = col[col.length - 1];
                        if (new Date(lastEvt.endTime).getTime() <= start) {
                            col.push(evt);
                            (evt as any)._col = c;
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) {
                        columns.push([evt]);
                        (evt as any)._col = columns.length - 1;
                    }
                });
                const numCols = columns.length;
                cluster.forEach(evt => {
                    evt.colWidth = 100 / numCols;
                    evt.colOffset = ((evt as any)._col) * evt.colWidth;
                });
            });
        }

        return map;
    }, [events, weekDays]);

    // Current time indicator
    const now = new Date();
    const nowDayIdx = weekDays.findIndex(d => isToday(d));
    const nowOffset = (now.getHours() - HOURS[0]) * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT;

    // Month label for header
    const monthLabel = useMemo(() => {
        const startMonth = weekDays[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const endMonth = weekDays[6].toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return startMonth === endMonth ? startMonth : `${weekDays[0].toLocaleDateString('en-US', { month: 'short' })} — ${weekDays[6].toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }, [weekDays]);

    return (
        <div style={{
            background: '#fff',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--background-color)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={goToToday} style={{
                        padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-color)',
                        background: '#fff', color: 'var(--text-primary)', cursor: 'pointer',
                        fontSize: '0.78rem', fontWeight: 700, transition: 'all 0.2s'
                    }}>
                        Today
                    </button>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={goToPrevWeek} style={{
                            padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)',
                            background: '#fff', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                            <ChevronLeft size={16} color="var(--text-secondary)" />
                        </button>
                        <button onClick={goToNextWeek} style={{
                            padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)',
                            background: '#fff', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                            <ChevronRight size={16} color="var(--text-secondary)" />
                        </button>
                    </div>
                </div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {monthLabel}
                </h3>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Week of {formatShortDate(weekDays[0])}
                </div>
            </div>

            {/* Day headers */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                {/* Time gutter */}
                <div style={{ width: '52px', flexShrink: 0, borderRight: '1px solid var(--border-color)' }} />
                {weekDays.map((d, i) => {
                    const today = isToday(d);
                    return (
                        <div key={i} style={{
                            flex: 1,
                            textAlign: 'center',
                            padding: '10px 4px',
                            borderRight: i < 6 ? '1px solid var(--border-light)' : 'none',
                            background: today ? 'rgba(232, 114, 12, 0.04)' : 'transparent'
                        }}>
                            <div style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: today ? 'var(--accent-color)' : 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                {DAY_NAMES[i]}
                            </div>
                            <div style={{
                                fontSize: '1.15rem',
                                fontWeight: 800,
                                color: today ? '#fff' : 'var(--text-primary)',
                                background: today ? 'var(--accent-color)' : 'transparent',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '4px auto 0'
                            }}>
                                {d.getDate()}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Grid */}
            <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }} className="custom-scrollbar">
                <div style={{ display: 'flex', position: 'relative' }}>
                    {/* Time labels */}
                    <div style={{ width: '52px', flexShrink: 0, borderRight: '1px solid var(--border-color)' }}>
                        {HOURS.map(h => (
                            <div key={h} style={{
                                height: `${HOUR_HEIGHT}px`,
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'flex-end',
                                padding: '0 8px',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                position: 'relative',
                                top: '-6px'
                            }}>
                                {formatHour(h)}
                            </div>
                        ))}
                    </div>

                    {/* Day columns */}
                    {weekDays.map((d, dayIdx) => {
                        const today = isToday(d);
                        const dayEvents = eventsByDay[dayIdx] || [];

                        return (
                            <div key={dayIdx} style={{
                                flex: 1,
                                position: 'relative',
                                borderRight: dayIdx < 6 ? '1px solid var(--border-light)' : 'none',
                                background: today ? 'rgba(232, 114, 12, 0.015)' : 'transparent'
                            }}>
                                {/* Hour grid lines */}
                                {HOURS.map(h => (
                                    <div key={h} style={{
                                        height: `${HOUR_HEIGHT}px`,
                                        borderBottom: '1px solid var(--border-light)'
                                    }} />
                                ))}

                                {/* Events */}
                                {dayEvents.map((evt, evtIdx) => {
                                    const start = new Date(evt.startTime);
                                    const end = new Date(evt.endTime);
                                    const startHour = start.getHours() + start.getMinutes() / 60;
                                    const endHour = end.getHours() + end.getMinutes() / 60;
                                    const top = (startHour - HOURS[0]) * HOUR_HEIGHT;
                                    const height = Math.max((endHour - startHour) * HOUR_HEIGHT, 22);
                                    const color = evt.color || EVENT_COLORS[evtIdx % EVENT_COLORS.length];

                                    return (
                                        <div
                                            key={evt.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setActivePopover({
                                                    event: evt,
                                                    x: rect.right + 10,
                                                    y: rect.top
                                                });
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: `${top}px`,
                                                left: `calc(${evt.colOffset}% + 2px)`,
                                                width: `calc(${evt.colWidth}% - 4px)`,
                                                height: `${height - 2}px`,
                                                background: `${color}18`,
                                                border: `1.5px solid ${color}`,
                                                borderLeft: `3px solid ${color}`,
                                                borderRadius: '6px',
                                                padding: '4px 6px',
                                                cursor: 'pointer',
                                                overflow: 'hidden',
                                                transition: 'all 0.15s',
                                                zIndex: 2,
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = `${color}28`;
                                                e.currentTarget.style.transform = 'scale(1.02)';
                                                e.currentTarget.style.boxShadow = `0 4px 12px ${color}30`;
                                                e.currentTarget.style.zIndex = '10';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = `${color}18`;
                                                e.currentTarget.style.transform = 'none';
                                                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                                e.currentTarget.style.zIndex = '2';
                                            }}
                                            title={`${evt.title}\n${formatTime(start)} — ${formatTime(end)}${evt.presenter ? `\nPresenter: ${evt.presenter}` : ''}`}
                                        >
                                            <div style={{
                                                fontSize: '0.68rem',
                                                fontWeight: 700,
                                                color: color,
                                                lineHeight: 1.2,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {evt.title}
                                            </div>
                                            {height > 30 && (
                                                <div style={{
                                                    fontSize: '0.62rem',
                                                    fontWeight: 600,
                                                    color: `${color}cc`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                    marginTop: '2px'
                                                }}>
                                                    <Clock size={9} />
                                                    {formatTime(start)} — {formatTime(end)}
                                                </div>
                                            )}
                                            {height > 48 && evt.presenter && (
                                                <div style={{
                                                    fontSize: '0.6rem',
                                                    fontWeight: 600,
                                                    color: `${color}aa`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                    marginTop: '1px'
                                                }}>
                                                    <Presentation size={9} />
                                                    {evt.presenter}
                                                </div>
                                            )}
                                            {height > 48 && evt.meetLink && (
                                                <div style={{
                                                    fontSize: '0.58rem',
                                                    fontWeight: 700,
                                                    color: '#10b981',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                    marginTop: '1px',
                                                    textDecoration: 'underline'
                                                }}>
                                                    <Video size={9} /> Meet
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Current time line */}
                                {today && nowDayIdx === dayIdx && nowOffset > 0 && nowOffset < HOURS.length * HOUR_HEIGHT && (
                                    <div style={{
                                        position: 'absolute',
                                        top: `${nowOffset}px`,
                                        left: 0,
                                        right: 0,
                                        height: '2px',
                                        background: '#ef4444',
                                        zIndex: 5,
                                        boxShadow: '0 0 6px rgba(239, 68, 68, 0.4)'
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            left: '-4px',
                                            top: '-4px',
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            background: '#ef4444'
                                        }} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Event Popover */}
            {activePopover && (
                <div
                    id="timetable-popover"
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                        position: 'fixed',
                        top: Math.min(activePopover.y, window.innerHeight - 450),
                        left: Math.min(activePopover.x, window.innerWidth - 300),
                        width: '300px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        background: '#fff',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        zIndex: 9999,
                        animation: 'popoverIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                >
                    <div style={{ padding: '16px', position: 'relative' }}>
                        <button
                            onClick={() => setActivePopover(null)}
                            style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                        >
                            <X size={16} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: activePopover.event.color || EVENT_COLORS[0] }} />
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', paddingRight: '20px', lineHeight: 1.3 }}>
                                {activePopover.event.title}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}>
                                <Clock size={14} color="var(--text-muted)" />
                                {formatTime(new Date(activePopover.event.startTime))} - {formatTime(new Date(activePopover.event.endTime))}
                            </div>

                            {activePopover.event.presenter && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}>
                                    <Presentation size={14} color="var(--text-muted)" />
                                    {activePopover.event.presenter}
                                </div>
                            )}

                            {activePopover.event.description && (
                                <div style={{ display: 'flex', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 500, lineHeight: 1.4 }}>
                                    <FileText size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <div style={{ maxHeight: '80px', overflowY: 'auto' }} className="custom-scrollbar">
                                        {activePopover.event.description}
                                    </div>
                                </div>
                            )}

                            {activePopover.event.guests && activePopover.event.guests.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600, marginTop: '4px' }}>
                                    <Users size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {activePopover.event.guests.slice(0, 4).map((g, i) => (
                                            <span key={i} style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', color: '#475569' }}>
                                                {g && g.length > 20 ? g.slice(0, 20) + '...' : g}
                                            </span>
                                        ))}
                                        {activePopover.event.guests.length > 4 && (
                                            <span style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', color: '#334155' }}>
                                                +{activePopover.event.guests.length - 4}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activePopover.event.meetLink ? (
                                <a
                                    href={activePopover.event.meetLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}
                                >
                                    <Video size={14} /> Join Google Meet
                                </a>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, fontStyle: 'italic' }}>
                                    <Video size={14} /> No meeting link
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ padding: '12px 16px', background: 'var(--surface-hover)', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => {
                                setActivePopover(null);
                                onEventClick?.(activePopover.event);
                            }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
                                borderRadius: '8px', background: '#fff', border: '1px solid var(--border-color)',
                                color: 'var(--accent-color)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}
                        >
                            <ExternalLink size={14} /> View Details
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes popoverIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default WeeklyTimetable;
