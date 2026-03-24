import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Resource, CreateBookingRequest, Booking, BookingStatus } from '@/types/booking';
import { X, Calendar, Clock, ChevronLeft, ChevronRight, Package, FileText, AlertCircle, Plus, Minus } from 'lucide-react';
import { bookingService } from '@/services/bookingService';

interface BookingModalProps {
  resource: Resource;
  onClose: () => void;
  onSubmit: (request: CreateBookingRequest) => void;
}

// ─── Styles ───────────────────────────────────────────────────────
const S = {
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 5000, paddingTop: '80px', paddingBottom: '60px' },
  modal: { width: '860px', maxWidth: '95vw', maxHeight: '85vh', background: '#fff', borderRadius: '20px', boxShadow: '0 25px 60px -15px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  header: { padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  body: { padding: '24px', overflowY: 'auto' as const, flex: 1, display: 'flex', flexDirection: 'column' as const, gap: '24px' },
  footer: { padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc' },
  label: { fontSize: '0.75rem', fontWeight: 700 as const, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' },
  input: { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600 as const, outline: 'none', transition: 'border 0.2s' },
  section: { background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' },
  calDay: (_active: boolean, inRange: boolean, isPast: boolean, isEdge: boolean) => ({
    width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.8rem', fontWeight: 700 as const, cursor: isPast ? 'not-allowed' : 'pointer',
    background: isEdge ? 'var(--accent-color)' : inRange ? 'rgba(99,102,241,0.12)' : isPast ? '#f8fafc' : '#fff',
    color: isEdge ? '#fff' : inRange ? 'var(--accent-color)' : isPast ? '#cbd5e1' : '#334155',
    border: isEdge ? '2px solid var(--accent-color)' : inRange ? '1px solid rgba(99,102,241,0.3)' : '1px solid #e2e8f0',
    transition: 'all 0.15s ease',
  }),
};

const BookingModal: React.FC<BookingModalProps> = ({ resource, onClose, onSubmit }) => {
  // ─── State ────────────────────────────────────────────
  const now = new Date();
  const fmt = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [activeTab, setActiveTab] = useState<'schedule' | 'details'>('details');
  const [startTime, setStartTime] = useState(fmt(now));
  const [endTime, setEndTime] = useState(fmt(new Date(now.getTime() + 7200000)));
  const [quantity, setQuantity] = useState(1);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  // Simple selection state
  const [selectingDateEnd, setSelectingDateEnd] = useState(false);
  const draggingDate = useRef(false);
  const dateAnchor = useRef<Date | null>(null);
  const hasMovedDate = useRef(false);

  // ── Date selection: click or drag ──
  const handleDateDown = useCallback((date: Date) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (date < today) return;

    if (selectingDateEnd) {
      const s = new Date(startTime); s.setHours(0, 0, 0, 0);
      const d = new Date(date);
      if (date >= s) {
        d.setHours(new Date(endTime).getHours(), new Date(endTime).getMinutes(), 0, 0);
        setEndTime(fmt(d));
      } else {
        d.setHours(new Date(startTime).getHours(), new Date(startTime).getMinutes(), 0, 0);
        setStartTime(fmt(d));
      }
      setSelectingDateEnd(false);
      return;
    }

    draggingDate.current = true;
    dateAnchor.current = date;
    hasMovedDate.current = false;
    const d = new Date(date);
    d.setHours(new Date(startTime).getHours(), new Date(startTime).getMinutes(), 0, 0);
    setStartTime(fmt(d));
    const e = new Date(date);
    e.setHours(new Date(endTime).getHours(), new Date(endTime).getMinutes(), 0, 0);
    if (e <= d) e.setTime(d.getTime() + 7200000);
    setEndTime(fmt(e));
  }, [selectingDateEnd, startTime, endTime]);

  const handleDateEnter = useCallback((date: Date) => {
    if (!draggingDate.current || !dateAnchor.current) return;
    if (date.getTime() !== dateAnchor.current.getTime()) hasMovedDate.current = true;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (date < today) return;

    const anchor = dateAnchor.current;
    const sDate = new Date(Math.min(anchor.getTime(), date.getTime()));
    const eDate = new Date(Math.max(anchor.getTime(), date.getTime()));

    const s = new Date(sDate);
    s.setHours(new Date(startTime).getHours(), new Date(startTime).getMinutes(), 0, 0);
    setStartTime(fmt(s));

    const e = new Date(eDate);
    e.setHours(new Date(endTime).getHours(), new Date(endTime).getMinutes(), 0, 0);
    setEndTime(fmt(e));
  }, [startTime, endTime]);

  const handleDateUp = useCallback(() => {
    if (draggingDate.current) {
      draggingDate.current = false;
      const anchor = dateAnchor.current;
      dateAnchor.current = null;
      if (!anchor) return;

      if (!hasMovedDate.current) {
        setSelectingDateEnd(true);
      }
    }
  }, []);

  // ─── Time selection manually ───
  const updateTime = (type: 'start' | 'end', update: { h?: string; m?: string }) => {
    const base = new Date(type === 'start' ? startTime : endTime);
    if (update.h !== undefined) base.setHours(parseInt(update.h));
    if (update.m !== undefined) base.setMinutes(parseInt(update.m));
    if (type === 'start') setStartTime(fmt(base));
    else setEndTime(fmt(base));
  };

  // Global mouseup cleanup
  useEffect(() => {
    const up = () => { draggingDate.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // ─── Fetch existing bookings ──────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await bookingService.getAll(1, 200);
        const items = (res as any).items || (Array.isArray(res) ? res : []);
        setExistingBookings(items.filter((b: any) =>
          String(b.resourceId) === String(resource.id) && [BookingStatus.Pending, BookingStatus.Approved, BookingStatus.InUse].includes(Number(b.status))
        ));
      } catch { /* silent */ }
    })();
  }, [resource.id]);

  // ─── Dynamic availability ─────────────────────────────
  const dynamicAvailable = useMemo(() => {
    if ([3, 4].includes(Number(resource.status))) return 0;
    const s = new Date(startTime).getTime(), e = new Date(endTime).getTime();
    if (isNaN(s) || isNaN(e) || s >= e) return resource.availableQuantity;

    // Collect all relevant time boundaries (only ones within our selected range)
    const boundaries = new Set<number>();
    boundaries.add(s);
    boundaries.add(e);

    existingBookings.forEach(b => {
      const bS = new Date(b.startTime).getTime();
      const bE = new Date(b.endTime).getTime();
      if (bS > s && bS < e) boundaries.add(bS);
      if (bE > s && bE < e) boundaries.add(bE);
    });

    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
    let peakOccupancy = 0;

    // Check each discrete segment between boundaries
    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      const midpoint = sortedBoundaries[i] + 1; // Check occupancy at just after the boundary
      let occ = 0;
      existingBookings.forEach(b => {
        if (new Date(b.startTime).getTime() <= midpoint && new Date(b.endTime).getTime() > midpoint) {
          occ += (b.quantity || 1);
        }
      });
      peakOccupancy = Math.max(peakOccupancy, occ);
    }

    return Math.max(0, resource.availableQuantity - peakOccupancy);
  }, [startTime, endTime, existingBookings, resource.availableQuantity, resource.status]);

  useEffect(() => {
    if (dynamicAvailable > 0) {
      if (quantity > dynamicAvailable) setQuantity(dynamicAvailable);
    } else {
      setQuantity(0);
    }
  }, [dynamicAvailable, quantity]);

  // ─── Validation ───────────────────────────────────────
  const error = useMemo(() => {
    if (quantity < 1 && dynamicAvailable > 0) return 'Select at least 1 unit';
    if (quantity > dynamicAvailable) return `Only ${dynamicAvailable} available`;
    const s = new Date(startTime), e = new Date(endTime);
    if (s >= e) return 'Time range is invalid';
    if (e.getTime() - s.getTime() > 14 * 24 * 60 * 60 * 1000) return 'Booking duration cannot exceed 2 weeks';
    return '';
  }, [startTime, endTime, quantity, dynamicAvailable]);

  const durationDisplay = useMemo(() => {
    const s = new Date(startTime), e = new Date(endTime);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null;
    const diff = e.getTime() - s.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const res = [];
    if (days > 0) res.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) res.push(`${hours}h`);
    if (minutes > 0) res.push(`${minutes}m`);
    return res.join(' ');
  }, [startTime, endTime]);

  // ─── Calendar helpers ─────────────────────────────────
  const calDays = useMemo(() => {
    const first = new Date(calYear, calMonth, 1);
    const startDay = (first.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calYear, calMonth, d));
    return cells;
  }, [calMonth, calYear]);

  const isDayInRange = (d: Date) => {
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    const s = new Date(startTime); s.setHours(0, 0, 0, 0);
    const e = new Date(endTime);
    // If end time is midnight (00:00 of next day), visually treat as previous day for highlighting
    if (e.getHours() === 0 && e.getMinutes() === 0 && e.getTime() > s.getTime()) {
      e.setDate(e.getDate() - 1);
    }
    e.setHours(0, 0, 0, 0);
    return day >= s && day <= e;
  };

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // ─── Day-level occupancy status ───────────────────────
  const dayStatusMap = useMemo(() => {
    const stats: Record<string, number> = {};
    calDays.forEach(day => {
      if (!day) return;
      const key = day.toDateString();
      const s = new Date(day); s.setHours(0, 0, 0, 0);
      const e = new Date(day); e.setHours(23, 59, 59, 999);

      let peak = 0;
      const events: { t: number, v: number }[] = [];
      existingBookings.forEach(b => {
        const bs = new Date(b.startTime).getTime();
        const be = new Date(b.endTime).getTime();
        if (bs < e.getTime() && be > s.getTime()) {
          events.push({ t: Math.max(s.getTime(), bs), v: b.quantity || 1 });
          events.push({ t: Math.min(e.getTime(), be), v: -(b.quantity || 1) });
        }
      });
      events.sort((a, b) => a.t - b.t || a.v - b.v);
      let cur = 0;
      events.forEach(ev => {
        cur += ev.v;
        if (cur > peak) peak = cur;
      });

      if (peak >= resource.availableQuantity) stats[key] = 2; // Full
      else if (peak > 0) stats[key] = 1; // Partial
      else stats[key] = 0;
    });
    return stats;
  }, [calDays, existingBookings, resource.availableQuantity]);



  // ─── Status badge ────────────────────────────────────
  const statusBadge = (s: number) => {
    const map: Record<number, { bg: string; color: string; label: string }> = {
      1: { bg: '#dcfce7', color: '#166534', label: 'Available' },
      2: { bg: '#dbeafe', color: '#1e40af', label: 'In Use' },
      3: { bg: '#fef3c7', color: '#92400e', label: 'Maintenance' },
      4: { bg: '#f1f5f9', color: '#475569', label: 'Retired' },
    };
    const info = map[s]; if (!info) return null;
    return <span style={{ background: info.bg, color: info.color, padding: '3px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 700 }}>{info.label}</span>;
  };

  // ─── Submit ──────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error || quantity < 1) return;
    if (!title || !purpose) {
      setActiveTab('details');
      return;
    }
    onSubmit({
      resourceId: resource.id,
      title,
      purpose,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      quantity
    });
  };

  // ─── Render ──────────────────────────────────────────
  const sObj = new Date(startTime), eObj = new Date(endTime);
  const fmtDate = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  // ─── Time Stepper Component ───
  const renderStepper = (type: 'start' | 'end', field: 'h' | 'm', label: string) => {
    const date = type === 'start' ? sObj : eObj;
    const value = field === 'h' ? date.getHours() : date.getMinutes();
    const max = field === 'h' ? 23 : 59;
    const handleAdj = (delta: number) => {
      let next = value + delta;
      if (next < 0) next = max;
      if (next > max) next = 0;
      updateTime(type, { [field]: next.toString() });
    };
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>{label}</div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
          onWheel={(e) => { e.preventDefault(); handleAdj(e.deltaY < 0 ? 1 : -1); }}
        >
          <button type="button" onClick={() => handleAdj(-1)} style={{ width: '28px', height: '28px', border: 'none', background: '#f8fafc', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <Minus size={14} />
          </button>
          <div style={{ width: '36px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-color)', fontFamily: 'monospace' }}>
            {value.toString().padStart(2, '0')}
          </div>
          <button type="button" onClick={() => handleAdj(1)} style={{ width: '28px', height: '28px', border: 'none', background: '#f8fafc', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <Plus size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        {/* ── Header ── */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={20} style={{ color: 'var(--accent-color)' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Book: {resource.name}</h2>
                {statusBadge(Number(resource.status))}
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Capacity: <b style={{ color: '#334155' }}>{resource.availableQuantity}</b> &middot; Available now: <b style={{ color: dynamicAvailable > 0 ? '#16a34a' : '#ef4444' }}>{dynamicAvailable}</b>
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} color="#64748b" />
          </button>
        </div>

        {/* ── Body ── */}
        <form onSubmit={handleSubmit} style={S.body}>

          {/* Browser-style Tabs */}
          <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #e2e8f0', marginBottom: '0' }}>
            {(['details', 'schedule'] as const).map(tab => {
              const needsDetails = tab === 'details' && (!title || !purpose);
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '10px 24px', cursor: 'pointer', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--accent-color)' : '2px solid transparent',
                    marginBottom: '-2px', background: 'transparent', transition: 'all 0.2s',
                    fontSize: '0.85rem', fontWeight: 800, color: activeTab === tab ? 'var(--accent-color)' : '#94a3b8',
                    display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' as const,
                  }}
                >
                  {tab === 'details' ? <><FileText size={14} /> Details</> : <><Calendar size={14} /> Schedule</>}
                  {needsDetails && (
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', position: 'absolute', top: '12px', right: '12px', border: '1.5px solid #fff' }} />
                  )}
                </button>
              );
            })}
          </div>

          {activeTab === 'details' ? (
            /* ── Details Tab: Title + Purpose ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s ease' }}>
              <div>
                <label style={S.label}><FileText size={13} /> Booking Name</label>
                <input value={title} onChange={e => setTitle(e.target.value)} maxLength={300} placeholder="e.g., Lab session A" required style={S.input} />
                <div style={{ textAlign: 'right', fontSize: '0.6rem', color: '#94a3b8', marginTop: '4px' }}>{title.length}/300</div>
              </div>
              <div>
                <label style={S.label}><FileText size={13} /> Purpose & Impact</label>
                <textarea value={purpose} onChange={e => setPurpose(e.target.value)} maxLength={2000} placeholder="Describe what you need this resource for..." required style={{ ...S.input, height: '120px', resize: 'none', lineHeight: 1.6 }} />
              </div>
            </div>
          ) : (
            /* ── Schedule Tab: Calendar + Time ── */
            <>

              {/* Row 2: Calendar + Time Matrix side-by-side */}
              <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '16px' }}>

                {/* ── Calendar ── */}
                <div style={S.section}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <button type="button" onClick={prevMonth} style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={14} /></button>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{MONTHS[calMonth]} {calYear}</span>
                    <button type="button" onClick={nextMonth} style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={14} /></button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '8px' }}>
                    {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => <span key={d} style={{ fontSize: '0.6rem', fontWeight: 800, color: '#94a3b8' }}>{d}</span>)}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', justifyItems: 'center' }}>
                     {calDays.map((day, i) => {
                       if (!day) return <div key={`empty-${i}`} />;
                       const today = new Date(); today.setHours(0, 0, 0, 0);
                       const isPast = day < today;
                       const inRange = isDayInRange(day);
                       const isStart = sObj.toDateString() === day.toDateString();
                       const isEnd = eObj.toDateString() === day.toDateString();
                       const status = dayStatusMap[day.toDateString()] || 0;

                       return (
                         <div
                           key={i}
                           onMouseDown={(e) => { e.preventDefault(); handleDateDown(day); }}
                           onMouseEnter={() => handleDateEnter(day)}
                           onMouseUp={handleDateUp}
                           style={{
                             ...S.calDay(false, inRange, isPast, isStart || isEnd),
                             position: 'relative',
                             ...(status === 2 && !isPast && !isStart && !isEnd ? { background: '#fff1f2', borderColor: '#fecaca', color: '#e11d48' } : {})
                           }}
                         >
                           {day.getDate()}
                           {status === 1 && !isPast && !isStart && !isEnd && (
                             <div style={{ position: 'absolute', bottom: '4px', width: '4px', height: '4px', borderRadius: '50%', background: '#f59e0b' }} />
                           )}
                           {status === 2 && !isPast && !isStart && !isEnd && (
                             <div style={{ position: 'absolute', bottom: '4px', width: '12px', height: '2px', borderRadius: '1px', background: '#ef4444' }} />
                           )}
                         </div>
                       );
                     })}
                   </div>

                   {/* Calendar Legend */}
                   <div style={{ marginTop: '16px', display: 'flex', gap: '12px', padding: '0 4px' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>
                       <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} /> Partial
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>
                       <div style={{ width: '10px', height: '2px', background: '#ef4444' }} /> Fully Booked
                     </div>
                   </div>

                  {/* Selected range summary */}
                  <div style={{ marginTop: '16px', padding: '10px 12px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{selectingDateEnd ? 'Now click END date' : 'Click or drag to select dates'}</span>
                      {durationDisplay && <span style={{ color: 'var(--accent-color)', fontWeight: 900 }}>{durationDisplay}</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                      {fmtDate(sObj)} → {fmtDate(eObj)}
                    </div>
                  </div>
                </div>

                {/* ── Time Selection ── */}
                <div style={S.section}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <Clock size={16} color="#64748b" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>Select Pickup & Return Time</span>
                  </div>

                   <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                     {/* Pickup Time Section */}
                     <div>
                       <div style={{ ...S.label, color: 'var(--accent-color)', marginBottom: '16px' }}>Pickup Time (Expected)</div>
                       <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#fff', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                         {renderStepper('start', 'h', 'Hour')}
                         <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e2e8f0', marginTop: '14px' }}>:</span>
                         {renderStepper('start', 'm', 'Minute')}
                       </div>
                     </div>

                     {/* Return Time Section */}
                     <div>
                       <div style={{ ...S.label, color: 'var(--accent-color)', marginBottom: '16px' }}>Return Time (Expected)</div>
                       <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#fff', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                         {renderStepper('end', 'h', 'Hour')}
                         <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e2e8f0', marginTop: '14px' }}>:</span>
                         {renderStepper('end', 'm', 'Minute')}
                       </div>
                     </div>
                   </div>


                  {/* Units selection moved here */}
                  <div style={{ marginTop: '16px', padding: '12px 16px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Package size={16} color="#64748b" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>QUANTITY</span>
                    </div>
                    <input
                      type="range"
                      min={dynamicAvailable > 0 ? 1 : 0}
                      max={Math.max(0, dynamicAvailable)}
                      value={quantity}
                      onChange={e => setQuantity(parseInt(e.target.value))}
                      disabled={dynamicAvailable <= 0}
                      style={{ flex: 1, accentColor: 'var(--accent-color)', cursor: dynamicAvailable > 0 ? 'pointer' : 'not-allowed' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        min={dynamicAvailable > 0 ? 1 : 0}
                        max={dynamicAvailable}
                        value={quantity === 0 ? '' : quantity}
                        step="1"
                        onKeyDown={e => {
                          if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === '-') e.preventDefault();
                        }}
                        onBlur={() => {
                          // Allow empty during typing
                        }}
                        onChange={e => {
                          const val = parseInt(e.target.value);
                          if (isNaN(val)) setQuantity(0);
                          else setQuantity(Math.min(dynamicAvailable, Math.max(0, val)));
                        }}
                        style={{
                          width: '56px', padding: '4px 6px', borderRadius: '8px', border: '1px solid #e2e8f0',
                          fontSize: '1rem', fontWeight: 900, color: 'var(--accent-color)', textAlign: 'center', outline: 'none'
                        }}
                      />
                      <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8' }}>/ {dynamicAvailable}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>)}

          {/* Validation error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
              <AlertCircle size={16} color="#ef4444" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#dc2626' }}>{error}</span>
            </div>
          )}
        </form>

        {/* ── Footer ── */}
        <div style={S.footer}>
          <button type="button" onClick={onClose} style={{ padding: '8px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.85rem', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!!error || quantity < 1}
            style={{
              padding: '10px 32px', borderRadius: '12px', border: 'none',
              background: !!error || quantity < 1 ? '#94a3b8' : 'var(--accent-color)',
              color: '#fff', fontSize: '0.9rem', fontWeight: 800, cursor: !!error || quantity < 1 ? 'not-allowed' : 'pointer',
              boxShadow: !error && quantity > 0 ? '0 4px 14px -3px rgba(232,114,12,0.4)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {activeTab === 'details' ? 'Next: Pick Times' : (!!error || quantity < 1 ? 'Check Requirements' : 'Confirm Booking')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingModal;
