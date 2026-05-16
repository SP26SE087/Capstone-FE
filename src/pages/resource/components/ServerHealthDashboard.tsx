import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Wifi, WifiOff, Activity, RefreshCw, Server, MapPin, Cpu,
    MemoryStick, Monitor, Loader2, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { computeService, AllServerHealthStatus, ServerResourceHealthItem } from '@/services/computeService';

type FilterTab = 'all' | 'online' | 'offline';

const ServerHealthDashboard: React.FC = () => {
    const [data, setData] = useState<AllServerHealthStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterTab>('all');
    const [recheckingId, setRecheckingId] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchAll = useCallback(async (isManual = false) => {
        if (isManual) setRefreshing(true);
        setError(null);
        try {
            const result = await computeService.getAllResourcesHealth();
            setData(result);
            setLastRefreshed(new Date());
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to fetch server health status.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
        intervalRef.current = setInterval(() => fetchAll(), 30_000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [fetchAll]);

    const handleRecheck = async (resourceId: string) => {
        setRecheckingId(resourceId);
        try {
            const updated = await computeService.getResourceHealth(resourceId);
            setData(prev => {
                if (!prev) return prev;
                const resources = prev.resources.map(r => r.resourceId === resourceId ? updated : r);
                const online = resources.filter(r => r.isOnline).length;
                return { ...prev, online, offline: resources.length - online, resources };
            });
        } catch {
            // silently ignore
        } finally {
            setRecheckingId(null);
        }
    };

    const filtered = data?.resources.filter(r => {
        if (filter === 'online') return r.isOnline;
        if (filter === 'offline') return !r.isOnline;
        return true;
    }) ?? [];

    const onlineRate = data ? Math.round((data.online / Math.max(data.total, 1)) * 100) : 0;

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '5rem' }}>
            <Loader2 size={30} className="animate-spin" style={{ color: '#7c3aed' }} />
        </div>
    );

    if (error) return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px',
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px',
            fontSize: '0.85rem', color: '#dc2626',
        }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            {error}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* ── Summary cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {[
                    {
                        label: 'Total Servers', value: data?.total ?? 0,
                        color: '#7c3aed', bg: '#f5f3ff', border: '#e9d5ff',
                        icon: <Server size={16} />,
                    },
                    {
                        label: 'Online', value: data?.online ?? 0,
                        color: '#059669', bg: '#ecfdf5', border: '#a7f3d0',
                        icon: <Wifi size={16} />,
                    },
                    {
                        label: 'Offline', value: data?.offline ?? 0,
                        color: '#dc2626', bg: '#fef2f2', border: '#fecaca',
                        icon: <WifiOff size={16} />,
                    },
                    {
                        label: 'Uptime Rate', value: `${onlineRate}%`,
                        color: onlineRate >= 80 ? '#059669' : onlineRate >= 50 ? '#d97706' : '#dc2626',
                        bg: onlineRate >= 80 ? '#ecfdf5' : onlineRate >= 50 ? '#fffbeb' : '#fef2f2',
                        border: onlineRate >= 80 ? '#a7f3d0' : onlineRate >= 50 ? '#fde68a' : '#fecaca',
                        icon: <Activity size={16} />,
                    },
                ].map(card => (
                    <div key={card.label} style={{
                        padding: '14px 16px', borderRadius: '12px',
                        background: card.bg, border: `1px solid ${card.border}`,
                        display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                        <div style={{
                            width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                            background: `${card.color}15`, color: card.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {card.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                                {card.label}
                            </div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: card.color, lineHeight: 1.2 }}>
                                {card.value}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Uptime bar ── */}
            {data && data.total > 0 && (
                <div>
                    <div style={{ height: '6px', borderRadius: '999px', background: '#fee2e2', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: '999px',
                            width: `${onlineRate}%`,
                            background: onlineRate >= 80 ? '#10b981' : onlineRate >= 50 ? '#f59e0b' : '#ef4444',
                            transition: 'width 0.4s ease',
                        }} />
                    </div>
                </div>
            )}

            {/* ── Toolbar: filter tabs + refresh ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
                    {([
                        { key: 'all', label: `All (${data?.total ?? 0})` },
                        { key: 'online', label: `Online (${data?.online ?? 0})`, color: '#059669' },
                        { key: 'offline', label: `Offline (${data?.offline ?? 0})`, color: '#dc2626' },
                    ] as { key: FilterTab; label: string; color?: string }[]).map(tab => {
                        const active = filter === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setFilter(tab.key)}
                                style={{
                                    padding: '5px 14px', borderRadius: '7px', border: 'none',
                                    fontSize: '0.75rem', fontWeight: active ? 700 : 500,
                                    background: active ? '#fff' : 'transparent',
                                    color: active ? (tab.color ?? '#1e293b') : '#64748b',
                                    cursor: 'pointer',
                                    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {lastRefreshed && (
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                            Updated {lastRefreshed.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={() => fetchAll(true)}
                        disabled={refreshing}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
                            background: '#fff', color: refreshing ? '#94a3b8' : '#475569',
                            fontSize: '0.75rem', fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        {refreshing ? 'Refreshing…' : 'Refresh All'}
                    </button>
                </div>
            </div>

            {/* ── Resource list ── */}
            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                    <CheckCircle2 size={36} style={{ opacity: 0.25, marginBottom: '10px', display: 'block', margin: '0 auto 10px' }} />
                    No {filter !== 'all' ? filter : ''} servers found.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filtered.map(r => <ResourceHealthCard key={r.resourceId} item={r} onRecheck={handleRecheck} recheckingId={recheckingId} />)}
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes healthPulse { 0% { transform: scale(1); opacity: 0.35; } 70% { transform: scale(2.8); opacity: 0; } 100% { transform: scale(2.8); opacity: 0; } }
            `}</style>
        </div>
    );
};

// ── Per-resource health card ──────────────────────────────────────────────────
const ResourceHealthCard: React.FC<{
    item: ServerResourceHealthItem;
    onRecheck: (id: string) => void;
    recheckingId: string | null;
}> = ({ item, onRecheck, recheckingId }) => {
    const isRechecking = recheckingId === item.resourceId;

    const latencyColor = item.latencyMs == null ? '#94a3b8'
        : item.latencyMs < 100 ? '#059669'
        : item.latencyMs < 300 ? '#d97706'
        : '#dc2626';

    return (
        <div style={{
            padding: '14px 16px', borderRadius: '12px',
            border: `1px solid ${item.isOnline ? '#e9d5ff' : '#fecaca'}`,
            background: item.isOnline ? '#fefefe' : '#fff',
            display: 'flex', alignItems: 'center', gap: '14px',
            transition: 'box-shadow 0.15s',
        }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
        >
            {/* Status dot */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: item.isOnline ? '#10b981' : '#ef4444',
                }} />
                {item.isOnline && (
                    <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: '#10b981', opacity: 0.35,
                        animation: 'healthPulse 2.5s ease-out infinite',
                    }} />
                )}
            </div>

            {/* Icon */}
            <div style={{
                width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
                background: item.isOnline ? '#f5f3ff' : '#fef2f2',
                color: item.isOnline ? '#7c3aed' : '#dc2626',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Server size={16} />
            </div>

            {/* Main info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                        {item.resourceName}
                    </span>
                    <span style={{
                        fontSize: '0.65rem', fontWeight: 700,
                        color: item.isOnline ? '#059669' : '#dc2626',
                        background: item.isOnline ? '#ecfdf5' : '#fef2f2',
                        border: `1px solid ${item.isOnline ? '#a7f3d0' : '#fecaca'}`,
                        padding: '1px 8px', borderRadius: 20,
                        display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                        {item.isOnline ? <Wifi size={9} /> : <WifiOff size={9} />}
                        {item.isOnline ? 'Online' : 'Offline'}
                    </span>
                    {item.isOnline && item.latencyMs != null && (
                        <span style={{
                            fontSize: '0.65rem', fontWeight: 700,
                            color: latencyColor,
                            background: '#f8fafc', border: '1px solid #e2e8f0',
                            padding: '1px 8px', borderRadius: 20,
                            display: 'flex', alignItems: 'center', gap: '3px',
                        }}>
                            <Activity size={9} /> {item.latencyMs}ms
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' as const }}>
                    {/* Host */}
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
                        {item.host}:{item.port}
                    </span>

                    {/* Location */}
                    {item.location && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: '#64748b' }}>
                            <MapPin size={10} /> {item.location}
                        </span>
                    )}

                    {/* Hardware specs */}
                    {(item.gpuCount != null || item.cpuCores != null || item.ramGb != null) && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {item.gpuCount != null && item.gpuCount > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: '#7c3aed', fontWeight: 600 }}>
                                    <Monitor size={10} /> {item.gpuCount} GPU
                                </span>
                            )}
                            {item.cpuCores != null && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: '#0284c7', fontWeight: 600 }}>
                                    <Cpu size={10} /> {item.cpuCores}C
                                </span>
                            )}
                            {item.ramGb != null && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: '#0891b2', fontWeight: 600 }}>
                                    <MemoryStick size={10} /> {item.ramGb}GB
                                </span>
                            )}
                        </div>
                    )}

                    {/* Model */}
                    {item.modelSeries && (
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{item.modelSeries}</span>
                    )}

                    {/* Offline message */}
                    {!item.isOnline && (
                        <span style={{ fontSize: '0.68rem', color: '#ef4444', fontStyle: 'italic' }}>
                            {item.message}
                        </span>
                    )}
                </div>
            </div>

            {/* Last checked + recheck button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
                <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                    {new Date(item.checkedAtUtc).toLocaleTimeString()}
                </span>
                <button
                    onClick={() => onRecheck(item.resourceId)}
                    disabled={isRechecking}
                    title="Re-check this server"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '4px 10px', borderRadius: '6px',
                        border: '1px solid #e2e8f0', background: '#fff',
                        color: isRechecking ? '#94a3b8' : '#475569',
                        fontSize: '0.68rem', fontWeight: 600,
                        cursor: isRechecking ? 'not-allowed' : 'pointer',
                    }}
                >
                    <RefreshCw size={10} style={{ animation: isRechecking ? 'spin 1s linear infinite' : 'none' }} />
                    {isRechecking ? 'Checking…' : 'Recheck'}
                </button>
            </div>
        </div>
    );
};

export default ServerHealthDashboard;
