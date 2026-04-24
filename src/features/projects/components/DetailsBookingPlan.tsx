// =============================================================================
// DetailsBookingPlan — Project Resource Booking Plan  (Redesigned)
// Split-panel layout: SchedulePanel (left 60%) always visible +
//   PlanBuilderPanel (right 40%) in planning mode
//   PlanReviewPanel  (right 40%) in review mode
// =============================================================================
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import BookingDetailPanel from '@/pages/resource/components/BookingDetailPanel';
import {
  Sparkles, ClipboardList, RefreshCw, Plus, Check, SkipForward, Minus,
  AlertTriangle, CheckCircle2, ExternalLink, Loader2, ChevronDown,
  ChevronUp, Package, CalendarRange, Bot, PencilLine, X, Search,
  Clock, MapPin, HardDrive, Monitor, Cpu, Database,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  projectBookingPlanService,
  ProjectBookingPlanResponse,
  ProjectBookingPlanItemResponse,
  PlanStatus,
  PlanItemStatus,
  ManualPlanItemRequest,
  PlanWarning,
} from '@/services/projectBookingPlanService';
import { resourceService } from '@/services/resourceService';
import type { ProjectResource } from '@/services/resourceService';
import { bookingService } from '@/services/bookingService';
import { Resource, Booking, BookingStatus } from '@/types/booking';

// ─── Props ────────────────────────────────────────────────────────────────────
interface DetailsBookingPlanProps {
  projectId: string;
  canManage: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

// ─── Status metadata ──────────────────────────────────────────────────────────
const PLAN_STATUS_META: Record<PlanStatus, { label: string; color: string; bg: string; border: string }> = {
  [PlanStatus.Draft]:          { label: 'In Progress',      color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  [PlanStatus.PartiallyBooked]:{ label: 'Partially Booked', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  [PlanStatus.FullyBooked]:    { label: 'Complete',         color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  [PlanStatus.Expired]:        { label: 'Expired',          color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
};

const ITEM_STATUS_META: Record<PlanItemStatus, { label: string; color: string; bg: string; bar: string }> = {
  [PlanItemStatus.Pending]: { label: 'Pending', color: '#b45309', bg: '#fffbeb', bar: '#f59e0b' },
  [PlanItemStatus.Booked]:  { label: 'Booked',  color: '#15803d', bg: '#f0fdf4', bar: '#22c55e' },
  [PlanItemStatus.Skipped]: { label: 'Skipped', color: '#6b7280', bg: '#f3f4f6', bar: '#d1d5db' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDatetimeLocal(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDuration(start: string, end: string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return '';
  const days = Math.floor(diff / 86400000);
  const h    = Math.floor((diff % 86400000) / 3600000);
  const m    = Math.floor((diff % 3600000) / 60000);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (h)    parts.push(`${h}h`);
  if (m && !days) parts.push(`${m}m`);
  return parts.join(' ') || '<1m';
}

function getRtMeta(resource: Resource): { icon: React.ReactNode; color: string; bg: string } {
  const name = (resource.resourceTypeName ?? '').toLowerCase();
  if (name.includes('gpu'))                                return { icon: <Cpu size={13} />,      color: '#7C3AED', bg: '#F5F3FF' };
  if (name.includes('microscope') || name.includes('lab equipment'))
                                                           return { icon: <Database size={13} />, color: '#0284C7', bg: '#F0F9FF' };
  if (name.includes('station') || name.includes('lab'))   return { icon: <Monitor size={13} />,  color: '#E8720C', bg: '#FFF7ED' };
  if (name.includes('equipment') || name.includes('hardware'))
                                                           return { icon: <HardDrive size={13} />,color: '#DC2626', bg: '#FEF2F2' };
  return { icon: <Package size={13} />, color: '#64748B', bg: '#F1F5F9' };
}

function getDayAvailableCount(resource: Resource, day: Date, bookings: Booking[]): number {
  if (!resource.ids?.length) return resource.totalQuantity ?? 1;
  const unitIds = new Set(resource.ids);
  const sT = new Date(day); sT.setHours(0, 0, 0, 0);
  const eT = new Date(day); eT.setHours(23, 59, 59, 999);
  const bookedIds = new Set<string>();
  for (const b of bookings) {
    if (b.status === BookingStatus.Rejected || b.status === BookingStatus.Cancelled || b.status === BookingStatus.Completed) continue;
    const bs = new Date(b.startTime), be = new Date(b.endTime);
    if (be <= sT || bs >= eT) continue;
    const rIds = b.resourceIds ?? (b.resourceId ? [b.resourceId] : []);
    for (const id of rIds) if (unitIds.has(id)) bookedIds.add(id);
  }
  return Math.max(0, resource.ids.length - bookedIds.size);
}

function getAvailableForWindow(resource: Resource, start: string, end: string, bookings: Booking[]): number {
  const fallback = resource.totalQuantity ?? resource.ids?.length ?? 1;
  if (!start || !end) return fallback;
  const s = new Date(start).getTime(), e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return fallback;
  if (!resource.ids?.length) return fallback;
  const unitIds = new Set(resource.ids);
  const bookedIds = new Set<string>();
  for (const b of bookings) {
    if (b.status === BookingStatus.Rejected || b.status === BookingStatus.Cancelled || b.status === BookingStatus.Completed) continue;
    const bs = new Date(b.startTime).getTime(), be = new Date(b.endTime).getTime();
    if (be <= s || bs >= e) continue;
    const rIds = b.resourceIds ?? (b.resourceId ? [b.resourceId] : []);
    for (const id of rIds) if (unitIds.has(id)) bookedIds.add(id);
  }
  return Math.max(0, resource.ids.length - bookedIds.size);
}

// ─── Style constants ──────────────────────────────────────────────────────────
const sectionBox: React.CSSProperties = {
  padding: '10px 12px',
  background: 'var(--background-color, #f8fafc)',
  borderRadius: 10,
  border: '1px solid var(--border-light, #f1f5f9)',
};
const sectionLbl: React.CSSProperties = {
  fontSize: '0.6rem', fontWeight: 800, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.7px',
  display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8,
};
const baseInput: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  border: '1.5px solid #e2e8f0', fontSize: '0.8rem',
  fontFamily: 'inherit', outline: 'none',
  background: '#fff', boxSizing: 'border-box', color: '#1e293b',
};
const fieldLbl: React.CSSProperties = {
  fontSize: '0.6rem', fontWeight: 800, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: '0.6px',
  marginBottom: 3, display: 'block',
};
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '9px 20px', borderRadius: 10, border: 'none',
  background: 'var(--primary-color,#e8720c)', color: '#fff',
  fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '9px 18px', borderRadius: 10,
  border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151',
  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 8,
  border: '1.5px dashed #cbd5e1', background: 'transparent', color: '#64748b',
  fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer',
};
const spinStyle: React.CSSProperties = { animation: 'spin 0.9s linear infinite' };

// ─── Confirm-form helpers ─────────────────────────────────────────────────────
const CONFIRM_MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CONFIRM_DAYS_SHORT = ['Mo','Tu','We','Th','Fr','Sa','Su'];
const CONFIRM_SESSIONS   = [
  { label: 'Morning',   mins: 480  },
  { label: 'Noon',      mins: 720  },
  { label: 'Afternoon', mins: 1020 },
];
const CONFIRM_SESSION_MINS = CONFIRM_SESSIONS.map(s => s.mins);
const CONFIRM_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2), m = i % 2 === 0 ? '00' : '30';
  return { value: h * 60 + (i % 2) * 30, label: `${String(h).padStart(2,'0')}:${m}` };
});
const CONFIRM_DURATIONS = [
  { label: '1 day',   days: 1  },
  { label: '2 days',  days: 2  },
  { label: '3 days',  days: 3  },
  { label: '1 week',  days: 7  },
  { label: '2 weeks', days: 14 },
];
function fmtConfirmMins(m: number): string {
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}
const ConfirmTimeDropdown: React.FC<{ value: number; onChange: (m: number) => void; accent: string }> = ({ value, onChange, accent }) => {
  const [open, setOpen] = useState(false);
  const ref     = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'center' });
  }, [open]);
  const isPreset = CONFIRM_SESSION_MINS.includes(value);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ padding: '3px 8px', borderRadius: 6, border: '1.5px solid', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s', borderColor: !isPreset ? accent : '#e2e8f0', background: !isPreset ? `${accent}18` : '#f8fafc', color: !isPreset ? accent : '#64748b' }}>
        {isPreset ? 'Other…' : fmtConfirmMins(value)}
      </button>
      {open && (
        <div ref={listRef} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px -4px rgba(0,0,0,0.14)', maxHeight: 180, overflowY: 'auto', minWidth: 88, padding: '4px 3px' }}>
          {CONFIRM_TIME_OPTIONS.filter(t => !CONFIRM_SESSION_MINS.includes(t.value)).map(t => {
            const sel = t.value === value;
            return (
              <div key={t.value} data-selected={sel} onClick={() => { onChange(t.value); setOpen(false); }}
                style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: sel ? 800 : 600, color: sel ? accent : '#334155', background: sel ? `${accent}18` : 'transparent', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
                onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                {t.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── ResourcePickerCard ───────────────────────────────────────────────────────
interface ResourcePickerCardProps {
  resource: Resource;
  selected: boolean;
  avail: number;
  total: number;
  stripDays: Date[];
  allBookings: Booking[];
  hasWindow: boolean;
  onClick: () => void;
}

const ResourcePickerCard: React.FC<ResourcePickerCardProps> = ({
  resource: r, selected, avail, total, stripDays, allBookings, hasWindow, onClick,
}) => {
  const meta = getRtMeta(r);
  const [hovered, setHovered] = useState(false);
  const fullyBooked = hasWindow && avail === 0;
  const freeRatio = total > 0 ? Math.max(0, avail / total) : 0;
  const barColor  = avail === 0 ? '#ef4444' : freeRatio < 0.5 ? '#f59e0b' : '#10b981';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: selected ? '2px solid var(--primary-color,#e8720c)' : `2px solid ${hovered ? '#cbd5e1' : '#e2e8f0'}`,
        borderRadius: 12, padding: '12px 14px', marginBottom: 8,
        background: selected ? 'rgba(232,114,12,0.04)' : '#fff',
        cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
        opacity: fullyBooked && !selected ? 0.6 : 1,
      }}
    >
      <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: 5, border: selected ? '2px solid var(--primary-color,#e8720c)' : '2px solid #cbd5e1', background: selected ? 'var(--primary-color,#e8720c)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {selected && <Check size={10} color="#fff" strokeWidth={3} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingRight: 26 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{meta.icon}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>{r.name}</div>
          {r.location && <div style={{ fontSize: '0.67rem', color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} />{r.location}</div>}
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{hasWindow ? 'In your window' : 'Next 14 days'}</span>
          <span style={{ fontSize: '0.73rem', fontWeight: 800, color: barColor }}>{avail}/{total} free</span>
        </div>
        {hasWindow && (
          <>
            <div style={{ height: 6, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, width: `${freeRatio * 100}%`, background: barColor, transition: 'width .3s' }} />
            </div>
            {fullyBooked && <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.67rem', color: '#ef4444', fontWeight: 700 }}><AlertTriangle size={10} /> Fully booked in this window</div>}
          </>
        )}
        {!hasWindow && (
          <>
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
              {stripDays.map((day, i) => {
                const da = getDayAvailableCount(r, day, allBookings);
                const dc = da >= total ? '#10b981' : da === 0 ? '#ef4444' : '#f59e0b';
                return (
                  <div key={i} title={`${day.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}: ${da}/${total}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <span style={{ fontSize: 7, fontWeight: 800, color: dc, lineHeight: 1, opacity: da >= total ? 0.6 : 1 }}>{da}</span>
                    <div style={{ width: '100%', height: 4, borderRadius: 2, background: dc, opacity: 0.7 + (da >= total ? 0.3 : 0), outline: i === 0 ? '2px solid #94a3b8' : 'none', outlineOffset: 1 }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#94a3b8', marginTop: 3, fontWeight: 600 }}>
              <span>Today</span><span>+14d</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── SchedulePanel ────────────────────────────────────────────────────────────
interface SchedulePanelProps {
  resources: Resource[];
  allBookings: Booking[];
  manualItems: (ManualPlanItemRequest & { _key: string })[];
  activeItemKey: string | null;
  onSlotClick: (resource: Resource, date: Date) => void;
  mode: 'planning' | 'review';
  plan?: ProjectBookingPlanResponse | null;
  highlightRange?: { start: Date; end: Date } | null;
  navigateTo?: Date | null;
}

const SchedulePanel: React.FC<SchedulePanelProps> = ({
  resources, allBookings, manualItems, activeItemKey, onSlotClick, mode, plan,
  highlightRange, navigateTo,
}) => {
  const todayMidnight = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const weekStart = useMemo(() => {
    const d = new Date(todayMidnight);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    return d;
  }, [todayMidnight]);

  const [rangeStart, setRangeStart] = useState(weekStart);
  const [rangeDays, setRangeDays]   = useState<7 | 14>(14);
  const [filterQ, setFilterQ]       = useState('');

  const DAY_W   = rangeDays <= 7 ? 76 : 52;
  const ROW_H   = 56;
  const LABEL_W = 150;

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(rangeStart); d.setDate(rangeStart.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [rangeStart, rangeDays]);

  const totalW   = DAY_W * rangeDays;

  const visibleResources = useMemo(() => {
    let base = resources;
    if (mode === 'review' && plan) {
      const planNames = new Set(plan.items.map(i => i.resourceName));
      base = resources.filter(r => planNames.has(r.name));
    }
    const q = filterQ.toLowerCase().trim();
    if (!q) return base;
    return base.filter(r => r.name.toLowerCase().includes(q) || (r.resourceTypeName ?? '').toLowerCase().includes(q));
  }, [resources, filterQ, mode, plan]);

  const rangeLabel = `${rangeStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${days[days.length - 1].toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const prev    = () => { const d = new Date(rangeStart); d.setDate(d.getDate() - rangeDays); setRangeStart(d); };
  const next    = () => { const d = new Date(rangeStart); d.setDate(d.getDate() + rangeDays); setRangeStart(d); };
  const goToday = () => setRangeStart(weekStart);

  // Click handler: find day from pixel offset
  const handleTrackClick = (resource: Resource, e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'planning') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dayIndex = Math.floor(x / DAY_W);
    if (dayIndex < 0 || dayIndex >= rangeDays) return;
    const clicked = new Date(rangeStart);
    clicked.setDate(rangeStart.getDate() + dayIndex);
    clicked.setHours(8, 0, 0, 0);
    onSlotClick(resource, clicked);
  };

  // Auto-navigate to show selected date
  useEffect(() => {
    if (!navigateTo) return;
    const d = new Date(navigateTo);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    setRangeStart(d);
  }, [navigateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-compute highlighted midnight timestamp set
  const hlMidSet = useMemo(() => {
    if (!highlightRange) return null;
    const set = new Set<number>();
    const cur = new Date(highlightRange.start);
    cur.setHours(0, 0, 0, 0);
    const endMid = new Date(highlightRange.end);
    endMid.setHours(0, 0, 0, 0);
    while (cur <= endMid) { set.add(cur.getTime()); cur.setDate(cur.getDate() + 1); }
    return set;
  }, [highlightRange]);

  return (
    <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        <button onClick={prev} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#475569' }}><ChevronLeft size={12} /></button>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', minWidth: 150, textAlign: 'center' }}>{rangeLabel}</span>
        <button onClick={next} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#475569' }}><ChevronRight size={12} /></button>
        <button onClick={goToday} style={{ padding: '3px 9px', fontSize: '0.68rem', fontWeight: 700, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#475569' }}>Today</button>
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 7, padding: 2, gap: 1 }}>
          {([7, 14] as const).map(n => (
            <button key={n} onClick={() => setRangeDays(n)} style={{ padding: '3px 9px', fontSize: '0.68rem', fontWeight: 600, borderRadius: 5, border: 'none', cursor: 'pointer', background: rangeDays === n ? '#fff' : 'transparent', color: rangeDays === n ? '#1e293b' : '#64748b', boxShadow: rangeDays === n ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s' }}>
              {n === 7 ? 'Week' : '2 Weeks'}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, fontSize: '0.62rem', color: '#94a3b8', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { color: '#10b981', label: 'All available' },
            { color: '#f59e0b', label: 'Partially booked' },
            { color: '#ef4444', label: 'Fully booked' },
          ].map(l => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: l.color, display: 'inline-block', flexShrink: 0 }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }}>
        <div style={{ minWidth: LABEL_W + totalW }}>
          {/* Day header */}
          <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 5, background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ width: LABEL_W, flexShrink: 0, padding: '6px 10px', borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Search size={11} style={{ color: '#94a3b8', flexShrink: 0 }} />
              <input value={filterQ} onChange={e => setFilterQ(e.target.value)} placeholder="Filter resources…"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.68rem', color: '#475569', fontFamily: 'inherit' }} />
              {filterQ && <button onClick={() => setFilterQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}><X size={10} /></button>}
            </div>
            <div style={{ display: 'flex' }}>
              {days.map((d, i) => {
                const isToday = d.getTime() === todayMidnight.getTime();
                const isWe    = d.getDay() === 0 || d.getDay() === 6;
                const isHl    = hlMidSet?.has(d.getTime()) ?? false;
                return (
                  <div key={i} style={{ width: DAY_W, flexShrink: 0, padding: '5px 3px', textAlign: 'center', borderRight: '1px solid #f1f5f9', background: isHl ? 'rgba(14,165,233,0.14)' : isToday ? '#fff7ed' : isWe ? '#f8fafc' : '#fff' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: isToday ? '#e8720c' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div style={{ fontSize: 13, fontWeight: isToday ? 800 : 600, color: isToday ? '#e8720c' : '#1e293b' }}>
                      {d.getDate()}
                      {d.getDate() === 1 && <span style={{ fontSize: 8, color: '#94a3b8', marginLeft: 2 }}>{d.toLocaleDateString('en-US', { month: 'short' })}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resource rows */}
          <div style={{ position: 'relative' }}>

            {visibleResources.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>{resources.length === 0 ? 'Loading…' : 'No matching resources.'}</div>
            )}

            {visibleResources.map((r, ridx) => {
              const isActiveResource = mode === 'planning' && activeItemKey !== null &&
                manualItems.some(i => i._key === activeItemKey && i.resourceId === r.id);

              return (
                <div key={r.id} style={{ display: 'flex', borderBottom: ridx < visibleResources.length - 1 ? '1px solid #f1f5f9' : 'none', height: ROW_H, position: 'relative', background: isActiveResource ? 'rgba(232,114,12,0.03)' : undefined }}>
                  {/* Label */}
                  <div style={{ width: LABEL_W, flexShrink: 0, padding: '6px 12px', borderRight: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 7, position: 'sticky', left: 0, zIndex: 3, background: isActiveResource ? 'rgba(232,114,12,0.05)' : '#fff' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0f172a' }}>{r.name}</div>
                      <div style={{ fontSize: 9, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.location ?? r.resourceTypeName}</div>
                    </div>
                  </div>
                  {/* Track */}
                  <div
                    onClick={e => handleTrackClick(r, e)}
                    style={{ position: 'relative', flex: 1, height: '100%', overflow: 'hidden', cursor: mode === 'planning' ? 'crosshair' : 'default' }}
                  >
                    {/* Day grid lines */}
                    {days.map((d, i) => {
                      const isWe = d.getDay() === 0 || d.getDay() === 6;
                      const isHl = hlMidSet?.has(d.getTime()) ?? false;
                      return <div key={i} style={{ position: 'absolute', left: i * DAY_W, top: 0, bottom: 0, width: DAY_W, borderRight: `1px solid ${isHl ? 'rgba(14,165,233,0.3)' : '#f1f5f9'}`, background: isHl ? 'rgba(14,165,233,0.1)' : isWe ? 'rgba(241,245,249,0.4)' : 'transparent', pointerEvents: 'none' }} />;
                    })}

                    {/* Availability strip — full-height cell per day */}
                    {days.map((day, i) => {
                      const av  = getDayAvailableCount(r, day, allBookings);
                      const tot = r.totalQuantity ?? r.ids?.length ?? 1;
                      const col = av >= tot ? '#10b981' : av === 0 ? '#ef4444' : '#f59e0b';
                      const fillPct = tot > 0 ? (av / tot) * 100 : 0;
                      return (
                        <div key={`strip-${i}`}
                          title={`${day.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}: ${av}/${tot} available`}
                          style={{ position: 'absolute', left: i * DAY_W + 1, top: 4, bottom: 0, width: DAY_W - 2, pointerEvents: 'none', zIndex: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 2, padding: '0 0 4px' }}
                        >
                          {/* 'avail' label */}
                          <span style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>avail</span>
                          {/* fraction */}
                          <span style={{ fontSize: 10, fontWeight: 800, color: col, lineHeight: 1, letterSpacing: '-0.02em' }}>{av}/{tot}</span>
                          {/* fill bar */}
                          <div style={{ width: '82%', height: 4, borderRadius: 3, background: `${col}30` }}>
                            <div style={{ height: '100%', width: `${fillPct}%`, borderRadius: 3, background: col, transition: 'width .3s' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {mode === 'planning' && resources.length > 0 && (
        <div style={{ padding: '7px 14px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', fontSize: '0.68rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Plus size={10} style={{ color: 'var(--primary-color,#e8720c)' }} />
          Click any resource row to add a new item starting on that day
        </div>
      )}
    </div>
  );
};

// ─── PlanItemRow — compact row in PlanBuilderPanel ────────────────────────────
interface PlanItemRowProps {
  item: ManualPlanItemRequest & { _key: string };
  index: number;
  resources: Resource[];
  isActive: boolean;
  onEdit: (key: string) => void;
  onRemove: (key: string) => void;
}

const PlanItemRow: React.FC<PlanItemRowProps> = ({ item, index, resources, isActive, onEdit, onRemove }) => {
  const resource = resources.find(r => r.id === item.resourceId);
  const meta     = resource ? getRtMeta(resource) : null;
  const duration = item.suggestedStartDate && item.suggestedEndDate ? fmtDuration(item.suggestedStartDate, item.suggestedEndDate) : null;

  return (
    <div
      onClick={() => onEdit(item._key)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        borderRadius: 8, marginBottom: 4, cursor: 'pointer',
        border: isActive ? '1.5px solid var(--primary-color,#e8720c)' : '1.5px solid #e2e8f0',
        background: isActive ? 'rgba(232,114,12,0.04)' : '#fff',
        transition: 'all 0.12s',
      }}
    >
      {/* Left bar */}
      <div style={{ width: 3, height: 32, borderRadius: 99, background: isActive ? 'var(--primary-color,#e8720c)' : '#e2e8f0', flexShrink: 0 }} />
      {/* Index badge */}
      <div style={{ width: 20, height: 20, borderRadius: 6, background: isActive ? 'var(--primary-color,#e8720c)' : '#f1f5f9', color: isActive ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{index + 1}</div>
      {/* Resource icon */}
      {meta && (
        <div style={{ width: 22, height: 22, borderRadius: 6, background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{meta.icon}</div>
      )}
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {resource ? resource.name : <span style={{ color: '#e8720c', fontStyle: 'italic' }}>Select resource…</span>}
        </div>
        <div style={{ fontSize: '0.67rem', color: '#94a3b8', display: 'flex', gap: 6, marginTop: 1 }}>
          {item.suggestedQuantity > 0 && <span>x{item.suggestedQuantity}</span>}
          {duration && <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Clock size={9} />{duration}</span>}
          {item.suggestedStartDate && <span>{fmtDate(item.suggestedStartDate)}</span>}
        </div>
      </div>
      {/* Edit btn */}
      <button
        onClick={e => { e.stopPropagation(); onEdit(item._key); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isActive ? 'var(--primary-color,#e8720c)' : '#94a3b8', padding: 3, borderRadius: 5, display: 'flex', flexShrink: 0 }}
      >
        <PencilLine size={13} />
      </button>
      {/* Remove btn */}
      <button
        onClick={e => { e.stopPropagation(); onRemove(item._key); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 3, borderRadius: 5, display: 'flex', flexShrink: 0 }}
      >
        <X size={13} />
      </button>
    </div>
  );
};

// ─── ItemEditForm — inline form below PlanBuilderPanel list ───────────────────
interface ItemEditFormProps {
  item: ManualPlanItemRequest & { _key: string };
  resources: Resource[];
  allBookings: Booking[];
  onChange: (key: string, field: string, value: string | number) => void;
  onSave: () => void;
  onCancel: () => void;
}

const ItemEditForm: React.FC<ItemEditFormProps> = ({ item, resources, allBookings, onChange, onSave, onCancel }) => {
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(!item.resourceId);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const stripDays = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d; }),
    [today],
  );

  const bookable = useMemo(() => resources.filter(r => r.isAvailable !== false && r.isDamaged !== true), [resources]);

  const availMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of bookable) {
      m.set(r.id, getAvailableForWindow(r, item.suggestedStartDate, item.suggestedEndDate, allBookings));
    }
    return m;
  }, [bookable, allBookings, item.suggestedStartDate, item.suggestedEndDate]);

  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? bookable.filter(r => r.name.toLowerCase().includes(q) || (r.resourceTypeName ?? '').toLowerCase().includes(q) || (r.location ?? '').toLowerCase().includes(q))
      : bookable;
    const g: Record<string, Resource[]> = {};
    for (const r of filtered) {
      const key = r.resourceTypeName || 'Other';
      if (!g[key]) g[key] = [];
      g[key].push(r);
    }
    return g;
  }, [bookable, search]);

  const selectedResource = bookable.find(r => r.id === item.resourceId) ?? null;
  const avail  = item.resourceId ? (availMap.get(item.resourceId) ?? 1) : 1;
  const total  = selectedResource ? (selectedResource.totalQuantity ?? selectedResource.ids?.length ?? 1) : 1;
  const hasWindow = !!(item.suggestedStartDate && item.suggestedEndDate);
  const duration  = hasWindow ? fmtDuration(item.suggestedStartDate, item.suggestedEndDate) : '';

  const selectResource = (resourceId: string) => {
    onChange(item._key, 'resourceId', resourceId);
    onChange(item._key, 'suggestedQuantity', 1);
    setShowPicker(false);
    setSearch('');
  };

  return (
    <div style={{ border: '1.5px solid var(--primary-color,#e8720c)', borderRadius: 10, background: '#fff', overflow: 'hidden', marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fff7ed', borderBottom: '1px solid #fed7aa' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#92400e' }}>Edit Item</span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex', borderRadius: 5 }}><X size={14} /></button>
      </div>
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* When */}
        <div style={sectionBox}>
          <div style={sectionLbl}><Clock size={11} /> When?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={fieldLbl}>Start *</label>
              <input type="datetime-local" value={fmtDatetimeLocal(item.suggestedStartDate)}
                onChange={e => onChange(item._key, 'suggestedStartDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
                style={baseInput} />
            </div>
            <div>
              <label style={fieldLbl}>End *</label>
              <input type="datetime-local" value={fmtDatetimeLocal(item.suggestedEndDate)}
                onChange={e => onChange(item._key, 'suggestedEndDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
                style={baseInput} />
            </div>
          </div>
          {duration && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#eff6ff', borderRadius: 7, border: '1px solid #bfdbfe', fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 700 }}>
              <Clock size={11} />
              <span>{duration}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.63rem', fontWeight: 600, color: '#3b82f6' }}>{fmtDate(item.suggestedStartDate)} → {fmtDate(item.suggestedEndDate)}</span>
            </div>
          )}
        </div>
        {/* Resource */}
        <div style={sectionBox}>
          <div style={{ ...sectionLbl, justifyContent: 'space-between' as const }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Package size={11} /> Resource *</span>
            {selectedResource && (
              <button onClick={() => { setShowPicker(v => !v); setSearch(''); }} style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary-color,#e8720c)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {showPicker ? '↩ Close' : '✎ Change'}
              </button>
            )}
          </div>
          {selectedResource && !showPicker && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(232,114,12,0.04)', border: '2px solid var(--primary-color,#e8720c)', borderRadius: 10 }}>
              {(() => { const m = getRtMeta(selectedResource); return <div style={{ width: 30, height: 30, borderRadius: 8, background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.icon}</div>; })()}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.83rem', fontWeight: 700, color: '#0f172a' }}>{selectedResource.name}</div>
                {selectedResource.location && <div style={{ fontSize: '0.67rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={9} />{selectedResource.location}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.77rem', fontWeight: 800, color: avail === 0 ? '#ef4444' : '#10b981' }}>{avail}/{total}</div>
                <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600 }}>{hasWindow ? 'in window' : 'free'}</div>
              </div>
              <Check size={14} style={{ color: 'var(--primary-color,#e8720c)', flexShrink: 0 }} />
            </div>
          )}
          {(!selectedResource || showPicker) && (
            <div>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search resources…" style={{ ...baseInput, paddingLeft: 28, fontSize: '0.77rem' }} />
                {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}><X size={11} /></button>}
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', paddingRight: 2 }}>
                {Object.keys(grouped).length === 0
                  ? <p style={{ textAlign: 'center', fontSize: '0.77rem', color: '#94a3b8', padding: '16px 0', margin: 0 }}>No resources match.</p>
                  : Object.entries(grouped).map(([typeName, rList]) => {
                      const meta = getRtMeta(rList[0]);
                      return (
                        <div key={typeName} style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 5, background: meta.bg, color: meta.color, flexShrink: 0 }}>{meta.icon}</span>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{typeName}</span>
                          </div>
                          {rList.map(r => (
                            <ResourcePickerCard key={r.id} resource={r} selected={item.resourceId === r.id}
                              avail={availMap.get(r.id) ?? (r.totalQuantity ?? 1)} total={r.totalQuantity ?? r.ids?.length ?? 1}
                              stripDays={stripDays} allBookings={allBookings} hasWindow={hasWindow}
                              onClick={() => selectResource(r.id)} />
                          ))}
                        </div>
                      );
                    })
                }
              </div>
            </div>
          )}
        </div>
        {/* Qty + Note */}
        {selectedResource && !showPicker && (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'start' }}>
            <div style={sectionBox}>
              <div style={sectionLbl}>Qty</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => onChange(item._key, 'suggestedQuantity', Math.max(1, item.suggestedQuantity - 1))} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}><Minus size={12} /></button>
                <span style={{ minWidth: 22, textAlign: 'center', fontSize: '0.9rem', fontWeight: 800, color: item.suggestedQuantity > avail ? '#dc2626' : 'var(--primary-color,#e8720c)' }}>{item.suggestedQuantity}</span>
                <button onClick={() => onChange(item._key, 'suggestedQuantity', Math.min(avail || 99, item.suggestedQuantity + 1))} disabled={item.suggestedQuantity >= avail} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #e2e8f0', background: item.suggestedQuantity >= avail ? '#f8fafc' : '#fff', cursor: item.suggestedQuantity >= avail ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.suggestedQuantity >= avail ? '#cbd5e1' : '#475569' }}><Plus size={12} /></button>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>/ {avail} free</span>
              </div>
            </div>
            <div style={sectionBox}>
              <div style={sectionLbl}>Note</div>
              <input type="text" value={item.note || ''} onChange={e => onChange(item._key, 'note', e.target.value)} placeholder="Optional reason or note…" style={{ ...baseInput, fontSize: '0.78rem' }} />
            </div>
          </div>
        )}
        {/* Form actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} style={{ ...btnSecondary, fontSize: '0.8rem', padding: '7px 14px' }}>Cancel</button>
          <button onClick={onSave} style={{ ...btnPrimary, fontSize: '0.8rem', padding: '7px 14px' }}><Check size={13} /> Apply</button>
        </div>
      </div>
    </div>
  );
};

// ─── PlanBuilderPanel — right panel in planning mode ─────────────────────────
interface PlanBuilderPanelProps {
  plan: ProjectBookingPlanResponse | null;
  manualItems: (ManualPlanItemRequest & { _key: string })[];
  activeItemKey: string | null;
  resources: Resource[];
  allBookings: Booking[];
  loadingData: boolean;
  actionLoading: 'generate' | 'manual' | null;
  onSetActiveKey: (key: string | null) => void;
  onAddItem: () => void;
  onChangeItem: (key: string, field: string, value: string | number) => void;
  onRemoveItem: (key: string) => void;
  onClose: () => void;
  onSavePlan: () => void;
}

const PlanBuilderPanel: React.FC<PlanBuilderPanelProps> = ({
  plan, manualItems, activeItemKey, resources, allBookings, loadingData, actionLoading,
  onSetActiveKey, onAddItem, onChangeItem, onRemoveItem, onClose, onSavePlan,
}) => {
  return (
    <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PencilLine size={15} style={{ color: 'var(--primary-color,#e8720c)' }} />
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
            Building Plan <span style={{ fontWeight: 500, fontSize: '0.8rem', color: '#64748b' }}>({manualItems.length} item{manualItems.length !== 1 ? 's' : ''})</span>
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 6, display: 'flex' }}><X size={15} /></button>
      </div>

      {/* Warning if replacing plan */}
      {plan && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: '0.78rem', color: '#92400e', flexShrink: 0 }}>
          <AlertTriangle size={12} />
          Saving will replace the current plan.
        </div>
      )}

      {/* Loading */}
      {loadingData && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b', flexShrink: 0 }}>
          <Loader2 size={12} style={spinStyle} /> Loading resources…
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {manualItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8' }}>
            <Package size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
            <div style={{ fontSize: '0.83rem', fontWeight: 600 }}>No items yet</div>
            <div style={{ fontSize: '0.75rem', marginTop: 4 }}>Click a resource row on the timeline<br/>or use the button below</div>
          </div>
        ) : (
          <>
            {manualItems.map((item, idx) => (
              <PlanItemRow key={item._key} item={item} index={idx} resources={resources}
                isActive={activeItemKey === item._key}
                onEdit={key => onSetActiveKey(activeItemKey === key ? null : key)}
                onRemove={onRemoveItem}
              />
            ))}
            {activeItemKey && manualItems.find(i => i._key === activeItemKey) && (
              <ItemEditForm
                item={manualItems.find(i => i._key === activeItemKey)!}
                resources={resources}
                allBookings={allBookings}
                onChange={onChangeItem}
                onSave={() => onSetActiveKey(null)}
                onCancel={() => onSetActiveKey(null)}
              />
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: '1px solid #f1f5f9', background: '#fafafa', flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={onAddItem} style={btnGhost}><Plus size={13} /> Add Item</button>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ ...btnSecondary, fontSize: '0.8rem', padding: '7px 14px' }}>Cancel</button>
        <button
          onClick={onSavePlan}
          disabled={actionLoading !== null || manualItems.length === 0}
          style={{ ...btnPrimary, fontSize: '0.8rem', padding: '7px 14px', opacity: actionLoading !== null || manualItems.length === 0 ? 0.55 : 1, cursor: actionLoading !== null || manualItems.length === 0 ? 'not-allowed' : 'pointer' }}>
          {actionLoading === 'manual' ? <Loader2 size={13} style={spinStyle} /> : <CheckCircle2 size={13} />}
          Save Plan
        </button>
      </div>
    </div>
  );
};

// ─── PlanItemCard ─────────────────────────────────────────────────────────────
interface PlanItemCardProps {
  item: ProjectBookingPlanItemResponse;
  planId: string;
  isPlanActive: boolean;
  canManage: boolean;
  onUpdate: (plan: ProjectBookingPlanResponse) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const PlanItemCard: React.FC<PlanItemCardProps> = ({ item, planId, isPlanActive, canManage, onUpdate, showToast }) => {
  const [loading, setLoading] = useState<'skip' | null>(null);

  const meta = ITEM_STATUS_META[item.status as PlanItemStatus];
  const isAutoBooking = item.bookingId !== null;

  const handleSkip = async () => {
    setLoading('skip');
    try {
      const updated = await projectBookingPlanService.skipItem(planId, item.id);
      onUpdate(updated);
      showToast('Item skipped.', 'info');
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to skip.', 'error');
    } finally { setLoading(null); }
  };

  const isBooked = item.status === PlanItemStatus.Booked;
  return (
    <div style={{ background: isBooked ? '#f0fdf4' : '#fff', borderRadius: 10, border: `1.5px solid ${isBooked ? '#22c55e' : '#e2e8f0'}`, marginBottom: 8, overflow: 'hidden', opacity: item.status === PlanItemStatus.Skipped ? 0.6 : 1, transition: 'border-color 0.2s' }}>
      <div style={{ flex: 1, padding: '13px 15px' }}>
        {/* Overlap warning */}
        {item.hasManualBookingOverlap && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 11px', marginBottom: 10, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 7, fontSize: '0.78rem', color: '#92400e', fontWeight: 500 }}>
            <AlertTriangle size={13} style={{ flexShrink: 0 }} />
            Another booking overlaps this window — you can still confirm or skip.
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Header row: name + qty + status badges */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: '0.93rem', color: '#0f172a' }}>{item.resourceName}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', background: '#64748b', borderRadius: 99, padding: '1px 7px' }}>x{item.suggestedQuantity}</span>
              <span style={{ fontSize: '0.71rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, color: meta.color, background: meta.bg, border: `1px solid ${meta.bar}33` }}>
                {meta.label}{item.status === PlanItemStatus.Booked ? ' ✓' : ''}
              </span>
              {isAutoBooking && (
                <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', letterSpacing: '0.04em' }}>AUTO</span>
              )}
            </div>
            {/* Suggested dates + related task */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', fontSize: '0.8rem', color: '#64748b', marginBottom: item.note || item.relatedTask ? 6 : 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <CalendarRange size={12} />
                {fmtDate(item.suggestedStartDate)} — {fmtDate(item.suggestedEndDate)}
              </span>
              {item.relatedTask && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#7c3aed', fontWeight: 600 }}>
                  <CheckCircle2 size={12} />
                  {item.relatedTask}
                </span>
              )}
            </div>
            {item.note && <p style={{ margin: '0 0 6px', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>"{item.note}"</p>}

            {/* Booking link (Booked state) */}
            {item.status === PlanItemStatus.Booked && item.bookingId && (
              <a href={`/resources/bookings/${item.bookingId}`} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '0.78rem', color: 'var(--primary-color,#e8720c)', textDecoration: 'none', fontWeight: 700, padding: '3px 10px', borderRadius: 7, background: '#fff7ed', border: '1px solid #fed7aa' }}>
                View Booking <ExternalLink size={11} />
              </a>
            )}
          </div>

          {/* Skip button — only for Pending + active plan */}
          {canManage && isPlanActive && item.status === PlanItemStatus.Pending && (
            <button onClick={handleSkip} disabled={loading !== null}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '0.79rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {loading === 'skip' ? <Loader2 size={12} style={spinStyle} /> : <SkipForward size={12} />}
              Skip
            </button>
          )}
        </div>

        {/* Inline confirm form removed — use Confirm Bookings modal instead */}
      </div>
    </div>
  );
};

// ─── ProjectResourcesPanel ───────────────────────────────────────────────────
const BOOKING_STATUS_STYLE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  // string keys (API returns label)
  Pending:   { label: 'Pending',   bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  Approved:  { label: 'Approved',  bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  Rejected:  { label: 'Rejected',  bg: '#fff1f2', color: '#be123c', border: '#fecdd3' },
  InUse:     { label: 'In Use',    bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  Completed: { label: 'Completed', bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
  Cancelled: { label: 'Cancelled', bg: '#fff1f2', color: '#be123c', border: '#fecdd3' },
  // numeric keys (API returns BookingStatus enum value)
  '1': { label: 'Pending',   bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  '2': { label: 'Approved',  bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  '3': { label: 'Rejected',  bg: '#fff1f2', color: '#be123c', border: '#fecdd3' },
  '4': { label: 'Cancelled', bg: '#fff1f2', color: '#6b7280', border: '#e5e7eb' },
  '5': { label: 'Completed', bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
  '6': { label: 'In Use',    bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
};

const ProjectResourcesPanel: React.FC<{ projectId: string; onNavigateBooking?: (bookingId: string) => void }> = ({ projectId, onNavigateBooking }) => {
  const [resources, setResources] = useState<ProjectResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    resourceService.getByProject(projectId)
      .then(data => { if (alive) setResources(data); })
      .catch(() => { if (alive) setResources([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [projectId]);

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Package size={16} style={{ color: '#0ea5e9' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>Project Equipment</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 1 }}>
            {loading ? 'Loading…' : resources.length === 0 ? 'No equipment booked yet' : `${resources.length} resource${resources.length !== 1 ? 's' : ''} across all bookings`}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '28px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Loader2 size={15} style={spinStyle} /> Loading equipment…
        </div>
      ) : resources.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <Package size={28} style={{ color: '#cbd5e1', marginBottom: 8 }} />
          <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 500 }}>No equipment has been booked for this project yet.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {resources.map((r, idx) => {
            const statusStyle = r.bookingStatus != null ? (BOOKING_STATUS_STYLE[String(r.bookingStatus)] ?? null) : null;
            const meta = getRtMeta({ resourceTypeName: r.resourceTypeName } as Resource);
            const modelLocation = [r.modelSeries, r.location].filter(Boolean).join(' · ');
            return (
              <div
                key={r.resourceId + (r.bookingId ?? idx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
              >
                {/* Icon */}
                <div style={{ width: 36, height: 36, borderRadius: 10, background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {meta.icon}
                </div>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    {r.isDamaged && (
                      <span title="Damaged" style={{ fontSize: '0.6rem', fontWeight: 800, background: '#fff1f2', color: '#ef4444', border: '1px solid #fecdd3', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>DMG</span>
                    )}
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', wordBreak: 'break-word' }}>{r.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {r.resourceTypeName && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: meta.color, background: meta.bg, padding: '1px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                        {r.resourceTypeName}
                      </span>
                    )}
                    {modelLocation && (
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                        {modelLocation}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status + Period */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  {statusStyle && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`, whiteSpace: 'nowrap' }}>
                      {statusStyle.label}
                    </span>
                  )}
                  {r.startTime && r.endTime && (
                    <span style={{ fontSize: '0.67rem', color: '#64748b', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CalendarRange size={10} style={{ color: '#94a3b8' }} />
                      {new Date(r.startTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                      {' → '}
                      {new Date(r.endTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </span>
                  )}
                </div>

                {/* View button */}
                {r.bookingId && onNavigateBooking && (
                  <button
                    onClick={() => onNavigateBooking(r.bookingId!)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.12s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#cbd5e1'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0'; }}
                  >
                    <ExternalLink size={10} /> View
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── ProgressBar ─────────────────────────────────────────────────────────────
const ProgressBar: React.FC<{ plan: ProjectBookingPlanResponse }> = ({ plan }) => {
  const total   = plan.items.length;
  if (total === 0) return null;
  const booked  = plan.items.filter(i => i.status === PlanItemStatus.Booked).length;
  const skipped = plan.items.filter(i => i.status === PlanItemStatus.Skipped).length;
  const pending = total - booked - skipped;
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: total, color: '#475569', bg: '#f1f5f9' },
          { label: 'Booked', value: booked, color: '#15803d', bg: '#f0fdf4' },
          { label: 'Pending', value: pending, color: '#b45309', bg: '#fffbeb' },
          { label: 'Skipped', value: skipped, color: '#6b7280', bg: '#f3f4f6' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: s.bg }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: s.color, opacity: 0.75 }}>{s.label}</span>
          </div>
        ))}
      </div>
      <div style={{ height: 7, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${(booked / total) * 100}%`, background: '#22c55e', transition: 'width .4s' }} />
        <div style={{ width: `${(skipped / total) * 100}%`, background: '#d1d5db', transition: 'width .4s' }} />
        <div style={{ width: `${(pending / total) * 100}%`, background: '#fde68a', transition: 'width .4s' }} />
      </div>
    </div>
  );
};

// ─── ItemGroup ────────────────────────────────────────────────────────────────
interface ItemGroupProps {
  label: string; count: number;
  meta: { color: string; bg: string; bar: string };
  collapsed: boolean; onToggle: () => void;
  children: React.ReactNode;
}
const ItemGroup: React.FC<ItemGroupProps> = ({ label, count, meta, collapsed, onToggle, children }) => (
  <div style={{ marginBottom: 8 }}>
    <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: collapsed ? '#f8fafc' : '#fff', border: '1.5px solid #e2e8f0', borderBottom: collapsed ? '1.5px solid #e2e8f0' : '1.5px solid transparent', borderRadius: collapsed ? 10 : '10px 10px 0 0', cursor: 'pointer', padding: '11px 16px' }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.bar, flexShrink: 0 }} />
      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#334155', flex: 1, textAlign: 'left' }}>{label}</span>
      <span style={{ fontSize: '0.73rem', fontWeight: 700, padding: '2px 9px', borderRadius: 99, color: meta.color, background: meta.bg, border: `1px solid ${meta.bar}33` }}>{count}</span>
      {collapsed ? <ChevronDown size={15} style={{ color: '#94a3b8' }} /> : <ChevronUp size={15} style={{ color: '#94a3b8' }} />}
    </button>
    {!collapsed && (
      <div style={{ border: '1.5px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px 14px 6px' }}>
        {children}
      </div>
    )}
  </div>
);

// ─── WarningSection ────────────────────────────────────────────────────────────
const WARNING_META: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  RESOURCE_TYPE_NOT_IN_SYSTEM: { color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', icon: <AlertTriangle size={14} /> },
  ALL_RESOURCES_UNAVAILABLE:   { color: '#92400e', bg: '#fffbeb', border: '#fde68a', icon: <AlertTriangle size={14} /> },
  NO_EQUIPMENT_NEEDED:         { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: <CheckCircle2 size={14} /> },
};
const defaultWarningMeta = { color: '#374151', bg: '#f9fafb', border: '#e5e7eb', icon: <AlertTriangle size={14} /> };

const WarningsSection: React.FC<{ warnings: PlanWarning[] }> = ({ warnings }) => {
  if (warnings.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <AlertTriangle size={13} style={{ color: '#f59e0b' }} />
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          AI Notes &amp; Warnings ({warnings.length})
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {warnings.map((w, i) => {
          const m = WARNING_META[w.code] ?? defaultWarningMeta;
          return (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 13px', borderRadius: 9, background: m.bg, border: `1px solid ${m.border}` }}>
              <div style={{ color: m.color, flexShrink: 0, marginTop: 1 }}>{m.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: m.color, marginBottom: 2 }}>
                  {w.resourceTypeName
                    ? <span style={{ marginRight: 6, fontWeight: 800 }}>{w.resourceTypeName}</span>
                    : null}
                  {w.code.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#374151', lineHeight: 1.5 }}>{w.message}</div>
                {w.relatedTask && (
                  <div style={{ marginTop: 4, fontSize: '0.68rem', color: '#7c3aed', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={10} /> Related: {w.relatedTask}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── BulkConfirmModal ─────────────────────────────────────────────────────────
interface BulkConfirmModalProps {
  plan: ProjectBookingPlanResponse;
  resources: Resource[];
  allBookings: Booking[];
  onClose: () => void;
  onUpdate: (plan: ProjectBookingPlanResponse) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const BulkConfirmModal: React.FC<BulkConfirmModalProps> = ({
  plan, resources, allBookings, onClose, onUpdate, showToast,
}) => {
  const pendingItems = useMemo(
    () => plan.items.filter(i => i.status === PlanItemStatus.Pending),
    [plan.items],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(pendingItems.map(i => i.id)),
  );
  const [date, setDate]               = useState<Date | null>(null);
  const [startMins, setStartMins]     = useState(480);
  const [returnMins, setReturnMins]   = useState(1020);
  const [durDays, setDurDays]         = useState(1);
  const [calMonth, setCalMonth]       = useState(new Date().getMonth());
  const [calYear, setCalYear]         = useState(new Date().getFullYear());
  const [submitting, setSubmitting]   = useState(false);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const calDays = useMemo(() => {
    const first    = new Date(calYear, calMonth, 1);
    const startDay = (first.getDay() + 6) % 7;
    const total    = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(new Date(calYear, calMonth, d));
    return cells;
  }, [calMonth, calYear]);

  const startObj = useMemo(() => {
    if (!date) return null;
    const s = new Date(date); s.setHours(Math.floor(startMins/60), startMins%60, 0, 0); return s;
  }, [date, startMins]);
  const endDate = useMemo(() => {
    if (!date) return null;
    const e = new Date(date); e.setDate(e.getDate() + durDays); e.setHours(Math.floor(returnMins/60), returnMins%60, 0, 0); return e;
  }, [date, durDays, returnMins]);
  const highlightRange = useMemo(
    () => startObj && endDate ? { start: startObj, end: endDate } : null,
    [startObj, endDate],
  );
  const durLabel = useMemo(() => {
    if (!startObj || !endDate || endDate <= startObj) return '';
    const ms = endDate.getTime() - startObj.getTime();
    const dv = Math.floor(ms / 86400000), hv = Math.floor((ms % 86400000) / 3600000);
    return [dv ? `${dv}d` : '', hv ? `${hv}h` : ''].filter(Boolean).join(' ') || '<1h';
  }, [startObj, endDate]);

  const toggleItem = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });

  const handleSubmit = async () => {
    if (selectedIds.size === 0) { showToast('Select at least one item.', 'warning'); return; }
    if (!startObj || !endDate || endDate <= startObj) { showToast('Select a valid date and time range.', 'warning'); return; }
    setSubmitting(true);
    let latest = plan;
    for (const item of pendingItems.filter(i => selectedIds.has(i.id))) {
      try {
        latest = await projectBookingPlanService.confirmItem(plan.id, item.id, {
          startDate: startObj.toISOString(), endDate: endDate.toISOString(),
          quantity: item.suggestedQuantity,
        });
      } catch (err: any) {
        showToast(`Failed "${item.resourceName}": ${err?.response?.data?.message || err?.message}`, 'error');
        setSubmitting(false); onUpdate(latest); return;
      }
    }
    setSubmitting(false); onUpdate(latest); onClose();
    showToast(`${selectedIds.size} booking${selectedIds.size !== 1 ? 's' : ''} created! Awaiting approval.`, 'success');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 1080, background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px -12px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarRange size={17} style={{ color: '#16a34a' }} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Confirm Bookings</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Select items and set a shared booking window</div>
            </div>
          </div>
          <button onClick={onClose} disabled={submitting} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>
          {/* Left — item list */}
          <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pending ({pendingItems.length})</span>
              <button onClick={() => setSelectedIds(selectedIds.size === pendingItems.length ? new Set() : new Set(pendingItems.map(i => i.id)))}
                style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary-color,#e8720c)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {selectedIds.size === pendingItems.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            {pendingItems.length === 0
              ? <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>No pending items.</div>
              : <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {pendingItems.map(item => {
                    const sel = selectedIds.has(item.id);
                    return (
                      <div key={item.id} onClick={() => toggleItem(item.id)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', borderRadius: 10, border: `1.5px solid ${sel ? 'var(--primary-color,#e8720c)' : '#e2e8f0'}`, background: sel ? 'rgba(232,114,12,0.04)' : '#fff', cursor: 'pointer', transition: 'all 0.12s' }}>
                        <div style={{ width: 17, height: 17, borderRadius: 5, border: `2px solid ${sel ? 'var(--primary-color,#e8720c)' : '#cbd5e1'}`, background: sel ? 'var(--primary-color,#e8720c)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                          {sel && <Check size={9} color="#fff" strokeWidth={3} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.resourceName}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.63rem', color: '#64748b', fontWeight: 600 }}>x{item.suggestedQuantity}</span>
                            {item.relatedTask && <span style={{ fontSize: '0.63rem', color: '#7c3aed', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}><CheckCircle2 size={9} />{item.relatedTask}</span>}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <CalendarRange size={9} />{fmtDate(item.suggestedStartDate)} — {fmtDate(item.suggestedEndDate)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </div>

          {/* Right — schedule + date picker */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Schedule (fills available height) */}
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 200 }}>
              <SchedulePanel
                resources={resources}
                allBookings={allBookings}
                manualItems={[]}
                activeItemKey={null}
                onSlotClick={() => {}}
                mode="review"
                plan={plan}
                highlightRange={highlightRange}
                navigateTo={date}
              />
            </div>

            {/* Compact date/time picker */}
            <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 18px', background: '#fafafa', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start', flexShrink: 0 }}>
              {/* Mini calendar */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Pickup Date</div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <button type="button" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); }} style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={10} /></button>
                    <span style={{ fontSize: '0.73rem', fontWeight: 800, color: '#1e293b' }}>{CONFIRM_MONTHS[calMonth]} {calYear}</span>
                    <button type="button" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); }} style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={10} /></button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 30px)', gap: 1, marginBottom: 3, textAlign: 'center' }}>
                    {CONFIRM_DAYS_SHORT.map(d => <span key={d} style={{ fontSize: 8, fontWeight: 800, color: '#94a3b8' }}>{d}</span>)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 30px)', gap: 1, justifyItems: 'center' }}>
                    {calDays.map((day, i) => {
                      if (!day) return <div key={`e${i}`} style={{ width: 30, height: 28 }} />;
                      const isPast = day < today;
                      const selMid = date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : null;
                      const dayMid = new Date(day.getFullYear(), day.getMonth(), day.getDate());
                      const isSel  = selMid ? dayMid.getTime() === selMid.getTime() : false;
                      const endMid = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) : null;
                      const isInRange = !!(selMid && endMid && dayMid > selMid && dayMid <= endMid);
                      return (
                        <div key={i} onClick={() => !isPast && setDate(new Date(day))}
                          style={{ width: 30, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isPast ? 'not-allowed' : 'pointer', background: isSel ? 'var(--primary-color,#e8720c)' : isInRange ? 'rgba(14,165,233,0.15)' : 'transparent', color: isSel ? '#fff' : isPast ? '#cbd5e1' : isInRange ? '#0369a1' : '#1e293b', fontSize: 11, fontWeight: isSel ? 800 : 500, transition: 'background 0.1s' }}
                          onMouseEnter={e => { if (!isPast && !isSel) (e.currentTarget as HTMLDivElement).style.background = isInRange ? 'rgba(14,165,233,0.25)' : '#f1f5f9'; }}
                          onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = isInRange ? 'rgba(14,165,233,0.15)' : 'transparent'; }}>
                          {day.getDate()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Time + duration + summary */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 240 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Pickup Time</div>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                      {CONFIRM_SESSIONS.map(s => (
                        <button key={s.mins} type="button" onClick={() => setStartMins(s.mins)}
                          style={{ padding: '3px 7px', borderRadius: 6, border: '1.5px solid', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s', borderColor: startMins === s.mins ? 'var(--primary-color,#e8720c)' : '#e2e8f0', background: startMins === s.mins ? 'var(--primary-color,#e8720c)' : '#fff', color: startMins === s.mins ? '#fff' : '#64748b' }}>
                          {s.label}
                        </button>
                      ))}
                      <ConfirmTimeDropdown value={startMins} onChange={setStartMins} accent="var(--primary-color,#e8720c)" />
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary-color,#e8720c)', marginTop: 2 }}>{fmtConfirmMins(startMins)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Return Time</div>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                      {CONFIRM_SESSIONS.map(s => (
                        <button key={s.mins} type="button" onClick={() => setReturnMins(s.mins)}
                          style={{ padding: '3px 7px', borderRadius: 6, border: '1.5px solid', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s', borderColor: returnMins === s.mins ? '#0ea5e9' : '#e2e8f0', background: returnMins === s.mins ? '#0ea5e9' : '#fff', color: returnMins === s.mins ? '#fff' : '#64748b' }}>
                          {s.label}
                        </button>
                      ))}
                      <ConfirmTimeDropdown value={returnMins} onChange={setReturnMins} accent="#0ea5e9" />
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#0ea5e9', marginTop: 2 }}>{fmtConfirmMins(returnMins)}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Duration</div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {CONFIRM_DURATIONS.map(p => (
                      <button key={p.label} type="button" onClick={() => setDurDays(p.days)}
                        style={{ padding: '3px 9px', borderRadius: 6, border: '1.5px solid', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s', borderColor: durDays === p.days ? 'var(--primary-color,#e8720c)' : '#e2e8f0', background: durDays === p.days ? 'rgba(232,114,12,0.08)' : '#fff', color: durDays === p.days ? 'var(--primary-color,#e8720c)' : '#64748b' }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                {startObj && endDate && endDate > startObj && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
                    <Clock size={12} style={{ color: '#1d4ed8', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '0.72rem', fontWeight: 700, color: '#1d4ed8' }}>
                      {startObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {fmtConfirmMins(startMins)}
                      {' → '}
                      {endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {fmtConfirmMins(returnMins)}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1d4ed8', background: '#fff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>{durLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#fafafa', flexShrink: 0 }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b', padding: '5px 10px', background: '#fffbeb', borderRadius: 7, border: '1px solid #fde68a' }}>
            <strong>{selectedIds.size}</strong> item{selectedIds.size !== 1 ? 's' : ''} selected — <strong>Pending</strong> bookings will be created and require approval.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} disabled={submitting} style={{ ...btnSecondary, fontSize: '0.78rem', padding: '7px 16px', opacity: submitting ? 0.5 : 1 }}>Cancel</button>
            <button onClick={handleSubmit} disabled={submitting || selectedIds.size === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 9, border: 'none', background: selectedIds.size === 0 ? '#e2e8f0' : '#16a34a', color: selectedIds.size === 0 ? '#94a3b8' : '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: submitting || selectedIds.size === 0 ? 'not-allowed' : 'pointer', opacity: submitting ? 0.65 : 1 }}>
              {submitting ? <Loader2 size={13} style={spinStyle} /> : <Check size={13} />}
              Create {selectedIds.size} Booking{selectedIds.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── PlanReviewPanel — right panel in review mode ─────────────────────────────
interface PlanReviewPanelProps {
  plan: ProjectBookingPlanResponse;
  warnings: PlanWarning[];
  canManage: boolean;
  actionLoading: 'generate' | 'manual' | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onUpdate: (plan: ProjectBookingPlanResponse) => void;
  onGenerate: () => void;
  onStartManual: () => void;
  onOpenBulkConfirm: () => void;
}

const PlanReviewPanel: React.FC<PlanReviewPanelProps> = ({
  plan, warnings, canManage, actionLoading, showToast, onUpdate, onGenerate, onStartManual, onOpenBulkConfirm,
}) => {
  const isPlanActive = plan.status !== PlanStatus.Expired && plan.status !== PlanStatus.FullyBooked;
  const [collapsed, setCollapsed] = useState<Record<PlanItemStatus, boolean>>({
    [PlanItemStatus.Pending]: false,
    [PlanItemStatus.Booked]:  true,
    [PlanItemStatus.Skipped]: true,
  });
  const toggle = (s: PlanItemStatus) => setCollapsed(prev => ({ ...prev, [s]: !prev[s] }));
  const groups = {
    [PlanItemStatus.Pending]: plan.items.filter(i => i.status === PlanItemStatus.Pending),
    [PlanItemStatus.Booked]:  plan.items.filter(i => i.status === PlanItemStatus.Booked),
    [PlanItemStatus.Skipped]: plan.items.filter(i => i.status === PlanItemStatus.Skipped),
  };

  return (
    <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Generated {new Date(plan.generatedAt).toLocaleString()}</span>
          {canManage && isPlanActive && plan.items.some(i => i.status === PlanItemStatus.Pending) && (
            <button onClick={onOpenBulkConfirm}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Check size={11} /> Confirm Bookings
            </button>
          )}
        </div>
        <ProgressBar plan={plan} />
      </div>

      {/* Scrollable item groups */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {([PlanItemStatus.Pending, PlanItemStatus.Booked, PlanItemStatus.Skipped] as PlanItemStatus[]).map(status => {
          const items = groups[status];
          if (items.length === 0) return null;
          return (
            <ItemGroup key={status} label={ITEM_STATUS_META[status].label} count={items.length}
              meta={ITEM_STATUS_META[status]} collapsed={collapsed[status]} onToggle={() => toggle(status)}>
              {items.map(item => (
                <PlanItemCard key={item.id} item={item} planId={plan.id}
                  isPlanActive={isPlanActive} canManage={canManage}
                  onUpdate={onUpdate} showToast={showToast} />
              ))}
            </ItemGroup>
          );
        })}
        {plan.items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.88rem' }}>This plan has no items.</div>
        )}
        {/* Warnings from last generate */}
        <WarningsSection warnings={warnings} />
      </div>

      {/* Footer actions */}
      {canManage && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid #f1f5f9', background: '#fafafa', flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={onGenerate} disabled={actionLoading !== null}
            style={{ ...btnSecondary, fontSize: '0.78rem', padding: '6px 14px', opacity: actionLoading ? 0.6 : 1, flex: 1, justifyContent: 'center' }}>
            {actionLoading === 'generate' ? <Loader2 size={13} style={spinStyle} /> : <Sparkles size={13} />}
            Re-gen AI
          </button>
          <button onClick={onStartManual} disabled={actionLoading !== null}
            style={{ ...btnGhost, fontSize: '0.78rem', padding: '6px 14px', opacity: actionLoading ? 0.6 : 1, flex: 1, justifyContent: 'center' }}>
            <ClipboardList size={13} /> New Manual
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const DetailsBookingPlan: React.FC<DetailsBookingPlanProps> = ({ projectId, canManage, showToast }) => {
  const [viewBookingId, setViewBookingId] = useState<string | null>(null);
  const [plan, setPlan]                   = useState<ProjectBookingPlanResponse | null>(null);
  const [lastWarnings, setLastWarnings]   = useState<PlanWarning[]>([]);
  const [loadingPlan, setLoadingPlan]     = useState(true);
  const [actionLoading, setActionLoading] = useState<'generate' | 'manual' | null>(null);
  const [resources, setResources]         = useState<Resource[]>([]);
  const [allBookings, setAllBookings]     = useState<Booking[]>([]);
  const [loadingData, setLoadingData]     = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [manualItems, setManualItems]     = useState<(ManualPlanItemRequest & { _key: string })[]>([]);
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    setLoadingPlan(true);
    // Warnings only come from generate — clear them on manual refresh
    setLastWarnings([]);
    try {
      const p = await projectBookingPlanService.getByProject(projectId);
      setPlan(p);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load booking plan.', 'error');
    } finally { setLoadingPlan(false); }
  }, [projectId]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const loadData = useCallback(async () => {
    if (resources.length > 0) return;
    setLoadingData(true);
    try {
      const [resResult, bookings] = await Promise.all([
        resourceService.getAll(1, 200),
        bookingService.getAllPages(),
      ]);
      setResources(resResult.items ?? []);
      setAllBookings(bookings);
    } catch { /* non-fatal */ }
    finally { setLoadingData(false); }
  }, [resources.length]);

  useEffect(() => { loadData(); }, [loadData]);

  const openManualForm = useCallback(async () => {
    setShowManualForm(true);
    if (manualItems.length === 0) {
      setManualItems([{ _key: `item-${Date.now()}`, resourceId: '', suggestedQuantity: 1, suggestedStartDate: '', suggestedEndDate: '', note: '' }]);
    }
    await loadData();
  }, [manualItems.length, loadData]);

  const closeManualForm = () => {
    setShowManualForm(false);
    setManualItems([]);
    setActiveItemKey(null);
  };

  const handleGenerate = async () => {
    setActionLoading('generate');
    try {
      const newPlan = await projectBookingPlanService.generate(projectId);
      setPlan(newPlan);
      setLastWarnings(newPlan.warnings ?? []);
      const count = newPlan.items.length;
      const warnCount = (newPlan.warnings ?? []).length;
      const retainedCount = newPlan.items.filter(i => i.status === PlanItemStatus.Booked).length;
      if (retainedCount > 0) {
        showToast(`${retainedCount} previously booked item${retainedCount !== 1 ? 's were' : ' was'} retained in the new plan.`, 'info');
      }
      showToast(
        `AI plan generated with ${count} suggestion${count !== 1 ? 's' : ''}${warnCount ? ` and ${warnCount} warning${warnCount !== 1 ? 's' : ''}` : ''}.`,
        warnCount > 0 ? 'warning' : 'success',
      );
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to generate plan.', 'error');
    } finally { setActionLoading(null); }
  };

  const addManualItem = () => {
    const key = `item-${Date.now()}`;
    setManualItems(prev => [...prev, { _key: key, resourceId: '', suggestedQuantity: 1, suggestedStartDate: '', suggestedEndDate: '', note: '' }]);
    setActiveItemKey(key);
  };

  const changeManualItem = (key: string, field: string, value: string | number) =>
    setManualItems(prev => prev.map(i => i._key === key ? { ...i, [field]: value } : i));

  const removeManualItem = (key: string) => {
    setManualItems(prev => prev.filter(i => i._key !== key));
    if (activeItemKey === key) setActiveItemKey(null);
  };

  const handleSlotClick = useCallback((resource: Resource, date: Date) => {
    const endDate = new Date(date);
    endDate.setDate(date.getDate() + 1);
    const key = `item-${Date.now()}`;
    const newItem = {
      _key: key,
      resourceId: resource.id,
      suggestedQuantity: Math.min(1, resource.availableQuantity ?? 1),
      suggestedStartDate: date.toISOString(),
      suggestedEndDate: endDate.toISOString(),
      note: '',
    };
    setManualItems(prev => [...prev, newItem]);
    setActiveItemKey(key);
    if (!showManualForm) openManualForm();
  }, [showManualForm, openManualForm]);

  const handleManualSubmit = async () => {
    for (const item of manualItems) {
      if (!item.resourceId) { showToast('Please select a resource for all items.', 'warning'); return; }
      if (!item.suggestedStartDate || !item.suggestedEndDate) { showToast('Start and end dates are required.', 'warning'); return; }
      if (new Date(item.suggestedEndDate) <= new Date(item.suggestedStartDate)) {
        const rName = resources.find(r => r.id === item.resourceId)?.name || item.resourceId;
        showToast(`End date must be after start date for "${rName}".`, 'warning'); return;
      }
    }
    setActionLoading('manual');
    try {
      const body = { items: manualItems.map(({ _key, ...rest }) => ({ ...rest, note: rest.note || undefined })) };
      const newPlan = await projectBookingPlanService.createManual(projectId, body);
      setPlan(newPlan);
      closeManualForm();
      showToast('Manual booking plan created!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to create plan.', 'error');
    } finally { setActionLoading(null); }
  };

  const planMeta = plan ? PLAN_STATUS_META[plan.status as PlanStatus] : null;

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loadingPlan) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5rem', gap: 12, color: '#94a3b8' }}>
        <Loader2 size={24} style={spinStyle} />
        <span style={{ fontSize: '0.9rem' }}>Loading booking plan…</span>
      </div>
    );
  }

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 9 }}>
            <Package size={20} style={{ color: 'var(--primary-color,#e8720c)' }} />
            Resource Booking Plan
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
            Generate an AI-recommended plan or build one manually to book lab resources.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {planMeta && (
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 12px', borderRadius: 99, color: planMeta.color, background: planMeta.bg, border: `1px solid ${planMeta.border}`, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{planMeta.label}</span>
          )}
          <button onClick={loadPlan} style={{ ...btnGhost, padding: '6px 12px', fontSize: '0.78rem' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Empty state (no plan, no form) ────────────────────────────── */}
      {!plan && !showManualForm && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 680 }}>
          <div
            style={{ padding: '28px 24px', borderRadius: 16, background: 'linear-gradient(135deg,#fff7ed 0%,#fffbf7 100%)', border: '1.5px solid #fed7aa', cursor: canManage ? 'pointer' : 'default' }}
            onClick={canManage && actionLoading === null ? handleGenerate : undefined}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#e8720c,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              {actionLoading === 'generate' ? <Loader2 size={22} color="#fff" style={spinStyle} /> : <Bot size={22} color="#fff" />}
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>Generate with AI</h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: '#78716c', lineHeight: 1.5 }}>AI analyses your milestones &amp; tasks and suggests the best resource bookings automatically.</p>
            {canManage && <span style={{ ...btnPrimary, fontSize: '0.8rem', padding: '7px 16px', pointerEvents: 'none' }}><Sparkles size={14} /> Generate Plan</span>}
          </div>
          <div
            style={{ padding: '28px 24px', borderRadius: 16, background: '#fff', border: '1.5px solid #e2e8f0', cursor: canManage ? 'pointer' : 'default' }}
            onClick={canManage && actionLoading === null ? openManualForm : undefined}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <PencilLine size={22} style={{ color: '#475569' }} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>Create Manually</h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>Pick specific resources, set your own date ranges and quantities for each item.</p>
            {canManage && <span style={{ ...btnSecondary, fontSize: '0.8rem', padding: '7px 16px', pointerEvents: 'none' }}><ClipboardList size={14} /> Create Plan</span>}
          </div>
        </div>
      )}

      {/* ── Planning mode: split panel (Schedule + Builder) ──────────── */}
      {showManualForm && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          <SchedulePanel
            resources={resources}
            allBookings={allBookings}
            manualItems={manualItems}
            activeItemKey={activeItemKey}
            onSlotClick={handleSlotClick}
            mode="planning"
          />
          <PlanBuilderPanel
            plan={plan}
            manualItems={manualItems}
            activeItemKey={activeItemKey}
            resources={resources}
            allBookings={allBookings}
            loadingData={loadingData}
            actionLoading={actionLoading}
            onSetActiveKey={setActiveItemKey}
            onAddItem={addManualItem}
            onChangeItem={changeManualItem}
            onRemoveItem={removeManualItem}
            onClose={closeManualForm}
            onSavePlan={handleManualSubmit}
          />
        </div>
      )}

      {/* ── Review mode: Equipment list + Plan Review ─────────────────── */}
      {plan && !showManualForm && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          <ProjectResourcesPanel
            projectId={projectId}
            onNavigateBooking={(bookingId) => setViewBookingId(bookingId)}
          />
          <PlanReviewPanel
            plan={plan}
            warnings={lastWarnings}
            canManage={canManage}
            actionLoading={actionLoading}
            showToast={showToast}
            onUpdate={setPlan}
            onGenerate={handleGenerate}
            onStartManual={openManualForm}
            onOpenBulkConfirm={() => setShowBulkConfirm(true)}
          />
        </div>
      )}

      {/* Bulk Confirm Modal */}
      {showBulkConfirm && plan && (
        <BulkConfirmModal
          plan={plan}
          resources={resources}
          allBookings={allBookings}
          onClose={() => setShowBulkConfirm(false)}
          onUpdate={(p) => { setPlan(p); setShowBulkConfirm(false); }}
          showToast={showToast}
        />
      )}

      {/* Booking Detail Modal */}
      {viewBookingId && (
        <div
          onClick={() => setViewBookingId(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9100,
            background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 600, maxHeight: '90vh',
              background: '#fff', borderRadius: 16,
              boxShadow: '0 24px 48px rgba(0,0,0,0.24)',
              display: 'flex', flexDirection: 'column', overflow: 'auto',
            }}
          >
            <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setViewBookingId(null)}
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '0 20px 20px', flex: 1, minHeight: 0 }}>
              <BookingDetailPanel
                key={viewBookingId}
                bookingId={viewBookingId}
                onClose={() => setViewBookingId(null)}
                onSaved={(shouldClose, message) => {
                  if (message) showToast(message, 'success');
                  if (shouldClose) setViewBookingId(null);
                }}
                isLabDirector={false}
                isManagedView={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailsBookingPlan;
