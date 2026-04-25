// =============================================================================
// NewBookingModal — 3-step booking flow
// Step 1: Pick Resources → Step 2: Schedule → Step 3: Details
// =============================================================================
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Resource, Booking, BookingStatus, CreateBookingRequest, ResourceType,
} from '@/types/booking';
import { resourceService } from '@/services/resourceService';
import { bookingService } from '@/services/bookingService';
import {
  X, Calendar, Clock, Package, FileText, Check, ChevronLeft, ChevronRight,
  MapPin, AlertTriangle, AlertCircle, Loader2, Search, Cpu, HardDrive, Box,
  Monitor, Database, Radio, Microscope,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NewBookingModalProps {
  onClose: () => void;
  onSaved: (message?: string) => void;
  /** Optionally pre-select a resource on open */
  preSelectedResourceId?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS_SHORT = ['Mo','Tu','We','Th','Fr','Sa','Su'];

const DURATION_PRESETS = [
  { label: '1 day',   days: 1 },
  { label: '3 days',  days: 3 },
  { label: '1 week',  days: 7 },
  { label: '2 weeks', days: 14 },
];

// Session time presets
const SESSION_TIMES = [
  { label: 'Morning',   mins: 480 },
  { label: 'Noon',      mins: 720 },
  { label: 'Afternoon', mins: 1020 },
];
const SESSION_MINS = SESSION_TIMES.map(s => s.mins);

// All 30-min slots for the "Other…" dropdown
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return { value: h * 60 + (i % 2) * 30, label: `${String(h).padStart(2,'0')}:${m}` };
});

// ─── Resource type metadata ───────────────────────────────────────────────────
interface RtMeta {
  icon: React.ReactNode;
  color: string;
  bg: string;
}

function getRtMeta(resource: Resource): RtMeta {
  const name = (resource.resourceTypeName ?? '').toLowerCase();
  if (name.includes('gpu') || resource.type === ResourceType.GPU)
    return { icon: <Cpu size={14}/>, color: '#7C3AED', bg: '#F5F3FF' };
  if (name.includes('microscope'))
    return { icon: <Microscope size={14}/>, color: '#0284C7', bg: '#F0F9FF' };
  if (name.includes('sensor') || name.includes('lidar') || name.includes('imu'))
    return { icon: <Radio size={14}/>, color: '#059669', bg: '#ECFDF5' };
  if (name.includes('station') || name.includes('lab') || resource.type === ResourceType.LabStation)
    return { icon: <Monitor size={14}/>, color: '#E8720C', bg: '#FFF7ED' };
  if (name.includes('dataset') || resource.type === ResourceType.Dataset)
    return { icon: <Database size={14}/>, color: '#64748B', bg: '#F1F5F9' };
  if (resource.type === ResourceType.Equipment)
    return { icon: <HardDrive size={14}/>, color: '#DC2626', bg: '#FEF2F2' };
  return { icon: <Package size={14}/>, color: '#64748B', bg: '#F1F5F9' };
}

// ─── Availability helpers ─────────────────────────────────────────────────────
/** Check if any unit of this resource group is unavailable during [start, end] */
function hasConflict(resource: Resource, startDate: Date, endDate: Date, bookings: Booking[]): boolean {
  if (!resource.ids?.length) return false;
  const unitIds = new Set(resource.ids);
  const sT = startDate.getTime(), eT = endDate.getTime();
  let booked = 0;
  for (const b of bookings) {
    if (
      b.status === BookingStatus.Rejected ||
      b.status === BookingStatus.Cancelled ||
      b.status === BookingStatus.Completed
    ) continue;
    const bs = new Date(b.startTime).getTime(), be = new Date(b.endTime).getTime();
    if (be <= sT || bs >= eT) continue;
    const rIds = b.resourceIds ?? (b.resourceId ? [b.resourceId] : []);
    for (const id of rIds) {
      if (unitIds.has(id)) { booked++; break; }
    }
  }
  return booked >= resource.ids.length;
}

type DayStatus = 'free' | 'partial' | 'full';

function getDayStatus(resource: Resource, day: Date, bookings: Booking[]): DayStatus {
  const n = getDayAvailableCount(resource, day, bookings);
  const total = resource.ids?.length ?? resource.totalQuantity ?? 1;
  if (n >= total) return 'free';
  if (n === 0) return 'full';
  return 'partial';
}

function getDayAvailableCount(resource: Resource, day: Date, bookings: Booking[]): number {
  if (!resource.ids?.length) return resource.totalQuantity ?? 1;
  const total = resource.ids.length;
  const unitIds = new Set(resource.ids);
  const sT = new Date(day); sT.setHours(0,0,0,0);
  const eT = new Date(day); eT.setHours(23,59,59,999);
  const bookedIds = new Set<string>();
  for (const b of bookings) {
    if (b.status === BookingStatus.Rejected || b.status === BookingStatus.Cancelled || b.status === BookingStatus.Completed) continue;
    const bs = new Date(b.startTime), be = new Date(b.endTime);
    if (be <= sT || bs >= eT) continue;
    const rIds = b.resourceIds ?? (b.resourceId ? [b.resourceId] : []);
    for (const id of rIds) if (unitIds.has(id)) bookedIds.add(id);
  }
  return Math.max(0, total - bookedIds.size);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** How many individual units of this resource are free during [start, end] */
function getAvailableCount(resource: Resource, start: Date, end: Date, bookings: Booking[]): number {
  if (!resource.ids?.length) return resource.totalQuantity ?? 1;
  const unitSet = new Set(resource.ids);
  const sT = start.getTime(), eT = end.getTime();
  const bookedIds = new Set<string>();
  for (const b of bookings) {
    if (b.status === BookingStatus.Rejected || b.status === BookingStatus.Cancelled || b.status === BookingStatus.Completed) continue;
    const bs = new Date(b.startTime).getTime(), be = new Date(b.endTime).getTime();
    if (be <= sT || bs >= eT) continue;
    const rIds = b.resourceIds ?? (b.resourceId ? [b.resourceId] : []);
    for (const id of rIds) if (unitSet.has(id)) bookedIds.add(id);
  }
  return Math.max(0, resource.ids.length - bookedIds.size);
}

function addMinutes(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60000);
}

function formatDuration(startDate: Date, endDate: Date): string {
  const diff = endDate.getTime() - startDate.getTime();
  const totalMins = Math.round(diff / 60000);
  if (totalMins <= 0) return '—';
  const days  = Math.floor(totalMins / 1440);
  const hrs   = Math.floor((totalMins % 1440) / 60);
  const mins  = totalMins % 60;
  const parts: string[] = [];
  if (days)  parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hrs)   parts.push(`${hrs}h`);
  if (mins)  parts.push(`${mins}m`);
  return parts.join(' ');
}

function fmtMins(mins: number): string {
  return `${String(Math.floor(mins/60)).padStart(2,'0')}:${mins%60===0?'00':'30'}`;
}

// ─── Step 1: Resource Picker ──────────────────────────────────────────────────
interface ResourcePickerProps {
  resources: Resource[];
  bookings: Booking[];
  loading: boolean;
  selectedIds: string[];
  quantities: Record<string, number>;
  onToggle: (id: string) => void;
  onQuantityChange: (id: string, qty: number) => void;
  startDate: Date | null;
  endDate: Date | null;
}

const ResourcePicker: React.FC<ResourcePickerProps> = ({
  resources, bookings, loading, selectedIds, quantities, onToggle, onQuantityChange, startDate, endDate,
}) => {
  const [search, setSearch] = useState('');
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const stripDays = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d; }),
    [today],
  );

  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? resources.filter(r =>
          r.name.toLowerCase().includes(q) ||
          (r.resourceTypeName ?? '').toLowerCase().includes(q) ||
          (r.location ?? '').toLowerCase().includes(q))
      : resources;
    const g: Record<string, Resource[]> = {};
    for (const r of filtered) {
      const key = r.resourceTypeName ?? `Type ${r.type}`;
      if (!g[key]) g[key] = [];
      g[key].push(r);
    }
    return g;
  }, [resources, search]);

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'60px 0', color:'#94a3b8' }}>
        <Loader2 size={20} className="animate-spin" />
        <span style={{ fontSize:14, fontWeight:600 }}>Loading resources…</span>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Search */}
      <div style={{ position:'relative' }}>
        <Search size={14} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Filter by name, type, location…"
          style={{
            width:'100%', padding:'9px 32px', borderRadius:10,
            border:'1px solid var(--border-color)', fontSize:13, fontFamily:'inherit',
            outline:'none', boxSizing:'border-box', color:'var(--text-primary)',
          }}
        />
        {search && (
          <button type="button" onClick={() => setSearch('')}
            style={{ position:'absolute', right:9, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0, display:'flex' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div style={{ textAlign:'center', padding:'40px 0', color:'#94a3b8', fontSize:13, fontWeight:600 }}>
          No resources match your search.
        </div>
      )}

      {Object.entries(grouped).map(([typeName, rList]) => {
        const meta = getRtMeta(rList[0]);
        return (
          <div key={typeName}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:22, height:22, borderRadius:6, background:meta.bg, color:meta.color }}>
                {meta.icon}
              </span>
              <span style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{typeName}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:10 }}>
              {rList.map(r => {
                const avail = (startDate && endDate)
                  ? getAvailableCount(r, startDate, endDate, bookings)
                  : (r.totalQuantity ?? 1);
                return (
                  <ResourceCard
                    key={r.id} resource={r}
                    selected={selectedIds.includes(r.id)}
                    quantity={quantities[r.id] ?? 1}
                    maxQty={avail}
                    conflict={!!(startDate && endDate && avail < (quantities[r.id] ?? 1))}
                    stripDays={stripDays} bookings={bookings}
                    onClick={() => onToggle(r.id)}
                    onQuantityChange={qty => onQuantityChange(r.id, qty)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface ResourceCardProps {
  resource: Resource;
  selected: boolean;
  quantity: number;
  maxQty: number;
  conflict: boolean;
  stripDays: Date[];
  bookings: Booking[];
  onClick: () => void;
  onQuantityChange: (qty: number) => void;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ resource: r, selected, quantity, maxQty, conflict, stripDays, bookings, onClick, onQuantityChange }) => {
  const meta = getRtMeta(r);
  const [hovered, setHovered] = useState(false);
  const isUnavailable = (r.availableQuantity ?? 0) === 0 && !selected;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: selected
          ? '2px solid var(--accent-color)'
          : `2px solid ${hovered ? '#cbd5e1' : 'var(--border-color)'}`,
        borderRadius:14, padding:'14px 16px',
        background: selected ? 'rgba(232,114,12,0.04)' : '#fff',
        cursor:'pointer', transition:'all 0.15s', position:'relative', userSelect:'none',
        opacity: isUnavailable ? 0.65 : 1,
      }}
    >
      {/* Checkbox */}
      <div style={{
        position:'absolute', top:12, right:12,
        width:20, height:20, borderRadius:6,
        border: selected ? '2px solid var(--accent-color)' : '2px solid #cbd5e1',
        background: selected ? 'var(--accent-color)' : '#fff',
        display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s',
      }}>
        {selected && <Check size={12} color="#fff" strokeWidth={3} />}
      </div>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:10, paddingRight:28 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:meta.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:meta.color }}>
          {meta.icon}
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', lineHeight:1.3 }}>{r.name}</div>
          {r.location && (
            <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2, display:'flex', alignItems:'center', gap:4 }}>
              <MapPin size={11} />{r.location}
            </div>
          )}
        </div>
      </div>

      {/* Capacity + quantity stepper */}
      <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', justifyContent:'space-between' }}>
        <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>
          <b style={{ color:'var(--text-primary)' }}>{r.totalQuantity}</b> unit{r.totalQuantity !== 1 ? 's' : ''}
          {maxQty < (r.totalQuantity ?? 1) && (
            <span style={{ color: maxQty === 0 ? '#ef4444' : '#f59e0b', marginLeft:4 }}>· {maxQty} free</span>
          )}
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          {conflict && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, color:'#dc2626', background:'#fef2f2', padding:'2px 7px', borderRadius:99, border:'1px solid #fecaca' }}>
              <AlertCircle size={10} color="#dc2626" /> Conflict
            </span>
          )}
          {isUnavailable && !conflict && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, color:'#f59e0b', background:'#fffbeb', padding:'2px 7px', borderRadius:99, border:'1px solid #fde68a' }}>
              Unavailable
            </span>
          )}
        </div>
      </div>

      {/* Quantity stepper — visible only when selected */}
      {selected && (
        <div
          style={{ marginTop:8, display:'flex', alignItems:'center', gap:6 }}
          onClick={e => e.stopPropagation()}
        >
          <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', flex:1 }}>Qty</span>
          <button type="button"
            onClick={() => onQuantityChange(quantity - 1)}
            style={{ width:24, height:24, borderRadius:6, border:'1px solid var(--border-color)', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'var(--text-secondary)', flexShrink:0 }}>
            −
          </button>
          <span style={{ minWidth:20, textAlign:'center', fontSize:13, fontWeight:800, color: conflict ? '#dc2626' : 'var(--accent-color)' }}>
            {quantity}
          </span>
          <button type="button"
            disabled={quantity >= maxQty}
            onClick={() => onQuantityChange(quantity + 1)}
            style={{ width:24, height:24, borderRadius:6, border:'1px solid var(--border-color)', background: quantity >= maxQty ? '#f8fafc' : '#fff', cursor: quantity >= maxQty ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color: quantity >= maxQty ? '#cbd5e1' : 'var(--text-secondary)', flexShrink:0 }}>
            +
          </button>
          <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>/ {maxQty}</span>
        </div>
      )}

      {/* 14-day availability strip */}
      <div style={{ marginTop:10 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.04em', textTransform:'uppercase' }}>
            Next 14 days
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{
              fontSize:10, fontWeight:800,
              color: maxQty === 0 ? '#ef4444' : maxQty < (r.totalQuantity ?? 1) ? '#f59e0b' : '#10b981',
            }}>
              {maxQty}
            </span>
            <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>
              / {r.totalQuantity ?? 1} available
            </span>
          </div>
        </div>
        <div style={{ display:'flex', gap:2, alignItems:'flex-end' }}>
          {stripDays.map((day, i) => {
            const avail = getDayAvailableCount(r, day, bookings);
            const total = r.totalQuantity ?? r.ids?.length ?? 1;
            const status = avail >= total ? 'free' : avail === 0 ? 'full' : 'partial';
            const color = status === 'free' ? '#10b981' : status === 'partial' ? '#f59e0b' : '#ef4444';
            const isToday = i === 0;
            return (
              <div key={i}
                title={`${day.toLocaleDateString(undefined,{month:'short',day:'numeric'})}: ${avail}/${total} available`}
                style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <span style={{ fontSize:8, fontWeight:800, color, lineHeight:1, opacity: avail === total ? 0.6 : 1 }}>
                  {avail}
                </span>
                <div style={{ width:'100%', height:5, borderRadius:3, background:color, opacity: 0.7 + (status === 'free' ? 0.3 : 0), outline: isToday ? '2px solid #94a3b8' : 'none', outlineOffset:1 }} />
              </div>
            );
          })}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--text-muted)', marginTop:3, fontWeight:600 }}>
          <span>Today</span><span>+14d</span>
        </div>
      </div>
    </div>
  );
};

// ─── TimeDropdown ─────────────────────────────────────────────────────────────
const TimeDropdown: React.FC<{
  value: number;
  onChange: (m: number) => void;
  accentColor: string;
  accentBg: string;
}> = ({ value, onChange, accentColor, accentBg }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'center' });
  }, [open]);

  const isSession = SESSION_MINS.includes(value);
  const label = isSession ? 'Other…' : fmtMins(value);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '6px 12px', borderRadius: 8, border: '1.5px solid',
          borderColor: !isSession ? accentColor : 'var(--border-color)',
          background: !isSession ? accentBg : '#f8fafc',
          color: !isSession ? accentColor : 'var(--text-secondary)',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 0.12s',
        }}
      >
        {label}
      </button>
      {open && (
        <div
          ref={listRef}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999,
            background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12,
            boxShadow: '0 8px 24px -4px rgba(0,0,0,0.14)',
            maxHeight: 220, overflowY: 'auto', minWidth: 110,
            padding: '6px 4px',
          }}
        >
          {TIME_OPTIONS.filter(t => !SESSION_MINS.includes(t.value)).map(t => {
            const selected = t.value === value;
            return (
              <div
                key={t.value}
                data-selected={selected}
                onClick={() => { onChange(t.value); setOpen(false); }}
                style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: selected ? 800 : 600,
                  color: selected ? accentColor : 'var(--text-primary)',
                  background: selected ? accentBg : 'transparent',
                  cursor: 'pointer', transition: 'background 0.1s',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}
                onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
                onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span>{t.label}</span>
                {selected && <span style={{ fontSize: 10, color: accentColor }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Step 2: Schedule Picker ──────────────────────────────────────────────────
interface SchedulePickerProps {
  resources: Resource[];
  bookings: Booking[];
  selectedIds: string[];
  quantities: Record<string, number>;
  onQuantityChange: (id: string, qty: number) => void;
  startDate: Date | null;
  setStartDate: (d: Date | null) => void;
  startMinutes: number;
  setStartMinutes: (m: number) => void;
  returnMinutes: number;
  setReturnMinutes: (m: number) => void;
  selectedPreset: string;
  setSelectedPreset: (p: string) => void;
  customHours: string;
  setCustomHours: (h: string) => void;
}

const SchedulePicker: React.FC<SchedulePickerProps> = ({
  resources, bookings, selectedIds, quantities, onQuantityChange,
  startDate, setStartDate, startMinutes, setStartMinutes,
  returnMinutes, setReturnMinutes,
  selectedPreset, setSelectedPreset, customHours, setCustomHours,
}) => {
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [showCustom, setShowCustom] = useState(false);

  const minsToTimeStr = (m: number) =>
    `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  const timeStrToMins = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return (h||0)*60 + (m||0);
  };

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const calDays = useMemo(() => {
    const first = new Date(calYear, calMonth, 1);
    const startDay = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calYear, calMonth, d));
    return cells;
  }, [calMonth, calYear]);

  const durationDays = useMemo(() => {
    if (selectedPreset === 'custom') return parseInt(customHours) || 0;
    return (DURATION_PRESETS.find(p => p.label === selectedPreset)?.days ?? 0);
  }, [selectedPreset, customHours]);

  const endDate = useMemo(() => {
    if (!startDate || durationDays <= 0) return null;
    const e = new Date(startDate);
    e.setDate(e.getDate() + durationDays);
    e.setHours(Math.floor(returnMinutes/60), returnMinutes%60, 0, 0);
    return e;
  }, [startDate, durationDays, returnMinutes]);

  const selectedResources = useMemo(
    () => resources.filter(r => selectedIds.includes(r.id)),
    [resources, selectedIds],
  );

  function getDayWorstStatus(day: Date): DayStatus {
    if (!selectedResources.length) return 'free';
    const statuses = selectedResources.map(r => getDayStatus(r, day, bookings));
    if (statuses.every(s => s === 'free')) return 'free';
    if (statuses.some(s => s === 'full')) return 'full';
    return 'partial';
  }

  const conflictResources = useMemo(() => {
    if (!startDate || !endDate) return [];
    const s = new Date(startDate);
    s.setHours(Math.floor(startMinutes/60), startMinutes%60, 0, 0);
    return selectedResources.filter(r => hasConflict(r, s, endDate, bookings));
  }, [startDate, endDate, startMinutes, selectedResources, bookings]);

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); };

  const startSummary = startDate ? new Date(startDate) : null;
  if (startSummary) startSummary.setHours(Math.floor(startMinutes/60), startMinutes%60, 0, 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
    <div style={{ display:'flex', gap:24, alignItems:'flex-start' }}>
      {/* ── Left: Calendar ── */}
      <div style={{ flexShrink:0, width:280 }}>
        <div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
          Pickup Date
        </div>
        <div style={{ background:'#fff', border:'1px solid var(--border-color)', borderRadius:14, padding:'16px 14px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <button type="button" onClick={prevMonth} style={{ width:28, height:28, borderRadius:8, border:'1px solid var(--border-color)', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)' }}>{MONTHS[calMonth]} {calYear}</span>
            <button type="button" onClick={nextMonth} style={{ width:28, height:28, borderRadius:8, border:'1px solid var(--border-color)', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <ChevronRight size={14} />
            </button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, textAlign:'center', marginBottom:6 }}>
            {DAYS_SHORT.map(d => <span key={d} style={{ fontSize:10, fontWeight:800, color:'var(--text-muted)' }}>{d}</span>)}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, justifyItems:'center' }}>
            {calDays.map((day, i) => {
              if (!day) return <div key={`e${i}`} style={{ width:34, height:34 }} />;
              const isPast = day < today;
              const dayMid = new Date(day.getFullYear(), day.getMonth(), day.getDate());
              const startMid = startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()) : null;
              const endMid = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) : null;
              const isStart = startMid ? dayMid.getTime() === startMid.getTime() : false;
              const isEnd = endMid ? dayMid.getTime() === endMid.getTime() : false;
              const isInRange = !!(startMid && endMid && dayMid > startMid && dayMid < endMid);
              const status = getDayWorstStatus(day);
              const dotColor = status === 'full' ? '#ef4444' : status === 'partial' ? '#f59e0b' : '#10b981';
              const bg = isStart ? 'var(--accent-color)' : isEnd ? '#0ea5e9' : isInRange ? 'rgba(232,114,12,0.12)' : 'transparent';
              const col = (isStart || isEnd) ? '#fff' : isPast ? '#cbd5e1' : 'var(--text-primary)';
              return (
                <div key={i}
                  onClick={() => !isPast && setStartDate(new Date(day))}
                  style={{
                    width:34, height:34, borderRadius:9,
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1,
                    cursor: isPast ? 'not-allowed' : 'pointer',
                    background: bg,
                    color: col,
                    fontSize:12, fontWeight: (isStart || isEnd) ? 800 : 600,
                    transition:'background 0.12s',
                    outline: isEnd ? '2px solid #0ea5e9' : 'none',
                    outlineOffset: -2,
                  }}
                  onMouseEnter={e => { if (!isPast && !isStart && !isEnd) (e.currentTarget as HTMLDivElement).style.background = isInRange ? 'rgba(232,114,12,0.22)' : '#f1f5f9'; }}
                  onMouseLeave={e => { if (!isStart && !isEnd) (e.currentTarget as HTMLDivElement).style.background = isInRange ? 'rgba(232,114,12,0.12)' : 'transparent'; }}
                >
                  {day.getDate()}
                  {!isPast && selectedIds.length > 0 && (
                    <div style={{ width:4, height:4, borderRadius:99, background: (isStart || isEnd) ? 'rgba(255,255,255,0.7)' : dotColor }} />
                  )}
                </div>
              );
            })}
          </div>
          {selectedIds.length > 0 && (
            <div style={{ marginTop:12, display:'flex', gap:10, justifyContent:'center', fontSize:10, fontWeight:700, color:'var(--text-muted)' }}>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:6,height:6,borderRadius:99,background:'#10b981',display:'inline-block' }}/>Free</span>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:6,height:6,borderRadius:99,background:'#f59e0b',display:'inline-block' }}/>Partial</span>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:6,height:6,borderRadius:99,background:'#ef4444',display:'inline-block' }}/>Full</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Time & Duration ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:20 }}>
        {/* Pickup Time */}
        <div>
          <div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
            Pickup Time
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
            {SESSION_TIMES.map(s => (
              <button key={s.mins} type="button" onClick={() => { setStartMinutes(s.mins); }}
                style={{
                  padding:'6px 14px', borderRadius:8, border:'1px solid',
                  borderColor: startMinutes === s.mins ? 'var(--accent-color)' : 'var(--border-color)',
                  background: startMinutes === s.mins ? 'var(--accent-color)' : '#fff',
                  color: startMinutes === s.mins ? '#fff' : 'var(--text-secondary)',
                  fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.12s', fontFamily:'inherit',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:1,
                }}>
                <span>{s.label}</span>
                <span style={{ fontSize:10, opacity:0.75 }}>{fmtMins(s.mins)}</span>
              </button>
            ))}
            <TimeDropdown
              value={startMinutes}
              onChange={setStartMinutes}
              accentColor="var(--accent-color)"
              accentBg="rgba(232,114,12,0.07)"
            />
          </div>
        </div>

        {/* Return Time */}
        <div>
          <div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
            Return Time
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
            {SESSION_TIMES.map(s => (
              <button key={s.mins} type="button" onClick={() => { setReturnMinutes(s.mins); }}
                style={{
                  padding:'6px 14px', borderRadius:8, border:'1px solid',
                  borderColor: returnMinutes === s.mins ? '#0ea5e9' : 'var(--border-color)',
                  background: returnMinutes === s.mins ? '#0ea5e9' : '#fff',
                  color: returnMinutes === s.mins ? '#fff' : 'var(--text-secondary)',
                  fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.12s', fontFamily:'inherit',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:1,
                }}>
                <span>{s.label}</span>
                <span style={{ fontSize:10, opacity:0.75 }}>{fmtMins(s.mins)}</span>
              </button>
            ))}
            <TimeDropdown
              value={returnMinutes}
              onChange={setReturnMinutes}
              accentColor="#0ea5e9"
              accentBg="rgba(14,165,233,0.07)"
            />
          </div>
        </div>

        {/* Duration */}
        <div>
          <div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
            Rental Duration
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            {DURATION_PRESETS.map(p => (
              <button key={p.label} type="button"
                onClick={() => { setSelectedPreset(p.label); setShowCustom(false); }}
                style={{
                  padding:'6px 14px', borderRadius:8, border:'1px solid',
                  borderColor: selectedPreset === p.label ? 'var(--accent-color)' : 'var(--border-color)',
                  background: selectedPreset === p.label ? 'var(--accent-color)' : '#fff',
                  color: selectedPreset === p.label ? '#fff' : 'var(--text-secondary)',
                  fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.12s', fontFamily:'inherit',
                }}>
                {p.label}
              </button>
            ))}
            <button type="button"
              onClick={() => { setSelectedPreset('custom'); setShowCustom(true); }}
              style={{
                padding:'6px 14px', borderRadius:8, border:'1px solid',
                borderColor: selectedPreset === 'custom' ? 'var(--accent-color)' : 'var(--border-color)',
                background: selectedPreset === 'custom' ? 'rgba(232,114,12,0.06)' : '#fff',
                color: selectedPreset === 'custom' ? 'var(--accent-color)' : 'var(--text-secondary)',
                fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.12s', fontFamily:'inherit',
              }}>
              Custom…
            </button>
          </div>
          {showCustom && (
            <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:6 }}>
              <button type="button"
                onClick={() => setCustomHours(String(Math.max(1, (parseInt(customHours)||1) - 1)))}
                style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border-color)', background:'#fff', fontSize:16, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-secondary)', flexShrink:0 }}>
                −
              </button>
              <input type="number" min="1" max="14" step="1"
                value={customHours === '' ? '' : Math.min(14, Math.max(1, parseInt(customHours)||1))}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  if (e.target.value === '') setCustomHours('');
                  else setCustomHours(String(Math.min(14, Math.max(1, isNaN(v) ? 1 : v))));
                }}
                style={{ width:52, padding:'5px 0', borderRadius:8, border:'1.5px solid var(--accent-color)', fontSize:15, fontWeight:800, outline:'none', textAlign:'center', color:'var(--accent-color)', fontFamily:'inherit', background:'rgba(232,114,12,0.04)' }}
              />
              <button type="button"
                onClick={() => setCustomHours(String(Math.min(14, (parseInt(customHours)||0) + 1)))}
                style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border-color)', background:'#fff', fontSize:16, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-secondary)', flexShrink:0 }}>
                +
              </button>
              <span style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:600 }}>days <span style={{ color:'#94a3b8', fontSize:11 }}>(1 – 14)</span></span>
            </div>
          )}
        </div>

        {/* Summary card */}
        {startSummary && endDate && (
          <div style={{ background:'#fff', border:'1px solid var(--border-color)', borderRadius:12, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                Booking Window
              </div>
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', background:'rgba(232,114,12,0.08)', borderRadius:99, border:'1px solid rgba(232,114,12,0.2)', fontSize:10, fontWeight:800, color:'var(--accent-color)', whiteSpace:'nowrap' }}>
                <Clock size={10} /> {formatDuration(startSummary, endDate)}
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'stretch', gap:0 }}>
              <div style={{ flex:1, background:'var(--background-color)', borderRadius:'10px 0 0 10px', padding:'8px 12px' }}>
                <div style={{ fontSize:9, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Pickup</div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)' }}>
                  {startSummary.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' })}
                </div>
                <div style={{ fontSize:16, fontWeight:900, color:'var(--accent-color)', lineHeight:1.3 }}>
                  {fmtMins(startMinutes)}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, background:'var(--background-color)', color:'var(--text-muted)', fontSize:12 }}>
                →
              </div>
              <div style={{ flex:1, background:'var(--background-color)', borderRadius:'0 10px 10px 0', padding:'8px 12px', borderLeft:'1px solid var(--border-color)' }}>
                <div style={{ fontSize:9, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Return</div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)' }}>
                  {endDate.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' })}
                </div>
                <div style={{ fontSize:16, fontWeight:900, color:'var(--accent-color)', lineHeight:1.3 }}>
                  {String(endDate.getHours()).padStart(2,'0')}:{String(endDate.getMinutes()).padStart(2,'0')}
                </div>
              </div>
            </div>
            {conflictResources.length > 0 && (
              <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10 }}>
                <AlertTriangle size={15} color="#dc2626" style={{ marginTop:1, flexShrink:0 }} />
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:'#dc2626' }}>Conflict detected</div>
                  <div style={{ fontSize:11, color:'#ef4444', marginTop:2 }}>
                    {conflictResources.map(r => r.name).join(', ')} already booked in this window
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
      {/* Weekly availability grid - full width */}
      {selectedIds.length > 0 && startDate && (
        <WeeklyAvailability resources={selectedResources} focusDate={startDate} bookings={bookings} endDate={endDate} quantities={quantities} onQuantityChange={onQuantityChange} />
      )}
    </div>
  );
};

const WeeklyAvailability: React.FC<{ resources: Resource[]; focusDate: Date; bookings: Booking[]; endDate: Date | null; quantities: Record<string, number>; onQuantityChange?: (id: string, qty: number) => void }> = ({
  resources, focusDate, bookings, endDate, quantities, onQuantityChange,
}) => {
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const d = new Date(focusDate);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weekOffset * 7);
    d.setHours(0,0,0,0);
    return d;
  }, [focusDate, weekOffset]);

  const weekEnd = useMemo(() => { const d = new Date(weekStart); d.setDate(d.getDate() + 6); return d; }, [weekStart]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }),
    [weekStart],
  );

  const startMid = new Date(focusDate.getFullYear(), focusDate.getMonth(), focusDate.getDate());
  const endMid = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) : null;

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          <div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
            Resource Availability
          </div>
          <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:500 }}>
            Each cell shows <strong>available / total</strong> units · Orange = pickup · Blue = return
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button type="button" onClick={() => setWeekOffset(o => o - 1)}
            style={{ width:22, height:22, borderRadius:6, border:'1px solid var(--border-color)', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <ChevronLeft size={11} />
          </button>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--text-primary)', minWidth:100, textAlign:'center' }}>
            {weekStart.toLocaleDateString(undefined, { month:'short', day:'numeric' })} – {weekEnd.toLocaleDateString(undefined, { month:'short', day:'numeric' })}
          </span>
          <button type="button" onClick={() => setWeekOffset(o => o + 1)}
            style={{ width:22, height:22, borderRadius:6, border:'1px solid var(--border-color)', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <ChevronRight size={11} />
          </button>
          <button type="button" onClick={() => setWeekOffset(0)}
            style={{ fontSize:10, fontWeight:700, color: weekOffset !== 0 ? 'var(--accent-color)' : 'var(--text-muted)', background:'none', border:'1px solid var(--border-color)', borderRadius:6, cursor:'pointer', padding:'3px 8px', opacity: weekOffset !== 0 ? 1 : 0.5 }}>
            Today
          </button>
        </div>
      </div>
      <div style={{ background:'#fff', border:'1px solid var(--border-color)', borderRadius:14, overflow:'hidden' }}>
        {/* Header row */}
        <div style={{ display:'grid', gridTemplateColumns:'160px repeat(7, 1fr)', borderBottom:'2px solid var(--border-color)', background:'var(--background-color)', padding:'8px 12px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', alignSelf:'center' }}>Resource</div>
          {weekDays.map((d, i) => {
            const isToday = d.toDateString() === new Date().toDateString();
            const dMid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const colIsStart = dMid.getTime() === startMid.getTime();
            const colIsEnd = endMid ? dMid.getTime() === endMid.getTime() : false;
            const colInRange = endMid ? (dMid > startMid && dMid < endMid) : false;
            const highlight = colIsStart || colIsEnd || colInRange;
            return (
              <div key={i} style={{
                textAlign:'center', fontSize:10, fontWeight: highlight || isToday ? 800 : 600,
                color: colIsEnd ? '#0ea5e9' : colIsStart ? 'var(--accent-color)' : isToday && !colInRange ? 'var(--text-primary)' : colInRange ? 'var(--accent-color)' : 'var(--text-muted)',
                background: colIsStart ? 'rgba(232,114,12,0.12)' : colIsEnd ? 'rgba(14,165,233,0.12)' : colInRange ? 'rgba(232,114,12,0.06)' : 'transparent',
                borderRadius:6, padding:'3px 0', position:'relative',
              }}>
                <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.04em' }}>{DAYS_SHORT[i]}</div>
                <div style={{ fontSize:13, marginTop:1 }}>{d.getDate()}</div>
                {colIsStart && <div style={{ fontSize:8, fontWeight:700, color:'var(--accent-color)', marginTop:1 }}>Pickup</div>}
                {colIsEnd && <div style={{ fontSize:8, fontWeight:700, color:'#0ea5e9', marginTop:1 }}>Return</div>}
                {isToday && !colIsStart && !colIsEnd && <div style={{ width:4, height:4, borderRadius:99, background:'var(--text-primary)', margin:'2px auto 0' }} />}
              </div>
            );
          })}
        </div>

        {/* Resource rows */}
        {resources.map((r, rIdx) => {
          const meta = getRtMeta(r);
          const selectedQty = quantities[r.id] ?? 1;
          const rowTotal = r.totalQuantity ?? r.ids?.length ?? 1;
          return (
            <div key={r.id} style={{
              display:'grid', gridTemplateColumns:'160px repeat(7, 1fr)',
              padding:'10px 12px',
              borderBottom: rIdx < resources.length - 1 ? '1px solid var(--border-light)' : 'none',
              alignItems:'center',
              background: rIdx % 2 === 1 ? '#fafafa' : '#fff',
            }}>
              {/* Resource name + qty control */}
              <div style={{ fontSize:11, fontWeight:700, display:'flex', flexDirection:'column', gap:5, overflow:'hidden', paddingRight:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ color:meta.color, flexShrink:0 }}>{meta.icon}</span>
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text-primary)', fontSize:11, flex:1, minWidth:0 }}>{r.name}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <button type="button" onClick={() => onQuantityChange?.(r.id, Math.max(1, selectedQty - 1))}
                    style={{ width:18, height:18, borderRadius:5, border:'1px solid var(--border-color)', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'var(--text-muted)', padding:0, lineHeight:1, flexShrink:0 }}>
                    −
                  </button>
                  <span style={{ fontSize:11, fontWeight:800, color:'var(--accent-color)', minWidth:14, textAlign:'center' }}>{selectedQty}</span>
                  <button type="button" onClick={() => onQuantityChange?.(r.id, Math.min(rowTotal, selectedQty + 1))}
                    style={{ width:18, height:18, borderRadius:5, border:'1px solid var(--border-color)', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'var(--text-muted)', padding:0, lineHeight:1, flexShrink:0 }}>
                    +
                  </button>
                  <span style={{ fontSize:9, color:'var(--text-muted)', whiteSpace:'nowrap' }}>of {rowTotal}</span>
                </div>
              </div>

              {/* Day cells */}
              {weekDays.map((day, i) => {
                const avail = getDayAvailableCount(r, day, bookings);
                const total = rowTotal;
                const dayMid2 = new Date(day.getFullYear(), day.getMonth(), day.getDate());
                const isRangeStart = dayMid2.getTime() === startMid.getTime();
                const isRangeEnd = endMid ? dayMid2.getTime() === endMid.getTime() : false;
                const colInRange = endMid ? (dayMid2 > startMid && dayMid2 < endMid) : false;
                const isKeyDay = isRangeStart || isRangeEnd;
                const hasConflict = avail < selectedQty;
                const pct = total > 0 ? avail / total : 0;

                // Availability color (green/yellow/red based on stock)
                const availColor = pct >= 1 ? '#10b981' : pct > 0 ? '#f59e0b' : '#ef4444';

                // Key days use their own accent color; non-key days use availability color
                const numColor = isRangeStart ? 'var(--accent-color)' : isRangeEnd ? '#0ea5e9' : availColor;
                const bg = isRangeStart ? 'rgba(232,114,12,0.07)' : isRangeEnd ? 'rgba(14,165,233,0.07)' : colInRange ? 'rgba(232,114,12,0.04)' : pct >= 1 ? '#f0fdf4' : pct > 0 ? '#fffbeb' : '#fef2f2';
                const borderWidth = isKeyDay ? 2 : 1;
                const borderColor = isRangeStart ? 'var(--accent-color)' : isRangeEnd ? '#0ea5e9' : !isKeyDay && hasConflict ? '#fca5a5' : `${availColor}44`;

                return (
                  <div key={i} style={{ display:'flex', justifyContent:'center', padding:'0 2px' }}>
                    <div
                      title={`${day.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}: ${avail} of ${total} available${hasConflict ? ` — need ${selectedQty}` : ''}`}
                      style={{
                        width:'100%', maxWidth:44, borderRadius:8, padding:'6px 4px 5px',
                        background: bg,
                        border: `${borderWidth}px solid ${borderColor}`,
                        display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                        position: 'relative',
                        cursor:'default',
                      }}>
                      {/* Conflict badge on key days (small !) */}
                      {isKeyDay && hasConflict && (
                        <div style={{
                          position:'absolute', top:-5, right:-5,
                          width:14, height:14, borderRadius:99,
                          background:'#ef4444', border:'1.5px solid #fff',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:8, fontWeight:900, color:'#fff', lineHeight:1,
                        }}>!</div>
                      )}
                      {/* avail / total */}
                      <span style={{ fontSize:12, fontWeight:800, color: numColor, lineHeight:1 }}>{avail}</span>
                      <span style={{ fontSize:9, fontWeight:600, color:`${numColor}99`, lineHeight:1 }}>/ {total}</span>
                      {/* mini progress bar — availability color always */}
                      <div style={{ width:'80%', height:3, borderRadius:99, background:`${availColor}22`, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.round(pct*100)}%`, background: availColor, borderRadius:99 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Footer legend */}
        <div style={{ display:'flex', gap:14, padding:'7px 14px', background:'var(--background-color)', borderTop:'1px solid var(--border-light)', fontSize:10, fontWeight:600, color:'var(--text-muted)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8,height:8,borderRadius:3,background:'#10b981',display:'inline-block' }}/>All free</span>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8,height:8,borderRadius:3,background:'#f59e0b',display:'inline-block' }}/>Partial</span>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8,height:8,borderRadius:3,background:'#ef4444',display:'inline-block' }}/>Fully booked</span>
          <span style={{ display:'flex', alignItems:'center', gap:4, marginLeft:'auto', color:'var(--accent-color)', fontWeight:700 }}>
            <span style={{ width:8,height:8,borderRadius:2,background:'var(--accent-color)',display:'inline-block' }}/>Pickup day
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:4, color:'#0ea5e9', fontWeight:700 }}>
            <span style={{ width:8,height:8,borderRadius:2,background:'#0ea5e9',display:'inline-block' }}/>Return day
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Step 3: Details ──────────────────────────────────────────────────────────
interface SummaryData {
  resources: Resource[];
  startDate: Date | null;
  startMinutes: number;
  endDate: Date | null;
  hasConflict: boolean;
}

interface DetailsStepProps {
  title: string;
  setTitle: (v: string) => void;
  purpose: string;
  setPurpose: (v: string) => void;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  summary: SummaryData;
}

const DetailsStep: React.FC<DetailsStepProps> = ({
  title, setTitle, purpose, setPurpose, fieldErrors, setFieldErrors, summary,
}) => (
  <div style={{ display:'flex', gap:24, alignItems:'flex-start' }}>
    {/* Form */}
    <div style={{ flex:1, display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <label style={{ display:'block', fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
          Booking Name *
        </label>
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); setFieldErrors(p => ({...p, title: e.target.value.trim() ? '' : 'Required'})); }}
          maxLength={300}
          placeholder="e.g., CVPR training run, Lab session A"
          style={{
            width:'100%', padding:'10px 14px', borderRadius:10,
            border:`1px solid ${fieldErrors.title ? '#ef4444' : 'var(--border-color)'}`,
            fontSize:14, fontWeight:600, outline:'none', boxSizing:'border-box',
            fontFamily:'inherit', color:'var(--text-primary)',
          }}
        />
        {fieldErrors.title && <div style={{ fontSize:11, color:'#ef4444', marginTop:4 }}>{fieldErrors.title}</div>}
        <div style={{ textAlign:'right', fontSize:10, color:'var(--text-muted)', marginTop:3 }}>{title.length}/300</div>
      </div>
      <div>
        <label style={{ display:'block', fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
          Purpose & Impact
        </label>
        <textarea
          value={purpose}
          onChange={e => setPurpose(e.target.value)}
          maxLength={2000} rows={5}
          placeholder="Describe what you need this resource for, expected outcomes…"
          style={{
            width:'100%', padding:'10px 14px', borderRadius:10,
            border:'1px solid var(--border-color)',
            fontSize:13, fontWeight:500, outline:'none', resize:'vertical', lineHeight:1.6,
            boxSizing:'border-box', fontFamily:'inherit', color:'var(--text-primary)',
          }}
        />
        <div style={{ textAlign:'right', fontSize:10, color:'var(--text-muted)', marginTop:3 }}>{purpose.length}/2000</div>
      </div>
    </div>

    {/* Summary card */}
    <div style={{ width:260, flexShrink:0 }}>
      <div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
        Booking Summary
      </div>
      <div style={{ background:'var(--background-color)', borderRadius:14, border:'1px solid var(--border-color)', padding:'16px', display:'flex', flexDirection:'column', gap:12 }}>
        {/* Resources */}
        <div>
          <div style={{ fontSize:10, fontWeight:800, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase' }}>Resources</div>
          {summary.resources.length === 0
            ? <div style={{ fontSize:11, color:'#94a3b8' }}>None selected</div>
            : summary.resources.map(r => {
                const meta = getRtMeta(r);
                return (
                  <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                    <span style={{ width:22, height:22, borderRadius:6, background:meta.bg, display:'flex', alignItems:'center', justifyContent:'center', color:meta.color }}>
                      {meta.icon}
                    </span>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{r.name}</span>
                  </div>
                );
              })}
        </div>

        {/* Schedule */}
        {summary.startDate && summary.endDate && (
          <div style={{ borderTop:'1px solid var(--border-color)', paddingTop:12 }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase' }}>Schedule</div>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', marginBottom:2 }}>
              {summary.startDate.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' })} {fmtMins(summary.startMinutes)}
            </div>
            <div style={{ fontSize:11, color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
              ↓ {formatDuration(summary.startDate, summary.endDate)}
            </div>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>
              {summary.endDate.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' })} {String(summary.endDate.getHours()).padStart(2,'0')}:{String(summary.endDate.getMinutes()).padStart(2,'0')}
            </div>
          </div>
        )}

        {/* Conflict warning */}
        {summary.hasConflict && (
          <div style={{ display:'flex', gap:8, padding:'8px 10px', background:'#fef2f2', borderRadius:8, border:'1px solid #fecaca' }}>
            <AlertTriangle size={13} color="#dc2626" style={{ flexShrink:0, marginTop:1 }} />
            <span style={{ fontSize:11, fontWeight:700, color:'#dc2626' }}>Some resources have conflicts — manager may reject</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

// ─── Main Modal ───────────────────────────────────────────────────────────────
const NewBookingModal: React.FC<NewBookingModalProps> = ({ onClose, onSaved, preSelectedResourceId }) => {
  const [step, setStep] = useState(1);
  const [resources,    setResources]    = useState<Resource[]>([]);
  const [allBookings,  setAllBookings]  = useState<Booking[]>([]);
  const [dataLoading,  setDataLoading]  = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [submitError,  setSubmitError]  = useState('');

  const [selectedIds,     setSelectedIds]     = useState<string[]>(preSelectedResourceId ? [preSelectedResourceId] : []);
  const [quantities,      setQuantities]      = useState<Record<string, number>>(preSelectedResourceId ? { [preSelectedResourceId]: 1 } : {});
  const [startDate,       setStartDate]       = useState<Date | null>(null);
  const [startMinutes,    setStartMinutes]    = useState(480); // 08:00 morning
  const [returnMinutes,   setReturnMinutes]   = useState(1020); // 17:00 afternoon
  const [selectedPreset,  setSelectedPreset]  = useState('1 day');
  const [customHours,     setCustomHours]     = useState('');
  const [title,           setTitle]           = useState('');
  const [purpose,         setPurpose]         = useState('');
  const [fieldErrors,     setFieldErrors]     = useState<Record<string, string>>({});

  // Load data
  useEffect(() => {
    (async () => {
      setDataLoading(true);
      try {
        const [resItems, allBk] = await Promise.all([
          resourceService.getAllPages(),
          bookingService.getAllPages(),
        ]);
        setResources(resItems);
        setAllBookings(allBk);
      } catch (err) {
        console.error('NewBookingModal: failed to load data', err);
      } finally {
        setDataLoading(false);
      }
    })();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Derived
  const durationDays = useMemo(() => {
    if (selectedPreset === 'custom') return parseInt(customHours) || 0;
    return (DURATION_PRESETS.find(p => p.label === selectedPreset)?.days ?? 0);
  }, [selectedPreset, customHours]);

  const endDate = useMemo(() => {
    if (!startDate || durationDays <= 0) return null;
    const e = new Date(startDate);
    e.setDate(e.getDate() + durationDays);
    e.setHours(Math.floor(returnMinutes/60), returnMinutes%60, 0, 0);
    return e;
  }, [startDate, durationDays, returnMinutes]);

  const selectedResources = useMemo(
    () => resources.filter(r => selectedIds.includes(r.id)),
    [resources, selectedIds],
  );

  const hasAnyConflict = useMemo(() => {
    if (!startDate || !endDate) return false;
    const s = new Date(startDate);
    s.setHours(Math.floor(startMinutes/60), startMinutes%60, 0, 0);
    return selectedResources.some(r => hasConflict(r, s, endDate, allBookings));
  }, [startDate, endDate, startMinutes, selectedResources, allBookings]);

  const canNext1 = selectedIds.length > 0;
  const canNext2 = !!(startDate && selectedPreset && durationDays > 0);
  const canSubmit = canNext2 && title.trim().length > 0;

  const startForSummary = useMemo(() => {
    if (!startDate) return null;
    const s = new Date(startDate);
    s.setHours(Math.floor(startMinutes/60), startMinutes%60, 0, 0);
    return s;
  }, [startDate, startMinutes]);

  const toggleResource = useCallback((id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        setQuantities(q => { const n = { ...q }; delete n[id]; return n; });
        return prev.filter(x => x !== id);
      }
      setQuantities(q => ({ ...q, [id]: 1 }));
      return [...prev, id];
    });
  }, []);

  const setResourceQuantity = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setSelectedIds(prev => prev.filter(x => x !== id));
      setQuantities(q => { const n = { ...q }; delete n[id]; return n; });
    } else {
      setQuantities(q => ({ ...q, [id]: qty }));
    }
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit || !startForSummary || !endDate) {
      setFieldErrors({ title: !title.trim() ? 'Required' : '' });
      return;
    }
    setSaving(true);
    setSubmitError('');
    try {
      const request: CreateBookingRequest = {
        title:     title.trim(),
        purpose:   purpose.trim(),
        startTime: startForSummary.toISOString(),
        endTime:   endDate.toISOString(),
        items: selectedResources.map(r => {
          const qty  = quantities[r.id] ?? 1;
          const pool = r.availableIds?.length ? r.availableIds : (r.ids ?? [r.id]);
          const picked = pool.slice(0, qty);
          return { resourceIds: picked.length > 0 ? picked : [r.id] };
        }),
      };
      await bookingService.create(request);
      onSaved('Booking request submitted successfully.');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to create booking.';
      setSubmitError(msg);
    } finally {
      setSaving(false);
    }
  };

  const STEPS = [
    { n:1, label:'Resources', icon:<Package size={12}/> },
    { n:2, label:'Schedule',  icon:<Calendar size={12}/> },
    { n:3, label:'Details',   icon:<FileText size={12}/> },
  ];

  const summaryData: SummaryData = {
    resources: selectedResources,
    startDate: startForSummary,
    startMinutes,
    endDate,
    hasConflict: hasAnyConflict,
  };

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:5000, padding:'16px' }}
      onClick={onClose}
    >
      <div
        style={{ width:760, maxWidth:'95vw', maxHeight:'88vh', background:'#fff', borderRadius:18, boxShadow:'0 24px 60px -15px rgba(0,0,0,0.3)', display:'flex', flexDirection:'column', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border-light)', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'var(--accent-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Calendar size={17} color="var(--accent-color)" />
          </div>
          <div style={{ flex:1 }}>
            <h3 style={{ fontSize:14, fontWeight:900, color:'var(--text-primary)', margin:0 }}>New Booking</h3>
            <p style={{ fontSize:12, color:'var(--text-secondary)', margin:0 }}>
              {step === 1 ? 'Select one or more resources to book'
                : step === 2 ? 'Set your pickup date, duration, and return time'
                : 'Add a name and purpose for your booking'}
            </p>
          </div>

          {/* Step indicator */}
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            {STEPS.map((s, i) => {
              const canClick = s.n < step || (s.n === 2 && canNext1) || (s.n === 3 && canNext2);
              return (
                <React.Fragment key={s.n}>
                  <div
                    onClick={() => canClick && setStep(s.n)}
                    style={{
                      display:'flex', alignItems:'center', gap:6,
                      padding:'6px 12px', borderRadius:99,
                      background: step === s.n ? 'var(--accent-color)' : step > s.n ? '#dcfce7' : 'var(--background-color)',
                      color: step === s.n ? '#fff' : step > s.n ? '#059669' : 'var(--text-muted)',
                      fontSize:11, fontWeight:800,
                      cursor: canClick ? 'pointer' : 'default',
                      transition:'all 0.15s', userSelect:'none',
                    }}
                  >
                    {step > s.n ? <Check size={12} strokeWidth={3} /> : s.icon}
                    {s.label}
                  </div>
                  {i < 2 && (
                    <div style={{ width:20, height:1, background: step > s.n ? '#059669' : 'var(--border-color)' }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <button
            onClick={onClose}
            style={{ width:34, height:34, borderRadius:99, border:'1px solid var(--border-color)', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }} className="bk-scroll">
          {step === 1 && (
            <ResourcePicker
              resources={resources}
              bookings={allBookings}
              loading={dataLoading}
              selectedIds={selectedIds}
              quantities={quantities}
              onToggle={toggleResource}
              onQuantityChange={setResourceQuantity}
              startDate={startForSummary}
              endDate={endDate}
            />
          )}
          {step === 2 && (
            <SchedulePicker
              resources={resources}
              bookings={allBookings}
              selectedIds={selectedIds}
              quantities={quantities}
              onQuantityChange={(id, qty) => setQuantities(q => ({ ...q, [id]: qty }))}
              startDate={startDate} setStartDate={setStartDate}
              startMinutes={startMinutes} setStartMinutes={setStartMinutes}
              returnMinutes={returnMinutes} setReturnMinutes={setReturnMinutes}
              selectedPreset={selectedPreset} setSelectedPreset={setSelectedPreset}
              customHours={customHours} setCustomHours={setCustomHours}
            />
          )}
          {step === 3 && (
            <DetailsStep
              title={title} setTitle={setTitle}
              purpose={purpose} setPurpose={setPurpose}
              fieldErrors={fieldErrors} setFieldErrors={setFieldErrors}
              summary={summaryData}
            />
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border-light)', background:'var(--background-color)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {step > 1
              ? (
                <button type="button" onClick={() => setStep(s => s-1)}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, border:'1px solid var(--border-color)', background:'#fff', fontSize:13, fontWeight:700, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'inherit' }}>
                  <ChevronLeft size={14} /> Back
                </button>
              ) : (
                <button type="button" onClick={onClose}
                  style={{ padding:'8px 16px', borderRadius:10, border:'1px solid var(--border-color)', background:'#fff', fontSize:13, fontWeight:700, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'inherit' }}>
                  Cancel
                </button>
              )
            }
            {selectedIds.length > 0 && step === 1 && (
              <span style={{ fontSize:12, fontWeight:700, color:'var(--accent-color)' }}>
                {selectedIds.length} resource{selectedIds.length > 1 ? 's' : ''} selected
              </span>
            )}
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {submitError && (
              <span style={{ fontSize:11, fontWeight:700, color:'#ef4444', display:'flex', alignItems:'center', gap:5 }}>
                <AlertCircle size={13} color="#ef4444" /> {submitError}
              </span>
            )}
            {hasAnyConflict && step === 3 && !submitError && (
              <span style={{ fontSize:11, fontWeight:700, color:'#f59e0b', display:'flex', alignItems:'center', gap:5 }}>
                <AlertTriangle size={13} color="#f59e0b" /> Conflicts present — manager will review
              </span>
            )}

            {step < 3 ? (
              <button type="button"
                disabled={step === 1 ? !canNext1 : !canNext2}
                onClick={() => setStep(s => s+1)}
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'10px 24px', borderRadius:12, border:'none',
                  background: (step === 1 ? canNext1 : canNext2) ? 'var(--accent-color)' : '#cbd5e1',
                  color:'#fff', fontSize:13, fontWeight:800,
                  cursor: (step === 1 ? canNext1 : canNext2) ? 'pointer' : 'not-allowed',
                  boxShadow: (step === 1 ? canNext1 : canNext2) ? '0 4px 14px -3px rgba(232,114,12,0.4)' : 'none',
                  transition:'all 0.15s', fontFamily:'inherit',
                }}
              >
                {step === 1 ? 'Set Schedule' : 'Add Details'}
                <ChevronRight size={14} />
              </button>
            ) : (
              <button type="button"
                disabled={!canSubmit || saving}
                onClick={handleSubmit}
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'10px 28px', borderRadius:12, border:'none',
                  background: canSubmit && !saving ? 'var(--accent-color)' : '#cbd5e1',
                  color:'#fff', fontSize:13, fontWeight:800,
                  cursor: canSubmit && !saving ? 'pointer' : 'not-allowed',
                  boxShadow: canSubmit && !saving ? '0 4px 14px -3px rgba(232,114,12,0.4)' : 'none',
                  transition:'all 0.15s', fontFamily:'inherit',
                }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                {saving ? 'Submitting…' : 'Submit Booking'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewBookingModal;
