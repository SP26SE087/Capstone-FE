import React, { useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type BookingStyleMonthGridEvent = {
    id: string;
    title: string;
    startTime: string;
    endTime?: string | null;
    color?: string;
    meta?: Record<string, unknown>;
};

export function sameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

export function buildMonthGrid(year: number, month: number): Date[] {
    const first = new Date(year, month, 1);
    const firstDow = (first.getDay() + 6) % 7; // Monday = 0
    const start = new Date(year, month, 1 - firstDow);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        d.setHours(0, 0, 0, 0);
        days.push(d);
    }
    return days;
}

function fmtTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function hexToRgba(hex: string, alpha: number): string {
    const raw = (hex || '').trim();
    const normalized = raw.startsWith('#') ? raw.slice(1) : raw;
    if (normalized.length === 3) {
        const r = parseInt(normalized[0] + normalized[0], 16);
        const g = parseInt(normalized[1] + normalized[1], 16);
        const b = parseInt(normalized[2] + normalized[2], 16);
        if ([r, g, b].some(n => Number.isNaN(n))) return `rgba(148,163,184,${alpha})`;
        return `rgba(${r},${g},${b},${alpha})`;
    }
    if (normalized.length === 6) {
        const r = parseInt(normalized.slice(0, 2), 16);
        const g = parseInt(normalized.slice(2, 4), 16);
        const b = parseInt(normalized.slice(4, 6), 16);
        if ([r, g, b].some(n => Number.isNaN(n))) return `rgba(148,163,184,${alpha})`;
        return `rgba(${r},${g},${b},${alpha})`;
    }
    return `rgba(148,163,184,${alpha})`;
}

function eventsOnDay(events: BookingStyleMonthGridEvent[], date: Date): BookingStyleMonthGridEvent[] {
    return events.filter(evt => {
        const s = new Date(evt.startTime);
        if (isNaN(s.getTime())) return false;
        return (
            s.getFullYear() === date.getFullYear() &&
            s.getMonth() === date.getMonth() &&
            s.getDate() === date.getDate()
        );
    });
}

function MonthEventPreview({
    event,
    onClick,
}: {
    event: BookingStyleMonthGridEvent;
    onClick?: (event: BookingStyleMonthGridEvent) => void;
}) {
    const accent = event.color || '#E8720C';
    const bg = hexToRgba(accent, 0.14);
    const border = hexToRgba(accent, 0.28);
    const time = fmtTime(event.startTime);

    return (
        <div
            className="bk-cal-event"
            onClick={(e) => {
                e.stopPropagation();
                onClick?.(event);
            }}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 6px',
                border: `1px solid ${border}`,
                background: bg,
                color: '#334155',
                borderRadius: 4,
                borderLeft: `3px solid ${accent}`,
                fontSize: 11.5,
                fontWeight: 600,
                cursor: onClick ? 'pointer' : 'default',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
            }}
            title={event.endTime ? `${event.title} · ${time}–${fmtTime(event.endTime)}` : `${event.title} · ${time}`}
            role={onClick ? 'button' : undefined}
        >
            {time && <span style={{ fontWeight: 700, minWidth: 28, flexShrink: 0 }}>{time}</span>}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</span>
        </div>
    );
}

export function BookingStyleMonthNav({
    year,
    month,
    setMonth,
    setYear,
}: {
    year: number;
    month: number;
    setMonth: (m: number) => void;
    setYear: (y: number) => void;
}) {
    const monthName = new Date(year, month, 1).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
    });

    const prev = () => {
        if (month === 0) {
            setMonth(11);
            setYear(year - 1);
        } else {
            setMonth(month - 1);
        }
    };

    const next = () => {
        if (month === 11) {
            setMonth(0);
            setYear(year + 1);
        } else {
            setMonth(month + 1);
        }
    };

    const goToday = () => {
        const t = new Date();
        setMonth(t.getMonth());
        setYear(t.getFullYear());
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={prev} className="icon-btn" style={{ width: 30, height: 30 }}>
                <ChevronLeft size={16} />
            </button>
            <div
                style={{
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: '-0.01em',
                    minWidth: 150,
                    textAlign: 'center',
                }}
            >
                {monthName}
            </div>
            <button onClick={next} className="icon-btn" style={{ width: 30, height: 30 }}>
                <ChevronRight size={16} />
            </button>
            <button
                onClick={goToday}
                style={{
                    height: 30,
                    padding: '0 12px',
                    background: '#fff',
                    color: '#1e293b',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                }}
            >
                Today
            </button>
        </div>
    );
}

export function BookingStyleMonthGrid({
    year,
    month,
    events,
    selectedDate,
    onSelectDate,
    onEventClick,
    minWidth = 600,
}: {
    year: number;
    month: number;
    events: BookingStyleMonthGridEvent[];
    selectedDate: Date | null;
    onSelectDate: (d: Date) => void;
    onEventClick?: (event: BookingStyleMonthGridEvent) => void;
    minWidth?: number;
}) {
    const days = useMemo(() => buildMonthGrid(year, month), [year, month]);
    const today = useMemo(() => {
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return t;
    }, []);

    const todayRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!todayRef.current || !scrollRef.current) return;
        const container = scrollRef.current;
        const cell = todayRef.current;
        const cellTop = cell.offsetTop;
        const cellHeight = cell.offsetHeight;
        const containerHeight = container.clientHeight;
        container.scrollTo({
            top: cellTop - containerHeight / 2 + cellHeight / 2,
            behavior: 'smooth',
        });
    }, [year, month]);

    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div
            ref={scrollRef}
            className="bk-card bk-scroll"
            style={{
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minWidth: 0,
            }}
        >
            <div style={{ minWidth }}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7,minmax(80px,1fr))',
                        borderBottom: '1px solid #e2e8f0',
                        background: '#f8fafc',
                    }}
                >
                    {weekdays.map((w) => (
                        <div
                            key={w}
                            style={{
                                padding: '9px 10px',
                                fontSize: 11,
                                fontWeight: 800,
                                color: '#94a3b8',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                            }}
                        >
                            {w}
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7,minmax(80px,1fr))',
                        gridAutoRows: 'minmax(122px, 1fr)',
                    }}
                >
                    {days.map((day, i) => {
                        const inMonth = day.getMonth() === month;
                        const isToday = sameDay(day, today);
                        const isSelected = selectedDate ? sameDay(day, selectedDate) : false;
                        const dayEvents = eventsOnDay(events, day)
                            .slice()
                            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

                        const maxVisible = dayEvents.length > 2 ? 2 : 3;
                        const overflow = dayEvents.length - maxVisible;

                        return (
                            <div
                                key={`${day.toISOString()}-${i}`}
                                ref={isToday ? todayRef : null}
                                onClick={() => onSelectDate(day)}
                                className="bk-cal-cell"
                                style={{
                                    borderRight: i % 7 !== 6 ? '1px solid #f1f5f9' : 'none',
                                    borderBottom: i < 35 ? '1px solid #f1f5f9' : 'none',
                                    padding: 6,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 3,
                                    background: isSelected ? '#fff7ed' : 'transparent',
                                    cursor: 'pointer',
                                    minHeight: 0,
                                    opacity: inMonth ? 1 : 0.4,
                                    position: 'relative',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: 2,
                                    }}
                                >
                                    <span
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 13.5,
                                            fontWeight: isToday ? 800 : 600,
                                            color: isToday ? '#fff' : isSelected ? '#E8720C' : '#1e293b',
                                            background: isToday ? '#E8720C' : 'transparent',
                                            width: isToday ? 22 : 'auto',
                                            height: isToday ? 22 : 'auto',
                                            borderRadius: isToday ? '50%' : 0,
                                        }}
                                    >
                                        {day.getDate()}
                                    </span>
                                    {dayEvents.length > 0 && (
                                        <span
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: '#94a3b8',
                                            }}
                                        >
                                            {dayEvents.length}
                                        </span>
                                    )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {dayEvents.slice(0, maxVisible).map((evt) => (
                                        <MonthEventPreview key={evt.id} event={evt} onClick={onEventClick} />
                                    ))}
                                    {overflow > 0 && (
                                        <span
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: '#94a3b8',
                                                padding: '2px 4px',
                                            }}
                                        >
                                            +{overflow} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
