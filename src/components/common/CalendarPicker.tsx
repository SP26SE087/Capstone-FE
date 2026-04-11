import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface CalendarPickerProps {
    value: string; // YYYY-MM-DD
    onChange: (value: string) => void;
    minDate?: string; // YYYY-MM-DD
    disabled?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const navBtn: React.CSSProperties = {
    width: '28px', height: '28px', borderRadius: '7px',
    border: '1px solid #e2e8f0', background: '#f8fafc',
    color: '#475569', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s', flexShrink: 0
};

const CalendarPicker: React.FC<CalendarPickerProps> = ({ value, onChange, minDate, disabled }) => {
    const [open, setOpen] = useState(false);
    const today = todayStr();

    const parsedInit = () => {
        const src = value || today;
        const d = new Date(src + 'T00:00:00');
        return { y: d.getFullYear(), m: d.getMonth() };
    };

    const [viewYear, setViewYear] = useState(parsedInit().y);
    const [viewMonth, setViewMonth] = useState(parsedInit().m);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (value) {
            const d = new Date(value + 'T00:00:00');
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
        }
    }, [value]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    // Build grid cells (Mon-first)
    const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const startOffset = firstDow === 0 ? 6 : firstDow - 1;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const handleSelect = (day: number) => {
        const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
        if (minDate && dateStr < minDate) return;
        onChange(dateStr);
        setOpen(false);
    };

    const handleToday = () => {
        if (!minDate || today >= minDate) {
            onChange(today);
            const now = new Date();
            setViewYear(now.getFullYear());
            setViewMonth(now.getMonth());
            setOpen(false);
        }
    };

    const displayValue = value
        ? (() => {
            const d = new Date(value + 'T00:00:00');
            return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
        })()
        : 'Select date';

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
                style={{
                    width: '100%', height: '40px', padding: '0 14px',
                    borderRadius: '10px',
                    border: `1.5px solid ${open ? '#e8720c' : 'var(--border-color)'}`,
                    boxShadow: open ? '0 0 0 3px rgba(232,114,12,0.08)' : 'none',
                    background: disabled ? '#f8fafc' : '#fff',
                    color: value ? '#1e293b' : '#94a3b8',
                    fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
            >
                <Calendar size={15} color={value ? '#e8720c' : '#94a3b8'} />
                {displayValue}
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000,
                    background: '#fff', borderRadius: '14px',
                    border: '1.5px solid #e2e8f0',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                    padding: '14px', width: '272px'
                }}>
                    {/* Month / Year header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <button type="button" onClick={prevMonth} style={navBtn}>
                            <ChevronLeft size={15} />
                        </button>
                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b' }}>
                            {MONTHS[viewMonth]} {viewYear}
                        </span>
                        <button type="button" onClick={nextMonth} style={navBtn}>
                            <ChevronRight size={15} />
                        </button>
                    </div>

                    {/* Day names */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
                        {DAY_LABELS.map(d => (
                            <div key={d} style={{
                                textAlign: 'center', fontSize: '0.65rem',
                                fontWeight: 800, color: '#94a3b8', padding: '2px 0'
                            }}>
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Day cells */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                        {cells.map((day, idx) => {
                            if (!day) return <div key={`_${idx}`} />;
                            const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
                            const isSelected = dateStr === value;
                            const isToday = dateStr === today;
                            const isPast = !!minDate && dateStr < minDate;

                            return (
                                <button
                                    key={day}
                                    type="button"
                                    disabled={isPast}
                                    onClick={() => handleSelect(day)}
                                    style={{
                                        width: '100%', aspectRatio: '1', borderRadius: '8px',
                                        border: isToday && !isSelected ? '1.5px solid #e8720c' : '1px solid transparent',
                                        background: isSelected ? '#e8720c' : 'transparent',
                                        color: isSelected ? '#fff' : isPast ? '#cbd5e1' : '#1e293b',
                                        fontSize: '0.78rem', fontWeight: isSelected || isToday ? 800 : 500,
                                        cursor: isPast ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.12s'
                                    }}
                                    onMouseEnter={e => {
                                        if (!isPast && !isSelected)
                                            e.currentTarget.style.background = 'rgba(232,114,12,0.1)';
                                    }}
                                    onMouseLeave={e => {
                                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    {/* Today shortcut */}
                    <button
                        type="button"
                        onClick={handleToday}
                        disabled={!!minDate && today < minDate}
                        style={{
                            marginTop: '10px', width: '100%', padding: '6px',
                            borderRadius: '8px', border: '1px solid #e2e8f0',
                            background: '#f8fafc', color: '#64748b',
                            fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                            transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; }}
                    >
                        Today
                    </button>
                </div>
            )}
        </div>
    );
};

export default CalendarPicker;
