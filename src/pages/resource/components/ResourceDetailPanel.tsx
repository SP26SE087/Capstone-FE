import React, { useState, useEffect, useRef } from 'react';
import SearchableSelect from '@/components/common/SearchableSelect';
import { Resource, ResourceType, UpdateResourceRequest, BasicBookingResponse, BookingStatus } from '@/types/booking';
import { resourceService } from '@/services/resourceService';
import { serverService, ServerResourceDetail } from '@/services/serverService';
import { bookingService } from '@/services/bookingService';
import { userService, UserResponse } from '@/services/userService';
import { resourceTypeService, ResourceTypeItem, ResourceTypeCategory } from '@/services/resourceTypeService';
import { useAuth } from '@/hooks/useAuth';
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
    Server,
    Key,
    MemoryStick,
    Users,
    Tag,
    Wifi,
    WifiOff,
    RefreshCw,
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
    currentUserId?: string;
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
    allowSerialSelect,
    currentUserId,
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


    // Editable fields – initialized from the target resource
    const [name, setName] = useState(initialResource.name || '');
    const [description, setDescription] = useState(initialResource.description || '');
    const [location, setLocation] = useState(initialResource.location || '');
    const [modelSeries, setModelSeries] = useState(initialResource.modelSeries || '');
    const [resourceTypeId, setResourceTypeId] = useState(initialResource.resourceTypeId || '');
    const [isDamaged, setIsDamaged] = useState(!!initialResource.isDamaged);
    const [isInUse, setIsInUse] = useState(!!initialResource.isInUse);

    // Server-specific fields
    const [serverDetail, setServerDetail] = useState<ServerResourceDetail | null>(null);
    const [serverDetailLoading, setServerDetailLoading] = useState(false);

    // Server health ping (3-second interval)
    type ServerHealth = 'checking' | 'online' | 'offline';
    const [serverHealth, setServerHealth] = useState<ServerHealth>('checking');
    const [healthLastChecked, setHealthLastChecked] = useState<Date | null>(null);
    const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [sshHost, setSshHost] = useState('');
    const [sshPort, setSshPort] = useState('22');
    const [sshUsername, setSshUsername] = useState('');
    const [sshPrivateKey, setSshPrivateKey] = useState('');
    const [gpuCount, setGpuCount] = useState('');
    const [cpuCores, setCpuCores] = useState('');
    const [ramGb, setRamGb] = useState('');
    const [maxConcurrentUsers, setMaxConcurrentUsers] = useState('');
    const [serverModelSeries, setServerModelSeries] = useState('');

    // Split into units
    const [splitCount, setSplitCount] = useState(2);
    const [splitCustom, setSplitCustom] = useState('');
    const [splitting, setSplitting] = useState(false);
    const [splitError, setSplitError] = useState('');
    const [splitSshPrivateKey, setSplitSshPrivateKey] = useState('');

    const isServerType = resourceTypes.find(rt => rt.id === resourceTypeId)?.category === ResourceTypeCategory.ServerCompute;
    // True when this resource is a grouped server (split into N units)
    const isServerGroup = isServerType && (initialResource.serials?.length ?? 0) > 1;

    const { user } = useAuth();

    // Only the assigned manager of this resource can edit it
    const isAssignee = (!!currentUserId && initialResource.managedBy === currentUserId) ||
                       (!!user?.email && initialResource.managerEmail === user.email);

    // Unit picker: allowSerialSelect (physical) or assignee on server groups
    const canPickUnit = allowSerialSelect || (isServerGroup && isAssignee);

    // For server groups, editing general details is allowed as a whole,
    // and editing unit-specific details is allowed when a unit is selected.
    // LabDirector can edit any server resource regardless of assignee
    const canEdit = isServerType ? (isAssignee || isLabDirector) : isAssignee;
    const canDelete = isLabDirector;

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
        setSelectedManagerId(targetResource.managedBy || '');
        onTitleChange?.(targetResource.name || 'Resource');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetResource.id]);

    // Load server-specific details when the resource is a server type
    useEffect(() => {
        if (!isServerType || !targetResource.id) return;
        setServerDetailLoading(true);
        serverService.getServerDetail(targetResource.id).then(detail => {
            setServerDetail(detail);
            setSshHost(detail.sshHost || '');
            setSshPort(detail.sshPort ? String(detail.sshPort) : '22');
            setSshUsername(detail.sshUsername || '');
            setSshPrivateKey(''); // never pre-fill private key
            setGpuCount(detail.gpuCount != null ? String(detail.gpuCount) : '');
            setCpuCores(detail.cpuCores != null ? String(detail.cpuCores) : '');
            setRamGb(detail.ramGb != null ? String(detail.ramGb) : '');
            setMaxConcurrentUsers(detail.maxConcurrentUsers != null ? String(detail.maxConcurrentUsers) : '');
            setServerModelSeries(detail.modelSeries || '');
        }).catch(() => {
            setServerDetail(null);
        }).finally(() => {
            setServerDetailLoading(false);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetResource.id, isServerType]);

    // Health-check ping every 3 seconds for server resources
    useEffect(() => {
        if (!isServerType || !targetResource.id) {
            setServerHealth('checking');
            return;
        }
        const ping = async () => {
            try {
                const detail = await serverService.getServerDetail(targetResource.id);
                setServerHealth(detail.isAvailable && !detail.isDamaged ? 'online' : 'offline');
            } catch {
                setServerHealth('offline');
            }
            setHealthLastChecked(new Date());
        };
        setServerHealth('checking');
        ping();
        healthIntervalRef.current = setInterval(ping, 3000);
        return () => { if (healthIntervalRef.current) clearInterval(healthIntervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetResource.id, isServerType]);

    const handleSelectSerial = async (serial: string) => {
        const next = serial === selectedSerial ? '' : serial;
        setSelectedSerial(next);
        if (!next) {
            setTargetResource(initialResource);
            return;
        }
        setSerialLoading(true);
        try {
            let unit: Resource;
            if (isServerGroup) {
                const idx = initialResource.serials?.indexOf(next) ?? -1;
                const unitId = idx >= 0 ? initialResource.ids[idx] : null;
                if (!unitId) throw new Error('Unit not found');
                unit = await resourceService.getById(unitId);
            } else {
                unit = await resourceService.getBySerial(next);
            }
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
            if (selectedSerial) {
                await resourceService.assignManager(targetResource.id, selectedManagerId);
            } else {
                await Promise.all(initialResource.ids.map(id => resourceService.assignManager(id, selectedManagerId)));
            }
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
            if (isServerType && isServerGroup && !selectedSerial) {
                // Update every unit in this server resource group with numbered names
                const request: UpdateResourceRequest = {
                    description: description.trim() || undefined,
                    location: location.trim() || undefined,
                    modelSeries: modelSeries.trim() || undefined,
                    resourceTypeId: resourceTypeId.trim() || undefined,
                    isDamaged,
                    isInUse
                };
                await Promise.all(initialResource.ids.map((id, idx) => {
                    const unitName = `${name.trim()} #${idx + 1}`;
                    return resourceService.update(id, { ...request, name: unitName });
                }));
            } else if (isServerType && serverDetail !== null) {
                // Server resource — update via serverService using targetResource.id
                // (targetResource is the selected unit for groups, or initialResource for singles)
                const serverReq: any = {
                    name: name.trim() || undefined,
                    description: description.trim() || undefined,
                    location: location.trim() || undefined,
                    resourceTypeId: resourceTypeId.trim() || undefined,
                    sshHost: sshHost.trim() || undefined,
                    sshPort: sshPort ? Number(sshPort) : undefined,
                    sshUsername: sshUsername.trim() || undefined,
                    gpuCount: gpuCount ? Number(gpuCount) : undefined,
                    cpuCores: cpuCores ? Number(cpuCores) : undefined,
                    ramGb: ramGb ? Number(ramGb) : undefined,
                    maxConcurrentUsers: maxConcurrentUsers ? Number(maxConcurrentUsers) : undefined,
                    modelSeries: serverModelSeries.trim() || undefined,
                };
                // Only send private key if user typed a new one
                if (sshPrivateKey.trim()) serverReq.sshPrivateKey = sshPrivateKey.trim();
                await serverService.updateServer(targetResource.id, serverReq);
            } else {
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
            }
            onSaved(false, 'Resource updated successfully.');
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to update resource.';
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleSplit = async () => {
        if (!splitSshPrivateKey.trim()) {
            setSplitError('SSH Private Key is required to create new server units.');
            return;
        }
        const minCount = isServerGroup ? 1 : 2;
        if (splitCount < minCount || splitCount > 64) {
            setSplitError(`Unit count must be between ${minCount} and 64.`);
            return;
        }
        setSplitError('');
        setSplitting(true);
        try {
            const commonPayload = {
                description: description.trim() || undefined,
                resourceTypeId,
                location: location.trim() || undefined,
                sshHost: sshHost.trim(),
                sshPort: sshPort ? Number(sshPort) : undefined,
                sshUsername: sshUsername.trim(),
                sshPrivateKey: splitSshPrivateKey.trim(),
                gpuCount: gpuCount ? Number(gpuCount) : undefined,
                cpuCores: cpuCores ? Number(cpuCores) : undefined,
                ramGb: ramGb ? Number(ramGb) : undefined,
                maxConcurrentUsers: maxConcurrentUsers ? Number(maxConcurrentUsers) : undefined,
                modelSeries: serverModelSeries.trim() || undefined,
            };

            if (isServerGroup) {
                // Add N more units to the existing group
                const existingCount = initialResource.ids.length;
                const baseName = initialResource.name;
                for (let i = 1; i <= splitCount; i++) {
                    await serverService.createServer({ name: `${baseName} #${existingCount + i}`, ...commonPayload });
                }
                onSaved(true, `Added ${splitCount} unit(s) to "${initialResource.name}".`);
            } else {
                // Split single server: rename to #1, create N-1 more
                await serverService.updateServer(targetResource.id, { name: `${name.trim()} #1` });
                for (let i = 2; i <= splitCount; i++) {
                    await serverService.createServer({ name: `${name.trim()} #${i}`, ...commonPayload });
                }
                onSaved(true, `Server split into ${splitCount} units successfully.`);
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.response?.data?.title || 'Failed to split server.';
            setSplitError(msg);
        } finally {
            setSplitting(false);
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                            <span style={{
                                fontSize: '0.68rem', fontWeight: 700, color: typeColor,
                                background: `${typeColor}10`, padding: '2px 8px', borderRadius: '12px'
                            }}>
                                {getResourceTypeLabel(initialResource.type)}
                            </span>
                            {isAssignee ? (
                                <span style={{
                                    fontSize: '0.62rem', fontWeight: 700,
                                    background: '#d1fae5', color: '#065f46',
                                    border: '1px solid #6ee7b7',
                                    padding: '2px 8px', borderRadius: '12px',
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                }}>
                                    <UserCog size={10} /> Assignee
                                </span>
                            ) : (
                                <span style={{
                                    fontSize: '0.62rem', fontWeight: 700,
                                    background: '#f1f5f9', color: '#64748b',
                                    border: '1px solid #e2e8f0',
                                    padding: '2px 8px', borderRadius: '12px',
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                }}>
                                    View Only
                                </span>
                            )}
                        </div>
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

                {/* View-only notice for non-assignees */}
                {!isAssignee && panelTab === 'details' && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 14px', marginBottom: '12px',
                        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px',
                        fontSize: '0.78rem', color: '#64748b',
                    }}>
                        <UserCog size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                        {initialResource.managerName ? (
                            <span>Managed by <strong style={{ color: '#1e293b' }}>{initialResource.managerName}</strong> — you can view but not edit this resource.</span>
                        ) : (
                            <span>No assignee set — you can view but not edit this resource.</span>
                        )}
                    </div>
                )}

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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={labelStyle}><Package size={12} /> Inventory Status</div>
                        {/* Server health badge — only for server resources when user is lab director */}
                        {isServerType && isLabDirector && (() => {
                            const hCfg = {
                                checking: { label: 'Checking…', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', dot: '#94a3b8', icon: <Loader2 size={11} className="animate-spin" /> },
                                online:   { label: 'Online',    color: '#16a34a', bg: '#dcfce7', border: '#86efac', dot: '#22c55e', icon: <Wifi size={11} /> },
                                offline:  { label: 'Offline',   color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', dot: '#ef4444', icon: <WifiOff size={11} /> },
                            }[serverHealth];
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        fontSize: '0.7rem', fontWeight: 800, padding: '4px 10px', borderRadius: '20px',
                                        color: hCfg.color, background: hCfg.bg, border: `1px solid ${hCfg.border}`,
                                    }}>
                                        {serverHealth === 'online'
                                            ? <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'serverPulse 1.4s ease-in-out infinite' }} />
                                            : hCfg.icon
                                        }
                                        {hCfg.label}
                                    </span>
                                    {healthLastChecked && (
                                        <span style={{ fontSize: '0.58rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <RefreshCw size={8} /> {healthLastChecked.toLocaleTimeString()}
                                        </span>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {[
                            { label: 'Total',     sub: 'all units',        value: initialResource.totalQuantity,       color: '#1e293b', bg: '#fff' },
                            { label: 'Available', sub: 'ready to book',    value: initialResource.availableQuantity,   color: '#059669', bg: '#ecfdf5' },
                            { label: 'In Use',    sub: 'active sessions',  value: initialResource.inUseCount ?? 0,     color: '#7c3aed', bg: '#f5f3ff' },
                            { label: 'Damaged',   sub: 'flagged units',    value: initialResource.damagedQuantity,     color: initialResource.damagedQuantity > 0 ? '#dc2626' : '#94a3b8', bg: initialResource.damagedQuantity > 0 ? '#fef2f2' : '#f8fafc' }
                        ].map(stat => (
                            <div key={stat.label} style={{ padding: '10px', background: stat.bg, borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px', textTransform: 'uppercase' }}>{stat.label}</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '3px', opacity: 0.75 }}>{stat.sub}</div>
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

                {/* Serial Numbers / Server Units */}
                {(initialResource.serials?.length ?? 0) > 0 && (() => {
                    const serials = initialResource.serials!;
                    const availableIdSet = new Set(initialResource.availableIds || []);
                    const totalUnits    = serials.length;
                    const damagedCnt   = initialResource.damagedQuantity ?? 0;
                    const availableCnt = initialResource.availableQuantity ?? (totalUnits - damagedCnt);
                    type UnitSt = 'available' | 'in-use' | 'damaged';
                    const SERIAL_STATUS: Record<UnitSt, { label: string; color: string; bg: string; border: string; dot: string }> = {
                        available: { label: 'Available', color: '#16a34a', bg: '#dcfce7', border: '#86efac', dot: '#22c55e' },
                        'in-use':  { label: 'In Use',    color: '#b45309', bg: '#fef9c3', border: '#fde68a', dot: '#f59e0b' },
                        damaged:   { label: 'Damaged',   color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', dot: '#ef4444' },
                    };
                    const unitSt: { serial: string; status: UnitSt; id?: string }[] = serials.map((serial, idx) => {
                        const id = initialResource.ids[idx];
                        const unit = initialResource.units?.[idx];
                        if (unit) {
                            if (unit.isDamaged) return { serial, status: 'damaged' as UnitSt, id };
                            if (unit.isInUse) return { serial, status: 'in-use' as UnitSt, id };
                            return { serial, status: 'available' as UnitSt, id };
                        }
                        if (initialResource.availableIds && initialResource.availableIds.length > 0) {
                            if (id && availableIdSet.has(id)) return { serial, status: 'available' as UnitSt, id };
                            if (idx < damagedCnt) return { serial, status: 'damaged' as UnitSt, id };
                            return { serial, status: 'in-use' as UnitSt, id };
                        }
                        if (idx < availableCnt) return { serial, status: 'available' as UnitSt, id };
                        if (idx < availableCnt + damagedCnt) return { serial, status: 'damaged' as UnitSt, id };
                        return { serial, status: 'in-use' as UnitSt, id };
                    });
                    const avCnt  = unitSt.filter(u => u.status === 'available').length;
                    const iuCnt  = unitSt.filter(u => u.status === 'in-use').length;
                    const dmCnt  = unitSt.filter(u => u.status === 'damaged').length;
                    return (
                    <div style={sectionStyle}>
                        <div style={{ ...labelStyle, justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Hash size={12} />
                                {isServerGroup ? `Server Units (${serials.length})` : `Serial Numbers (${serials.length} units)`}
                            </span>
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#0ea5e9', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '20px', letterSpacing: '0.03em' }}>
                                Current status
                            </span>
                        </div>
                        {/* Status summary */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
                            {([{count:avCnt,st:'available'},{count:iuCnt,st:'in-use'},{count:dmCnt,st:'damaged'}] as const)
                              .filter(s => s.count > 0).map(s => { const sc = SERIAL_STATUS[s.st as UnitSt]; return (
                                <span key={s.st} style={{ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'0.67rem', fontWeight:800, padding:'3px 9px', borderRadius:'20px', color:sc.color, background:sc.bg, border:`1px solid ${sc.border}` }}>
                                    <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:sc.dot, display:'inline-block' }} />
                                    {s.count} {sc.label}
                                </span>
                            );})}
                        </div>
                        {/* Badge grid */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '160px', overflowY: 'auto' }} className="custom-scrollbar">
                            {unitSt.map(({ serial, status }, idx) => {
                                const sc = SERIAL_STATUS[status];
                                const isActive = canPickUnit && selectedSerial === serial;
                                return (
                                    <span key={idx} title={`${serial} — ${sc.label}${status === 'in-use' ? ' (checked out via active booking)' : status === 'damaged' ? ' (manually flagged as damaged)' : ' (no active booking)'}`}
                                        onClick={canPickUnit ? () => handleSelectSerial(serial) : undefined}
                                        style={{ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'0.7rem', fontWeight:700,
                                            fontFamily:'"Fira Code","Cascadia Code",monospace', padding:'4px 10px', borderRadius:'7px',
                                            color:sc.color, background:isActive ? sc.dot+'22' : sc.bg,
                                            border:isActive ? `2px solid ${sc.dot}` : `1px solid ${sc.border}`,
                                            cursor:canPickUnit?'pointer':'default', letterSpacing:'0.03em', whiteSpace:'nowrap',
                                            transition:'all 0.15s', boxShadow:isActive?`0 0 0 2px ${sc.dot}33`:'none' }}
                                    >
                                        <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:sc.dot, display:'inline-block', flexShrink:0 }} />
                                        {serial}
                                    </span>
                                );
                            })}
                        </div>

                        {canPickUnit && (
                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>
                                        {isServerGroup ? 'Unit Details' : 'Unit Details'}
                                    </div>
                                    {serialLoading && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-color)' }} />}
                                </div>

                                {!selectedSerial ? (
                                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                                        {isServerGroup
                                            ? 'Click a server unit above to view and edit its configuration.'
                                            : 'Click a serial number above to expand the update table.'}
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: '8px 12px' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>{isServerGroup ? 'Unit' : 'Serial'}</div>
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

                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>
                                            Unit Status
                                            <span style={{ marginLeft: '5px', fontSize: '0.62rem', fontWeight: 600, color: '#94a3b8', textTransform: 'none', letterSpacing: 0 }}>(manual overrides)</span>
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' as const }}>
                                                {/* Damaged toggle */}
                                                <div onClick={() => { if (canEdit) setIsDamaged(v => !v); }}
                                                    style={{ display:'flex', alignItems:'center', gap:'7px', cursor:canEdit?'pointer':'default' }}>
                                                    <div style={{ width:'36px', height:'20px', borderRadius:'10px', background:isDamaged?'#ef4444':'#e2e8f0', position:'relative', transition:'background 0.2s', cursor:canEdit?'pointer':'default', flexShrink:0 }}>
                                                        <div style={{ position:'absolute', top:'2px', left:isDamaged?'18px':'2px', width:'16px', height:'16px', borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
                                                    </div>
                                                    <span style={{ fontSize:'0.75rem', fontWeight:700, color:isDamaged?'#dc2626':'#94a3b8', padding:'2px 8px', borderRadius:'12px', background:isDamaged?'#fee2e2':'#f8fafc', border:`1px solid ${isDamaged?'#fca5a5':'#e2e8f0'}`, transition:'all 0.2s' }}>Damaged</span>
                                                </div>
                                                {/* In Use toggle */}
                                                <div onClick={() => { if (canEdit) setIsInUse(v => !v); }}
                                                    style={{ display:'flex', alignItems:'center', gap:'7px', cursor:canEdit?'pointer':'default' }}>
                                                    <div style={{ width:'36px', height:'20px', borderRadius:'10px', background:isInUse?'#f59e0b':'#e2e8f0', position:'relative', transition:'background 0.2s', cursor:canEdit?'pointer':'default', flexShrink:0 }}>
                                                        <div style={{ position:'absolute', top:'2px', left:isInUse?'18px':'2px', width:'16px', height:'16px', borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
                                                    </div>
                                                    <span style={{ fontSize:'0.75rem', fontWeight:700, color:isInUse?'#b45309':'#94a3b8', padding:'2px 8px', borderRadius:'12px', background:isInUse?'#fef9c3':'#f8fafc', border:`1px solid ${isInUse?'#fde68a':'#e2e8f0'}`, transition:'all 0.2s' }}>In Use</span>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '6px' }}>
                                                These flags are set manually — they persist independently of active booking sessions.
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    );
                })()}

                {/* Editable Details */}
                {!selectedSerial && (
                <div style={sectionStyle}>
                    <div style={labelStyle}><FileText size={12} /> {canEdit ? 'Editable Details' : 'Details'}</div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Name</label>
                        <input
                            style={{ ...inputStyle, ...(!canEdit ? { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' } : {}) }}
                            value={name}
                            onChange={e => { if (canEdit) { setName(e.target.value); onTitleChange?.(e.target.value || 'Resource'); } }}
                            readOnly={!canEdit}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Description</label>
                        <textarea
                            style={{
                                ...inputStyle, minHeight: '70px',
                                resize: canEdit ? 'vertical' as const : 'none' as const,
                                ...(!canEdit ? { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' } : {})
                            }}
                            value={description}
                            onChange={e => { if (canEdit) setDescription(e.target.value); }}
                            readOnly={!canEdit}
                            placeholder="Resource description..."
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}><MapPin size={12} /> Location</label>
                        <input
                            style={{ ...inputStyle, ...(!canEdit ? { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' } : {}) }}
                            value={location}
                            onChange={e => { if (canEdit) setLocation(e.target.value); }}
                            readOnly={!canEdit}
                            placeholder="Resource location..."
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}><Package size={12} /> Model / Series</label>
                        <input
                            style={{ ...inputStyle, ...(!canEdit ? { background: '#f8fafc', color: 'var(--text-secondary)', cursor: 'default' } : {}) }}
                            value={modelSeries}
                            onChange={e => { if (canEdit) setModelSeries(e.target.value); }}
                            readOnly={!canEdit}
                            placeholder="Resource model or series..."
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                    </div>

                    <div>
                        <label style={{ ...labelStyle, fontSize: '0.68rem' }}><Package size={12} /> Resource Type</label>
                        <TypeSelect
                            value={resourceTypeId}
                            onChange={v => { if (canEdit) setResourceTypeId(v); }}
                            options={resourceTypes.map(rt => ({ value: rt.id, label: rt.name }))}
                            isDisabled={!canEdit}
                        />
                    </div>
                </div>
                )}

                {/* Server Configuration (only for server/compute resource types) */}
                {isServerType && (isAssignee || isLabDirector) && (!isServerGroup || !!selectedSerial) && (
                <div style={sectionStyle}>
                    <div style={labelStyle}><Server size={12} /> SSH Connection</div>
                    {serverDetailLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', color: '#64748b', fontSize: '0.82rem' }}>
                            <Loader2 size={14} className="animate-spin" /> Loading server details…
                        </div>
                    ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px 12px', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Host *</label>
                        <input
                            style={inputStyle}
                            value={sshHost}
                            onChange={e => setSshHost(e.target.value)}
                            placeholder="e.g. 192.168.1.100"
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />

                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Port</label>
                        <input
                            style={{ ...inputStyle, width: '80px' }}
                            value={sshPort}
                            onChange={e => setSshPort(e.target.value)}
                            placeholder="22"
                            type="number"
                            min={1} max={65535}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />

                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Username *</label>
                        <input
                            style={inputStyle}
                            value={sshUsername}
                            onChange={e => setSshUsername(e.target.value)}
                            placeholder="e.g. ubuntu"
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />

                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>
                            <Key size={10} style={{ marginRight: 3 }} />Private Key
                        </label>
                        <div>
                            <textarea
                                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.75rem' }}
                                value={sshPrivateKey}
                                onChange={e => setSshPrivateKey(e.target.value)}
                                placeholder="Leave blank to keep existing private key"
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                            />
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Leave blank to keep existing private key unchanged.</div>
                        </div>
                    </div>
                    )}

                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                        <div style={{ ...labelStyle, marginBottom: '10px' }}><MemoryStick size={12} /> Hardware Specs</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                            <div>
                                <label style={{ ...labelStyle, fontSize: '0.65rem' }}><Monitor size={10} /> GPU Count</label>
                                <input
                                    style={inputStyle}
                                    value={gpuCount}
                                    onChange={e => setGpuCount(e.target.value)}
                                    placeholder="e.g. 2"
                                    type="number" min={0}
                                    onFocus={handleFocus}
                                    onBlur={handleBlur}
                                />
                            </div>
                            <div>
                                <label style={{ ...labelStyle, fontSize: '0.65rem' }}><Cpu size={10} /> CPU Cores</label>
                                <input
                                    style={inputStyle}
                                    value={cpuCores}
                                    onChange={e => setCpuCores(e.target.value)}
                                    placeholder="e.g. 16"
                                    type="number" min={0}
                                    onFocus={handleFocus}
                                    onBlur={handleBlur}
                                />
                            </div>
                            <div>
                                <label style={{ ...labelStyle, fontSize: '0.65rem' }}><MemoryStick size={10} /> RAM (GB)</label>
                                <input
                                    style={inputStyle}
                                    value={ramGb}
                                    onChange={e => setRamGb(e.target.value)}
                                    placeholder="e.g. 64"
                                    type="number" min={0}
                                    onFocus={handleFocus}
                                    onBlur={handleBlur}
                                />
                            </div>
                            <div>
                                <label style={{ ...labelStyle, fontSize: '0.65rem' }}><Users size={10} /> Max Concurrent Users</label>
                                <input
                                    style={inputStyle}
                                    value={maxConcurrentUsers}
                                    onChange={e => setMaxConcurrentUsers(e.target.value)}
                                    placeholder="e.g. 5"
                                    type="number" min={1}
                                    onFocus={handleFocus}
                                    onBlur={handleBlur}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ ...labelStyle, fontSize: '0.65rem' }}><Tag size={10} /> Model / Series</label>
                            <input
                                style={inputStyle}
                                value={serverModelSeries}
                                onChange={e => setServerModelSeries(e.target.value)}
                                placeholder="e.g. NVIDIA DGX A100"
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                            />
                        </div>
                    </div>
                </div>
                )}

                {/* Split / Add More Units */}
                {!allowSerialSelect && isServerType && isAssignee && isLabDirector && (
                <div style={{ ...sectionStyle, borderColor: 'rgba(124,58,237,0.2)' }}>
                    <div style={{ ...labelStyle, marginBottom: '4px' }}>
                        <Hash size={12} /> {isServerGroup ? 'Add More Units' : 'Split into Units'}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px', marginTop: 0 }}>
                        {isServerGroup
                            ? <>Add more units to the <strong>{initialResource.name}</strong> group. They will be numbered from #{initialResource.ids.length + 1}.</>
                            : <>Split this server into multiple units. The current server will be renamed to <strong>{name.trim() || 'Server'} #1</strong>.</>
                        }
                    </p>

                    {/* Count picker */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '12px' }}>
                        {(isServerGroup ? [1, 2, 4, 8] : [2, 4, 8]).map(n => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => { setSplitCount(n); setSplitCustom(''); setSplitError(''); }}
                                style={{
                                    padding: '7px 18px', borderRadius: '10px', fontWeight: 800, fontSize: '0.85rem',
                                    border: splitCount === n && !splitCustom ? '2px solid #7c3aed' : '1.5px solid var(--border-color)',
                                    background: splitCount === n && !splitCustom ? '#ede9fe' : '#fff',
                                    color: splitCount === n && !splitCustom ? '#7c3aed' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    boxShadow: splitCount === n && !splitCustom ? '0 0 0 3px rgba(124,58,237,0.12)' : 'none',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {isServerGroup ? `+${n}` : `×${n}`}
                            </button>
                        ))}
                        <input
                            style={{
                                ...inputStyle, width: '90px', padding: '7px 10px',
                                borderColor: splitCustom ? '#7c3aed' : undefined,
                                boxShadow: splitCustom ? '0 0 0 3px rgba(124,58,237,0.12)' : 'none',
                                fontWeight: 700, textAlign: 'center' as const,
                            }}
                            type="number" min={isServerGroup ? 1 : 2} max={64}
                            value={splitCustom}
                            placeholder="Custom"
                            onChange={e => {
                                setSplitCustom(e.target.value);
                                const n = parseInt(e.target.value, 10);
                                if (!isNaN(n) && n >= 1) setSplitCount(n);
                                setSplitError('');
                            }}
                            onFocus={handleFocus} onBlur={handleBlur}
                        />
                    </div>

                    {/* Private key — always required for creating new units */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ ...labelStyle, fontSize: '0.65rem' }}><Key size={10} /> SSH Private Key <span style={{ color: '#ef4444' }}>*</span></label>
                        <textarea
                            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' as const, fontFamily: 'monospace', fontSize: '0.75rem' }}
                            value={splitSshPrivateKey}
                            onChange={e => { setSplitSshPrivateKey(e.target.value); setSplitError(''); }}
                            placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..."
                            onFocus={handleFocus} onBlur={handleBlur}
                        />
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                            {isServerGroup
                                ? `SSH host/user will be copied from "${initialResource.name} #1". Only the private key is required.`
                                : 'Private key used to provision the new server units.'}
                        </div>
                    </div>

                    {/* Preview */}
                    {(isServerGroup ? initialResource.name : name.trim()) && (
                        <div style={{
                            background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '10px',
                            padding: '10px 14px', display: 'flex', flexWrap: 'wrap' as const, gap: '6px',
                            marginBottom: splitError ? '10px' : 0,
                        }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7c3aed', width: '100%', marginBottom: '4px' }}>
                                {isServerGroup ? `Adding ${splitCount} unit(s):` : `Will create ${splitCount} server(s):`}
                            </span>
                            {isServerGroup
                                ? Array.from({ length: Math.min(splitCount, 8) }, (_, i) => (
                                    <span key={i} style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6d28d9', background: '#ede9fe', padding: '2px 10px', borderRadius: 20, fontFamily: 'monospace' }}>
                                        {initialResource.name} #{initialResource.ids.length + i + 1}
                                    </span>
                                ))
                                : Array.from({ length: Math.min(splitCount, 8) }, (_, i) => (
                                    <span key={i} style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6d28d9', background: '#ede9fe', padding: '2px 10px', borderRadius: 20, fontFamily: 'monospace' }}>
                                        {name.trim()} #{i + 1}
                                    </span>
                                ))
                            }
                            {splitCount > 8 && (
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', alignSelf: 'center' }}>…+{splitCount - 8} more</span>
                            )}
                        </div>
                    )}

                    {splitError && (
                        <div style={{ fontSize: '0.78rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 12px', marginTop: '10px' }}>
                            {splitError}
                        </div>
                    )}
                </div>
                )}

                {/* Assign Manager */}
                {isLabDirector && (
                    <div style={sectionStyle}>
                        <div style={labelStyle}><UserCog size={12} /> Assign Manager</div>

                        {isServerGroup && !selectedSerial ? (
                            <div style={{ fontSize: '0.82rem', color: '#64748b', background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', border: '1px solid var(--border-light)' }}>
                                Select a unit above to assign a manager to that specific unit.
                            </div>
                        ) : (
                            <>
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
                                {targetResource.managerName && (
                                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#64748b' }}>
                                        Current: <strong style={{ color: '#1e293b' }}>{targetResource.managerName}</strong>
                                        {isServerGroup && selectedSerial && (
                                            <span style={{ color: '#94a3b8', marginLeft: '4px' }}>(this unit)</span>
                                        )}
                                    </div>
                                )}
                            </>
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
                    {canEdit && panelTab === 'details' && !allowSerialSelect && isServerType && isAssignee && isLabDirector && (
                        <button
                            onClick={handleSplit}
                            disabled={splitting || saving}
                            style={{
                                padding: '8px 20px', borderRadius: '10px', border: '2px solid #7c3aed',
                                background: (splitting || saving) ? '#f5f3ff' : '#ede9fe',
                                color: (splitting || saving) ? '#a78bfa' : '#7c3aed',
                                cursor: (splitting || saving) ? 'not-allowed' : 'pointer',
                                fontSize: '0.8rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: '6px',
                                transition: 'all 0.2s',
                            }}
                        >
                            {splitting ? <Loader2 size={14} className="animate-spin" /> : <Hash size={14} />}
                            Split × {splitCount}
                        </button>
                    )}
                    {canEdit && panelTab === 'details' && (
                        <button
                            onClick={handleSave}
                            disabled={saving || serialLoading || splitting}
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
