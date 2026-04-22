// =============================================================================
// DetailsBookingPlan — Project Resource Booking Plan  (Redesigned)
// Split-panel layout: SchedulePanel (left 60%) always visible +
//   PlanBuilderPanel (right 40%) in planning mode
//   PlanReviewPanel  (right 40%) in review mode
// =============================================================================
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from '@/services/projectBookingPlanService';
import { resourceService } from '@/services/resourceService';
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

// ─── Booking status colors ────────────────────────────────────────────────────
const BKST: Record<number, { bg: string; border: string; color: string; dashed?: boolean }> = {
  [BookingStatus.Pending]:   { bg: '#FEF3C7', border: '#F59E0B', color: '#92400E', dashed: true },
  [BookingStatus.Approved]:  { bg: '#DCFCE7', border: '#22C55E', color: '#14532D' },
  [BookingStatus.InUse]:     { bg: '#EDE9FE', border: '#8B5CF6', color: '#4C1D95' },
  [BookingStatus.Completed]: { bg: '#F1F5F9', border: '#94A3B8', color: '#475569' },
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
}

const SchedulePanel: React.FC<SchedulePanelProps> = ({
  resources, allBookings, manualItems, activeItemKey, onSlotClick, mode, plan,
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

  const DAY_W   = rangeDays <= 7 ? 100 : 65;
  const ROW_H   = 52;
  const LABEL_W = 180;

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(rangeStart); d.setDate(rangeStart.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [rangeStart, rangeDays]);

  const rangeEnd = useMemo(() => { const e = new Date(rangeStart); e.setDate(rangeStart.getDate() + rangeDays); return e; }, [rangeStart, rangeDays]);
  const totalW   = DAY_W * rangeDays;

  const visibleResources = useMemo(() => {
    const q = filterQ.toLowerCase().trim();
    if (!q) return resources;
    return resources.filter(r => r.name.toLowerCase().includes(q) || (r.resourceTypeName ?? '').toLowerCase().includes(q));
  }, [resources, filterQ]);

  const bookingsByResource = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    resources.forEach(r => { map[r.id] = []; });
    allBookings.forEach(b => {
      if (b.status === BookingStatus.Rejected || b.status === BookingStatus.Cancelled) return;
      const ids = b.resourceIds ?? (b.resourceId ? [b.resourceId] : []);
      ids.forEach(id => {
        const r = resources.find(x => x.id === id || x.ids?.includes(id));
        if (r && map[r.id]) map[r.id].push(b);
      });
    });
    return map;
  }, [allBookings, resources]);

  const posFor = (b: Booking) => {
    const s = new Date(b.startTime), e = new Date(b.endTime);
    if (e <= rangeStart || s >= rangeEnd) return null;
    const clS = s < rangeStart ? rangeStart : s;
    const clE = e > rangeEnd ? rangeEnd : e;
    const left  = ((clS.getTime() - rangeStart.getTime()) / 86400000) * DAY_W;
    const width = Math.max(((clE.getTime() - clS.getTime()) / 86400000) * DAY_W, 20);
    return { left, width };
  };

  const winFor = (start: string, end: string) => {
    if (!start || !end) return null;
    const s = new Date(start), e = new Date(end);
    if (e <= rangeStart || s >= rangeEnd) return null;
    const clS = s < rangeStart ? rangeStart : s;
    const clE = e > rangeEnd ? rangeEnd : e;
    const left  = ((clS.getTime() - rangeStart.getTime()) / 86400000) * DAY_W;
    const width = Math.max(((clE.getTime() - clS.getTime()) / 86400000) * DAY_W, 8);
    return { left, width };
  };

  const nowLeft    = ((Date.now() - rangeStart.getTime()) / 86400000) * DAY_W;
  const nowVisible = nowLeft >= 0 && nowLeft <= totalW;
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

  // Plan item overlays for review mode (matched by resourceName)
  const planItemsByResourceName = useMemo(() => {
    if (mode !== 'review' || !plan) return {} as Record<string, ProjectBookingPlanItemResponse[]>;
    const map: Record<string, ProjectBookingPlanItemResponse[]> = {};
    for (const item of plan.items) {
      if (!map[item.resourceName]) map[item.resourceName] = [];
      map[item.resourceName].push(item);
    }
    return map;
  }, [plan, mode]);

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
            { bg: '#DCFCE7', border: '#22C55E', label: 'Approved' },
            { bg: '#EDE9FE', border: '#8B5CF6', label: 'In Use' },
            { bg: '#FEF3C7', border: '#F59E0B', label: 'Pending', dashed: true },
            { bg: 'rgba(232,114,12,0.12)', border: '#e8720c', label: mode === 'planning' ? 'Your plan' : 'Plan item' },
          ].map(l => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: l.bg, border: `1px ${l.dashed ? 'dashed' : 'solid'} ${l.border}`, display: 'inline-block', flexShrink: 0 }} />
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
                return (
                  <div key={i} style={{ width: DAY_W, flexShrink: 0, padding: '5px 3px', textAlign: 'center', borderRight: '1px solid #f1f5f9', background: isToday ? '#fff7ed' : isWe ? '#f8fafc' : '#fff' }}>
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
            {nowVisible && (
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: LABEL_W + nowLeft, width: 2, background: '#e8720c', zIndex: 4, boxShadow: '0 0 0 2px rgba(232,114,12,0.15)', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: -4, left: -4, width: 10, height: 10, borderRadius: 99, background: '#e8720c', border: '2px solid #fff' }} />
              </div>
            )}

            {visibleResources.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>{resources.length === 0 ? 'Loading…' : 'No matching resources.'}</div>
            )}

            {visibleResources.map((r, ridx) => {
              const meta      = getRtMeta(r);
              const rBookings = (bookingsByResource[r.id] ?? []).filter(b => BKST[b.status]);

              const laned: { b: Booking; lane: number }[] = [];
              rBookings
                .slice().sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                .forEach(b => {
                  let lane = 0;
                  while (laned.some(x => x.lane === lane && new Date(x.b.endTime) > new Date(b.startTime) && new Date(x.b.startTime) < new Date(b.endTime))) lane++;
                  laned.push({ b, lane });
                });
              const maxLane   = Math.max(0, ...laned.map(x => x.lane));
              const rowHeight = ROW_H + maxLane * 26;

              // Planning mode: orange overlays from manualItems with this resourceId
              const planningWins = mode === 'planning'
                ? manualItems
                    .filter(i => i.resourceId === r.id && i.suggestedStartDate && i.suggestedEndDate)
                    .map((i, idx) => ({ start: i.suggestedStartDate, end: i.suggestedEndDate, label: `#${idx + 1}`, isActive: i._key === activeItemKey }))
                : [];

              // Review mode: plan item overlays by resourceName match
              const reviewWins = mode === 'review'
                ? (planItemsByResourceName[r.name] ?? [])
                    .filter(i => i.status !== PlanItemStatus.Skipped)
                    .map(i => ({ start: i.suggestedStartDate, end: i.suggestedEndDate, label: i.resourceName, isActive: false }))
                : [];

              const allWins = [...planningWins, ...reviewWins];

              // Active resource highlight (any manualItem with this resourceId is the active item)
              const isActiveResource = mode === 'planning' && activeItemKey !== null &&
                manualItems.some(i => i._key === activeItemKey && i.resourceId === r.id);

              return (
                <div key={r.id} style={{ display: 'flex', borderBottom: ridx < visibleResources.length - 1 ? '1px solid #f1f5f9' : 'none', height: rowHeight, position: 'relative', background: isActiveResource ? 'rgba(232,114,12,0.03)' : undefined }}>
                  {/* Label */}
                  <div style={{ width: LABEL_W, flexShrink: 0, padding: '6px 12px', borderRight: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 7, position: 'sticky', left: 0, zIndex: 3, background: isActiveResource ? 'rgba(232,114,12,0.05)' : '#fff' }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{meta.icon}</div>
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
                      return <div key={i} style={{ position: 'absolute', left: i * DAY_W, top: 0, bottom: 0, width: DAY_W, borderRight: '1px solid #f1f5f9', background: isWe ? 'rgba(241,245,249,0.4)' : 'transparent', pointerEvents: 'none' }} />;
                    })}

                    {/* Overlays (planning: manualItems; review: plan items) */}
                    {allWins.map((w, wi) => {
                      const p = winFor(w.start, w.end);
                      if (!p) return null;
                      return (
                        <div key={wi} style={{ position: 'absolute', left: p.left, width: p.width, top: 0, bottom: 0, background: w.isActive ? 'rgba(232,114,12,0.18)' : 'rgba(232,114,12,0.10)', borderLeft: `2.5px solid ${w.isActive ? '#e8720c' : 'rgba(232,114,12,0.5)'}`, borderRight: `2.5px solid ${w.isActive ? '#e8720c' : 'rgba(232,114,12,0.5)'}`, zIndex: 1, pointerEvents: 'none' }}>
                          <div style={{ position: 'absolute', bottom: 2, left: 4, fontSize: 8, fontWeight: 800, color: '#e8720c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: p.width - 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{w.label}</div>
                        </div>
                      );
                    })}

                    {/* Booking blocks */}
                    {laned.map(({ b, lane }, i) => {
                      const p = posFor(b);
                      if (!p) return null;
                      const s = BKST[b.status];
                      if (!s) return null;
                      return (
                        <div key={b.id + '-' + i}
                          title={`${(b as any).title ?? 'Booking'}\n${(b as any).userFullName ?? (b as any).userName ?? ''}\n${new Date(b.startTime).toLocaleDateString('en-GB')} ${new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                          style={{ position: 'absolute', left: p.left + 1, width: p.width - 2, top: 5 + lane * 26, height: 30, background: s.bg, color: s.color, border: `1.5px ${s.dashed ? 'dashed' : 'solid'} ${s.border}`, borderLeft: !s.dashed ? `3px solid ${s.border}` : undefined, borderRadius: 5, padding: '2px 5px', overflow: 'hidden', zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(b as any).title ?? 'Booking'}</div>
                          {p.width > 70 && <div style={{ fontSize: 9, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
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
  const [loading, setLoading] = useState<'confirm' | 'skip' | null>(null);
  const meta = ITEM_STATUS_META[item.status as PlanItemStatus];

  const handleConfirm = async () => {
    setLoading('confirm');
    try {
      const updated = await projectBookingPlanService.confirmItem(planId, item.id);
      onUpdate(updated);
      showToast('Booking confirmed and created!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to confirm.', 'error');
    } finally { setLoading(null); }
  };

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

  return (
    <div style={{ display: 'flex', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 8, overflow: 'hidden', opacity: item.status === PlanItemStatus.Skipped ? 0.6 : 1 }}>
      <div style={{ width: 4, flexShrink: 0, background: meta.bar }} />
      <div style={{ flex: 1, padding: '13px 15px' }}>
        {item.hasManualBookingOverlap && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 11px', marginBottom: 10, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 7, fontSize: '0.78rem', color: '#92400e', fontWeight: 500 }}>
            <AlertTriangle size={13} style={{ flexShrink: 0 }} />
            Another booking overlaps this window — you can still confirm or skip.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: '0.93rem', color: '#0f172a' }}>{item.resourceName}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', background: '#64748b', borderRadius: 99, padding: '1px 7px' }}>x{item.suggestedQuantity}</span>
              <span style={{ fontSize: '0.71rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, color: meta.color, background: meta.bg, border: `1px solid ${meta.bar}33` }}>
                {meta.label}{item.status === PlanItemStatus.Booked ? ' ✓' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', fontSize: '0.8rem', color: '#64748b' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CalendarRange size={12} />{fmtDate(item.suggestedStartDate)} — {fmtDate(item.suggestedEndDate)}</span>
              {item.relatedTask && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} />{item.relatedTask}</span>}
            </div>
            {item.note && <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>"{item.note}"</p>}
            {item.status === PlanItemStatus.Booked && item.bookingId && (
              <a href={`/resources/bookings/${item.bookingId}`} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 7, fontSize: '0.78rem', color: 'var(--primary-color,#e8720c)', textDecoration: 'none', fontWeight: 600 }}>
                View Booking <ExternalLink size={11} />
              </a>
            )}
          </div>
          {canManage && isPlanActive && item.status === PlanItemStatus.Pending && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
              <button onClick={handleConfirm} disabled={loading !== null}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', fontSize: '0.79rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1, whiteSpace: 'nowrap' }}>
                {loading === 'confirm' ? <Loader2 size={12} style={spinStyle} /> : <Check size={12} />}
                Confirm
              </button>
              <button onClick={handleSkip} disabled={loading !== null}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '0.79rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1, whiteSpace: 'nowrap' }}>
                {loading === 'skip' ? <Loader2 size={12} style={spinStyle} /> : <SkipForward size={12} />}
                Skip
              </button>
            </div>
          )}
        </div>
      </div>
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

// ─── PlanReviewPanel — right panel in review mode ─────────────────────────────
interface PlanReviewPanelProps {
  plan: ProjectBookingPlanResponse;
  canManage: boolean;
  actionLoading: 'generate' | 'manual' | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onUpdate: (plan: ProjectBookingPlanResponse) => void;
  onGenerate: () => void;
  onStartManual: () => void;
}

const PlanReviewPanel: React.FC<PlanReviewPanelProps> = ({
  plan, canManage, actionLoading, showToast, onUpdate, onGenerate, onStartManual,
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
  const [plan, setPlan]                   = useState<ProjectBookingPlanResponse | null>(null);
  const [loadingPlan, setLoadingPlan]     = useState(true);
  const [actionLoading, setActionLoading] = useState<'generate' | 'manual' | null>(null);
  const [resources, setResources]         = useState<Resource[]>([]);
  const [allBookings, setAllBookings]     = useState<Booking[]>([]);
  const [loadingData, setLoadingData]     = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualItems, setManualItems]     = useState<(ManualPlanItemRequest & { _key: string })[]>([]);
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    setLoadingPlan(true);
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
      showToast('AI booking plan generated!', 'success');
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
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, alignItems: 'start' }}>
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

      {/* ── Review mode: split panel (Schedule + Review) ─────────────── */}
      {plan && !showManualForm && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, alignItems: 'start' }}>
          <SchedulePanel
            resources={resources}
            allBookings={allBookings}
            manualItems={[]}
            activeItemKey={null}
            onSlotClick={() => {}}
            mode="review"
            plan={plan}
          />
          <PlanReviewPanel
            plan={plan}
            canManage={canManage}
            actionLoading={actionLoading}
            showToast={showToast}
            onUpdate={setPlan}
            onGenerate={handleGenerate}
            onStartManual={openManualForm}
          />
        </div>
      )}
    </div>
  );
};

export default DetailsBookingPlan;
