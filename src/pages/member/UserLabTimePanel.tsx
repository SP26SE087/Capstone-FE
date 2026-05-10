import React, { useEffect, useRef, useState } from 'react';
import { Clock, Loader2, X } from 'lucide-react';
import { userService } from '@/services/userService';

interface UserLabTimePanelProps {
    userId: string;
    userName: string;
    onClose: () => void;
}

const UserLabTimePanel: React.FC<UserLabTimePanelProps> = ({ userId, userName, onClose }) => {
    const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fetchLocked, setFetchLocked] = useState(false);
    const fetchLockTimerRef = useRef<number | null>(null);

    const toDateInputValue = (d: Date) => {
        const y = d.getFullYear();
        const m = `${d.getMonth() + 1}`.padStart(2, '0');
        const day = `${d.getDate()}`.padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const getWeekValueFromDate = (dateStr: string) => {
        const base = new Date(`${dateStr}T00:00:00`);
        if (Number.isNaN(base.getTime())) return '';

        const utcDate = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()));
        const dayNum = utcDate.getUTCDay() || 7;
        utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);

        const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    };

    const getDateFromWeekValue = (weekValue: string) => {
        const m = /^(\d{4})-W(\d{2})$/.exec(weekValue);
        if (!m) return toDateInputValue(new Date());

        const year = Number(m[1]);
        const week = Number(m[2]);
        const jan4 = new Date(Date.UTC(year, 0, 4));
        const jan4Day = jan4.getUTCDay() || 7;
        const mondayWeek1 = new Date(jan4);
        mondayWeek1.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

        const targetMonday = new Date(mondayWeek1);
        targetMonday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);

        return toDateInputValue(new Date(targetMonday.getUTCFullYear(), targetMonday.getUTCMonth(), targetMonday.getUTCDate()));
    };

    const FETCH_LOCK_MS = 1200;

    const fetchLabTime = async () => {
        if (loading || fetchLocked) return;
        setFetchLocked(true);
        setLoading(true);
        setError(null);
        try {
            const result = await userService.getLabTime(userId, period, date);
            setData(result);
        } catch {
            setError('Failed to load lab time data.');
            setData(null);
        } finally {
            setLoading(false);
            if (fetchLockTimerRef.current !== null) {
                window.clearTimeout(fetchLockTimerRef.current);
            }
            fetchLockTimerRef.current = window.setTimeout(() => setFetchLocked(false), FETCH_LOCK_MS);
        }
    };

    useEffect(() => {
        return () => {
            if (fetchLockTimerRef.current !== null) {
                window.clearTimeout(fetchLockTimerRef.current);
            }
        };
    }, []);

    const fmtTime = (iso: string) =>
        iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

    const totalHours = Number(data?.totalHours ?? 0).toFixed(1);
    const sessionCount = data?.sessions?.length ?? 0;
    const hasData = Boolean(data);
    const weekValue = getWeekValueFromDate(date);
    const monthValue = date.slice(0, 7);

    return (
        <div className="card" style={{
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--card-bg)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.3s ease-out',
            height: '100%'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.875rem 1rem',
                borderBottom: '1px solid var(--border-light)',
                background: 'rgba(var(--primary-rgb), 0.01)',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={15} style={{ color: 'var(--primary-color)' }} />
                    <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                        Lab Time
                    </h3>
                </div>
                <button onClick={onClose} title="Close" style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: '4px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <X size={16} />
                </button>
            </div>

            {/* User strip */}
            <div style={{
                padding: '0.5rem 1rem',
                background: 'var(--accent-bg)',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border-light)',
                flexShrink: 0
            }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{userName}</span>
            </div>

            {/* Controls */}
            <div style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
                flexShrink: 0
            }}>
                <select
                    value={period}
                    onChange={e => {
                        const nextPeriod = e.target.value as 'day' | 'week' | 'month';
                        setPeriod(nextPeriod);
                        if (nextPeriod === 'week') {
                            setDate(getDateFromWeekValue(getWeekValueFromDate(date)));
                        }
                        if (nextPeriod === 'month') {
                            setDate(`${date.slice(0, 7)}-01`);
                        }
                    }}
                    style={{
                        padding: '6px 10px', borderRadius: '8px', fontSize: '0.78rem',
                        border: '1px solid var(--border-color)',
                        background: 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer'
                    }}
                >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                </select>
                {period === 'day' && (
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        style={{
                            padding: '6px 10px', borderRadius: '8px', fontSize: '0.78rem',
                            border: '1px solid var(--border-color)',
                            background: 'var(--card-bg)', color: 'var(--text-primary)'
                        }}
                    />
                )}
                {period === 'week' && (
                    <input
                        type="week"
                        value={weekValue}
                        onChange={e => setDate(getDateFromWeekValue(e.target.value))}
                        style={{
                            padding: '6px 10px', borderRadius: '8px', fontSize: '0.78rem',
                            border: '1px solid var(--border-color)',
                            background: 'var(--card-bg)', color: 'var(--text-primary)'
                        }}
                    />
                )}
                {period === 'month' && (
                    <input
                        type="month"
                        value={monthValue}
                        onChange={e => setDate(`${e.target.value}-01`)}
                        style={{
                            padding: '6px 10px', borderRadius: '8px', fontSize: '0.78rem',
                            border: '1px solid var(--border-color)',
                            background: 'var(--card-bg)', color: 'var(--text-primary)'
                        }}
                    />
                )}
                <button
                    disabled={loading || fetchLocked}
                    onClick={fetchLabTime}
                    style={{
                        padding: '6px 16px', borderRadius: '8px', fontSize: '0.78rem',
                        fontWeight: 700, border: 'none',
                        cursor: loading || fetchLocked ? 'not-allowed' : 'pointer',
                        background: 'var(--primary-color)', color: '#fff',
                        display: 'flex', alignItems: 'center', gap: '5px'
                    }}
                >
                    {loading
                        ? <><Loader2 size={13} className="animate-spin" /> Loading…</>
                        : fetchLocked
                            ? 'Please wait…'
                            : 'Reload'}
                </button>
            </div>
            <p style={{ margin: '-8px 1rem 10px', fontSize: '0.74rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                {period === 'day' && `Selected day: ${new Date(`${date}T00:00:00`).toLocaleDateString('en-GB')}`}
                {period === 'week' && `Selected week starts on ${new Date(`${date}T00:00:00`).toLocaleDateString('en-GB')}`}
                {period === 'month' && `Selected month: ${new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}
            </p>

            {/* Body */}
            <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Summary */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{
                            flex: '1 1 140px', padding: '10px 14px', borderRadius: '10px',
                            background: 'var(--accent-bg)', textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-color)' }}>
                                {loading ? '…' : totalHours}
                            </div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '2px' }}>
                                Total Hours
                            </div>
                        </div>
                        <div style={{
                            flex: '1 1 140px', padding: '10px 14px', borderRadius: '10px',
                            background: '#f0fdf4', textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>
                                {loading ? '…' : sessionCount}
                            </div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '2px' }}>
                                Sessions
                            </div>
                        </div>
                    </div>

                    {loading && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '1.25rem 0' }}>
                            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary-color)' }} />
                        </div>
                    )}

                    {!loading && error && (
                        <p style={{ fontSize: '0.78rem', color: '#ef4444', textAlign: 'center', padding: '1rem 0', margin: 0 }}>{error}</p>
                    )}

                    {!loading && !error && !hasData && (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                            <Clock size={28} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.4 }} />
                            <p style={{ fontSize: '0.78rem', margin: 0 }}>Select a period and date, then click Fetch</p>
                        </div>
                    )}

                    {!loading && !error && hasData && (
                        <>
                            {/* Sessions table */}
                            {(data.sessions?.length ?? 0) > 0 ? (
                                <div style={{ border: '1px solid var(--border-light)', borderRadius: '10px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                        <thead>
                                            <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border-color)' }}>
                                                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.62rem', textTransform: 'uppercase' }}>#</th>
                                                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.62rem', textTransform: 'uppercase' }}>Check In</th>
                                                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.62rem', textTransform: 'uppercase' }}>Check Out</th>
                                                <th style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.62rem', textTransform: 'uppercase' }}>Duration</th>
                                                <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.62rem', textTransform: 'uppercase' }}>Inferred</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.sessions.map((s: any, i: number) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: '7px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                                                    <td style={{ padding: '7px 10px' }}>{fmtTime(s.checkIn)}</td>
                                                    <td style={{ padding: '7px 10px' }}>
                                                        {s.checkOut
                                                            ? fmtTime(s.checkOut)
                                                            : <span style={{ color: '#16a34a', fontWeight: 600 }}>Active</span>}
                                                    </td>
                                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>
                                                        {s.durationMinutes != null ? `${Math.round(s.durationMinutes)} min` : '—'}
                                                    </td>
                                                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                                        {s.isInferred
                                                            ? <span style={{ fontSize: '0.65rem', color: '#d97706', background: '#fefce8', border: '1px solid #fde68a', padding: '1px 7px', borderRadius: '10px', fontWeight: 700 }}>Yes</span>
                                                            : <span style={{ fontSize: '0.65rem', color: '#64748b' }}>—</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                                    No sessions found for this period.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserLabTimePanel;
