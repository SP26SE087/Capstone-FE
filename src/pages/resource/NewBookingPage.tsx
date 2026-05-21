// =============================================================================
// NewBookingPage — full-page booking flow
// 2-panel: left = compact resource list (search + filter), right = schedule + details + submit
// =============================================================================
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { Resource, Booking, BookingStatus, CreateBookingRequest } from '@/types/booking';
import { resourceService } from '@/services/resourceService';
import { bookingService } from '@/services/bookingService';
import { resourceTypeService, ResourceTypeItem, ResourceTypeCategory } from '@/services/resourceTypeService';
import { useToastStore } from '@/store/slices/toastSlice';
import {
  Search, Cpu, Box, Layers, MapPin, Check, X, ChevronLeft,
  Loader2, Calendar, Clock, FileText, Package, AlertTriangle,
  ChevronDown, ChevronUp, CheckCircle2, Server, Filter,
} from 'lucide-react';

// ─── Merge server unit groups (e.g. "Server A #1", "Server A #2" → one row) ─
function mergeServerGroups(resources: Resource[]): Resource[] {
  const byKey = new Map<string, Resource[]>();
  const rest: Resource[] = [];
  for (const r of resources) {
    const m = r.name.match(/^(.+?)\s+#(\d+)$/);
    if (m && (r.ids?.length ?? 1) <= 1) {
      const key = `${r.resourceTypeId ?? ''}::${m[1]}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(r);
    } else {
      rest.push(r);
    }
  }
  const result: Resource[] = [...rest];
  for (const units of byKey.values()) {
    units.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const first = units[0];
    if (units.length === 1) {
      result.push(first);
    } else {
      const allIds = units.flatMap(u => u.ids?.length ? u.ids : [u.id]);
      const availIds = units
        .filter(u => u.isAvailable !== false && !u.isInUse && !u.isDamaged)
        .flatMap(u => u.ids?.length ? u.ids : [u.id]);
      result.push({
        ...first,
        id: first.id,
        ids: allIds,
        name: first.name.replace(/\s+#\d+$/, ''),
        totalQuantity: units.length,
        availableQuantity: availIds.length,
        availableIds: availIds.length > 0 ? availIds : undefined,
        damagedQuantity: units.filter(u => u.isDamaged).length,
        inUseCount: units.filter(u => u.isInUse).length,
        isAvailable: availIds.length > 0,
        isInUse: availIds.length === 0,
      });
    }
  }
  return result;
}

// ─── Availability helpers ─────────────────────────────────────────────────────
function getAvailableCount(resource: Resource, start: Date, end: Date, bookings: Booking[]): number {
  if (!resource.ids?.length) return resource.totalQuantity ?? 1;
  const unitSet = new Set(resource.ids);
  const sT = start.getTime(), eT = end.getTime();
  const bookedIds = new Set<string>();
  for (const b of bookings) {
    // Only Approved and InUse bookings actually lock the resource slot.
    // Pending = request chưa được duyệt → không khóa slot.
    if (![BookingStatus.Approved, BookingStatus.InUse].includes(b.status)) continue;
    const bs = new Date(b.startTime).getTime(), be = new Date(b.endTime).getTime();
    if (be <= sT || bs >= eT) continue;
    const rIds = b.resourceIds ?? (b.resourceId ? [b.resourceId] : []);
    for (const id of rIds) if (unitSet.has(id)) bookedIds.add(id);
  }
  return Math.max(0, resource.ids.length - bookedIds.size);
}

// ─── Format helpers ───────────────────────────────────────────────────────────
function fmtMins(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function formatDuration(s: Date, e: Date) {
  const diff = e.getTime() - s.getTime();
  const totalMins = Math.round(diff / 60000);
  if (totalMins <= 0) return '—';
  const days = Math.floor(totalMins / 1440);
  const hrs  = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hrs)  parts.push(`${hrs}h`);
  if (mins) parts.push(`${mins}m`);
  return parts.join(' ');
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_S  = ['Mo','Tu','We','Th','Fr','Sa','Su'];
const DURATION_PRESETS = [
  { label: '1 day',   days: 1 },
  { label: '3 days',  days: 3 },
  { label: '1 week',  days: 7 },
  { label: '2 weeks', days: 14 },
];
const SESSION_TIMES = [
  { label: 'Morning',   mins: 480  },
  { label: 'Afternoon', mins: 1020 },
];

function isServerResource(r: Resource) {
  const n = (r.resourceTypeName ?? '').toLowerCase();
  return n.includes('server') || n.includes('compute') || n.includes('gpu');
}

// ─── Resource row ─────────────────────────────────────────────────────────────
interface ResourceRowProps {
  resource: Resource;
  selected: boolean;
  qty: number;
  maxQty: number;
  onToggle: () => void;
  onQtyChange: (q: number) => void;
  currentUserId?: string;
}
const ResourceRow: React.FC<ResourceRowProps> = ({ resource: r, selected, qty, maxQty, onToggle, onQtyChange, currentUserId }) => {
  const { user } = useAuth();
  const server    = isServerResource(r);
  const iconColor = server ? '#7C3AED' : '#0284C7';
  const iconBg    = server ? '#F5F3FF' : '#F0F9FF';
  const avail     = maxQty;
  const total     = r.totalQuantity ?? 1;
  const isManaged = (!!currentUserId && !!r.managedBy && r.managedBy === currentUserId) ||
                    (!!user?.email && !!r.managerEmail && r.managerEmail === user.email);
  const unavailable = (avail === 0 && !selected) || isManaged;

  return (
    <div style={{ marginBottom: isManaged ? 2 : 0 }}>
    <div
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onClick={() => { if (!isManaged) onToggle(); }}
      onKeyDown={e => { if (!isManaged && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); onToggle(); } }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: isManaged ? '10px 10px 0 0' : 10,
        border: isManaged ? '1.5px solid #fde68a' : '1.5px solid transparent',
        borderBottom: isManaged ? 'none' : undefined,
        background: isManaged ? '#fffbeb' : 'transparent',
        cursor: unavailable ? 'not-allowed' : 'pointer',
        opacity: isManaged ? 0.75 : unavailable ? 0.45 : 1,
        transition: 'background 0.1s, border-color 0.1s',
        userSelect: 'none',
      }}
      onMouseEnter={e => { if (!unavailable) (e.currentTarget as HTMLElement).style.background = 'var(--background-color)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isManaged ? '#fffbeb' : 'transparent'; }}
    >
      {/* Checkbox */}
      <div style={{
        width: 17, height: 17, borderRadius: 5, flexShrink: 0,
        border: isManaged ? '2px solid #fbbf24' : selected ? '2px solid var(--accent-color)' : '2px solid #cbd5e1',
        background: isManaged ? '#fef3c7' : selected ? 'var(--accent-color)' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s',
      }}>
        {selected && !isManaged && <Check size={10} color="#fff" strokeWidth={3} />}
      </div>

      {/* Icon */}
      <div style={{ width: 28, height: 28, borderRadius: 7, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {server ? <Cpu size={13} /> : <Box size={13} />}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {r.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
          {r.resourceTypeName && (
            <span style={{ fontSize: 10, fontWeight: 700, color: iconColor, background: iconBg, padding: '0px 5px', borderRadius: 99, lineHeight: '16px' }}>
              {r.resourceTypeName}
            </span>
          )}
          {r.location && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <MapPin size={9} />{r.location}
            </span>
          )}
        </div>
      </div>

      {/* Availability badge */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 44 }}>
        <span style={{
          fontSize: 11, fontWeight: 800,
          color: isManaged ? '#d97706' : avail === 0 ? '#ef4444' : avail < total ? '#f59e0b' : '#10b981',
        }}>
          {avail}/{total}
        </span>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>free</div>
      </div>

      {/* Qty stepper (only when selected and group has >1 unit) */}
      {selected && total > 1 && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, marginLeft: 4 }}
        >
          <button
            onClick={() => onQtyChange(qty - 1)}
            style={{ width: 20, height: 20, borderRadius: 5, border: '1px solid var(--border-color)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'var(--text-secondary)', lineHeight: 1, padding: 0 }}>
            −
          </button>
          <span style={{ minWidth: 20, textAlign: 'center', fontSize: 12, fontWeight: 800, color: 'var(--accent-color)' }}>{qty}</span>
          <button
            disabled={qty >= maxQty}
            onClick={() => onQtyChange(qty + 1)}
            style={{ width: 20, height: 20, borderRadius: 5, border: '1px solid var(--border-color)', background: qty >= maxQty ? '#f8fafc' : '#fff', cursor: qty >= maxQty ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: qty >= maxQty ? '#cbd5e1' : 'var(--text-secondary)', lineHeight: 1, padding: 0 }}>
            +
          </button>
        </div>
      )}
    </div>
    {isManaged && (
      <div style={{
        padding: '5px 12px 7px',
        background: '#fffbeb',
        border: '1.5px solid #fde68a',
        borderTop: 'none',
        borderRadius: '0 0 10px 10px',
        fontSize: 11,
        fontWeight: 600,
        color: '#92400e',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
      }}>
        <AlertTriangle size={11} style={{ flexShrink: 0, color: '#d97706' }} />
        You manage this resource and cannot book it yourself.
      </div>
    )}
    </div>
  );
};

// ─── Compact inline calendar ──────────────────────────────────────────────────
interface MiniCalendarProps {
  selected: Date | null;
  onSelect: (d: Date) => void;
  bookings: Booking[];
  selectedResources: Resource[];
  quantities: Record<string, number>;
  endDate: Date | null;
}
const MiniCalendar: React.FC<MiniCalendarProps> = ({ selected, onSelect, bookings, selectedResources, quantities, endDate }) => {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [month, setMonth] = useState(selected?.getMonth() ?? today.getMonth());
  const [year,  setYear]  = useState(selected?.getFullYear() ?? today.getFullYear());

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startDay = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    return arr;
  }, [month, year]);

  const endMid = endDate ? (() => { const d = new Date(endDate); d.setHours(12,0,0,0); return d; })() : null;
  const startMid = selected ? (() => { const d = new Date(selected); d.setHours(12,0,0,0); return d; })() : null;

  const getAvailPct = (day: Date) => {
    if (!selectedResources.length) return 1;
    const dayStart = new Date(day); dayStart.setHours(0,0,0,0);
    const dayEnd   = new Date(day); dayEnd.setHours(23,59,59,999);
    let allFree = true, anyFree = false;
    for (const r of selectedResources) {
      const avail = getAvailableCount(r, dayStart, dayEnd, bookings);
      const need = quantities[r.id] ?? 1;
      if (avail >= need) anyFree = true;
      else allFree = false;
    }
    if (allFree) return 1;
    if (anyFree) return 0.5;
    return 0;
  };

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={() => { const d = new Date(year, month - 1, 1); setMonth(d.getMonth()); setYear(d.getFullYear()); }}
          style={{ padding: '4px 10px', border: '1px solid var(--border-color)', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)', fontWeight: 700 }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{MONTHS[month]} {year}</span>
        <button type="button" onClick={() => { const d = new Date(year, month + 1, 1); setMonth(d.getMonth()); setYear(d.getFullYear()); }}
          style={{ padding: '4px 10px', border: '1px solid var(--border-color)', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)', fontWeight: 700 }}>›</button>
      </div>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
        {DAYS_S.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', padding: '3px 0' }}>{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const isPast = day < today;
          const isSel  = selected ? day.toDateString() === selected.toDateString() : false;
          const isEnd  = endDate  ? day.toDateString() === endDate.toDateString()  : false;
          const inRange = startMid && endMid ? (new Date(day).setHours(12,0,0,0)) > startMid.getTime() && (new Date(day).setHours(12,0,0,0)) < endMid.getTime() : false;
          const pct = !isPast ? getAvailPct(day) : -1;
          const dotColor = pct === 1 ? '#10b981' : pct === 0.5 ? '#f59e0b' : pct === 0 ? '#ef4444' : undefined;

          return (
            <div key={i}
              onClick={() => !isPast && onSelect(day)}
              style={{
                aspectRatio: '1', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: isPast ? 'not-allowed' : 'pointer',
                background: isSel ? 'var(--accent-color)' : isEnd ? '#0ea5e9' : inRange ? 'rgba(232,114,12,0.08)' : 'transparent',
                border: isSel ? '2px solid var(--accent-color)' : isEnd ? '2px solid #0ea5e9' : '2px solid transparent',
                opacity: isPast ? 0.35 : 1,
                transition: 'all 0.1s',
                minHeight: 32,
              }}
              onMouseEnter={e => { if (!isPast && !isSel && !isEnd) (e.currentTarget as HTMLElement).style.background = 'var(--background-color)'; }}
              onMouseLeave={e => { if (!isSel && !isEnd && !inRange) (e.currentTarget as HTMLElement).style.background = 'transparent'; else if (inRange) (e.currentTarget as HTMLElement).style.background = 'rgba(232,114,12,0.08)'; }}
            >
              <span style={{ fontSize: 12, fontWeight: isSel || isEnd ? 900 : 600, color: isSel || isEnd ? '#fff' : 'var(--text-primary)', lineHeight: 1 }}>
                {day.getDate()}
              </span>
              {dotColor && !isSel && !isEnd && (
                <div style={{ width: 4, height: 4, borderRadius: 99, background: dotColor, marginTop: 2 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Time picker row ──────────────────────────────────────────────────────────
const TimePicker: React.FC<{ label: string; value: number; onChange: (m: number) => void; accentColor: string; }> = ({ label, value, onChange, accentColor }) => {
  const h = Math.floor(value / 60);
  const m = value % 60;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', minWidth: 68 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number" min={0} max={23} value={h}
          onChange={e => onChange(Math.max(0, Math.min(23, Number(e.target.value))) * 60 + m)}
          style={{ width: 42, padding: '4px 6px', borderRadius: 7, border: `1.5px solid ${accentColor}`, fontSize: 13, fontWeight: 800, textAlign: 'center', outline: 'none', color: accentColor, fontFamily: 'inherit' }}
        />
        <span style={{ fontWeight: 800, color: 'var(--text-muted)' }}>:</span>
        <input
          type="number" min={0} max={59} step={5} value={m}
          onChange={e => onChange(h * 60 + Math.max(0, Math.min(59, Number(e.target.value))))}
          style={{ width: 42, padding: '4px 6px', borderRadius: 7, border: `1.5px solid ${accentColor}`, fontSize: 13, fontWeight: 800, textAlign: 'center', outline: 'none', color: accentColor, fontFamily: 'inherit' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {SESSION_TIMES.map(s => (
          <button key={s.mins} type="button" onClick={() => onChange(s.mins)}
            style={{
              padding: '3px 8px', borderRadius: 6, border: `1px solid ${value === s.mins ? accentColor : 'var(--border-color)'}`,
              background: value === s.mins ? accentColor : '#fff',
              color: value === s.mins ? '#fff' : 'var(--text-secondary)',
              fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const NewBookingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedId = searchParams.get('resourceId') ?? undefined;
  const { addToast } = useToastStore();
  const { user } = useAuth();
  const currentUserId = user?.userId;

  // ── Data ──
  const [resources,   setResources]   = useState<Resource[]>([]);
  const [bookings,    setBookings]    = useState<Booking[]>([]);
  const [resTypes,    setResTypes]    = useState<ResourceTypeItem[]>([]);
  const [loading,     setLoading]     = useState(true);

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quantities,  setQuantities]  = useState<Record<string, number>>({});

  // ── Filter ──
  const [search,        setSearch]        = useState('');
  const [catFilter,     setCatFilter]     = useState<'all' | 'physical' | 'server'>('all');
  const [typeFilter,    setTypeFilter]    = useState('');
  const [availOnly,     setAvailOnly]     = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Schedule ──
  const [startDate,       setStartDate]       = useState<Date | null>(null);
  const [startMinutes,    setStartMinutes]    = useState(480);
  const [returnMinutes,   setReturnMinutes]   = useState(1020);
  const [selectedPreset,  setSelectedPreset]  = useState('1 day');
  const [customDays,      setCustomDays]      = useState('');

  // ── Details ──
  const [title,   setTitle]   = useState('');
  const [purpose, setPurpose] = useState('');

  // ── Submission ──
  const [saving,      setSaving]      = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Load data ──
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [resItems, allBk, types] = await Promise.all([
          resourceService.getAllPages(),
          bookingService.getAllPages(),
          resourceTypeService.getAll(),
        ]);
        const merged = mergeServerGroups(resItems);
        setResources(merged);
        setBookings(allBk);
        setResTypes(types);

        if (preSelectedId) {
          const group = merged.find(r => r.ids?.includes(preSelectedId) || r.id === preSelectedId);
          if (group) {
            setSelectedIds([group.id]);
            setQuantities({ [group.id]: 1 });
          }
        }
      } catch {
        addToast('Failed to load resources', 'error');
      } finally {
        setLoading(false);
        // Autofocus search after load
        setTimeout(() => searchRef.current?.focus(), 100);
      }
    })();
  }, []);

  // ── Derived ──
  const durationDays = useMemo(() => {
    if (selectedPreset === 'custom') return parseInt(customDays) || 0;
    return DURATION_PRESETS.find(p => p.label === selectedPreset)?.days ?? 0;
  }, [selectedPreset, customDays]);

  const startDateTime = useMemo(() => {
    if (!startDate) return null;
    const d = new Date(startDate);
    d.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    return d;
  }, [startDate, startMinutes]);

  const endDate = useMemo(() => {
    if (!startDate || durationDays <= 0) return null;
    const d = new Date(startDate);
    d.setDate(d.getDate() + durationDays);
    d.setHours(Math.floor(returnMinutes / 60), returnMinutes % 60, 0, 0);
    return d;
  }, [startDate, durationDays, returnMinutes]);

  const selectedResources = useMemo(() => resources.filter(r => selectedIds.includes(r.id)), [resources, selectedIds]);

  const filtered = useMemo(() => {
    let list = resources;
    const q = search.toLowerCase().trim();
    if (q) list = list.filter(r => r.name.toLowerCase().includes(q) || (r.resourceTypeName ?? '').toLowerCase().includes(q) || (r.location ?? '').toLowerCase().includes(q));
    if (catFilter === 'server')   list = list.filter(isServerResource);
    if (catFilter === 'physical') list = list.filter(r => !isServerResource(r));
    if (typeFilter) list = list.filter(r => r.resourceTypeId === typeFilter);
    if (availOnly)  list = list.filter(r => (r.availableQuantity ?? 0) > 0);
    return list;
  }, [resources, search, catFilter, typeFilter, availOnly]);

  // Group filtered by resource type name
  const grouped = useMemo(() => {
    const g: Record<string, Resource[]> = {};
    for (const r of filtered) {
      const key = r.resourceTypeName ?? 'Other';
      if (!g[key]) g[key] = [];
      g[key].push(r);
    }
    return g;
  }, [filtered]);

  const maxQtyFor = useCallback((r: Resource) => {
    if (startDateTime && endDate) return getAvailableCount(r, startDateTime, endDate, bookings);
    return r.availableQuantity ?? r.totalQuantity ?? 1;
  }, [startDateTime, endDate, bookings]);

  const hasConflict = useMemo(() => {
    if (!startDateTime || !endDate) return false;
    return selectedResources.some(r => getAvailableCount(r, startDateTime, endDate, bookings) < (quantities[r.id] ?? 1));
  }, [startDateTime, endDate, selectedResources, quantities, bookings]);

  // ── Toggle / qty ──
  const toggleResource = useCallback((r: Resource) => {
    if ((currentUserId && r.managedBy === currentUserId) || (user?.email && r.managerEmail === user.email)) return; // block own-managed
    const avail = maxQtyFor(r);
    if (avail === 0 && !selectedIds.includes(r.id)) return; // block unavailable
    setSelectedIds(prev => {
      if (prev.includes(r.id)) {
        setQuantities(q => { const n = { ...q }; delete n[r.id]; return n; });
        return prev.filter(x => x !== r.id);
      }
      setQuantities(q => ({ ...q, [r.id]: 1 }));
      return [...prev, r.id];
    });
  }, [selectedIds, maxQtyFor]);

  const setQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setSelectedIds(prev => prev.filter(x => x !== id));
      setQuantities(q => { const n = { ...q }; delete n[id]; return n; });
    } else {
      setQuantities(q => ({ ...q, [id]: qty }));
    }
  }, []);

  // ── Submit ──
  const validate = () => {
    const errs: Record<string, string> = {};
    if (selectedIds.length === 0) errs.resources = 'Select at least one resource.';
    if (!startDate) errs.schedule = 'Select a start date.';
    if (durationDays <= 0) errs.schedule = 'Select a duration.';
    if (!title.trim()) errs.title = 'Booking name is required.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !startDateTime || !endDate) return;
    setSaving(true);
    setSubmitError('');
    try {
      const request: CreateBookingRequest = {
        title: title.trim(),
        purpose: purpose.trim(),
        startTime: startDateTime.toISOString(),
        endTime: endDate.toISOString(),
        items: selectedResources.map(r => {
          const qty  = quantities[r.id] ?? 1;
          const pool = r.availableIds?.length ? r.availableIds : (r.ids ?? [r.id]);
          return { resourceIds: pool.slice(0, qty).length > 0 ? pool.slice(0, qty) : [r.id] };
        }),
      };
      await bookingService.create(request);
      addToast('Booking request submitted successfully.', 'success');
      navigate('/bookings');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to submit booking.';
      setSubmitError(msg);
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = selectedIds.length > 0 && !!startDate && durationDays > 0 && title.trim().length > 0;

  // ── Keyboard navigation on list ──
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const flatFiltered = useMemo(() => filtered, [filtered]);
  useEffect(() => { setFocusedIdx(-1); }, [search, catFilter, typeFilter]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIdx(0); }
  };
  const handleRowKeyNav = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIdx(Math.min(idx + 1, flatFiltered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); if (idx === 0) { setFocusedIdx(-1); searchRef.current?.focus(); } else setFocusedIdx(idx - 1); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--background-color)' }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: '#fff', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
          <button
            onClick={() => navigate('/bookings')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: '#fff', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <ChevronLeft size={14} /> Back
          </button>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={17} color="var(--accent-color)" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: 'var(--text-primary)' }}>New Booking</h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Select resources, set schedule, and submit</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {selectedIds.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-color)', background: 'var(--accent-bg)', padding: '4px 12px', borderRadius: 99 }}>
                {selectedIds.length} selected
              </span>
            )}
            <button
              onClick={() => navigate('/bookings')}
              style={{ width: 32, height: 32, borderRadius: 99, border: '1px solid var(--border-color)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ───── LEFT PANEL: Resource list ───── */}
          <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-light)', overflow: 'hidden', background: '#fff' }}>

            {/* Search + filters */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search by name, type, location… (↓ to navigate list)"
                  style={{
                    width: '100%', padding: '9px 32px', borderRadius: 10,
                    border: '1.5px solid var(--border-color)', fontSize: 13, fontFamily: 'inherit',
                    outline: 'none', boxSizing: 'border-box', color: 'var(--text-primary)',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                />
                {search && (
                  <button type="button" onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                    style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 0 }}>
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Filter row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {/* Category chips */}
                {([
                  { key: 'all',      label: 'All',     icon: <Layers size={11} />,  ac: '#64748b', ab: '#f1f5f9' },
                  { key: 'physical', label: 'Physical', icon: <Box size={11} />,     ac: '#0284c7', ab: '#e0f2fe' },
                  { key: 'server',   label: 'Server',   icon: <Cpu size={11} />,     ac: '#7c3aed', ab: '#f5f3ff' },
                ] as const).map(opt => {
                  const active = catFilter === opt.key;
                  return (
                    <button key={opt.key} type="button" onClick={() => setCatFilter(opt.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99,
                        border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: active ? 800 : 600,
                        background: active ? opt.ab : '#f8fafc', color: active ? opt.ac : '#64748b',
                        boxShadow: active ? `0 0 0 1.5px ${opt.ac}55` : 'none', transition: 'all 0.12s',
                      }}>
                      {opt.icon} {opt.label}
                    </button>
                  );
                })}

                {/* Type dropdown */}
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  style={{
                    padding: '4px 8px', borderRadius: 8, border: `1px solid ${typeFilter ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    fontSize: 11, fontWeight: 600, outline: 'none', fontFamily: 'inherit',
                    color: typeFilter ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: 'pointer',
                    background: typeFilter ? 'var(--accent-bg)' : '#fff',
                  }}>
                  <option value="">All types</option>
                  {resTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>

                {/* Available only toggle */}
                <button type="button" onClick={() => setAvailOnly(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99,
                    border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: availOnly ? 800 : 600,
                    background: availOnly ? '#dcfce7' : '#f8fafc', color: availOnly ? '#16a34a' : '#64748b',
                    boxShadow: availOnly ? '0 0 0 1.5px #16a34a55' : 'none', transition: 'all 0.12s',
                  }}>
                  <CheckCircle2 size={11} /> Available only
                </button>

                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                  {filtered.length} resource{filtered.length !== 1 ? 's' : ''}
                  {resources.length !== filtered.length && <span> of {resources.length}</span>}
                </span>
              </div>

              {/* Error banner for resources */}
              {fieldErrors.resources && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                  {fieldErrors.resources}
                </div>
              )}
            </div>

            {/* Resource list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }} className="custom-scrollbar">
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '60px 0', color: '#94a3b8' }}>
                  <Loader2 size={20} className="animate-spin" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Loading resources…</span>
                </div>
              ) : Object.keys(grouped).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8', fontSize: 13, fontWeight: 700 }}>
                  No resources match your filters.
                </div>
              ) : (
                Object.entries(grouped).map(([typeName, list]) => {
                  const server = isServerResource(list[0]);
                  const hColor = server ? '#7c3aed' : '#0284c7';
                  const hBg    = server ? '#f5f3ff' : '#f0f9ff';
                  const globalOffset = Object.entries(grouped)
                    .slice(0, Object.keys(grouped).indexOf(typeName))
                    .reduce((acc, [, v]) => acc + v.length, 0);

                  return (
                    <div key={typeName} style={{ marginBottom: 18 }}>
                      {/* Group header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 4px', marginBottom: 6, position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 5, background: hBg, color: hColor }}>
                          {server ? <Cpu size={11} /> : <Box size={11} />}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{typeName}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 2 }}>({list.length})</span>
                      </div>

                      {/* Rows */}
                      {list.map((r, i) => {
                        const globalIdx = globalOffset + i;
                        const mq = maxQtyFor(r);
                        return (
                          <div
                            key={r.id}
                            ref={el => { if (globalIdx === focusedIdx && el) el.focus(); }}
                            tabIndex={-1}
                            onKeyDown={e => handleRowKeyNav(e, globalIdx)}
                            style={{ marginBottom: 3 }}
                          >
                            <ResourceRow
                              resource={r}
                              selected={selectedIds.includes(r.id)}
                              qty={quantities[r.id] ?? 1}
                              maxQty={mq}
                              onToggle={() => toggleResource(r)}
                              onQtyChange={q => setQty(r.id, q)}
                              currentUserId={currentUserId}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ───── RIGHT PANEL: Schedule + Details ───── */}
          <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--background-color)' }} className="custom-scrollbar">
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ── Schedule ── */}
              <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${fieldErrors.schedule ? '#fecaca' : 'var(--border-light)'}`, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={13} color={fieldErrors.schedule ? '#ef4444' : 'var(--accent-color)'} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: fieldErrors.schedule ? '#ef4444' : 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Schedule
                  </span>
                  {fieldErrors.schedule && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, marginLeft: 4 }}>— {fieldErrors.schedule}</span>}
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Start date calendar */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Start Date</div>
                    <MiniCalendar
                      selected={startDate}
                      onSelect={d => { setStartDate(d); setFieldErrors(p => ({ ...p, schedule: '' })); }}
                      bookings={bookings}
                      selectedResources={selectedResources}
                      quantities={quantities}
                      endDate={endDate}
                    />
                  </div>

                  {/* Duration presets */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Duration</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {DURATION_PRESETS.map(p => (
                        <button key={p.label} type="button"
                          onClick={() => { setSelectedPreset(p.label); setCustomDays(''); }}
                          style={{
                            padding: '5px 10px', borderRadius: 7, border: '1px solid',
                            borderColor: selectedPreset === p.label ? 'var(--accent-color)' : 'var(--border-color)',
                            background: selectedPreset === p.label ? 'var(--accent-color)' : '#fff',
                            color: selectedPreset === p.label ? '#fff' : 'var(--text-secondary)',
                            fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s',
                          }}>
                          {p.label}
                        </button>
                      ))}
                      <button type="button"
                        onClick={() => setSelectedPreset('custom')}
                        style={{
                          padding: '5px 10px', borderRadius: 7, border: '1px solid',
                          borderColor: selectedPreset === 'custom' ? 'var(--accent-color)' : 'var(--border-color)',
                          background: selectedPreset === 'custom' ? 'rgba(232,114,12,0.06)' : '#fff',
                          color: selectedPreset === 'custom' ? 'var(--accent-color)' : 'var(--text-secondary)',
                          fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                        Custom
                      </button>
                    </div>
                    {selectedPreset === 'custom' && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button type="button" onClick={() => setCustomDays(String(Math.max(1, (parseInt(customDays)||1) - 1)))}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border-color)', background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>−</button>
                        <input type="number" min={1} max={30} value={customDays}
                          onChange={e => setCustomDays(String(Math.max(1, Math.min(30, parseInt(e.target.value) || 1))))}
                          style={{ width: 50, padding: '4px', borderRadius: 7, border: '1.5px solid var(--accent-color)', fontSize: 14, fontWeight: 800, outline: 'none', textAlign: 'center', color: 'var(--accent-color)', fontFamily: 'inherit' }}
                        />
                        <button type="button" onClick={() => setCustomDays(String(Math.min(30, (parseInt(customDays)||0) + 1)))}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border-color)', background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>+</button>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>days (1–30)</span>
                      </div>
                    )}
                  </div>

                  {/* Pickup & Return time */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <TimePicker label="Pickup" value={startMinutes} onChange={setStartMinutes} accentColor="var(--accent-color)" />
                    <TimePicker label="Return" value={returnMinutes} onChange={setReturnMinutes} accentColor="#0ea5e9" />
                  </div>

                  {/* Booking window summary */}
                  {startDateTime && endDate && (
                    <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <div style={{ flex: 1, padding: '8px 10px', background: 'var(--background-color)' }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Pickup</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {startDateTime.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--accent-color)' }}>{fmtMins(startMinutes)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, background: 'var(--background-color)', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--accent-color)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {formatDuration(startDateTime, endDate)}
                        </div>
                      </div>
                      <div style={{ flex: 1, padding: '8px 10px', background: 'var(--background-color)' }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Return</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {endDate.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#0ea5e9' }}>{fmtMins(returnMinutes)}</div>
                      </div>
                    </div>
                  )}

                  {/* Conflict warning */}
                  {hasConflict && startDateTime && endDate && (
                    <div style={{ display: 'flex', gap: 8, padding: '8px 10px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                      <AlertTriangle size={13} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>Some resources have limited availability on these dates</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Details ── */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={13} color="var(--accent-color)" />
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Details</span>
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                      Booking Name *
                    </label>
                    <input
                      value={title}
                      onChange={e => { setTitle(e.target.value); setFieldErrors(p => ({ ...p, title: e.target.value.trim() ? '' : 'Required' })); }}
                      maxLength={300}
                      placeholder="e.g. CVPR training run"
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8, boxSizing: 'border-box',
                        border: `1.5px solid ${fieldErrors.title ? '#ef4444' : 'var(--border-color)'}`,
                        fontSize: 13, fontWeight: 600, outline: 'none', fontFamily: 'inherit', color: 'var(--text-primary)',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = fieldErrors.title ? '#ef4444' : 'var(--accent-color)'}
                      onBlur={e => e.currentTarget.style.borderColor = fieldErrors.title ? '#ef4444' : 'var(--border-color)'}
                    />
                    {fieldErrors.title && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3, fontWeight: 700 }}>{fieldErrors.title}</div>}
                    <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{title.length}/300</div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                      Purpose & Impact
                    </label>
                    <textarea
                      value={purpose}
                      onChange={e => setPurpose(e.target.value)}
                      maxLength={2000} rows={4}
                      placeholder="Describe what you need these resources for…"
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8, boxSizing: 'border-box',
                        border: '1.5px solid var(--border-color)',
                        fontSize: 12, fontWeight: 500, outline: 'none', resize: 'vertical',
                        lineHeight: 1.6, fontFamily: 'inherit', color: 'var(--text-primary)',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    />
                    <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{purpose.length}/2000</div>
                  </div>
                </div>
              </div>

              {/* ── Submit ── */}
              {submitError && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca', fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                  {submitError}
                </div>
              )}

              <button
                type="button"
                disabled={!canSubmit || saving}
                onClick={handleSubmit}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: canSubmit && !saving ? 'pointer' : 'not-allowed',
                  background: canSubmit && !saving ? 'var(--accent-color)' : '#e2e8f0',
                  color: canSubmit && !saving ? '#fff' : '#94a3b8',
                  fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: canSubmit && !saving ? '0 4px 14px -3px rgba(232,114,12,0.4)' : 'none',
                  transition: 'all 0.15s',
                }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                {saving ? 'Submitting…' : 'Submit Booking Request'}
              </button>

              <div style={{ height: 8 }} />
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default NewBookingPage;
