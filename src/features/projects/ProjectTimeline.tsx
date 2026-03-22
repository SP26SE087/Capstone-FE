import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Project, Milestone, MilestoneStatus, Task, TaskStatus } from '@/types';
import { ChevronRight, ChevronDown, CalendarClock, Clock, CheckCircle2, Circle, AlertTriangle, Loader2 } from 'lucide-react';
import { formatProjectDate } from '@/utils/projectUtils';

export interface TimelineData {
    milestones: Array<{
        milestone: Milestone;
        tasks: Task[];
    }>;
    generalTasks: Task[];
}

interface ProjectTimelineProps {
    project: Project;
    timelineData: TimelineData | null;
    onTaskClick: (task: Task) => void;
    onMilestoneClick: (milestone: Milestone) => void;
}

// ── Helper: Task status config ──
const getTaskStatusConfig = (status: TaskStatus) => {
    switch (status) {
        case TaskStatus.Todo: return { color: '#64748b', bg: '#f1f5f9', gradient: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', label: 'Draft', icon: Circle };
        case TaskStatus.InProgress: return { color: '#2563eb', bg: '#eff6ff', gradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', label: 'On-going', icon: Loader2 };
        case TaskStatus.Submitted: return { color: '#7c3aed', bg: '#f5f3ff', gradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', label: 'Submitted', icon: Clock };
        case TaskStatus.Missed: return { color: '#ef4444', bg: '#fef2f2', gradient: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', label: 'Missed', icon: AlertTriangle };
        case TaskStatus.Adjusting: return { color: '#ea580c', bg: '#fff7ed', gradient: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', label: 'Adjusting', icon: Loader2 };
        case TaskStatus.Completed: return { color: '#059669', bg: '#ecfdf5', gradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', label: 'Completed', icon: CheckCircle2 };
        default: return { color: '#64748b', bg: '#f1f5f9', gradient: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', label: 'Unknown', icon: Circle };
    }
};

const getMilestoneStatusConfig = (status: MilestoneStatus) => {
    switch (status) {
        case MilestoneStatus.NotStarted: return { color: '#94a3b8', bg: '#f8fafc', label: 'Not Started', barGradient: 'linear-gradient(135deg, rgba(148,163,184,0.12) 0%, rgba(148,163,184,0.04) 100%)' };
        case MilestoneStatus.InProgress: return { color: '#E8720C', bg: '#fff7ed', label: 'In Progress', barGradient: 'linear-gradient(135deg, rgba(232,114,12,0.12) 0%, rgba(232,114,12,0.03) 100%)' };
        case MilestoneStatus.Completed: return { color: '#059669', bg: '#ecfdf5', label: 'Completed', barGradient: 'linear-gradient(135deg, rgba(5,150,105,0.12) 0%, rgba(5,150,105,0.03) 100%)' };
        case MilestoneStatus.OnHold: return { color: '#eab308', bg: '#fefce8', label: 'On Hold', barGradient: 'linear-gradient(135deg, rgba(234,179,8,0.12) 0%, rgba(234,179,8,0.03) 100%)' };
        case MilestoneStatus.Cancelled: return { color: '#ef4444', bg: '#fef2f2', label: 'Cancelled', barGradient: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.03) 100%)' };
        default: return { color: '#94a3b8', bg: '#f8fafc', label: 'Unknown', barGradient: 'linear-gradient(135deg, rgba(148,163,184,0.1) 0%, rgba(148,163,184,0.03) 100%)' };
    }
};

const ProjectTimeline: React.FC<ProjectTimelineProps> = ({
    project,
    timelineData,
    onTaskClick
}) => {
    const zoomLevel = 8;
    const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
    const hasInitialFocused = useRef(false);
    const [isOrphanExpanded, setIsOrphanExpanded] = useState(false);
    const [hoverInfo, setHoverInfo] = useState<{ task: Task; x: number; y: number } | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const isDragging = useRef(false);
    const startX = useRef(0);
    const startY = useRef(0);
    const scrollLeftRef = useRef(0);
    const scrollTopRef = useRef(0);
    const [cursor, setCursor] = useState<'grab' | 'grabbing'>('grab');

    const toggleMilestone = (id: string) => {
        const next = new Set(expandedMilestones);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedMilestones(next);
    };

    const scrollToMilestone = (x: number) => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ left: x - 100, behavior: 'smooth' });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        setCursor('grabbing');
        startX.current = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
        startY.current = e.pageY - (scrollContainerRef.current?.offsetTop || 0);
        scrollLeftRef.current = scrollContainerRef.current?.scrollLeft || 0;
        scrollTopRef.current = scrollContainerRef.current?.scrollTop || 0;
    };

    const handleMouseUp = () => { isDragging.current = false; setCursor('grab'); };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - (scrollContainerRef.current.offsetLeft || 0);
        const y = e.pageY - (scrollContainerRef.current.offsetTop || 0);
        scrollContainerRef.current.scrollLeft = scrollLeftRef.current - (x - startX.current) * 1.5;
        scrollContainerRef.current.scrollTop = scrollTopRef.current - (y - startY.current) * 1.5;
    };

    // ── Data Processing ──
    const activeMilestonesData = useMemo(() => {
        if (!timelineData?.milestones) return [];
        return timelineData.milestones
            .filter(item => {
                const m = item.milestone;
                if (!m) return false;
                return m.status >= MilestoneStatus.InProgress || (item.tasks || []).some(t => t.status >= TaskStatus.InProgress);
            })
            .sort((a, b) => new Date(a.milestone.startDate || "").getTime() - new Date(b.milestone.startDate || "").getTime());
    }, [timelineData]);

    const activeOrphanTasks = useMemo(() => {
        if (!timelineData?.generalTasks) return [];
        return timelineData.generalTasks.filter(t => t.status >= TaskStatus.InProgress);
    }, [timelineData]);

    const allActiveTasks = useMemo(() => {
        return [...activeMilestonesData.flatMap(item => item.tasks.filter(t => t.status >= TaskStatus.InProgress)), ...activeOrphanTasks];
    }, [activeMilestonesData, activeOrphanTasks]);

    // ── Timeline Range ──
    const range = useMemo(() => {
        const allDates = [
            new Date(project.startDate || ""), new Date(project.endDate || ""),
            ...(timelineData?.milestones.flatMap(item => [new Date(item.milestone.startDate || ""), new Date(item.milestone.dueDate || "")]) || []),
            ...(timelineData?.milestones.flatMap(item => item.tasks.flatMap(t => [new Date(t.startDate || ""), new Date(t.dueDate || "")])) || []),
            ...(timelineData?.generalTasks.flatMap(t => [new Date(t.startDate || ""), new Date(t.dueDate || "")]) || [])
        ].filter(d => !isNaN(d.getTime()));

        if (allDates.length === 0) return { start: Date.now(), end: Date.now() + 86400000, duration: 86400000 };

        const start = new Date(Math.min(...allDates.map(d => d.getTime())));
        start.setMonth(start.getMonth() - 1); // Add a 1-month logical padding to the start
        start.setDate(1);
        const end = new Date(Math.max(...allDates.map(d => d.getTime())));
        end.setMonth(end.getMonth() + 4);
        end.setDate(0);

        return { start: start.getTime(), end: end.getTime(), duration: Math.max(1, end.getTime() - start.getTime()) };
    }, [project, activeMilestonesData, allActiveTasks]);

    const days = range.duration / (24 * 60 * 60 * 1000);
    const contentWidth = Math.max(1400, days * zoomLevel);
    const leftSidebarWidth = 230;

    const months = useMemo(() => {
        const result = [];
        let curr = new Date(range.start);
        while (curr.getTime() <= range.end) { result.push(new Date(curr)); curr.setMonth(curr.getMonth() + 1); }
        return result;
    }, [range]);

    // ── Today position ──
    const todayX = ((Date.now() - range.start) / range.duration) * contentWidth;

    // ── Auto-Focus ──
    useEffect(() => {
        if (!timelineData || hasInitialFocused.current || timelineData.milestones.length === 0) return;

        const inProgress = timelineData.milestones.filter(m => m.milestone.status === MilestoneStatus.InProgress);
        const completed = timelineData.milestones.filter(m => m.milestone.status === MilestoneStatus.Completed);

        let targetId: string | null = null;
        let expandIds: string[] = [];

        if (inProgress.length > 0) {
            expandIds = inProgress.map(m => m.milestone.id);
            const now = Date.now();
            targetId = inProgress.sort((a, b) =>
                Math.abs(new Date(a.milestone.startDate || "").getTime() - now) - Math.abs(new Date(b.milestone.startDate || "").getTime() - now)
            )[0].milestone.id;
        } else if (completed.length > 0) {
            expandIds = completed.map(m => m.milestone.id);
            targetId = completed.sort((a, b) =>
                new Date(b.milestone.dueDate || "").getTime() - new Date(a.milestone.dueDate || "").getTime()
            )[0].milestone.id;
        }

        if (expandIds.length > 0) {
            setExpandedMilestones(new Set(expandIds));
            hasInitialFocused.current = true;
            if (targetId) {
                const mData = timelineData.milestones.find(m => m.milestone.id === targetId);
                if (mData) {
                    const x = ((new Date(mData.milestone.startDate || mData.milestone.dueDate || "").getTime() - range.start) / range.duration) * contentWidth;
                    setTimeout(() => scrollToMilestone(x), 150);
                }
            }
        }
    }, [timelineData, range, contentWidth]);

    if (!timelineData) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading timeline mapping...</div>;
    }

    if (activeMilestonesData.length === 0 && activeOrphanTasks.length === 0) {
        return (
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '5rem 2rem', background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
                borderRadius: '24px', border: '1.5px solid #e2e8f0', margin: '1.5rem 0',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'rgba(232,114,12,0.03)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '-30px', left: '-30px', width: '120px', height: '120px', background: 'rgba(59,130,246,0.03)', borderRadius: '50%' }} />
                <div style={{
                    width: '90px', height: '90px', borderRadius: '24px', background: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8720C',
                    marginBottom: '1.5rem', boxShadow: '0 15px 30px -10px rgba(232,114,12,0.2)',
                    border: '1px solid rgba(232,114,12,0.1)', animation: 'floatIcon 3s ease-in-out infinite'
                }}>
                    <CalendarClock size={42} strokeWidth={1.5} />
                </div>
                <h3 style={{ margin: '0 0 0.75rem', color: '#1e293b', fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.025em' }}>No Roadmap Content Found</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem', textAlign: 'center', maxWidth: '480px', lineHeight: 1.7, fontWeight: 500 }}>
                    {timelineData.milestones.length > 0 || timelineData.generalTasks.length > 0
                        ? "Your roadmap is currently in a setup phase. Complete the initialization of your milestones or start tracking activities to see them populated here."
                        : "Start defining your research journey. Once you add milestones and trackable activities, a visual timeline of your project's progress will appear."}
                </p>
                <style>{`@keyframes floatIcon { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }`}</style>
            </div>
        );
    }

    const isNearDeadline = (task: Task) => {
        if (!task.dueDate) return false;
        if (task.status === TaskStatus.Completed || task.status === TaskStatus.Submitted) return false;
        const diffDays = (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return diffDays <= 3;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', height: '100%', position: 'relative' }}>
            <style>{`
                @keyframes warningBlink {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.3); }
                }
            `}</style>
            <div className="card" style={{
                padding: 0, maxHeight: '480px', minHeight: '220px', width: '100%',
                display: 'flex', flexDirection: 'column',
                border: '1px solid #e2e8f0', borderRadius: '20px', background: 'white',
                boxShadow: '0 4px 30px -8px rgba(0,0,0,0.08)', cursor: cursor
            }}>
                <div
                    ref={scrollContainerRef}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseUp}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    className="custom-scrollbar-thin"
                    style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', WebkitOverflowScrolling: 'touch' }}
                >
                    <div style={{
                        width: 'fit-content', minWidth: '100%', position: 'relative',
                        display: 'flex', flexDirection: 'column', minHeight: '300px',
                        userSelect: isDragging.current ? 'none' : 'auto'
                    }}>

                        {/* ─── STICKY HEADER RULER ─── */}
                        <div style={{
                            position: 'sticky', top: 0, zIndex: 400,
                            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                            display: 'flex', flexDirection: 'column',
                            boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)',
                            borderBottom: '1px solid #e2e8f0'
                        }}>
                            <div style={{ display: 'flex', height: '36px', position: 'relative', zIndex: 60 }}>
                                {/* Sidebar label */}
                                <div style={{
                                    width: `${leftSidebarWidth}px`, background: '#f8fafc',
                                    borderRight: '1px solid #e2e8f0', position: 'sticky', left: 0, zIndex: 410,
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '0 14px'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Workspace</div>
                                        <div style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 900, textTransform: 'uppercase' }}>Roadmap</div>
                                    </div>
                                    <div style={{
                                        fontSize: '0.55rem', fontWeight: 800, color: '#ef4444', background: '#fef2f2',
                                        padding: '2px 6px', borderRadius: '4px', border: '1px solid #fecaca'
                                    }}>
                                        TODAY
                                    </div>
                                </div>
                                {/* Month labels */}
                                <div style={{ width: `${contentWidth}px`, flexShrink: 0, position: 'relative' }}>
                                    {months.map((d, i) => {
                                        const left = ((d.getTime() - range.start) / range.duration) * contentWidth;
                                        const isCurrentMonth = d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
                                        return (
                                            <div key={i} style={{
                                                position: 'absolute', left: `${left}px`,
                                                fontSize: '0.7rem', fontWeight: isCurrentMonth ? 900 : 700,
                                                color: isCurrentMonth ? '#E8720C' : '#64748b',
                                                height: '100%', display: 'flex', alignItems: 'center',
                                                borderLeft: `1px solid ${isCurrentMonth ? '#E8720C' : '#e2e8f0'}`,
                                                paddingLeft: '8px'
                                            }}>
                                                {d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                                            </div>
                                        );
                                    })}
                                    {/* Today line on ruler */}
                                    <div style={{
                                        position: 'absolute', left: `${todayX}px`, top: 0, bottom: 0,
                                        width: '2px', background: '#ef4444', zIndex: 100
                                    }} />
                                </div>
                            </div>
                        </div>

                        {/* ─── TIMELINE CONTENT ─── */}
                        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', flex: 1 }}>
                            {/* ── Background Layers ── */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 0 }}>
                                {/* Sidebar background that stretches dynamically but sticks horizontally */}
                                <div style={{
                                    position: 'sticky', left: 0, top: 0, height: '100%',
                                    width: `${leftSidebarWidth}px`, background: '#fafbfc',
                                    borderRight: '1px solid #e2e8f0', zIndex: 1
                                }} />

                                {/* Grid Lines + Today Line */}
                                <div style={{ position: 'absolute', top: 0, left: `${leftSidebarWidth}px`, right: 0, bottom: 0 }}>
                                    {months.map((d, j) => {
                                        const left = ((d.getTime() - range.start) / range.duration) * contentWidth;
                                        return <div key={j} style={{ position: 'absolute', left: `${left}px`, top: 0, bottom: 0, width: '1px', background: '#f1f5f9' }} />;
                                    })}
                                    {/* TODAY vertical line */}
                                    <div style={{
                                        position: 'absolute', left: `${todayX}px`, top: 0, bottom: 0,
                                        width: '2px', background: 'linear-gradient(180deg, #ef4444 0%, rgba(239,68,68,0.15) 100%)',
                                        zIndex: 5
                                    }}>
                                        <div style={{
                                            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                                            width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%',
                                            boxShadow: '0 0 8px rgba(239,68,68,0.5)'
                                        }} />
                                    </div>
                                </div>
                            </div>

                            {/* ─── MILESTONE ROWS ─── */}
                            {activeMilestonesData.map((item) => {
                                const milestone = item.milestone;
                                if (!milestone) return null;
                                const mTasks = (item.tasks || []).filter(t => t.status >= TaskStatus.InProgress);
                                const isExpanded = expandedMilestones.has(milestone.id);
                                const mX = ((new Date(milestone.dueDate || "").getTime() - range.start) / range.duration) * contentWidth;
                                const msConfig = getMilestoneStatusConfig(milestone.status);
                                const completedTasks = mTasks.filter(t => t.status === TaskStatus.Completed).length;
                                const progress = mTasks.length > 0 ? Math.round((completedTasks / mTasks.length) * 100) : 0;

                                return (
                                    <div key={milestone.id} style={{
                                        display: 'flex',
                                        borderBottom: `1px solid ${isExpanded ? '#e2e8f0' : '#f1f5f9'}`,
                                        minHeight: '70px', flexShrink: 0,
                                        transition: 'background 0.2s'
                                    }}>
                                        {/* SIDEBAR */}
                                        <div style={{
                                            width: `${leftSidebarWidth}px`, flexShrink: 0,
                                            borderRight: '1px solid #e2e8f0',
                                            background: isExpanded ? '#f8fafc' : '#fafbfc',
                                            position: 'sticky', left: 0, zIndex: 110,
                                            padding: '10px 12px',
                                            display: 'flex', flexDirection: 'column', gap: '6px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div
                                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}
                                                    onClick={(e) => { e.stopPropagation(); scrollToMilestone(mX); }}
                                                >
                                                    <div style={{
                                                        width: '4px', height: '28px', borderRadius: '4px',
                                                        background: `linear-gradient(180deg, ${msConfig.color} 0%, ${msConfig.color}88 100%)`,
                                                        flexShrink: 0
                                                    }} />
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{
                                                            fontSize: '0.82rem', fontWeight: 800, color: '#101828',
                                                            whiteSpace: isExpanded ? 'normal' : 'nowrap',
                                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                                            lineHeight: '1.4'
                                                        }}>
                                                            {milestone.name}
                                                        </div>
                                                        <div style={{ fontSize: '0.62rem', color: '#667085', fontWeight: 600 }}>
                                                            {formatProjectDate(milestone.startDate)} — {formatProjectDate(milestone.dueDate)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleMilestone(milestone.id); }}
                                                    style={{
                                                        background: isExpanded ? '#e2e8f0' : 'transparent', border: 'none',
                                                        cursor: 'pointer', padding: '4px', color: '#64748b',
                                                        borderRadius: '6px', transition: 'all 0.15s', flexShrink: 0
                                                    }}
                                                >
                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </button>
                                            </div>
                                            {/* Status badge + task count */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '12px' }}>
                                                <span style={{
                                                    fontSize: '0.6rem', fontWeight: 800, color: msConfig.color,
                                                    background: msConfig.bg, padding: '2px 8px',
                                                    borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.03em'
                                                }}>
                                                    {msConfig.label}
                                                </span>
                                                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>
                                                    {mTasks.length} tasks
                                                </span>
                                            </div>
                                            {/* Progress bar */}
                                            {mTasks.length > 0 && (
                                                <div style={{ paddingLeft: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{
                                                        flex: 1, height: '4px', borderRadius: '2px',
                                                        background: '#e2e8f0', overflow: 'hidden'
                                                    }}>
                                                        <div style={{
                                                            height: '100%', borderRadius: '2px',
                                                            background: `linear-gradient(90deg, ${msConfig.color} 0%, ${msConfig.color}aa 100%)`,
                                                            width: `${progress}%`, transition: 'width 0.5s ease'
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: msConfig.color }}>{progress}%</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* GRID */}
                                        <div style={{ width: `${contentWidth}px`, flexShrink: 0, position: 'relative', paddingTop: '28px', paddingBottom: isExpanded ? '10px' : '0' }}>
                                            {/* Milestone phase bar */}
                                            {(() => {
                                                const mStart = new Date(milestone.startDate || "").getTime();
                                                const mEnd = new Date(milestone.dueDate || "").getTime();
                                                const left = ((mStart - range.start) / range.duration) * contentWidth;
                                                const width = Math.max(2, ((mEnd - mStart) / range.duration) * contentWidth);

                                                return (
                                                    <div style={{
                                                        position: 'absolute', left: `${left}px`, width: `${width}px`,
                                                        top: '24px', bottom: '8px',
                                                        background: msConfig.barGradient,
                                                        borderRadius: '6px',
                                                        borderLeft: `2.5px solid ${msConfig.color}`,
                                                        borderRight: `2.5px solid ${msConfig.color}`,
                                                        zIndex: 1, cursor: 'pointer',
                                                        transition: 'opacity 0.2s',
                                                        opacity: isExpanded ? 0.15 : 0.7
                                                    }}
                                                        onClick={(e) => { e.stopPropagation(); toggleMilestone(milestone.id); }}
                                                    >
                                                        {/* Phase boundary markers — show dates, positioned outside the bar */}
                                                        <div style={{
                                                            position: 'absolute', left: 0, top: '-16px',
                                                            fontSize: '0.55rem', color: msConfig.color, fontWeight: 800,
                                                            transform: 'translateX(-100%)', whiteSpace: 'nowrap',
                                                            paddingRight: '4px', display: 'flex', alignItems: 'center', gap: '2px'
                                                        }}>{formatProjectDate(milestone.startDate)} ▶</div>
                                                        <div style={{
                                                            position: 'absolute', right: 0, top: '-16px',
                                                            fontSize: '0.55rem', color: msConfig.color, fontWeight: 800,
                                                            transform: 'translateX(100%)', whiteSpace: 'nowrap',
                                                            paddingLeft: '4px', display: 'flex', alignItems: 'center', gap: '2px'
                                                        }}>◀ {formatProjectDate(milestone.dueDate)}</div>

                                                        {!isExpanded && (
                                                            <div style={{
                                                                width: '100%', height: '100%', display: 'flex',
                                                                alignItems: 'center', padding: '0 14px', overflow: 'hidden'
                                                            }}>
                                                                <span style={{
                                                                    fontSize: '0.7rem', fontWeight: 900, color: msConfig.color,
                                                                    textTransform: 'uppercase', letterSpacing: '0.04em',
                                                                    whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'
                                                                }}>
                                                                    {milestone.name}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Task bars */}
                                            {isExpanded && mTasks.map((task) => {
                                                const tStart = new Date(task.startDate || milestone.startDate || "").getTime();
                                                const tEnd = new Date(task.dueDate || task.startDate || milestone.startDate || "").getTime();
                                                const left = ((tStart - range.start) / range.duration) * contentWidth;
                                                const width = Math.max(12, ((tEnd - tStart) / range.duration) * contentWidth);
                                                const cfg = getTaskStatusConfig(task.status);

                                                return (
                                                    <div key={task.id} style={{ height: '32px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                        <div
                                                            onMouseEnter={(e) => setHoverInfo({ task, x: e.clientX, y: e.clientY })}
                                                            onMouseMove={(e) => setHoverInfo({ task, x: e.clientX, y: e.clientY })}
                                                            onMouseLeave={() => setHoverInfo(null)}
                                                            onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                                                            className="timeline-item-bar"
                                                            style={{
                                                                position: 'absolute', left: `${left}px`, width: `${width}px`,
                                                                height: '24px', background: cfg.gradient,
                                                                border: `1.5px solid ${cfg.color}`,
                                                                borderRadius: '8px',
                                                                display: 'flex', alignItems: 'center', gap: '5px',
                                                                padding: '0 8px', cursor: 'pointer', zIndex: 10,
                                                                boxShadow: `0 2px 6px ${cfg.color}15`,
                                                                overflow: 'hidden'
                                                            }}
                                                        >
                                                            <div style={{
                                                                width: '5px', height: '5px', borderRadius: '50%',
                                                                background: cfg.color, flexShrink: 0
                                                            }} />
                                                            <span style={{
                                                                fontSize: '0.62rem', color: cfg.color, fontWeight: 800,
                                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                            }}>
                                                                {task.name}
                                                            </span>
                                                        </div>
                                                        {isNearDeadline(task) && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                left: `${left + width + 4}px`,
                                                                top: '50%', transform: 'translateY(-50%)',
                                                                width: '8px', height: '8px', borderRadius: '50%',
                                                                background: '#ef4444', border: '1.5px solid white',
                                                                boxShadow: '0 0 6px #ef4444',
                                                                animation: 'warningBlink 1s ease-in-out infinite',
                                                                zIndex: 15
                                                            }} title="Deadline is within 3 days or overdue!" />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* ─── ORPHAN TASKS ─── */}
                            {activeOrphanTasks.length > 0 && (
                                <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', minHeight: '50px', flexShrink: 0 }}>
                                    <div style={{
                                        width: `${leftSidebarWidth}px`, flexShrink: 0,
                                        borderRight: '1px solid #e2e8f0',
                                        background: isOrphanExpanded ? '#f8fafc' : '#fafbfc',
                                        position: 'sticky', left: 0, zIndex: 110,
                                        padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '4px', height: '20px', borderRadius: '4px', background: 'linear-gradient(180deg, #94a3b8 0%, #cbd5e1 100%)' }} />
                                                <div>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569' }}>General Activities</span>
                                                    <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600 }}>Independent research tasks</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setIsOrphanExpanded(!isOrphanExpanded); }}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8', borderRadius: '6px' }}
                                            >
                                                {isOrphanExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ width: `${contentWidth}px`, flexShrink: 0, position: 'relative', padding: isOrphanExpanded ? '10px 0' : '0' }}>
                                        {isOrphanExpanded && activeOrphanTasks.map((task) => {
                                            const tStart = new Date(task.startDate || project.startDate || "").getTime();
                                            const tEnd = new Date(task.dueDate || task.startDate || project.startDate || "").getTime();
                                            const left = ((tStart - range.start) / range.duration) * contentWidth;
                                            const width = Math.max(12, ((tEnd - tStart) / range.duration) * contentWidth);
                                            const cfg = getTaskStatusConfig(task.status);

                                            return (
                                                <div key={task.id} style={{ height: '32px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    <div
                                                        onMouseEnter={(e) => setHoverInfo({ task, x: e.clientX, y: e.clientY })}
                                                        onMouseMove={(e) => setHoverInfo({ task, x: e.clientX, y: e.clientY })}
                                                        onMouseLeave={() => setHoverInfo(null)}
                                                        onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                                                        className="timeline-item-bar"
                                                        style={{
                                                            position: 'absolute', left: `${left}px`, width: `${width}px`,
                                                            height: '24px', background: cfg.gradient,
                                                            border: `1.5px solid ${cfg.color}`,
                                                            borderRadius: '8px',
                                                            display: 'flex', alignItems: 'center', gap: '5px',
                                                            padding: '0 8px', cursor: 'pointer', zIndex: 10,
                                                            overflow: 'hidden'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '5px', height: '5px', borderRadius: '50%',
                                                            background: cfg.color, flexShrink: 0
                                                        }} />
                                                        <span style={{
                                                            fontSize: '0.62rem', color: cfg.color, fontWeight: 800,
                                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                        }}>
                                                            {task.name}
                                                        </span>
                                                    </div>
                                                    {isNearDeadline(task) && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            left: `${left + width + 4}px`,
                                                            top: '50%', transform: 'translateY(-50%)',
                                                            width: '8px', height: '8px', borderRadius: '50%',
                                                            background: '#ef4444', border: '1.5px solid white',
                                                            boxShadow: '0 0 6px #ef4444',
                                                            animation: 'warningBlink 1s ease-in-out infinite',
                                                            zIndex: 15
                                                        }} title="Deadline is within 3 days or overdue!" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── TOOLTIP ─── */}
            {hoverInfo && (() => {
                const cfg = getTaskStatusConfig(hoverInfo.task.status);
                const StatusIcon = cfg.icon;
                return (
                    <div style={{
                        position: 'fixed', top: hoverInfo.y + 16, left: hoverInfo.x + 16,
                        background: 'rgba(15, 23, 42, 0.95)', color: 'white',
                        padding: '14px 16px', borderRadius: '14px', zIndex: 2000, width: '300px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(20px)', pointerEvents: 'none',
                        animation: 'tooltipIn 0.15s ease-out'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <div style={{
                                width: '28px', height: '28px', borderRadius: '8px',
                                background: `${cfg.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <StatusIcon size={14} color={cfg.color} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {hoverInfo.task.name}
                                </div>
                                <div style={{ fontSize: '0.6rem', color: cfg.color, fontWeight: 800, textTransform: 'uppercase' }}>
                                    {cfg.label}
                                </div>
                            </div>
                        </div>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            fontSize: '0.72rem', color: '#94a3b8',
                            padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.08)'
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={11} /> Schedule
                            </span>
                            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                                {formatProjectDate(hoverInfo.task.startDate)} — {formatProjectDate(hoverInfo.task.dueDate)}
                            </span>
                        </div>
                        {hoverInfo.task.description && (
                            <div style={{
                                borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '4px',
                                paddingTop: '8px', fontSize: '0.65rem', color: '#cbd5e1',
                                lineHeight: 1.5, maxHeight: '60px', overflow: 'hidden'
                            }}>
                                {hoverInfo.task.description}
                            </div>
                        )}
                    </div>
                );
            })()}

            <style>{`
                @keyframes tooltipIn {
                    from { opacity: 0; transform: translateY(4px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .timeline-item-bar {
                    transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
                }
                .timeline-item-bar:hover {
                    transform: scaleY(1.15) scaleX(1.01);
                    box-shadow: 0 6px 20px rgba(0,0,0,0.12) !important;
                    z-index: 20 !important;
                    filter: brightness(1.02);
                }
                .timeline-item-bar:active {
                    transform: scaleY(1.05);
                }
                .custom-scrollbar-thin::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar-thin::-webkit-scrollbar-track {
                    background: #f8fafc;
                    border-radius: 3px;
                }
                .custom-scrollbar-thin::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 3px;
                }
                .custom-scrollbar-thin::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}</style>
        </div>
    );
};

export default ProjectTimeline;
