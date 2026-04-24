import React, { useState, useEffect, useRef } from 'react';
import SearchableSelect from '@/components/common/SearchableSelect';
import { Resource, ResourceType, UpdateResourceRequest, BasicBookingResponse, BookingStatus } from '@/types/booking';
import { resourceService } from '@/services/resourceService';
import { bookingService } from '@/services/bookingService';
import { userService, UserResponse } from '@/services/userService';
import { resourceTypeService, ResourceTypeItem } from '@/services/resourceTypeService';
import {
    Save,
    Loader2,
    Cpu,
    HardDrive,
    Box,
    Monitor,
    MapPin,
    FileText,
    Package,
    Trash2,
    AlertTriangle,
    Hash,
    UserCog,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    History,
    Clock,
    User,
} from 'lucide-react';

// ─── Lightweight custom select (open/close toggle like native <select>) ────────
function TypeSelect({ value, onChange, options, isDisabled }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    isDisabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selected = options.find(o => o.value === value);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            {/* Trigger */}
            <div
                onClick={() => !isDisabled && setOpen(o => !o)}
                style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: `1.5px solid ${open ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    boxShadow: open ? '0 0 0 3px rgba(232,114,12,0.08)' : 'none',
                    fontSize: '0.85rem', fontWeight: 500, fontFamily: 'inherit',
                    background: isDisabled ? '#f8fafc' : '#fff',
                    color: selected ? 'var(--text-primary)' : '#94a3b8',
                    cursor: isDisabled ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    userSelect: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box',
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected?.label ?? '— Select type —'}
                </span>
                <ChevronDown
                    size={14}
                    style={{
                        color: open ? 'var(--accent-color)' : '#94a3b8',
                        flexShrink: 0, marginLeft: 6,
                        transform: open ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s, color 0.15s',
                    }}
                />
            </div>

            {/* Dropdown list */}
            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px',
                    boxShadow: '0 8px 28px rgba(0,0,0,0.12)', overflow: 'hidden',
                }}>
                    <div style={{ maxHeight: '108px', overflowY: 'auto', padding: '4px' }}>
                        {[{ value: '', label: '— Select type —' }, ...options].map(o => {
                            const isSel = o.value === value;
                            return (
                                <div
                                    key={o.value}
                                    onMouseDown={e => { e.preventDefault(); onChange(o.value); setOpen(false); }}
                                    style={{
                                        padding: '8px 12px', borderRadius: '6px',
                                        fontSize: '0.875rem', fontWeight: isSel ? 600 : 400,
                                        color: isSel ? '#fff' : '#1e293b',
                                        background: isSel ? 'var(--accent-color, #e8720c)' : 'transparent',
                                        cursor: 'pointer', transition: 'background 0.12s',
                                    }}
                                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#fff7ed'; }}
                                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    {o.label}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

interface ResourceDetailPanelProps {
    resource: Resource;
    onClose: () => void;
    onSaved: (shouldClose?: boolean, message?: string) => void;
    onTitleChange?: (title: string) => void;
    isLabDirector: boolean;
    allowSerialSelect?: boolean;
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1.5px solid var(--border-color)',
    fontSize: '0.85rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    background: '#fff'
};

const labelStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
};

const sectionStyle: React.CSSProperties = {
    padding: '16px',
    background: 'var(--background-color)',
    borderRadius: '12px',
    border: '1px solid var(--border-light)',
    marginBottom: '16px'
};

const getResourceIcon = (type: ResourceType) => {
    switch (type) {
        case ResourceType.GPU: return <Cpu size={16} />;
        case ResourceType.Equipment: return <HardDrive size={16} />;
        case ResourceType.Dataset: return <Box size={16} />;
        case ResourceType.LabStation: return <Monitor size={16} />;
        default: return <Package size={16} />;
    }
};

const getResourceTypeLabel = (type: ResourceType) => {
    switch (type) {
        case ResourceType.GPU: return 'GPU';
        case ResourceType.Equipment: return 'Equipment';
        case ResourceType.Dataset: return 'Dataset';
        case ResourceType.LabStation: return 'Lab Station';
        default: return 'Resource';
    }
};

const getTypeColor = (type: ResourceType) => {
    switch (type) {
        case ResourceType.GPU: return '#7c3aed';
        case ResourceType.Equipment: return '#2563eb';
        case ResourceType.Dataset: return '#059669';
        case ResourceType.LabStation: return '#ea580c';
        default: return '#64748b';
    }
};

const ResourceDetailPanel: React.FC<ResourceDetailPanelProps> = ({
    resource: initialResource,
    onClose,
    onSaved,
    onTitleChange,
    isLabDirector,
    allowSerialSelect
}) => {
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [selectedManagerId, setSelectedManagerId] = useState(initialResource.managedBy || '');
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [resourceTypes, setResourceTypes] = useState<ResourceTypeItem[]>([]);

    const [selectedSerial, setSelectedSerial] = useState<string>('');
    const [serialLoading, setSerialLoading] = useState(false);
    const [targetResource, setTargetResource] = useState<Resource>(initialResource);

    const canEdit = isLabDirector || (allowSerialSelect && !!selectedSerial);
    const canDelete = isLabDirector || (allowSerialSelect && !!selectedSerial);

    // Editable fields – initialized from the target resource
    const [name, setName] = useState(initialResource.name || '');
    const [description, setDescription] = useState(initialResource.description || '');
    const [location, setLocation] = useState(initialResource.location || '');
    const [modelSeries, setModelSeries] = useState(initialResource.modelSeries || '');
    const [resourceTypeId, setResourceTypeId] = useState(initialResource.resourceTypeId || '');
    const [isDamaged, setIsDamaged] = useState(!!initialResource.isDamaged);
    const [isInUse, setIsInUse] = useState(!!initialResource.isInUse);

    // ─── Panel tab state ───────────────────────────────────────────────────
    type PanelTab = 'details' | 'history';
    const [panelTab, setPanelTab] = useState<PanelTab>('details');

    // ─── Booking history state ─────────────────────────────────────────────
    const [historyItems, setHistoryItems] = useState<BasicBookingResponse[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const historyPageSize = 10;
    const [historyTotalCount, setHistoryTotalCount] = useState(0);

    const fetchHistory = async (resourceId: string, page: number) => {
        setHistoryLoading(true);
        try {
            const result = await bookingService.getByResource(resourceId, page, historyPageSize);
            setHistoryItems(result.items || []);
            setHistoryTotalCount(result.totalCount || 0);
        } catch {
            setHistoryItems([]);
            setHistoryTotalCount(0);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (panelTab === 'history') {
            fetchHistory(targetResource.id, historyPage);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panelTab, historyPage, targetResource.id]);

    const historyStatusCfg: Record<number, { label: string; color: string; bg: string }> = {
        [BookingStatus.Pending]:   { label: 'Pending',   color: '#d97706', bg: '#fef9c3' },
        [BookingStatus.Approved]:  { label: 'Approved',  color: '#059669', bg: '#d1fae5' },
        [BookingStatus.Rejected]:  { label: 'Rejected',  color: '#dc2626', bg: '#fee2e2' },
        [BookingStatus.Cancelled]: { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6' },
        [BookingStatus.Completed]: { label: 'Completed', color: '#2563eb', bg: '#dbeafe' },
        [BookingStatus.InUse]:     { label: 'In Use',    color: '#7c3aed', bg: '#ede9fe' },
    };

    const fmtDt = (s: string) => {
        const d = new Date(s);
        if (isNaN(d.getTime())) return 'N/A';
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    };

    const typeColor = getTypeColor(initialResource.type);

    useEffect(() => {
        if (!isLabDirector) return;
        userService.getAll().then((data: any) => {
            const list: UserResponse[] = Array.isArray(data) ? data : (data.items || []);
            setUsers(list);
        }).catch(() => {});
    }, [isLabDirector]);

    useEffect(() => {
        resourceTypeService.getAll().then(setResourceTypes).catch(() => {});
    }, []);

    useEffect(() => {
        setTargetResource(initialResource);
        setSelectedSerial('');
        setName(initialResource.name || '');
        setDescription(initialResource.description || '');
        setLocation(initialResource.location || '');
        setModelSeries(initialResource.modelSeries || '');
        setResourceTypeId(initialResource.resourceTypeId || '');
        setIsDamaged(!!initialResource.isDamaged);
        setIsInUse(!!initialResource.isInUse);
        setPanelTab('details');
        setHistoryPage(1);
    }, [initialResource]);

    useEffect(() => {
        setName(targetResource.name || '');
        setDescription(targetResource.description || '');
        setLocation(targetResource.location || '');
        setModelSeries(targetResource.modelSeries || '');
        setResourceTypeId(targetResource.resourceTypeId || '');
        setIsDamaged(!!targetResource.isDamaged);
        setIsInUse(!!targetResource.isInUse);
        onTitleChange?.(targetResource.name || 'Resource');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetResource.id]);

    const handleSelectSerial = async (serial: string) => {
        const next = serial === selectedSerial ? '' : serial;
        setSelectedSerial(next);
        if (!next) {
            setTargetResource(initialResource);
            return;
        }
        setSerialLoading(true);
        try {
            const unit = await resourceService.getBySerial(next);
            setTargetResource(unit);
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to load resource by serial.';
            alert(msg);
            setSelectedSerial('');
            setTargetResource(initialResource);
        } finally {
            setSerialLoading(false);
        }
    };

    const handleAssignManager = async () => {
        if (!selectedManagerId) return;
        setAssigning(true);
        try {
            await Promise.all(initialResource.ids.map(id => resourceService.assignManager(id, selectedManagerId)));
            onSaved(false, 'Manager assigned successfully.');
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to assign manager.';
            alert(msg);
        } finally {
            setAssigning(false);
        }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!canEdit) return;
        e.currentTarget.style.borderColor = 'var(--accent-color)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,114,12,0.08)';
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.boxShadow = 'none';
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const request: UpdateResourceRequest = {
                name: name.trim() || undefined,
                description: description.trim() || undefined,
                location: location.trim() || undefined,
                modelSeries: modelSeries.trim() || undefined,
                resourceTypeId: resourceTypeId.trim() || undefined,
                isDamaged,
                isInUse
            };
            if (selectedSerial) {
                // Update only the selected unit
                await resourceService.update(targetResource.id, request);
            } else {
                // Update every unit in this resource group
                await Promise.all(initialResource.ids.map(id => resourceService.update(id, request)));
            }
            onSaved(false, 'Resource updated successfully.');
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to update resource.';
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            if (selectedSerial) {
                // Delete only the selected unit
                await resourceService.delete(targetResource.id);
            } else {
                // Delete every unit in this resource group
                await Promise.all(initialResource.ids.map(id => resourceService.delete(id)));
            }
            onSaved(true, 'Resource deleted successfully.');
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to delete resource.';
            alert(msg);
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Panel Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '10px',
                        background: `${typeColor}15`, color: typeColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {getResourceIcon(initialResource.type)}
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {initialResource.name}
                        </h3>
                        <span style={{
                            fontSize: '0.68rem', fontWeight: 700, color: typeColor,
                            background: `${typeColor}10`, padding: '2px 8px', borderRadius: '12px'
                        }}>
                            {getResourceTypeLabel(initialResource.type)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
                {([
                    { id: 'details', label: 'Details', icon: <FileText size={13} /> },
                    { id: 'history', label: 'Booking History', icon: <History size={13} /> },
                ] as const).map(tab => {
                    const active = panelTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setPanelTab(tab.id)}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '6px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                                fontSize: '0.78rem', fontWeight: active ? 700 : 500,
                                background: active ? '#fff' : 'transparent',
                                color: active ? (tab.id === 'history' ? '#4f46e5' : typeColor) : '#64748b',
                                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            {tab.icon} {tab.label}
                            {tab.id === 'history' && historyTotalCount > 0 && (
                                <span style={{
                                    fontSize: '0.62rem', fontWeight: 800, minWidth: '16px', height: '16px',
                                    borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '0 4px',
                                    background: active ? '#4f46e5' : '#e2e8f0',
                                    color: active ? '#fff' : '#64748b',
                                }}>
                                    {historyTotalCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">

                {/* ── Booking History Tab ── */}
                {panelTab === 'history' && (() => {
                    const totalPages = Math.ceil(historyTotalCount / historyPageSize) || 1;
                    return (
                        <div>
                            {historyLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem' }}>
                                    <Loader2 size={28} className="animate-spin" style={{ color: '#4f46e5' }} />
                                </div>
                            ) : historyItems.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                                    <History size={36} style={{ opacity: 0.25, marginBottom: '10px' }} />
                                    <div>No booking history found for this resource.</div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {historyItems.map((item, idx) => {
                                        const sc = historyStatusCfg[item.status] ?? { label: 'Unknown', color: '#64748b', bg: '#f8fafc' };
                                        return (
                                            <div key={item.bookingId || idx} style={{
                                                background: '#fff', borderRadius: '10px',
                                                border: '1px solid #e2e8f0', padding: '12px 14px',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <span style={{
                                                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 9px',
                                                        borderRadius: '20px', color: sc.color, background: sc.bg,
                                                    }}>
                                                        {sc.label}
                                                    </span>
                                                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                                                        #{(item.bookingId || '').slice(-8).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px', fontSize: '0.78rem', color: '#475569' }}>
                                                    <Clock size={12} style={{ color: '#94a3b8', flexShrink: 0 }} />
                                                    <span>{fmtDt(item.startTime)}</span>
                                                    <span style={{ color: '#cbd5e1' }}>→</span>
                                                    <span>{fmtDt(item.endTime)}</span>
                                                </div>
                                                {item.managerFullName && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#64748b' }}>
                                                        <User size={11} style={{ color: '#94a3b8', flexShrink: 0 }} />
                                                        Manager: <strong style={{ color: '#1e293b' }}>{item.managerFullName}</strong>
                                                        {item.managerEmail && <span style={{ color: '#94a3b8' }}>({item.managerEmail})</span>}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Pagination */}
                            {historyTotalCount > historyPageSize && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 0 4px', borderTop: '1px solid #f1f5f9', marginTop: '10px' }}>
                                    <button
                                        disabled={historyPage <= 1}
                                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: '1px solid #e2e8f0', background: historyPage <= 1 ? '#f8fafc' : '#fff', color: historyPage <= 1 ? '#cbd5e1' : '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: historyPage <= 1 ? 'not-allowed' : 'pointer' }}
                                    >
                                        <ChevronLeft size={13} /> Prev
                                    </button>
                                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                                        {historyPage} / {totalPages}
                                    </span>
                                    <button
                                        disabled={historyPage >= totalPages}
                                        onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: '1px solid #e2e8f0', background: historyPage >= totalPages ? '#f8fafc' : '#fff', color: historyPage >= totalPages ? '#cbd5e1' : '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: historyPage >= totalPages ? 'not-allowed' : 'pointer' }}
                                    >
                                        Next <ChevronRight size={13} />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* ── Details Tab ── */}
                {panelTab === 'details' && (<>

                {/* Inventory Status */}
                <div style={sectionStyle}>
                    <div style={labelStyle}><Package size={12} /> Inventory Status</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {[
                            { label: 'Total', value: initialResource.totalQuantity, color: '#1e293b', bg: '#fff' },
                            { label: 'Available', value: initialResource.availableQuantity, color: '#059669', bg: '#ecfdf5' },
                            { label: 'In Use', value: initialResource.inUseCount ?? 0, color: '#7c3aed', bg: '#f5f3ff' },
                            { label: 'Damaged', value: initialResource.damagedQuantity, color: initialResource.damagedQuantity > 0 ? '#dc2626' : '#94a3b8', bg: initialResource.damagedQuantity > 0 ? '#fef2f2' : '#f8fafc' }
                        ].map(stat => (
                            <div key={stat.label} style={{ padding: '10px', background: stat.bg, borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>{stat.label}</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                            </div>
                        ))}
                    </div>
                    {initialResource.location && (
                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#64748b' }}>
                            <MapPin size={12} />
                            <span style={{ fontWeight: 600 }}>{initialResource.location}</span>
                        </div>
                    )}
                    {initialResource.managerName && (
                        <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                            Managed by: <strong style={{ color: '#1e293b' }}>{initialResource.managerName}</strong>
                        </div>
                    )}
                </div>

                {/* Serial Numbers */}
                {(initialResource.serials?.length ?? 0) > 0 && (
                    <div style={sectionStyle}>
                        <div style={labelStyle}><Hash size={12} /> Serial Numbers ({initialResource.serials!.length} units)</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }} className="custom-scrollbar">
                            {initialResource.serials!.map((serial, idx) => (
                                <div
                                    key={idx}
                                    onClick={allowSerialSelect ? () => handleSelectSerial(serial) : undefined}
                                    style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '7px 10px',
                                    background: (allowSerialSelect && selectedSerial === serial) ? '#f8fafc' : '#fff',
                                    borderRadius: '8px',
                                    border: (allowSerialSelect && selectedSerial === serial) ? '1px solid var(--accent-color)' : '1px solid var(--border-light)',
                                    cursor: allowSerialSelect ? 'pointer' : 'default'
                                }}>
                                    <span style={{
                                        width: '20px', height: '20px', borderRadius: '6px', background: '#f1f5f9',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.65rem', fontWeight: 700, color: '#64748b', flexShrink: 0
                                    }}>{idx + 1}</span>
                                    <code style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', letterSpacing: '0.5px' }}>
                                        {serial}
                                    </code>
                                </div>
                            ))}
                        </div>

                        {allowSerialSelect && (
                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>
                                        Unit Details
                                    </div>
                                    {serialLoading && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-color)' }} />}
                                </div>

                                {!selectedSerial ? (
                                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                                        Click a serial number above to expand the update table.
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: '8px 12px' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Serial</div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>{selectedSerial}</div>

                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Name</div>
                                        <input
                                            style={{ ...inputStyle, ...(!canEdit ? { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' } : {}) }}
                                            value={name}
                                            onChange={e => { if (canEdit) { setName(e.target.value); onTitleChange?.(e.target.value || 'Resource'); } }}
                                            readOnly={!canEdit}
                                            onFocus={handleFocus}
                                            onBlur={handleBlur}
                                        />

                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Description</div>
                                        <textarea
                                            style={{
                                                ...inputStyle,
                                                minHeight: '70px',
                                                resize: canEdit ? 'vertical' as const : 'none' as const,
                                                ...(!canEdit ? { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' } : {})
                                            }}
                                            value={description}
                                            onChange={e => { if (canEdit) setDescription(e.target.value); }}
                                            readOnly={!canEdit}
                                            onFocus={handleFocus}
                                            onBlur={handleBlur}
                                        />

                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Location</div>
                                        <input
                                            style={{ ...inputStyle, ...(!canEdit ? { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' } : {}) }}
                                            value={location}
                                            onChange={e => { if (canEdit) setLocation(e.target.value); }}
                                            readOnly={!canEdit}
                                            onFocus={handleFocus}
                                            onBlur={handleBlur}
                                        />

                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Model Series</div>
                                        <input
                                            style={{ ...inputStyle, ...(!canEdit ? { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' } : {}) }}
                                            value={modelSeries}
                                            onChange={e => { if (canEdit) setModelSeries(e.target.value); }}
                                            readOnly={!canEdit}
                                            onFocus={handleFocus}
                                            onBlur={handleBlur}
                                        />

                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Resource Type</div>
                                        <TypeSelect
                                            value={resourceTypeId}
                                            onChange={v => { if (canEdit) setResourceTypeId(v); }}
                                            options={resourceTypes.map(rt => ({ value: rt.id, label: rt.name }))}
                                            isDisabled={!canEdit}
                                        />

                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Flags</div>
                                        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isDamaged}
                                                    onChange={e => { if (canEdit) setIsDamaged(e.target.checked); }}
                                                    disabled={!canEdit}
                                                />
                                                Is Damaged
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isInUse}
                                                    onChange={e => { if (canEdit) setIsInUse(e.target.checked); }}
                                                    disabled={!canEdit}
                                                />
                                                Is In Use
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Editable Details */}
                {!allowSerialSelect && (
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={12} /> {isLabDirector ? 'Editable Details' : 'Details'}</div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Name</label>
                        <input
                            style={{ ...inputStyle, ...(!isLabDirector ? { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' } : {}) }}
                            value={name}
                            onChange={e => { if (isLabDirector) { setName(e.target.value); onTitleChange?.(e.target.value || 'Resource'); } }}
                            readOnly={!isLabDirector}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Description</label>
                        <textarea
                            style={{
                                ...inputStyle, minHeight: '70px',
                                resize: isLabDirector ? 'vertical' as const : 'none' as const,
                                ...(!isLabDirector ? { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' } : {})
                            }}
                            value={description}
                            onChange={e => { if (isLabDirector) setDescription(e.target.value); }}
                            readOnly={!isLabDirector}
                            placeholder="Resource description..."
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}><MapPin size={12} /> Location</label>
                        <input
                            style={{ ...inputStyle, ...(!isLabDirector ? { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' } : {}) }}
                            value={location}
                            onChange={e => { if (isLabDirector) setLocation(e.target.value); }}
                            readOnly={!isLabDirector}
                            placeholder="Resource location..."
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                    </div>

                    <div>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}><Package size={12} /> Resource Type</label>
                        <TypeSelect
                            value={resourceTypeId}
                            onChange={v => { if (isLabDirector) setResourceTypeId(v); }}
                            options={resourceTypes.map(rt => ({ value: rt.id, label: rt.name }))}
                            isDisabled={!isLabDirector}
                        />
                    </div>
                </div>
                )}

                {/* Assign Manager */}
                {isLabDirector && (
                    <div style={sectionStyle}>
                        <div style={labelStyle}><UserCog size={12} /> Assign Manager</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                                <SearchableSelect
                                    options={users.map(u => ({ id: u.userId, name: u.fullName, info: u.email }))}
                                    value={selectedManagerId}
                                    onChange={v => setSelectedManagerId(v as string)}
                                    placeholder="— Select a manager —"
                                    icon={<UserCog size={14} />}
                                />
                            </div>
                            <button
                                onClick={handleAssignManager}
                                disabled={assigning || !selectedManagerId}
                                style={{
                                    padding: '10px 16px', borderRadius: '10px', border: 'none',
                                    background: (!selectedManagerId || assigning) ? '#e2e8f0' : 'var(--accent-color)',
                                    color: (!selectedManagerId || assigning) ? '#94a3b8' : '#fff',
                                    cursor: (!selectedManagerId || assigning) ? 'not-allowed' : 'pointer',
                                    fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                {assigning ? <Loader2 size={14} className="animate-spin" /> : <UserCog size={14} />}
                                Assign
                            </button>
                        </div>
                        {initialResource.managerName && (
                            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#64748b' }}>
                                Current: <strong style={{ color: '#1e293b' }}>{initialResource.managerName}</strong>
                            </div>
                        )}
                    </div>
                )}

                {/* Delete Confirmation */}
                {showDeleteConfirm && canDelete && (
                    <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <AlertTriangle size={16} color="#dc2626" />
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626' }}>Confirm Delete</span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: '#7f1d1d', margin: '0 0 12px 0' }}>
                            {selectedSerial
                                ? `This will delete the selected unit (serial: ${selectedSerial}). This cannot be undone.`
                                : `This will delete all ${initialResource.ids.length} unit(s) of "${initialResource.name}". This cannot be undone.`}
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                style={{
                                    padding: '6px 16px', borderRadius: '8px', border: 'none',
                                    background: '#dc2626', color: '#fff',
                                    cursor: deleting ? 'not-allowed' : 'pointer',
                                    fontSize: '0.78rem', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
                </>)}
            </div>

            {/* Footer */}
            <div style={{
                paddingTop: '14px', borderTop: '1px solid var(--border-light)',
                display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: 'auto'
            }}>
                <div>
                    {panelTab === 'details' && canDelete && !showDeleteConfirm && (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            style={{
                                padding: '8px 16px', borderRadius: '10px',
                                border: '1px solid #fecaca', background: '#fff', color: '#dc2626',
                                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                            }}
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 20px', borderRadius: '10px',
                            border: '1px solid var(--border-color)', background: '#fff',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s'
                        }}
                    >
                        Close
                    </button>
                    {canEdit && panelTab === 'details' && (
                        <button
                            onClick={handleSave}
                            disabled={saving || serialLoading}
                            style={{
                                padding: '8px 24px', borderRadius: '10px', border: 'none',
                                background: saving ? '#94a3b8' : 'var(--accent-color)',
                                color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                                fontSize: '0.8rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: '6px',
                                transition: 'all 0.2s',
                                boxShadow: saving ? 'none' : '0 4px 12px rgba(232,114,12,0.25)'
                            }}
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save Changes
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResourceDetailPanel;
