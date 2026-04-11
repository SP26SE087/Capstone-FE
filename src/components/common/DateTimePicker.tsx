import React, { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';

interface DateTimePickerProps {
    value: string;
    onChange: (value: string) => void;
    min?: string;
    disabled?: boolean;
    accentColor?: string;
    hideDate?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

const parseValue = (iso: string) => {
    if (!iso) return { date: '', hours: 0, minutes: 0 };
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { date: '', hours: 0, minutes: 0 };
    return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        hours: d.getHours(),
        minutes: d.getMinutes()
    };
};

const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ── Drum spinner ─────────────────────────────────────────────────────────────
interface DrumProps {
    inputVal: string;
    max: number;
    label: string;
    accent: string;
    disabled?: boolean;
    onUp: () => void;
    onDown: () => void;
    onInput: (v: string) => void;
    onCommit: () => void;
}

const Drum: React.FC<DrumProps> = ({ inputVal, max, label, accent, disabled, onUp, onDown, onInput, onCommit }) => {
    const [focused, setFocused] = useState(false);

    const btn = (onClick: () => void, icon: React.ReactNode, isUp: boolean) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{
                width: '24px', height: '18px', border: 'none', borderRadius: '5px',
                background: focused ? `${accent}18` : '#f1f5f9',
                color: focused ? accent : '#94a3b8',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', padding: 0, flexShrink: 0,
            }}
            onMouseEnter={e => {
                if (!disabled) {
                    e.currentTarget.style.background = `${accent}22`;
                    e.currentTarget.style.color = accent;
                    e.currentTarget.style.transform = isUp ? 'translateY(-1px)' : 'translateY(1px)';
                }
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = focused ? `${accent}18` : '#f1f5f9';
                e.currentTarget.style.color = focused ? accent : '#94a3b8';
                e.currentTarget.style.transform = 'none';
            }}
        >
            {icon}
        </button>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '0.55rem', fontWeight: 700, color: focused ? accent : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', transition: 'color 0.2s' }}>
                {label}
            </span>
            {btn(onUp, <ChevronUp size={11} strokeWidth={3} />, true)}
            <div style={{
                width: '42px', height: '36px', borderRadius: '8px',
                border: `2px solid ${focused ? accent : '#e2e8f0'}`,
                background: focused ? `${accent}08` : '#fafafa',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: focused ? `0 0 0 3px ${accent}18` : 'inset 0 1px 3px rgba(0,0,0,0.04)'
            }}>
                <input
                    type="text"
                    inputMode="numeric"
                    value={inputVal}
                    disabled={disabled}
                    maxLength={2}
                    onChange={e => onInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    onFocus={() => setFocused(true)}
                    onBlur={() => { setFocused(false); onCommit(); }}
                    onKeyDown={e => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'ArrowUp') { e.preventDefault(); onUp(); }
                        if (e.key === 'ArrowDown') { e.preventDefault(); onDown(); }
                    }}
                    style={{
                        width: '100%', height: '100%', border: 'none', background: 'transparent',
                        textAlign: 'center', fontSize: '0.95rem', fontWeight: 800,
                        fontFamily: "'SF Mono','Fira Code','Courier New',monospace",
                        color: focused ? accent : '#1e293b',
                        outline: 'none', cursor: disabled ? 'not-allowed' : 'text',
                        transition: 'color 0.2s', padding: 0
                    }}
                />
            </div>
            {btn(onDown, <ChevronDown size={11} strokeWidth={3} />, false)}
            <span style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 700 }}>0–{max}</span>
        </div>
    );
};

// ── Main ─────────────────────────────────────────────────────────────────────
const DateTimePicker: React.FC<DateTimePickerProps> = ({ value, onChange, min, disabled, accentColor, hideDate }) => {
    const parsed = parseValue(value);
    const [date, setDate] = useState(parsed.date);
    const [hours, setHours] = useState(parsed.hours);
    const [minutes, setMinutes] = useState(parsed.minutes);
    const [hourInput, setHourInput] = useState(pad(parsed.hours));
    const [minuteInput, setMinuteInput] = useState(pad(parsed.minutes));
    const [pastError, setPastError] = useState(false);
    const dateRef = useRef<HTMLInputElement>(null);

    // resolve CSS var to actual hex for use in inline styles
    const accent = accentColor && !accentColor.startsWith('var(') ? accentColor : '#e8720c';

    useEffect(() => {
        const p = parseValue(value);
        setDate(p.date); setHours(p.hours); setMinutes(p.minutes);
        setHourInput(pad(p.hours)); setMinuteInput(pad(p.minutes));
    }, [value]);

    const emit = (d: string, h: number, m: number) => {
        if (!d) return;
        const candidate = new Date(`${d}T${pad(h)}:${pad(m)}:00`);
        const now = new Date();
        now.setSeconds(0, 0);
        const minDt = min ? new Date(min) : now;
        const effective = minDt > now ? minDt : now;
        if (candidate < effective) {
            setPastError(true);
            return;
        }
        setPastError(false);
        onChange(`${d}T${pad(h)}:${pad(m)}:00`);
    };

    const handleDateChange = (v: string) => {
        // Block past dates
        const minD = min ? min.split('T')[0] : today();
        if (v < minD) return;
        setDate(v); emit(v, hours, minutes);
    };

    const changeHour = (delta: number) => {
        const next = (hours + delta + 24) % 24;
        setHours(next); setHourInput(pad(next)); emit(date, next, minutes);
    };
    const handleHourInput = (v: string) => {
        setHourInput(v);
        const n = parseInt(v, 10);
        if (!isNaN(n) && n >= 0 && n <= 23) { setHours(n); emit(date, n, minutes); }
    };
    const commitHour = () => {
        const n = parseInt(hourInput, 10);
        const c = isNaN(n) ? 0 : Math.max(0, Math.min(23, n));
        setHours(c); setHourInput(pad(c)); emit(date, c, minutes);
    };

    const changeMinute = (delta: number) => {
        const next = (minutes + delta + 60) % 60;
        setMinutes(next); setMinuteInput(pad(next)); emit(date, hours, next);
    };
    const handleMinuteInput = (v: string) => {
        setMinuteInput(v);
        const n = parseInt(v, 10);
        if (!isNaN(n) && n >= 0 && n <= 59) { setMinutes(n); emit(date, hours, n); }
    };
    const commitMinute = () => {
        const n = parseInt(minuteInput, 10);
        const c = isNaN(n) ? 0 : Math.max(0, Math.min(59, n));
        setMinutes(c); setMinuteInput(pad(c)); emit(date, hours, c);
    };

    const minDate = min ? min.split('T')[0] : today();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const }}>
            {/* Date — compact, click opens native picker */}
            {!hideDate && (
                <div style={{ position: 'relative', flex: 1, minWidth: '140px' }}>
                    <input
                        ref={dateRef}
                        type="date"
                        value={date}
                        min={minDate}
                        disabled={disabled}
                        onChange={e => handleDateChange(e.target.value)}
                        style={{
                            width: '100%', height: '36px', padding: '0 10px',
                            borderRadius: '8px', border: `1.5px solid #e2e8f0`,
                            fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit',
                            outline: 'none', background: disabled ? '#f8fafc' : '#fff',
                            color: date ? '#1e293b' : '#94a3b8',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            boxSizing: 'border-box' as const
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}18`; }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                </div>
            )}

            {/* Divider */}
            {!hideDate && <div style={{ width: '1px', height: '28px', background: '#e2e8f0', flexShrink: 0 }} />}

            {/* Hour + Minute drums */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <Drum
                    inputVal={hourInput} max={23} label="HH" accent={accent} disabled={disabled}
                    onUp={() => changeHour(1)} onDown={() => changeHour(-1)}
                    onInput={handleHourInput} onCommit={commitHour}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#cbd5e1' }} />
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#cbd5e1' }} />
                </div>
                <Drum
                    inputVal={minuteInput} max={59} label="MM" accent={accent} disabled={disabled}
                    onUp={() => changeMinute(1)} onDown={() => changeMinute(-1)}
                    onInput={handleMinuteInput} onCommit={commitMinute}
                />
            </div>
        </div>
        {pastError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>
                <AlertCircle size={13} /> Cannot select a date/time in the past.
            </div>
        )}
        </div>
    );
};

export default DateTimePicker;
