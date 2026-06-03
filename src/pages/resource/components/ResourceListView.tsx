import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Resource } from '@/types/booking';
import { Box, Cpu, Package, MapPin, ChevronRight, UserCog, Server, Wifi, WifiOff, Activity, RefreshCw } from 'lucide-react';
import { ResourceTypeItem, ResourceTypeCategory } from '@/services/resourceTypeService';
import { computeService, ServerResourceHealthItem } from '@/services/computeService';

interface ResourceListViewProps {
    resources: Resource[];
    selectedId: string | null;
    onSelect: (resource: Resource) => void;
    onBook?: (resource: Resource) => void;
    isSplit?: boolean;
    resourceTypes?: ResourceTypeItem[];
}

const SECTION_CFG = {
    server: {
        label: 'Server / Compute',
        color: '#7c3aed',
        bg: '#f5f3ff',
        border: '#e9d5ff',
        icon: <Server size={11} />,
        cardIcon: <Cpu size={14} />,
    },
    physical: {
        label: 'Physical',
        color: '#0284c7',
        bg: '#f0f9ff',
        border: '#bae6fd',
        icon: <Box size={11} />,
        cardIcon: <Box size={14} />,
    },
};

type UnitStatus = 'available' | 'in-use' | 'damaged';

const STATUS_CFG: Record<UnitStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
    available: { label: 'Available', color: '#16a34a', bg: '#dcfce7', border: '#86efac', dot: '#22c55e' },
    'in-use':  { label: 'In Use',    color: '#b45309', bg: '#fef9c3', border: '#fde68a', dot: '#f59e0b' },
    damaged:   { label: 'Damaged',   color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', dot: '#ef4444' },
};

const ResourceListView: React.FC<ResourceListViewProps> = ({
    resources,
    selectedId,
    onSelect,
    onBook: _onBook,
    isSplit: _isSplit = false,
    resourceTypes = [],
}) => {
    const [activeTab, setActiveTab] = useState<'server' | 'physical'>('server');

    // ── Health status for server resources ──────────────────────────────────
    const [healthMap, setHealthMap] = useState<Map<string, ServerResourceHealthItem>>(new Map());
    const [healthLoading, setHealthLoading] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchHealth = useCallback(async () => {
        setHealthLoading(true);
        try {
            const result = await computeService.getAllResourcesHealth();
            const map = new Map<string, ServerResourceHealthItem>();
            result.resources.forEach(r => map.set(r.resourceId, r));
            setHealthMap(map);
        } catch {
            // silently ignore if endpoint unavailable
        } finally {
            setHealthLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHealth();
        intervalRef.current = setInterval(fetchHealth, 30_000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [fetchHealth]);

    if (resources.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
                <Package size={48} style={{ display: 'block', margin: '0 auto 1.5rem', opacity: 0.3 }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>No Resources</h3>
                <p style={{ fontSize: '0.85rem' }}>No resources found matching your criteria.</p>
            </div>
        );
    }

    const serverResources = resources.filter(r => {
        const rt = resourceTypes.find(t => t.id === r.resourceTypeId);
        return rt?.category === ResourceTypeCategory.ServerCompute;
    });
    const physicalResources = resources.filter(r => {
        const rt = resourceTypes.find(t => t.id === r.resourceTypeId);
        return rt?.category !== ResourceTypeCategory.ServerCompute;
    });

    // Aggregate health for a (possibly grouped) server resource
    const getResourceHealth = (resource: Resource): ServerResourceHealthItem | null => {
        // Check all unit IDs; return the first match (grouped resources share the same server)
        for (const id of resource.ids) {
            const h = healthMap.get(id);
            if (h) return h;
        }
        return null;
    };

    // Summary counts for server tab
    const serverOnline  = serverResources.filter(r => getResourceHealth(r)?.isOnline === true).length;
    const serverOffline = serverResources.filter(r => {
        const h = getResourceHealth(r);
        return h !== null && !h.isOnline;
    }).length;

    const renderCard = (resource: Resource) => {
        const isSelected = resource.id === selectedId;
        const rt = resourceTypes.find(t => t.id === resource.resourceTypeId);
        const isServer = rt?.category === ResourceTypeCategory.ServerCompute;
        const cfg = isServer ? SECTION_CFG.server : SECTION_CFG.physical;

        const total        = Math.max(resource.totalQuantity || 0, 1);
        const availableCount = resource.availableQuantity ?? 0;
        const damagedCount   = resource.damagedQuantity ?? 0;
        const inUseCount     = resource.inUseCount ?? Math.max(0, total - availableCount - damagedCount);


        const health = isServer ? getResourceHealth(resource) : null;
        const latencyColor = health?.latencyMs == null ? '#94a3b8'
            : health.latencyMs < 100 ? '#059669'
            : health.latencyMs < 300 ? '#d97706'
            : '#dc2626';

        return (
            <div
                key={resource.id}
                onClick={() => onSelect(resource)}
                style={{
                    padding: '11px 12px',
                    borderRadius: '12px',
                    border: isSelected ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                    background: isSelected ? 'var(--accent-bg)' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                }}
            >
                {/* ── Top row: icon + name + overall status badge ── */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: cfg.bg, color: cfg.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        {cfg.cardIcon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Name + now-status + connectivity badge */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' as const }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', wordBreak: 'break-word', flex: 1 }}>
                                {resource.name}
                            </div>
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
                                {/* Connectivity badge — server only */}
                                {isServer && health && (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                                        fontSize: '0.62rem', fontWeight: 700,
                                        color: health.isOnline ? '#059669' : '#dc2626',
                                        background: health.isOnline ? '#ecfdf5' : '#fef2f2',
                                        border: `1px solid ${health.isOnline ? '#a7f3d0' : '#fecaca'}`,
                                        padding: '1px 7px', borderRadius: 20,
                                        whiteSpace: 'nowrap' as const,
                                    }}>
                                        {/* Pulsing dot */}
                                        <span style={{ position: 'relative', width: '6px', height: '6px', flexShrink: 0 }}>
                                            <span style={{
                                                position: 'absolute', inset: 0, borderRadius: '50%',
                                                background: health.isOnline ? '#10b981' : '#ef4444',
                                            }} />
                                            {health.isOnline && (
                                                <span style={{
                                                    position: 'absolute', inset: 0, borderRadius: '50%',
                                                    background: '#10b981', opacity: 0.4,
                                                    animation: 'healthPulse 2.5s ease-out infinite',
                                                }} />
                                            )}
                                        </span>
                                        {health.isOnline ? 'Online' : 'Offline'}
                                        {health.isOnline && health.latencyMs != null && (
                                            <span style={{ color: latencyColor, marginLeft: '1px' }}>· {health.latencyMs}ms</span>
                                        )}
                                    </span>
                                )}
                                {/* Damaged count pill — always visible */}
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    fontSize: '0.65rem', fontWeight: 800,
                                    padding: '2px 8px', borderRadius: '20px',
                                    color: STATUS_CFG.damaged.color,
                                    background: STATUS_CFG.damaged.bg,
                                    border: `1px solid ${STATUS_CFG.damaged.border}`,
                                    whiteSpace: 'nowrap' as const,
                                }}>
                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: STATUS_CFG.damaged.dot, display: 'inline-block' }} />
                                    {damagedCount} Damaged
                                </span>
                            </div>
                        </div>

                        {/* Meta: type badge + location + manager */}
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' as const }}>
                            <span style={{
                                fontSize: '0.6rem', fontWeight: 700,
                                color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
                                padding: '1px 7px', borderRadius: '999px', whiteSpace: 'nowrap' as const,
                            }}>
                                {resource.resourceTypeName || 'Resource'}
                            </span>
                            {resource.location && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: '#64748b' }}>
                                    <MapPin size={11} /> {resource.location}
                                </span>
                            )}
                            {resource.managerName && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600, color: '#475569', fontSize: '0.68rem' }}>
                                    <UserCog size={11} /> {resource.managerName}
                                </span>
                            )}
                            {/* Host (server only, no health loaded yet → show nothing) */}
                            {isServer && health && (
                                <span style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: '#94a3b8' }}>
                                    {health.host}:{health.port}
                                </span>
                            )}
                        </div>
                    </div>

                    <div style={{
                        width: '28px', height: '28px', borderRadius: '999px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isSelected ? 'rgba(232,114,12,0.15)' : '#f8fafc',
                        border: isSelected ? '1px solid rgba(232,114,12,0.35)' : '1px solid #e2e8f0',
                        marginTop: '2px', flexShrink: 0,
                    }}>
                        <ChevronRight size={15} style={{ color: isSelected ? 'var(--accent-color)' : '#94a3b8' }} />
                    </div>
                </div>

                {/* ── Stats summary line ── */}
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const, fontSize: '0.72rem', fontWeight: 700 }}>
                    <span style={{ color: '#475569' }}>Total {total}</span>
                    <span style={{ color: '#cbd5e1' }}>·</span>
                    <span style={{ color: '#16a34a' }}>{availableCount} avail</span>
                    <span style={{ color: '#cbd5e1' }}>·</span>
                    <span style={{ color: '#b45309' }}>{inUseCount} in use</span>
                    <span style={{ color: '#cbd5e1' }}>·</span>
                    <span style={{ color: '#dc2626' }}>{damagedCount} damaged</span>
                </div>
            </div>
        );
    };

    const visibleList = activeTab === 'server' ? serverResources : physicalResources;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Category toggle */}
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
                {(['server', 'physical'] as const).map(tab => {
                    const cfg = SECTION_CFG[tab];
                    const count = tab === 'server' ? serverResources.length : physicalResources.length;
                    const active = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '6px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                                fontSize: '0.75rem', fontWeight: active ? 700 : 500,
                                background: active ? '#fff' : 'transparent',
                                color: active ? cfg.color : '#64748b',
                                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            <div style={{
                                width: '16px', height: '16px', borderRadius: '4px',
                                background: active ? cfg.bg : 'transparent',
                                color: active ? cfg.color : '#94a3b8',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                            }}>
                                {cfg.icon}
                            </div>
                            {cfg.label}
                            <span style={{
                                fontSize: '0.62rem', fontWeight: 800, minWidth: '16px', height: '16px',
                                borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                padding: '0 4px',
                                background: active ? cfg.color : '#e2e8f0',
                                color: active ? '#fff' : '#64748b',
                                transition: 'all 0.15s',
                            }}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>



            {/* Resource cards */}
            {visibleList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                    No {SECTION_CFG[activeTab].label} resources found.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {visibleList.map(renderCard)}
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes healthPulse { 0% { transform: scale(1); opacity: 0.4; } 70% { transform: scale(2.8); opacity: 0; } 100% { transform: scale(2.8); opacity: 0; } }
            `}</style>
        </div>
    );
};

export default ResourceListView;
